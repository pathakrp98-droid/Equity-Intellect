import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

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
      listHoldings: async () => [...(this.holdings.get(portfolioId) ?? [])],
      listTargets: async () =>
        this.targets.filter(
          (target) =>
            target.userId === userId && target.portfolioId === portfolioId,
        ),
      findCompany: async ({ normalizedIdentityKey, ticker }) =>
        this.companies.find(
          (company) =>
            company.userId === userId &&
            (company.normalizedIdentityKey === normalizedIdentityKey ||
              company.ticker === ticker),
        ) ?? null,
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

function compiled(statement: SQL): { sql: string; params: unknown[] } {
  const query = new PgDialect().sqlToQuery(statement);
  return { sql: query.sql.replace(/\s+/g, " ").trim(), params: query.params };
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
