import { createHash } from "node:crypto";

import type {
  AutomaticAttemptClaim,
  AutomaticAttemptDiagnostics,
  AutomaticAttemptStatus,
} from "./priceRefreshRepository";
import { classifyQuoteRefresh } from "./quoteRefreshPolicy";
import type { ProviderRefreshDiagnostic } from "./types";

export interface QuoteRefreshExecutionResult {
  refreshedAt: Date;
  expectedSymbols: number;
  receivedSymbols: number;
  diagnostics: ProviderRefreshDiagnostic[];
  autoEvaluateAlerts: boolean;
}

export interface PriceRefreshSchedulerDependencies {
  now(): Date;
  acquireLease(input: {
    name: string;
    workerId: string;
    now: Date;
    leaseMs: number;
  }): Promise<boolean>;
  releaseLease(input: { name: string; workerId: string }): Promise<boolean>;
  claimAttempt(input: {
    userId: string;
    workerId: string;
    now: Date;
  }): Promise<AutomaticAttemptClaim>;
  completeAttempt(input: {
    attemptId: number;
    userId: string;
    workerId: string;
    status: AutomaticAttemptStatus;
    completedAt: Date;
    diagnostics: AutomaticAttemptDiagnostics;
    errorCode?: string | null;
  }): Promise<boolean>;
  listActiveUserIds(): Promise<string[]>;
  refreshQuotes(input: {
    userId: string;
    force: true;
  }): Promise<QuoteRefreshExecutionResult>;
  evaluateAlerts(input: { userId: string }): Promise<{
    evaluatedAt: Date;
    candidates: number;
    alertsUpserted: number;
  }>;
}

export type AutomaticPriceRefreshResult =
  | {
      attempted: false;
      reason:
        | "concurrent_refresh"
        | "already_fresh"
        | "attempt_limit"
        | "retry_not_due"
        | "concurrent_attempt";
    }
  | {
      attempted: true;
      status: AutomaticAttemptStatus;
      refreshedAt: Date;
      diagnostics: ProviderRefreshDiagnostic[];
      alertEvaluation?: {
        evaluatedAt: Date;
        candidates: number;
        alertsUpserted: number;
      };
    };

export interface PriceRefreshBatchSummary {
  status: "success" | "partial" | "skipped";
  leaseAcquired: boolean;
  usersDiscovered: number;
  attempted: number;
  fresh: number;
  partial: number;
  failed: number;
  skipped: number;
}

const USER_LEASE_MS = 10 * 60_000;
const GLOBAL_LEASE_MS = 10 * 60_000;

export function userPriceRefreshLeaseName(userId: string): string {
  return `price:user:${createHash("sha256").update(userId).digest("hex")}`;
}

function safeDiagnostics(
  result: QuoteRefreshExecutionResult,
): AutomaticAttemptDiagnostics {
  return {
    expectedSymbols: Math.max(0, Math.floor(result.expectedSymbols)),
    receivedSymbols: Math.max(0, Math.floor(result.receivedSymbols)),
    providers: result.diagnostics.map((item) => ({
      provider: item.provider.slice(0, 120),
      status: item.status,
      records: Math.max(0, Math.floor(item.records)),
    })),
  };
}

function errorCodeFor(status: AutomaticAttemptStatus): string | null {
  if (status === "partial") return "quotes_partial";
  if (status === "failed") return "quotes_failed";
  return null;
}

export async function runAutomaticPriceRefreshForUser(
  input: { userId: string; workerId: string; leaseMs?: number },
  dependencies: PriceRefreshSchedulerDependencies,
): Promise<AutomaticPriceRefreshResult> {
  const leaseName = userPriceRefreshLeaseName(input.userId);
  const acquired = await dependencies.acquireLease({
    name: leaseName,
    workerId: input.workerId,
    now: dependencies.now(),
    leaseMs: input.leaseMs ?? USER_LEASE_MS,
  });
  if (!acquired) return { attempted: false, reason: "concurrent_refresh" };

  let claim: Extract<AutomaticAttemptClaim, { claimed: true }> | null = null;
  try {
    const claimResult = await dependencies.claimAttempt({
      userId: input.userId,
      workerId: input.workerId,
      now: dependencies.now(),
    });
    if (!claimResult.claimed) {
      return { attempted: false, reason: claimResult.reason };
    }
    claim = claimResult;

    try {
      const quoteResult = await dependencies.refreshQuotes({
        userId: input.userId,
        force: true,
      });
      const status = classifyQuoteRefresh(quoteResult);
      let alertEvaluation:
        | {
            evaluatedAt: Date;
            candidates: number;
            alertsUpserted: number;
          }
        | undefined;
      if (status !== "failed" && quoteResult.autoEvaluateAlerts) {
        try {
          alertEvaluation = await dependencies.evaluateAlerts({
            userId: input.userId,
          });
        } catch {
          // Quote freshness remains valid when deterministic alert evaluation fails.
        }
      }
      const completed = await dependencies.completeAttempt({
        attemptId: claim.attemptId,
        userId: input.userId,
        workerId: input.workerId,
        status,
        completedAt: dependencies.now(),
        diagnostics: safeDiagnostics(quoteResult),
        errorCode: errorCodeFor(status),
      });
      if (!completed) throw new Error("price refresh attempt completion failed");
      return {
        attempted: true,
        status,
        refreshedAt: quoteResult.refreshedAt,
        diagnostics: quoteResult.diagnostics,
        ...(alertEvaluation ? { alertEvaluation } : {}),
      };
    } catch (error) {
      if (error instanceof Error && error.message === "price refresh attempt completion failed") {
        throw error;
      }
      const completed = await dependencies.completeAttempt({
        attemptId: claim.attemptId,
        userId: input.userId,
        workerId: input.workerId,
        status: "failed",
        completedAt: dependencies.now(),
        diagnostics: {
          expectedSymbols: 0,
          receivedSymbols: 0,
          providers: [],
        },
        errorCode: "quotes_unavailable",
      });
      if (!completed) throw new Error("price refresh attempt completion failed");
      return {
        attempted: true,
        status: "failed",
        refreshedAt: dependencies.now(),
        diagnostics: [],
      };
    }
  } finally {
    await dependencies.releaseLease({
      name: leaseName,
      workerId: input.workerId,
    });
  }
}

async function mapWithConcurrency<T>(
  values: string[],
  concurrency: number,
  worker: (value: string) => Promise<T>,
): Promise<Array<PromiseSettledResult<T>>> {
  const results: Array<PromiseSettledResult<T>> = new Array(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (next < values.length) {
        const index = next++;
        try {
          results[index] = {
            status: "fulfilled",
            value: await worker(values[index]!),
          };
        } catch (reason) {
          results[index] = { status: "rejected", reason };
        }
      }
    }),
  );
  return results;
}

export async function runPriceRefreshBatch(
  input: {
    workerId: string;
    concurrency?: number;
    globalLeaseMs?: number;
    userLeaseMs?: number;
  },
  dependencies: PriceRefreshSchedulerDependencies,
): Promise<PriceRefreshBatchSummary> {
  const concurrency = input.concurrency ?? 2;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) {
    throw new Error("price refresh concurrency is invalid");
  }
  const leaseAcquired = await dependencies.acquireLease({
    name: "price:scheduler",
    workerId: input.workerId,
    now: dependencies.now(),
    leaseMs: input.globalLeaseMs ?? GLOBAL_LEASE_MS,
  });
  const empty: PriceRefreshBatchSummary = {
    status: "skipped",
    leaseAcquired: false,
    usersDiscovered: 0,
    attempted: 0,
    fresh: 0,
    partial: 0,
    failed: 0,
    skipped: 0,
  };
  if (!leaseAcquired) return empty;

  try {
    const userIds = await dependencies.listActiveUserIds();
    const results = await mapWithConcurrency(
      userIds,
      concurrency,
      (userId) =>
        runAutomaticPriceRefreshForUser(
          {
            userId,
            workerId: input.workerId,
            leaseMs: input.userLeaseMs,
          },
          dependencies,
        ),
    );
    const summary: PriceRefreshBatchSummary = {
      status: "success",
      leaseAcquired: true,
      usersDiscovered: userIds.length,
      attempted: 0,
      fresh: 0,
      partial: 0,
      failed: 0,
      skipped: 0,
    };
    for (const result of results) {
      if (result.status === "rejected") {
        summary.failed += 1;
      } else if (!result.value.attempted) {
        summary.skipped += 1;
      } else {
        summary.attempted += 1;
        summary[result.value.status] += 1;
      }
    }
    if (summary.partial > 0 || summary.failed > 0) summary.status = "partial";
    return summary;
  } finally {
    await dependencies.releaseLease({
      name: "price:scheduler",
      workerId: input.workerId,
    });
  }
}
