import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  automatedResearchSnapshotsTable,
  automatedResearchSourcesTable,
} from "@workspace/db/schema";

import * as automationRepositoryModule from "./researchAutomationRepository";

import {
  buildClaimJobsStatement,
  buildClaimTriggerEventsStatement,
  buildCurrentSnapshotStatement,
  buildOwnedJobStatement,
  buildRefreshBucket,
  buildRequeueExpiredJobsStatement,
  ResearchAutomationRepository,
  sanitizeStoredFailure,
} from "./researchAutomationRepository";
import {
  normalizeHoldingIdentity,
  reconcilePortfolioHoldings,
  type ReconciliationCompany,
  type ReconciliationHolding,
  type ReconciliationJob,
  type ReconciliationRepository,
  type ReconciliationSnapshot,
  type ReconciliationTarget,
  type ReconciliationTransaction,
} from "./researchReconciler";

interface StoredCompany extends ReconciliationCompany {
  description: string | null;
  website: string | null;
}

interface StoredSnapshot extends ReconciliationSnapshot {
  jobStatus: "succeeded" | "partial" | "failed" | "dead_letter";
  version: number;
}

class MemoryRepository implements ReconciliationRepository {
  portfolioOwners = new Map<number, string>();
  holdings = new Map<number, ReconciliationHolding[]>();
  companies: StoredCompany[] = [];
  targets: ReconciliationTarget[] = [];
  jobs: ReconciliationJob[] = [];
  snapshots: StoredSnapshot[] = [];
  manual = {
    theses: ["owner thesis"],
    notes: ["owner note"],
    risks: ["owner risk"],
    catalysts: ["owner catalyst"],
    invalidations: ["owner invalidation"],
    assumptions: ["owner assumption"],
  };
  reconciliationOperations: string[] = [];

  private nextCompanyId = 1;
  private nextTargetId = 1;
  private nextJobId = 1;

  addPortfolio(
    userId: string,
    portfolioId: number,
    holdings: ReconciliationHolding[],
  ) {
    this.portfolioOwners.set(portfolioId, userId);
    this.holdings.set(portfolioId, holdings);
  }

  async transaction<T>(
    userId: string,
    portfolioId: number,
    operation: (tx: ReconciliationTransaction) => Promise<T>,
  ): Promise<T> {
    if (this.portfolioOwners.get(portfolioId) !== userId) {
      throw new Error("portfolio_not_found");
    }

    const tx: ReconciliationTransaction = {
      lockIdentity: async (normalizedIdentityKey: string) => {
        this.reconciliationOperations.push(`lock:${normalizedIdentityKey}`);
      },
      listHoldings: async () => [...(this.holdings.get(portfolioId) ?? [])],
      listTargets: async () =>
        this.targets.filter(
          (target) =>
            target.userId === userId && target.portfolioId === portfolioId,
        ),
      findCompany: async ({ normalizedIdentityKey, ticker }) => {
        this.reconciliationOperations.push(
          `find:${normalizedIdentityKey}:${ticker}`,
        );
        const exact = this.companies.find(
          (company) =>
            company.userId === userId &&
            company.normalizedIdentityKey === normalizedIdentityKey,
        );
        if (exact) return exact;
        return (
          this.companies.find(
            (company) => company.userId === userId && company.ticker === ticker,
          ) ?? null
        );
      },
      createCompany: async (input) => {
        const company: StoredCompany = {
          id: this.nextCompanyId++,
          userId,
          ticker: input.ticker,
          name: input.name,
          exchange: input.exchange,
          sector: input.sector,
          isin: input.isin,
          normalizedIdentityKey: input.normalizedIdentityKey,
          securityType: input.securityType,
          identityStatus: input.identityStatus,
          identityConfidence: input.identityConfidence,
          automationEnabled: true,
          isArchived: false,
          description: null,
          website: null,
        };
        this.companies.push(company);
        return company;
      },
      updateCompanyAutomation: async (companyId, input) => {
        const company = this.companies.find(
          (candidate) =>
            candidate.id === companyId && candidate.userId === userId,
        );
        if (!company) throw new Error("company_not_found");
        Object.assign(company, input, { isArchived: false });
        return company;
      },
      createTarget: async (input) => {
        const target: ReconciliationTarget = {
          id: this.nextTargetId++,
          userId,
          portfolioId,
          companyId: input.companyId,
          ticker: input.ticker,
          holdingFingerprint: input.holdingFingerprint,
          isActive: true,
          firstSeenAt: input.now,
          lastSeenAt: input.now,
          removedAt: null,
        };
        this.targets.push(target);
        return target;
      },
      updateTarget: async (targetId, input) => {
        const target = this.targets.find(
          (candidate) =>
            candidate.id === targetId &&
            candidate.userId === userId &&
            candidate.portfolioId === portfolioId,
        );
        if (!target) throw new Error("target_not_found");
        Object.assign(target, input);
        return target;
      },
      latestSuccessfulSnapshot: async (companyId) =>
        this.snapshots
          .filter(
            (snapshot) =>
              snapshot.userId === userId &&
              snapshot.companyId === companyId &&
              snapshot.jobStatus === "succeeded",
          )
          .sort((left, right) => right.version - left.version)[0] ?? null,
      hasPendingJob: async (companyId) =>
        this.jobs.some(
          (job) =>
            job.userId === userId &&
            job.companyId === companyId &&
            (job.status === "queued" || job.status === "running"),
        ),
      enqueueJob: async (input) => {
        const existing = this.jobs.find(
          (job) =>
            job.userId === userId &&
            job.idempotencyKey === input.idempotencyKey,
        );
        if (existing) return { job: existing, created: false };
        const job: ReconciliationJob = {
          id: this.nextJobId++,
          userId,
          companyId: input.companyId,
          trigger: input.trigger,
          idempotencyKey: input.idempotencyKey,
          status: "queued",
        };
        this.jobs.push(job);
        return { job, created: true };
      },
      hasActiveTarget: async (companyId) =>
        this.targets.some(
          (target) =>
            target.userId === userId &&
            target.companyId === companyId &&
            target.isActive,
        ),
      markReconciled: async () => undefined,
    };

    return operation(tx);
  }
}

function holding(
  input: Partial<ReconciliationHolding> = {},
): ReconciliationHolding {
  return {
    ticker: "RELIANCE",
    name: "Reliance Industries Limited",
    exchange: "NSE",
    sector: "Energy",
    isin: "INE002A01018",
    marketPrice: 3012.5,
    previousClose: 2991.1,
    ...input,
  };
}

const firstRunAt = new Date("2026-08-14T06:00:00.000Z");

test("reconcile: a new resolved holding creates a company, target, and one baseline job", async () => {
  const repository = new MemoryRepository();
  repository.addPortfolio("user-a", 10, [holding()]);

  const result = await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: firstRunAt,
    timezone: "Asia/Kolkata",
  });

  assert.equal(repository.companies.length, 1);
  assert.equal(repository.companies[0]?.identityStatus, "resolved");
  assert.equal(repository.targets.length, 1);
  assert.equal(repository.targets[0]?.isActive, true);
  assert.equal(repository.jobs.length, 1);
  assert.equal(repository.jobs[0]?.trigger, "holding_added");
  assert.deepEqual(result.memberships, {
    new: ["RELIANCE"],
    reactivated: [],
    changed: [],
    unchanged: [],
    removed: [],
  });
});

test("reconcile: repeating the same holdings is idempotent", async () => {
  const repository = new MemoryRepository();
  repository.addPortfolio("user-a", 10, [holding()]);

  await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: firstRunAt,
  });
  const second = await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: new Date("2026-08-14T06:05:00.000Z"),
  });

  assert.equal(repository.companies.length, 1);
  assert.equal(repository.targets.length, 1);
  assert.equal(repository.jobs.length, 1);
  assert.deepEqual(second.memberships.unchanged, ["RELIANCE"]);
});

test("reconcile: the same security in two portfolios reuses one company and one baseline need", async () => {
  const repository = new MemoryRepository();
  repository.addPortfolio("user-a", 10, [holding()]);
  repository.addPortfolio("user-a", 11, [holding({ sector: "Conglomerate" })]);

  await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: firstRunAt,
  });
  await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 11,
    now: firstRunAt,
  });

  assert.equal(repository.companies.length, 1);
  assert.equal(repository.targets.length, 2);
  assert.equal(repository.jobs.length, 1);
});

test("reconcile: normalized ISIN is preferred over ticker identity", () => {
  assert.deepEqual(
    normalizeHoldingIdentity(holding({ isin: " ine002a01018 " })),
    {
      isin: "INE002A01018",
      normalizedIdentityKey: "isin:INE002A01018",
    },
  );
});

test("reconcile: ambiguous identity remains visible as needs_identity without a job", async () => {
  const repository = new MemoryRepository();
  repository.addPortfolio("user-a", 10, [
    holding({ ticker: "UNKNOWN1", name: "Unknown security", isin: null }),
  ]);

  await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: firstRunAt,
  });

  assert.equal(repository.companies[0]?.identityStatus, "needs_identity");
  assert.equal(repository.targets[0]?.isActive, true);
  assert.equal(repository.jobs.length, 0);
});

test("reconcile: removal deactivates membership without deleting company or owner research", async () => {
  const repository = new MemoryRepository();
  repository.addPortfolio("user-a", 10, [holding()]);
  await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: firstRunAt,
  });
  const company = repository.companies[0]!;
  repository.snapshots.push({
    userId: "user-a",
    companyId: company.id,
    validUntil: new Date("2026-09-01T00:00:00.000Z"),
    jobStatus: "succeeded",
    version: 1,
  });
  const manualBefore = structuredClone(repository.manual);
  repository.addPortfolio("user-a", 10, []);

  const result = await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: new Date("2026-08-15T06:00:00.000Z"),
  });

  assert.equal(repository.targets[0]?.isActive, false);
  assert.ok(repository.targets[0]?.removedAt instanceof Date);
  assert.equal(repository.companies.length, 1);
  assert.equal(repository.snapshots.length, 1);
  assert.deepEqual(repository.manual, manualBefore);
  assert.deepEqual(result.memberships.removed, ["RELIANCE"]);
  assert.equal(result.effectiveCoverage.get(company.id), false);
});

test("reconcile: removal from one of two portfolios leaves effective coverage active", async () => {
  const repository = new MemoryRepository();
  repository.addPortfolio("user-a", 10, [holding()]);
  repository.addPortfolio("user-a", 11, [holding()]);
  await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: firstRunAt,
  });
  await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 11,
    now: firstRunAt,
  });
  repository.addPortfolio("user-a", 10, []);

  const result = await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: new Date("2026-08-15T06:00:00.000Z"),
  });

  assert.equal(result.effectiveCoverage.get(repository.companies[0]!.id), true);
  assert.equal(
    repository.targets.filter((target) => target.isActive).length,
    1,
  );
});

describe("reconcile: re-adding a holding", () => {
  async function removedRepository(snapshot: StoredSnapshot | null) {
    const repository = new MemoryRepository();
    repository.addPortfolio("user-a", 10, [holding()]);
    await reconcilePortfolioHoldings(repository, {
      userId: "user-a",
      portfolioId: 10,
      now: firstRunAt,
    });
    repository.jobs[0]!.status = snapshot ? "succeeded" : "failed";
    if (snapshot) repository.snapshots.push(snapshot);
    repository.addPortfolio("user-a", 10, []);
    await reconcilePortfolioHoldings(repository, {
      userId: "user-a",
      portfolioId: 10,
      now: new Date("2026-08-15T05:00:00.000Z"),
    });
    repository.addPortfolio("user-a", 10, [holding()]);
    return repository;
  }

  test("queues freshness when a successful snapshot is missing", async () => {
    const repository = await removedRepository(null);
    const result = await reconcilePortfolioHoldings(repository, {
      userId: "user-a",
      portfolioId: 10,
      now: new Date("2026-08-15T06:00:00.000Z"),
      timezone: "Asia/Kolkata",
    });
    assert.deepEqual(result.memberships.reactivated, ["RELIANCE"]);
    assert.equal(repository.jobs.length, 2);
    assert.equal(repository.jobs[1]?.trigger, "portfolio_reconciled");
  });

  test("queues freshness when the last successful snapshot is stale", async () => {
    const repository = await removedRepository({
      userId: "user-a",
      companyId: 1,
      validUntil: new Date("2026-08-15T05:30:00.000Z"),
      jobStatus: "succeeded",
      version: 1,
    });
    await reconcilePortfolioHoldings(repository, {
      userId: "user-a",
      portfolioId: 10,
      now: new Date("2026-08-15T06:00:00.000Z"),
    });
    assert.equal(repository.jobs.length, 2);
  });

  test("does not queue when the last successful snapshot is current", async () => {
    const repository = await removedRepository({
      userId: "user-a",
      companyId: 1,
      validUntil: new Date("2026-08-16T06:00:00.000Z"),
      jobStatus: "succeeded",
      version: 1,
    });
    await reconcilePortfolioHoldings(repository, {
      userId: "user-a",
      portfolioId: 10,
      now: new Date("2026-08-15T06:00:00.000Z"),
    });
    assert.equal(repository.jobs.length, 1);
  });
});

test("reconcile: another tenant's matching company is never reused", async () => {
  const repository = new MemoryRepository();
  repository.companies.push({
    id: 50,
    userId: "user-b",
    ticker: "RELIANCE",
    name: "Other tenant company",
    exchange: "NSE",
    sector: null,
    isin: "INE002A01018",
    normalizedIdentityKey: "isin:INE002A01018",
    securityType: "equity",
    identityStatus: "resolved",
    identityConfidence: 1,
    automationEnabled: true,
    isArchived: false,
    description: "private profile",
    website: "https://private.invalid",
  });
  repository.addPortfolio("user-a", 10, [holding()]);

  await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: firstRunAt,
  });

  assert.equal(repository.companies.length, 2);
  assert.equal(
    repository.companies.find((company) => company.userId === "user-a")?.id,
    1,
  );
  assert.equal(repository.targets[0]?.companyId, 1);
});

test("reconcile: automated updates preserve non-null manual company profile fields", async () => {
  const repository = new MemoryRepository();
  repository.companies.push({
    id: 7,
    userId: "user-a",
    ticker: "RELIANCE",
    name: "Owner supplied name",
    exchange: "BSE",
    sector: "Owner sector",
    isin: null,
    normalizedIdentityKey: null,
    securityType: "unknown",
    identityStatus: "needs_identity",
    identityConfidence: 0,
    automationEnabled: true,
    isArchived: true,
    description: "Owner description",
    website: "https://owner.example",
  });
  repository.addPortfolio("user-a", 10, [holding()]);

  await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: firstRunAt,
  });

  const company = repository.companies[0]!;
  assert.equal(company.name, "Owner supplied name");
  assert.equal(company.exchange, "BSE");
  assert.equal(company.sector, "Owner sector");
  assert.equal(company.description, "Owner description");
  assert.equal(company.website, "https://owner.example");
  assert.equal(company.isin, "INE002A01018");
  assert.equal(company.identityStatus, "resolved");
  assert.equal(company.isArchived, false);
});

test("reconcile review: conflicting stable ISIN preserves old research and requires identity review", async () => {
  const repository = new MemoryRepository();
  repository.companies.push({
    id: 7,
    userId: "user-a",
    ticker: "RELIANCE",
    name: "Owner supplied name",
    exchange: "NSE",
    sector: "Owner sector",
    isin: "INE002A01018",
    normalizedIdentityKey: "isin:INE002A01018",
    securityType: "equity",
    identityStatus: "resolved",
    identityConfidence: 1,
    automationEnabled: true,
    isArchived: false,
    description: "Owner description",
    website: "https://owner.example",
  });
  repository.addPortfolio("user-a", 10, [holding({ isin: "INE999A01019" })]);
  const manualBefore = structuredClone(repository.manual);

  const result = await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: firstRunAt,
  });

  const company = repository.companies[0]!;
  assert.equal(company.isin, "INE002A01018");
  assert.equal(company.normalizedIdentityKey, "isin:INE002A01018");
  assert.equal(company.identityStatus, "needs_identity");
  assert.deepEqual(result.needsIdentity, ["RELIANCE"]);
  assert.equal(repository.jobs.length, 0);
  assert.deepEqual(repository.manual, manualBefore);
});

test("reconcile review: exact identity outranks a conflicting ticker fallback", async () => {
  const repository = new MemoryRepository();
  repository.companies.push(
    {
      id: 7,
      userId: "user-a",
      ticker: "RELIANCE",
      name: "Old ticker owner",
      exchange: "NSE",
      sector: null,
      isin: "INE999A01019",
      normalizedIdentityKey: "isin:INE999A01019",
      securityType: "equity",
      identityStatus: "resolved",
      identityConfidence: 1,
      automationEnabled: true,
      isArchived: false,
      description: "Preserve old manual research",
      website: null,
    },
    {
      id: 8,
      userId: "user-a",
      ticker: "OLDALIAS",
      name: "Exact ISIN owner",
      exchange: "NSE",
      sector: null,
      isin: "INE002A01018",
      normalizedIdentityKey: "isin:INE002A01018",
      securityType: "equity",
      identityStatus: "resolved",
      identityConfidence: 1,
      automationEnabled: true,
      isArchived: false,
      description: "Reuse this research",
      website: null,
    },
  );
  repository.addPortfolio("user-a", 10, [holding()]);

  await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: firstRunAt,
  });

  assert.equal(repository.targets[0]?.companyId, 8);
  assert.equal(repository.companies[0]?.identityStatus, "resolved");
  assert.equal(repository.companies[0]?.isin, "INE999A01019");
});

test("reconcile review: newly discovered ISIN upgrades a ticker-derived identity and job key", async () => {
  const repository = new MemoryRepository();
  repository.companies.push({
    id: 7,
    userId: "user-a",
    ticker: "RELIANCE",
    name: "Owner supplied name",
    exchange: "NSE",
    sector: "Owner sector",
    isin: null,
    normalizedIdentityKey: "security:NSE:RELIANCE",
    securityType: "equity",
    identityStatus: "resolved",
    identityConfidence: 0.75,
    automationEnabled: true,
    isArchived: false,
    description: "Owner description",
    website: "https://owner.example",
  });
  repository.addPortfolio("user-a", 10, [holding()]);

  await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: firstRunAt,
  });

  assert.equal(repository.companies[0]?.isin, "INE002A01018");
  assert.equal(
    repository.companies[0]?.normalizedIdentityKey,
    "isin:INE002A01018",
  );
  assert.match(
    repository.jobs[0]?.idempotencyKey ?? "",
    /^user-a:isin:INE002A01018:/,
  );
});

test("reconcile review: identity advisory lock is acquired before company lookup", async () => {
  const repository = new MemoryRepository();
  repository.addPortfolio("user-a", 10, [holding()]);

  await reconcilePortfolioHoldings(repository, {
    userId: "user-a",
    portfolioId: 10,
    now: firstRunAt,
  });

  assert.deepEqual(repository.reconciliationOperations.slice(0, 2), [
    "lock:isin:INE002A01018",
    "find:isin:INE002A01018:RELIANCE",
  ]);
});

test("reconcile review: all unique identity locks use one sorted pre-lookup order", async () => {
  const alpha = holding();
  const beta = holding({
    ticker: "TCS",
    name: "Tata Consultancy Services Limited",
    isin: "INE009A01021",
  });
  const duplicateAlpha = holding({
    ticker: "RIL",
    name: "Same identity under another ticker alias",
  });
  const repositories = [new MemoryRepository(), new MemoryRepository()];
  repositories[0]!.addPortfolio("user-a", 10, [beta, alpha, duplicateAlpha]);
  repositories[1]!.addPortfolio("user-a", 10, [duplicateAlpha, alpha, beta]);

  for (const repository of repositories) {
    await reconcilePortfolioHoldings(repository, {
      userId: "user-a",
      portfolioId: 10,
      now: firstRunAt,
    });
  }

  const expectedLocks = ["lock:isin:INE002A01018", "lock:isin:INE009A01021"];
  for (const repository of repositories) {
    const operations = repository.reconciliationOperations;
    const locks = operations.filter((operation) =>
      operation.startsWith("lock:"),
    );
    assert.deepEqual(locks, expectedLocks);
    assert.deepEqual(operations.slice(0, expectedLocks.length), expectedLocks);
    assert.equal(
      operations.findIndex((operation) => operation.startsWith("find:")),
      expectedLocks.length,
    );
  }
});

function compiled(statement: SQL): { sql: string; params: unknown[] } {
  const query = new PgDialect().sqlToQuery(statement);
  return { sql: query.sql.replace(/\s+/g, " ").trim(), params: query.params };
}

function requiredSqlBuilder(
  name: string,
  ...args: unknown[]
): { sql: string; params: unknown[] } {
  const candidate = (
    automationRepositoryModule as unknown as Record<string, unknown>
  )[name];
  assert.equal(typeof candidate, "function", `${name} must be exported`);
  return compiled((candidate as (...values: unknown[]) => SQL)(...args));
}

test("repository: trigger and job claims use one atomic skip-locked CTE", () => {
  const input = {
    workerId: "worker-a",
    limit: 8,
    now: firstRunAt,
    leaseExpiresAt: new Date("2026-08-14T06:10:00.000Z"),
  };
  for (const statement of [
    buildClaimTriggerEventsStatement(input),
    buildClaimJobsStatement(input),
  ]) {
    const query = compiled(statement);
    assert.match(query.sql, /^with "candidates" as \(/i);
    assert.match(query.sql, /for update skip locked/i);
    assert.match(query.sql, /order by "priority" desc/i);
    assert.match(query.sql, /update .* from "candidates"/i);
    assert.match(query.sql, /returning/i);
    assert.match(query.sql, /"attempts" = .*"attempts" \+ 1/i);
    assert.equal(query.sql.match(/"attempts"\s*=/gi)?.length, 1);
    assert.equal(
      query.params.filter((value) => value === "worker-a").length,
      1,
    );
  }
});

test("repository review: identity lookup and reconciliation writes are race-safe SQL", () => {
  const lock = requiredSqlBuilder("buildIdentityAdvisoryLockStatement", {
    userId: "user-a",
    normalizedIdentityKey: "isin:INE002A01018",
  });
  assert.match(lock.sql, /pg_advisory_xact_lock/i);
  assert.match(lock.sql, /hashtextextended/i);
  assert.ok(lock.params.includes("user-a:isin:INE002A01018"));

  const exact = requiredSqlBuilder("buildFindExactIdentityCompanyStatement", {
    userId: "user-a",
    normalizedIdentityKey: "isin:INE002A01018",
  });
  assert.match(exact.sql, /"normalized_identity_key" =/i);
  assert.doesNotMatch(exact.sql, /\sor\s/i);

  const fallback = requiredSqlBuilder(
    "buildFindTickerFallbackCompanyStatement",
    {
      userId: "user-a",
      ticker: "RELIANCE",
    },
  );
  assert.match(fallback.sql, /"ticker" =/i);

  const companyInsert = requiredSqlBuilder("buildCreateCompanyStatement", {
    userId: "user-a",
    ticker: "RELIANCE",
    name: "Reliance Industries Limited",
    exchange: "NSE",
    sector: "Energy",
    isin: "INE002A01018",
    normalizedIdentityKey: "isin:INE002A01018",
    securityType: "equity",
    identityStatus: "resolved",
    identityConfidence: 1,
  });
  assert.match(
    companyInsert.sql,
    /on conflict \("user_id", "ticker"\) do nothing/i,
  );
  assert.match(companyInsert.sql, /returning \*/i);

  const targetUpsert = requiredSqlBuilder(
    "buildUpsertCoverageTargetStatement",
    {
      userId: "user-a",
      portfolioId: 10,
      companyId: 7,
      ticker: "RELIANCE",
      holdingFingerprint: "f".repeat(64),
      now: firstRunAt,
    },
  );
  assert.match(
    targetUpsert.sql,
    /on conflict \("user_id", "portfolio_id", "ticker"\) do update/i,
  );
  assert.match(targetUpsert.sql, /"is_active" = true/i);
  assert.match(targetUpsert.sql, /"removed_at" = null/i);
});

test("repository: expired job recovery does not increment attempts and dead-letters exhausted jobs", () => {
  const query = compiled(buildRequeueExpiredJobsStatement(firstRunAt));
  assert.match(query.sql, /where .*"status" = .*running/i);
  assert.match(query.sql, /"lease_expires_at" <=/i);
  assert.match(
    query.sql,
    /case when .*"attempts" >= .*"max_attempts" then .*dead_letter/i,
  );
  assert.doesNotMatch(query.sql, /"attempts"\s*=/i);
});

test("repository: current snapshots require a succeeded job and owned reads include user scope", () => {
  const current = compiled(buildCurrentSnapshotStatement("user-a", 22));
  assert.match(
    current.sql,
    /"research_automation_jobs".*"status" = .*succeeded/i,
  );
  assert.match(current.sql, /"automated_research_snapshots".*"user_id" =/i);
  assert.ok(current.params.includes("user-a"));

  const ownedJob = compiled(buildOwnedJobStatement("user-a", 99));
  assert.match(ownedJob.sql, /"research_automation_jobs".*"user_id" =/i);
  assert.ok(ownedJob.params.includes("user-a"));
});

test("repository: current snapshot rows are mapped to the public camel-case contract", async () => {
  const raw = {
    id: 5,
    user_id: "user-a",
    company_id: 22,
    job_id: 9,
    version: 2,
    schema_version: "1",
    security_type: "equity",
    template_version: "equity-v1",
    payload: {},
    quality: {},
    change_set: {},
    evidence_strength: "moderate",
    fresh_at: firstRunAt,
    valid_until: new Date("2026-08-15T06:00:00.000Z"),
    provider: "test",
    model: "test-model",
    input_tokens: 10,
    output_tokens: 20,
    latency_ms: 30,
    evidence_count: 2,
    primary_evidence_count: 1,
    content_hash: "a".repeat(64),
    published_at: firstRunAt,
  };
  const database = {
    execute: async () => ({ rows: [raw] }),
  };
  const repository = new ResearchAutomationRepository(database as never);

  const snapshot = await repository.getCurrentSnapshot("user-a", 22);

  assert.equal(snapshot?.userId, "user-a");
  assert.equal(snapshot?.companyId, 22);
  assert.equal(snapshot?.jobId, 9);
  assert.equal(snapshot?.validUntil.toISOString(), "2026-08-15T06:00:00.000Z");
});

test("repository: stored failures are bounded and control characters are removed", () => {
  const failure = sanitizeStoredFailure({
    code: "UPSTREAM\nSECRET",
    message: `provider\u0000 failed\n${"x".repeat(1200)}`,
  });
  assert.equal(failure.code, "database_error");
  assert.equal(failure.message.includes("\n"), false);
  assert.equal(failure.message.includes("\u0000"), false);
  assert.equal(failure.message.length, 1000);
});

test("repository review: retry, dead-letter, and publish SQL require the active lease owner", () => {
  const fence = {
    userId: "user-a",
    jobId: 9,
    companyId: 7,
    workerId: "worker-a",
    now: firstRunAt,
  };
  const retry = requiredSqlBuilder("buildMarkJobRetryStatement", {
    ...fence,
    retryAt: new Date("2026-08-14T06:30:00.000Z"),
    failure: { code: "provider_timeout", message: "Timed out." },
  });
  const deadLetter = requiredSqlBuilder("buildMarkJobDeadLetterStatement", {
    ...fence,
    failure: { code: "provider_timeout", message: "Timed out." },
  });
  for (const query of [retry, deadLetter]) {
    assert.match(query.sql, /"user_id" =/i);
    assert.match(query.sql, /"status" = .*running/i);
    assert.match(query.sql, /"worker_id" =/i);
    assert.match(query.sql, /"lease_expires_at" >/i);
    assert.ok(query.params.includes("user-a"));
    assert.ok(query.params.includes("worker-a"));
  }

  const jobLock = requiredSqlBuilder("buildFencedJobLockStatement", fence);
  assert.match(jobLock.sql, /for update/i);
  assert.match(jobLock.sql, /"status" = .*running/i);
  assert.match(jobLock.sql, /"worker_id" =/i);
  assert.match(jobLock.sql, /"lease_expires_at" >/i);

  const companyLock = requiredSqlBuilder(
    "buildOwnedCompanyLockStatement",
    "user-a",
    7,
  );
  assert.match(companyLock.sql, /from "research_companies"/i);
  assert.match(companyLock.sql, /for update/i);
  assert.ok(companyLock.params.includes("user-a"));
});

test("repository review: stale worker cannot dead-letter a reclaimed job", async () => {
  const database = {
    execute: async () => ({ rows: [] }),
  };
  const repository = new ResearchAutomationRepository(database as never);

  await assert.rejects(
    repository.markJobDeadLetter({
      userId: "user-a",
      jobId: 9,
      workerId: "stale-worker",
      now: firstRunAt,
      failure: { code: "provider_timeout", message: "Timed out." },
    } as never),
    /lease is no longer owned/i,
  );
});

function publicationFixture() {
  return {
    job: {
      id: 9,
      userId: "user-a",
      companyId: 7,
      status: "running",
      workerId: "worker-a",
      leaseExpiresAt: new Date("2026-08-14T06:10:00.000Z"),
    } as never,
    bundle: {
      payload: { securityType: "equity" } as never,
      schemaVersion: "1",
      templateVersion: "equity-v1",
      quality: {},
      changeSet: {},
      freshAt: firstRunAt,
      validUntil: new Date("2026-08-15T06:00:00.000Z"),
      provider: "test",
      model: "test-model",
      contentHash: "a".repeat(64),
      sources: [],
    },
    validation: { evidenceStrength: "moderate" as const },
    fence: { workerId: "worker-a", now: firstRunAt },
  };
}

function publicationDatabase(input: {
  existingJobSnapshotId?: number;
  existingContentSnapshotId?: number;
  jobLeaseOwned?: boolean;
}) {
  const operations: string[] = [];
  let insertedSnapshot: Record<string, unknown> | null = null;

  const tx = {
    execute: async (statement: SQL) => {
      const query = compiled(statement).sql;
      if (
        /from "research_automation_jobs"/i.test(query) &&
        /for update/i.test(query)
      ) {
        operations.push("lock-job");
        return { rows: input.jobLeaseOwned === false ? [] : [{ id: 9 }] };
      }
      if (
        /from "research_companies"/i.test(query) &&
        /for update/i.test(query)
      ) {
        operations.push("lock-company");
        return { rows: [{ id: 7 }] };
      }
      if (/"job_id" =/i.test(query)) {
        operations.push("find-job-snapshot");
        return {
          rows: input.existingJobSnapshotId
            ? [{ id: input.existingJobSnapshotId }]
            : [],
        };
      }
      if (/"content_hash" =/i.test(query)) {
        operations.push("find-content-snapshot");
        return {
          rows: input.existingContentSnapshotId
            ? [{ id: input.existingContentSnapshotId }]
            : [],
        };
      }
      if (/order by "version" desc/i.test(query)) {
        operations.push("read-latest-version");
        return { rows: [{ version: 3 }] };
      }
      if (/update "research_automation_jobs"/i.test(query)) {
        operations.push("complete-job");
        return { rows: [{ id: 9 }] };
      }
      throw new Error(`Unexpected publication SQL: ${query}`);
    },
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        if (table === automatedResearchSnapshotsTable) {
          operations.push("insert-snapshot");
          insertedSnapshot = values;
          return { returning: async () => [{ id: 77 }] };
        }
        if (table === automatedResearchSourcesTable) {
          operations.push("insert-sources");
          return Promise.resolve();
        }
        throw new Error("Unexpected publication table");
      },
    }),
  };
  return {
    database: {
      transaction: async <T>(
        operation: (transaction: typeof tx) => Promise<T>,
      ) => operation(tx),
    },
    operations,
    insertedSnapshot: () => insertedSnapshot,
  };
}

function statefulPublicationDatabase() {
  const operations: string[] = [];
  const state = {
    jobStatus: "running" as "running" | "succeeded",
    snapshotId: undefined as number | undefined,
    snapshotInsertions: 0,
    sourceInsertions: 0,
    completionMutations: 0,
    jobLocks: 0,
    companyLocks: 0,
  };
  const tx = {
    execute: async (statement: SQL) => {
      const query = compiled(statement).sql;
      if (/"job_id" =/i.test(query)) {
        operations.push("find-job-snapshot");
        return { rows: state.snapshotId ? [{ id: state.snapshotId }] : [] };
      }
      if (
        /from "research_automation_jobs"/i.test(query) &&
        /for update/i.test(query)
      ) {
        operations.push("lock-job");
        state.jobLocks += 1;
        return { rows: state.jobStatus === "running" ? [{ id: 9 }] : [] };
      }
      if (
        /from "research_companies"/i.test(query) &&
        /for update/i.test(query)
      ) {
        operations.push("lock-company");
        state.companyLocks += 1;
        return { rows: [{ id: 7 }] };
      }
      if (/"content_hash" =/i.test(query)) {
        operations.push("find-content-snapshot");
        return { rows: [] };
      }
      if (/order by "version" desc/i.test(query)) {
        operations.push("read-latest-version");
        return { rows: [] };
      }
      if (/update "research_automation_jobs"/i.test(query)) {
        operations.push("complete-job");
        state.completionMutations += 1;
        if (state.jobStatus !== "running") return { rows: [] };
        state.jobStatus = "succeeded";
        return { rows: [{ id: 9 }] };
      }
      throw new Error(`Unexpected stateful publication SQL: ${query}`);
    },
    insert: (table: unknown) => ({
      values: (_values: unknown) => {
        if (table === automatedResearchSnapshotsTable) {
          operations.push("insert-snapshot");
          state.snapshotInsertions += 1;
          state.snapshotId = 77;
          return { returning: async () => [{ id: 77 }] };
        }
        if (table === automatedResearchSourcesTable) {
          operations.push("insert-sources");
          state.sourceInsertions += 1;
          return Promise.resolve();
        }
        throw new Error("Unexpected stateful publication table");
      },
    }),
  };
  return {
    database: {
      transaction: async <T>(
        operation: (transaction: typeof tx) => Promise<T>,
      ) => operation(tx),
    },
    operations,
    state,
  };
}

test("repository review: publish locks job then company before version allocation", async () => {
  const fake = publicationDatabase({});
  const repository = new ResearchAutomationRepository(fake.database as never);
  const fixture = publicationFixture();

  const snapshotId = await repository.publishSnapshot(
    fixture.job,
    fixture.bundle,
    fixture.validation,
    fixture.fence,
  );

  assert.equal(snapshotId, 77);
  assert.deepEqual(fake.operations, [
    "find-job-snapshot",
    "lock-job",
    "lock-company",
    "find-content-snapshot",
    "read-latest-version",
    "insert-snapshot",
    "complete-job",
  ]);
  assert.equal(fake.insertedSnapshot()?.version, 4);
});

test("repository review: an existing job snapshot returns without lease or completion mutation", async () => {
  const fake = publicationDatabase({ existingJobSnapshotId: 41 });
  const repository = new ResearchAutomationRepository(fake.database as never);
  const fixture = publicationFixture();

  const snapshotId = await repository.publishSnapshot(
    fixture.job,
    fixture.bundle,
    fixture.validation,
    fixture.fence,
  );

  assert.equal(snapshotId, 41);
  assert.deepEqual(fake.operations, ["find-job-snapshot"]);
});

test("repository review: duplicate content completes without corrupting version history", async () => {
  const fake = publicationDatabase({ existingContentSnapshotId: 44 });
  const repository = new ResearchAutomationRepository(fake.database as never);
  const fixture = publicationFixture();

  const snapshotId = await repository.publishSnapshot(
    fixture.job,
    fixture.bundle,
    fixture.validation,
    fixture.fence,
  );

  assert.equal(snapshotId, 44);
  assert.deepEqual(fake.operations, [
    "find-job-snapshot",
    "lock-job",
    "lock-company",
    "find-content-snapshot",
    "complete-job",
  ]);
});

test("repository review: a lost-response retry returns the committed snapshot read-only", async () => {
  const fake = statefulPublicationDatabase();
  const repository = new ResearchAutomationRepository(fake.database as never);
  const fixture = publicationFixture();
  const bundle = {
    ...fixture.bundle,
    sources: [
      {
        citationKey: "issuer-filing",
        authority: "primary" as const,
        sourceType: "issuer_filing",
        title: "Issuer filing",
        publisher: "Issuer",
        canonicalUrl: "https://issuer.example/filing",
        publishedAt: firstRunAt,
        retrievedAt: firstRunAt,
        evidenceSummary: "Primary evidence.",
        contentFingerprint: "b".repeat(64),
      },
    ],
  };

  const firstId = await repository.publishSnapshot(
    fixture.job,
    bundle,
    fixture.validation,
    fixture.fence,
  );
  const secondId = await repository.publishSnapshot(
    fixture.job,
    bundle,
    fixture.validation,
    fixture.fence,
  );

  assert.equal(firstId, 77);
  assert.equal(secondId, 77);
  assert.equal(fake.state.jobStatus, "succeeded");
  assert.equal(fake.state.snapshotInsertions, 1);
  assert.equal(fake.state.sourceInsertions, 1);
  assert.equal(fake.state.completionMutations, 1);
  assert.equal(fake.state.jobLocks, 1);
  assert.equal(fake.state.companyLocks, 1);
  assert.deepEqual(fake.operations.slice(-1), ["find-job-snapshot"]);
});

test("repository review: stale worker without a snapshot fails before company mutation", async () => {
  const fake = publicationDatabase({ jobLeaseOwned: false });
  const repository = new ResearchAutomationRepository(fake.database as never);
  const fixture = publicationFixture();

  await assert.rejects(
    repository.publishSnapshot(
      fixture.job,
      fixture.bundle,
      fixture.validation,
      fixture.fence,
    ),
    /lease is no longer owned/i,
  );
  assert.deepEqual(fake.operations, ["find-job-snapshot", "lock-job"]);
});

test("repository: refresh buckets follow holding, local-day, four-hour, and fifteen-minute policies", () => {
  const now = new Date("2026-08-14T22:07:00.000Z");
  assert.equal(
    buildRefreshBucket({
      trigger: "holding_added",
      now,
      timezone: "Asia/Kolkata",
      holdingFingerprint: "first-seen-fingerprint",
    }),
    "first-seen-fingerprint",
  );
  assert.equal(
    buildRefreshBucket({
      trigger: "scheduled_refresh",
      now,
      timezone: "Asia/Kolkata",
    }),
    "2026-08-15",
  );
  assert.equal(
    buildRefreshBucket({
      trigger: "material_event",
      now,
      timezone: "Asia/Kolkata",
    }),
    "2026-08-14T20:00:00.000Z",
  );
  assert.equal(
    buildRefreshBucket({
      trigger: "manual_refresh",
      now,
      timezone: "Asia/Kolkata",
    }),
    "2026-08-14T22:00:00.000Z",
  );
});

test("research list: legacy fields survive automation metadata and live holding prices win", async () => {
  process.env.DATABASE_URL = "postgresql://test-only.invalid/no-connection";
  const { mergeAutomatedResearchListFields } =
    await import("../researchService");
  const legacy = {
    id: 17,
    ticker: "RELIANCE",
    conviction: "high" as const,
    thesisStatus: "intact" as const,
    completenessScore: 83,
    isHolding: true,
    isCovered: true,
    currentPrice: 2500,
    previousClose: 2490,
  };

  const merged = mergeAutomatedResearchListFields(legacy, {
    holding: { marketPrice: 3012.5, previousClose: 2991.1 },
    identityStatus: "resolved",
    automationState: "limited",
  });

  assert.deepEqual(merged, {
    ...legacy,
    currentPrice: 3012.5,
    previousClose: 2991.1,
    identityStatus: "resolved",
    automationState: "limited",
  });
});

test("research list: inactive portfolio membership is archived without changing legacy coverage", async () => {
  process.env.DATABASE_URL = "postgresql://test-only.invalid/no-connection";
  const { deriveResearchAutomationState } = await import("../researchService");

  assert.equal(
    deriveResearchAutomationState({
      identityStatus: "resolved",
      automationEnabled: true,
      hasAnyTarget: true,
      hasActiveTarget: false,
      latestJob: null,
      latestSnapshot: {
        evidenceStrength: "strong",
        validUntil: new Date("2026-08-16T06:00:00.000Z"),
        publishedAt: firstRunAt,
      },
      now: new Date("2026-08-15T06:00:00.000Z"),
    }),
    "archived",
  );
});

test("research list review: active target aliases bind live holdings without an uncovered duplicate", async () => {
  process.env.DATABASE_URL = "postgresql://test-only.invalid/no-connection";
  const researchServiceModule = await import("../researchService");
  const buildMap = (researchServiceModule as unknown as Record<string, unknown>)
    .buildResearchHoldingCoverageMap;
  assert.equal(
    typeof buildMap,
    "function",
    "buildResearchHoldingCoverageMap must be exported",
  );
  const aliasedHolding = {
    ticker: "NEWALIAS",
    name: "Issuer New Alias",
    exchange: "NSE",
    sector: "Industrials",
    quantity: 4,
    marketPrice: 345.5,
    previousClose: 340,
    marketValue: 1382,
    allocationPct: 12,
  };

  const result = (
    buildMap as (
      companies: Array<{ id: number; ticker: string }>,
      targets: Array<{
        companyId: number;
        ticker: string;
        isActive: boolean;
      }>,
      holdings: (typeof aliasedHolding)[],
    ) => {
      holdingByCompanyId: Map<number, typeof aliasedHolding>;
      coveredHoldingTickers: Set<string>;
    }
  )(
    [{ id: 7, ticker: "OLDALIAS" }],
    [{ companyId: 7, ticker: "NEWALIAS", isActive: true }],
    [aliasedHolding],
  );

  assert.equal(result.holdingByCompanyId.get(7)?.ticker, "NEWALIAS");
  assert.equal(result.holdingByCompanyId.get(7)?.marketPrice, 345.5);
  assert.equal(result.coveredHoldingTickers.has("NEWALIAS"), true);
  assert.deepEqual(
    [aliasedHolding]
      .filter((holding) => !result.coveredHoldingTickers.has(holding.ticker))
      .map((holding) => holding.ticker),
    [],
  );
});
