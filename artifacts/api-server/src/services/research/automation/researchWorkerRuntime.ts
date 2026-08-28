import {
  db,
  investmentThesesTable,
  pool,
  portfolioHoldingsTable,
  portfoliosTable,
  researchAutomationJobsTable,
  researchAutomationPreferencesTable,
  researchAutomationTriggerEventsTable,
  researchCompaniesTable,
  researchCoverageTargetsTable,
} from "@workspace/db";
import { and, asc, eq, gt, lte, sql } from "drizzle-orm";

import { openAIResearchProvider } from "./openAIResearchProvider";
import {
  ResearchAutomationService,
  type ResearchAutomationContextReader,
} from "./researchAutomationService";
import {
  buildIdempotencyKey,
  buildRefreshBucket,
  ResearchAutomationRepository,
} from "./researchAutomationRepository";
import { reconcilePortfolioHoldings } from "./researchReconciler";
import type {
  ResearchWorkerDependencies,
  ResearchWorkerEvent,
} from "./researchWorker";

const GLOBAL_WORKER_LOCK = 81_732_027;

interface AdvisoryLockClient {
  query(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>> }>;
  release(): void;
}

class DbResearchAutomationContextReader implements ResearchAutomationContextReader {
  async loadOwnedContext(userId: string, companyId: number) {
    const [company] = await db
      .select()
      .from(researchCompaniesTable)
      .where(
        and(
          eq(researchCompaniesTable.userId, userId),
          eq(researchCompaniesTable.id, companyId),
        ),
      )
      .limit(1);
    if (!company) return null;
    const [holding, thesis] = await Promise.all([
      db
        .select({
          quantity: portfolioHoldingsTable.quantity,
          averageCost: portfolioHoldingsTable.averageCost,
          currentPrice: portfolioHoldingsTable.marketPrice,
          portfolioWeightPct: portfolioHoldingsTable.allocationPct,
          priceAsOf: portfolioHoldingsTable.updatedAt,
        })
        .from(researchCoverageTargetsTable)
        .innerJoin(
          portfoliosTable,
          and(
            eq(portfoliosTable.id, researchCoverageTargetsTable.portfolioId),
            eq(portfoliosTable.userId, userId),
          ),
        )
        .innerJoin(
          portfolioHoldingsTable,
          and(
            eq(
              portfolioHoldingsTable.portfolioId,
              researchCoverageTargetsTable.portfolioId,
            ),
            eq(
              portfolioHoldingsTable.ticker,
              researchCoverageTargetsTable.ticker,
            ),
          ),
        )
        .where(
          and(
            eq(researchCoverageTargetsTable.userId, userId),
            eq(researchCoverageTargetsTable.companyId, companyId),
            eq(researchCoverageTargetsTable.isActive, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({ summary: investmentThesesTable.summary })
        .from(investmentThesesTable)
        .where(eq(investmentThesesTable.companyId, companyId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);
    return {
      company: {
        id: company.id,
        userId: company.userId,
        ticker: company.ticker,
        name: company.name,
        exchange: company.exchange,
        isin: company.isin,
        sector: company.sector,
        securityType: company.securityType,
        identityStatus: company.identityStatus,
        automationEnabled: company.automationEnabled,
        officialDomains: [],
        verifiedIssuerWebsite: null,
      },
      holdingContext: {
        quantity: holding?.quantity ?? null,
        averageCost: holding?.averageCost ?? null,
        currentPrice: holding?.currentPrice ?? company.currentPrice,
        currency: "INR",
        portfolioWeightPct: holding?.portfolioWeightPct ?? null,
        priceAsOf: holding?.priceAsOf.toISOString() ?? null,
      },
      userResearchSummary: thesis?.summary ?? null,
    };
  }
}

function localDailyJobs(now: Date) {
  return db.transaction(async (tx) => {
    const preferences = await tx
      .select()
      .from(researchAutomationPreferencesTable)
      .where(
        and(
          eq(researchAutomationPreferencesTable.enabled, true),
          lte(researchAutomationPreferencesTable.nextDailyRunAt, now),
        ),
      )
      .orderBy(asc(researchAutomationPreferencesTable.nextDailyRunAt))
      .limit(50)
      .for("update", { skipLocked: true });
    let created = 0;
    for (const preference of preferences) {
      const companies = await tx
        .select({
          id: researchCompaniesTable.id,
          normalizedIdentityKey: researchCompaniesTable.normalizedIdentityKey,
          ticker: researchCompaniesTable.ticker,
        })
        .from(researchCoverageTargetsTable)
        .innerJoin(
          researchCompaniesTable,
          and(
            eq(
              researchCompaniesTable.id,
              researchCoverageTargetsTable.companyId,
            ),
            eq(researchCompaniesTable.userId, preference.userId),
          ),
        )
        .where(
          and(
            eq(researchCoverageTargetsTable.userId, preference.userId),
            eq(researchCoverageTargetsTable.isActive, true),
            eq(researchCompaniesTable.automationEnabled, true),
            eq(researchCompaniesTable.identityStatus, "resolved"),
          ),
        )
        .groupBy(
          researchCompaniesTable.id,
          researchCompaniesTable.normalizedIdentityKey,
          researchCompaniesTable.ticker,
        )
        .orderBy(asc(researchCompaniesTable.id))
        .limit(preference.maxAssetsPerDailyRun);
      for (const company of companies) {
        const identityKey =
          company.normalizedIdentityKey ?? `security:UNKNOWN:${company.ticker}`;
        const refreshBucket = buildRefreshBucket({
          trigger: "scheduled_refresh",
          now,
          timezone: preference.timezone,
        });
        const [job] = await tx
          .insert(researchAutomationJobsTable)
          .values({
            userId: preference.userId,
            companyId: company.id,
            trigger: "scheduled_refresh",
            priority: 20,
            idempotencyKey: buildIdempotencyKey({
              userId: preference.userId,
              normalizedIdentityKey: identityKey,
              trigger: "scheduled_refresh",
              refreshBucket,
            }),
            context: { ticker: company.ticker, refreshBucket },
            runAfter: now,
          })
          .onConflictDoNothing({
            target: [
              researchAutomationJobsTable.userId,
              researchAutomationJobsTable.idempotencyKey,
            ],
          })
          .returning({ id: researchAutomationJobsTable.id });
        if (job) created += 1;
      }
      await tx
        .update(researchAutomationPreferencesTable)
        .set({
          lastDailyEnqueuedAt: now,
          nextDailyRunAt: sql`(((${now} at time zone ${preference.timezone})::date + interval '1 day' + make_interval(hours => ${preference.dailyHour})) at time zone ${preference.timezone})`,
          updatedAt: now,
        })
        .where(
          eq(researchAutomationPreferencesTable.userId, preference.userId),
        );
    }
    return created;
  });
}

export function createProductionResearchWorkerDependencies(): ResearchWorkerDependencies {
  const repository = new ResearchAutomationRepository(db);
  const service = new ResearchAutomationService({
    repository,
    contextReader: new DbResearchAutomationContextReader(),
    provider: openAIResearchProvider,
  });
  let lockClient: AdvisoryLockClient | null = null;

  const completeEvent = async (
    event: ResearchWorkerEvent,
    workerId: string,
    now: Date,
  ) => {
    await db
      .update(researchAutomationTriggerEventsTable)
      .set({
        status: "succeeded",
        processedAt: now,
        lockedAt: null,
        leaseExpiresAt: null,
        workerId: null,
        lastError: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(researchAutomationTriggerEventsTable.id, event.id),
          eq(researchAutomationTriggerEventsTable.userId, event.userId!),
          eq(researchAutomationTriggerEventsTable.status, "running"),
          eq(researchAutomationTriggerEventsTable.workerId, workerId),
          gt(researchAutomationTriggerEventsTable.leaseExpiresAt, now),
        ),
      );
  };

  return {
    acquireGlobalLease: async () => {
      if (lockClient) return false;
      const client = (await pool.connect()) as unknown as AdvisoryLockClient;
      const result = await client.query(
        "select pg_try_advisory_lock($1) as acquired",
        [GLOBAL_WORKER_LOCK],
      );
      if (result.rows[0]?.acquired !== true) {
        client.release();
        return false;
      }
      lockClient = client;
      return true;
    },
    releaseGlobalLease: async () => {
      const client = lockClient;
      lockClient = null;
      if (!client) return;
      try {
        await client.query("select pg_advisory_unlock($1)", [
          GLOBAL_WORKER_LOCK,
        ]);
      } finally {
        client.release();
      }
    },
    recoverExpiredLeases: (now) => repository.requeueExpiredLeases(now),
    enqueueDueDailyJobs: (now) => localDailyJobs(now),
    claimTriggerEvents: (input) => repository.claimTriggerEvents(input),
    processTriggerEvent: async ({ event, workerId, now }) => {
      if (!event.userId || !event.trigger) throw new Error("invalid event");
      try {
        if (event.trigger === "portfolio_reconciled" && event.portfolioId) {
          await reconcilePortfolioHoldings(repository, {
            userId: event.userId,
            portfolioId: event.portfolioId,
            now,
          });
        } else if (event.trigger === "material_event" && event.ticker) {
          const [company] = await db
            .select({
              id: researchCompaniesTable.id,
              normalizedIdentityKey:
                researchCompaniesTable.normalizedIdentityKey,
            })
            .from(researchCompaniesTable)
            .innerJoin(
              researchCoverageTargetsTable,
              and(
                eq(
                  researchCoverageTargetsTable.companyId,
                  researchCompaniesTable.id,
                ),
                eq(researchCoverageTargetsTable.userId, event.userId),
                eq(researchCoverageTargetsTable.isActive, true),
              ),
            )
            .where(
              and(
                eq(researchCompaniesTable.userId, event.userId),
                eq(researchCompaniesTable.ticker, event.ticker),
                eq(researchCompaniesTable.automationEnabled, true),
                eq(researchCompaniesTable.identityStatus, "resolved"),
              ),
            )
            .limit(1);
          if (company?.normalizedIdentityKey) {
            await repository.enqueueJob({
              userId: event.userId,
              companyId: company.id,
              normalizedIdentityKey: company.normalizedIdentityKey,
              trigger: "material_event",
              triggerEventId: event.id,
              refreshBucket: buildRefreshBucket({
                trigger: "material_event",
                now,
                timezone: "UTC",
              }),
              priority: 80,
              context: event.payload ?? {},
              runAfter: now,
            });
          }
        }
        await completeEvent(event, workerId, now);
      } catch {
        const dead = (event.attempts ?? 0) >= 5;
        await db
          .update(researchAutomationTriggerEventsTable)
          .set({
            status: dead ? "dead_letter" : "queued",
            availableAt: dead ? now : new Date(now.getTime() + 5 * 60_000),
            processedAt: dead ? now : null,
            lockedAt: null,
            leaseExpiresAt: null,
            workerId: null,
            lastError: "Research trigger processing failed.",
            updatedAt: now,
          })
          .where(
            and(
              eq(researchAutomationTriggerEventsTable.id, event.id),
              eq(researchAutomationTriggerEventsTable.userId, event.userId),
              eq(researchAutomationTriggerEventsTable.status, "running"),
              eq(researchAutomationTriggerEventsTable.workerId, workerId),
            ),
          );
        throw new Error("Research trigger processing failed.");
      }
    },
    claimJobs: (input) => repository.claimJobs(input),
    runJob: (input) => service.runJob(input),
    countRemainingJobs: async (now) => {
      const rows = await db
        .select({ id: researchAutomationJobsTable.id })
        .from(researchAutomationJobsTable)
        .where(
          and(
            eq(researchAutomationJobsTable.status, "queued"),
            lte(researchAutomationJobsTable.runAfter, now),
          ),
        );
      return rows.length;
    },
  };
}
