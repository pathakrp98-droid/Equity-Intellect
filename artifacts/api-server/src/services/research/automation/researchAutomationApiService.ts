import {
  automatedResearchSnapshotsTable,
  automatedResearchSourcesTable,
  db,
  researchAutomationJobsTable,
  researchCompaniesTable,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";

import { researchService } from "../researchService";
import {
  ResearchRefreshCooldownError,
  type ResearchAutomationApiService,
  type ResearchIdentityCorrectionInput,
} from "./researchAutomationApi";
import {
  buildIdempotencyKey,
  buildRefreshBucket,
  ResearchAutomationRepository,
} from "./researchAutomationRepository";
import {
  holdingIdentityFingerprint,
  normalizeHoldingIdentity,
} from "./researchReconciler";

function publicJob(job: typeof researchAutomationJobsTable.$inferSelect) {
  return {
    id: job.id,
    companyId: job.companyId,
    trigger: job.trigger,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    runAfter: job.runAfter,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

async function ownedCompany(userId: string, ticker: string) {
  const [company] = await db
    .select()
    .from(researchCompaniesTable)
    .where(
      and(
        eq(researchCompaniesTable.userId, userId),
        eq(researchCompaniesTable.ticker, ticker),
      ),
    )
    .limit(1);
  return company ?? null;
}

async function snapshotsWithSources(userId: string, companyId: number) {
  const snapshots = await db
    .select()
    .from(automatedResearchSnapshotsTable)
    .innerJoin(
      researchAutomationJobsTable,
      and(
        eq(
          researchAutomationJobsTable.id,
          automatedResearchSnapshotsTable.jobId,
        ),
        eq(researchAutomationJobsTable.userId, userId),
        eq(researchAutomationJobsTable.status, "succeeded"),
      ),
    )
    .where(
      and(
        eq(automatedResearchSnapshotsTable.userId, userId),
        eq(automatedResearchSnapshotsTable.companyId, companyId),
      ),
    )
    .orderBy(desc(automatedResearchSnapshotsTable.version));
  const snapshotIds = snapshots.map(
    (row) => row.automated_research_snapshots.id,
  );
  const sources = snapshotIds.length
    ? await db
        .select()
        .from(automatedResearchSourcesTable)
        .where(
          and(
            eq(automatedResearchSourcesTable.userId, userId),
            eq(automatedResearchSourcesTable.companyId, companyId),
            inArray(automatedResearchSourcesTable.snapshotId, snapshotIds),
          ),
        )
    : [];
  const sourcesBySnapshot = new Map<number, typeof sources>();
  for (const source of sources) {
    const current = sourcesBySnapshot.get(source.snapshotId) ?? [];
    current.push(source);
    sourcesBySnapshot.set(source.snapshotId, current);
  }
  return snapshots.map(
    ({
      automated_research_snapshots: snapshot,
      research_automation_jobs: job,
    }) => ({
      id: snapshot.id,
      version: snapshot.version,
      trigger: job.trigger,
      securityType: snapshot.securityType,
      payload: snapshot.payload,
      quality: snapshot.quality,
      changeSet: snapshot.changeSet,
      evidenceStrength: snapshot.evidenceStrength,
      freshAt: snapshot.freshAt,
      validUntil: snapshot.validUntil,
      publishedAt: snapshot.publishedAt,
      sources: (sourcesBySnapshot.get(snapshot.id) ?? []).map((source) => ({
        citationKey: source.citationKey,
        authority: source.authority,
        sourceType: source.sourceType,
        title: source.title,
        publisher: source.publisher,
        url: source.canonicalUrl,
        publishedAt: source.publishedAt,
        retrievedAt: source.retrievedAt,
        evidenceSummary: source.evidenceSummary,
      })),
    }),
  );
}

class DbResearchAutomationApiService implements ResearchAutomationApiService {
  private readonly repository = new ResearchAutomationRepository(db);

  listCoverage(userId: string) {
    return researchService.listCompanies(userId);
  }

  async getCompany(userId: string, ticker: string) {
    const company = await ownedCompany(userId, ticker);
    if (!company) return null;
    const [snapshots, jobs] = await Promise.all([
      snapshotsWithSources(userId, company.id),
      db
        .select()
        .from(researchAutomationJobsTable)
        .where(
          and(
            eq(researchAutomationJobsTable.userId, userId),
            eq(researchAutomationJobsTable.companyId, company.id),
          ),
        )
        .orderBy(desc(researchAutomationJobsTable.createdAt))
        .limit(10),
    ]);
    return {
      company: {
        id: company.id,
        ticker: company.ticker,
        name: company.name,
        exchange: company.exchange,
        isin: company.isin,
        securityType: company.securityType,
        identityStatus: company.identityStatus,
        identityConfidence: company.identityConfidence,
        automationEnabled: company.automationEnabled,
      },
      latestSnapshot: snapshots[0] ?? null,
      recentJobs: jobs.map(publicJob),
    };
  }

  async listHistory(userId: string, ticker: string) {
    const company = await ownedCompany(userId, ticker);
    return company ? snapshotsWithSources(userId, company.id) : null;
  }

  async requestRefresh(userId: string, ticker: string) {
    const company = await ownedCompany(userId, ticker);
    if (!company) return null;
    const now = new Date();
    const [latest] = await db
      .select()
      .from(researchAutomationJobsTable)
      .where(
        and(
          eq(researchAutomationJobsTable.userId, userId),
          eq(researchAutomationJobsTable.companyId, company.id),
        ),
      )
      .orderBy(desc(researchAutomationJobsTable.createdAt))
      .limit(1);
    const cooldownEnds = latest ? latest.createdAt.getTime() + 15 * 60_000 : 0;
    if (
      latest &&
      (["queued", "running"].includes(latest.status) ||
        cooldownEnds > now.getTime())
    ) {
      throw new ResearchRefreshCooldownError(
        Math.max(1, Math.ceil((cooldownEnds - now.getTime()) / 1000)),
      );
    }
    const normalizedIdentityKey =
      company.normalizedIdentityKey ??
      normalizeHoldingIdentity({
        ticker: company.ticker,
        name: company.name,
        exchange: company.exchange,
        sector: company.sector,
        isin: company.isin,
        marketPrice: company.currentPrice,
        previousClose: company.previousClose,
      }).normalizedIdentityKey;
    const enqueued = await this.repository.enqueueJob({
      userId,
      companyId: company.id,
      normalizedIdentityKey,
      trigger: "manual_refresh",
      refreshBucket: buildRefreshBucket({
        trigger: "manual_refresh",
        now,
        timezone: "UTC",
      }),
      priority: 60,
      context: { ticker: company.ticker },
      runAfter: now,
    });
    if (!enqueued.created) throw new ResearchRefreshCooldownError(15 * 60);
    return { jobId: enqueued.job.id, created: true };
  }

  async correctIdentity(
    userId: string,
    ticker: string,
    input: ResearchIdentityCorrectionInput,
  ) {
    const now = new Date();
    return db.transaction(async (tx) => {
      const [company] = await tx
        .select()
        .from(researchCompaniesTable)
        .where(
          and(
            eq(researchCompaniesTable.userId, userId),
            eq(researchCompaniesTable.ticker, ticker),
          ),
        )
        .for("update")
        .limit(1);
      if (!company) return null;
      const identity = normalizeHoldingIdentity({
        ticker: input.ticker,
        name: input.name,
        exchange: input.exchange,
        sector: company.sector,
        isin: input.isin,
        marketPrice: company.currentPrice,
        previousClose: company.previousClose,
      });
      const fingerprint = holdingIdentityFingerprint(
        {
          ticker: input.ticker,
          name: input.name,
          exchange: input.exchange,
          sector: company.sector,
          isin: input.isin,
          marketPrice: company.currentPrice,
          previousClose: company.previousClose,
        },
        identity.normalizedIdentityKey,
      );
      const [updated] = await tx
        .update(researchCompaniesTable)
        .set({
          ticker: input.ticker,
          name: input.name,
          exchange: input.exchange,
          isin: identity.isin,
          normalizedIdentityKey: identity.normalizedIdentityKey,
          securityType: input.securityType,
          identityStatus: "resolved",
          identityConfidence: 1,
          automationEnabled: true,
          updatedAt: now,
        })
        .where(
          and(
            eq(researchCompaniesTable.id, company.id),
            eq(researchCompaniesTable.userId, userId),
          ),
        )
        .returning();
      const idempotencyKey = buildIdempotencyKey({
        userId,
        normalizedIdentityKey: identity.normalizedIdentityKey,
        trigger: "holding_changed",
        refreshBucket: fingerprint,
      });
      await tx
        .insert(researchAutomationJobsTable)
        .values({
          userId,
          companyId: company.id,
          trigger: "holding_changed",
          priority: 100,
          idempotencyKey,
          context: { ticker: input.ticker, holdingFingerprint: fingerprint },
          runAfter: now,
        })
        .onConflictDoNothing({
          target: [
            researchAutomationJobsTable.userId,
            researchAutomationJobsTable.idempotencyKey,
          ],
        });
      return updated ?? null;
    });
  }

  async getJob(userId: string, id: number) {
    const job = await this.repository.getJob(userId, id);
    return job ? publicJob(job) : null;
  }
}

export const researchAutomationApiService =
  new DbResearchAutomationApiService();
