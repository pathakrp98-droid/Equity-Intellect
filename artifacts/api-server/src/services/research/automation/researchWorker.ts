export interface ResearchWorkerEvent {
  id: number;
  userId?: string;
  portfolioId?: number | null;
  ticker?: string | null;
  trigger?: string;
  attempts?: number;
  payload?: Record<string, unknown>;
}

export interface ResearchWorkerJob {
  id: number;
  userId: string;
}

interface WorkerClaimInput {
  workerId: string;
  limit: number;
  now: Date;
  leaseExpiresAt: Date;
}

export interface ResearchWorkerDependencies {
  acquireGlobalLease(workerId: string): Promise<boolean>;
  releaseGlobalLease(workerId: string): Promise<void>;
  recoverExpiredLeases(now: Date): Promise<{ events: number; jobs: number }>;
  enqueueDueDailyJobs(now: Date): Promise<number>;
  claimTriggerEvents(input: WorkerClaimInput): Promise<ResearchWorkerEvent[]>;
  processTriggerEvent(input: {
    event: ResearchWorkerEvent;
    workerId: string;
    now: Date;
  }): Promise<void>;
  claimJobs(input: WorkerClaimInput): Promise<ResearchWorkerJob[]>;
  runJob(input: {
    userId: string;
    jobId: number;
    workerId: string;
  }): Promise<{ status: "succeeded" | "retrying" | "dead_letter" | "skipped" }>;
  countRemainingJobs(now: Date): Promise<number>;
}

export interface RunResearchBatchOptions {
  workerId: string;
  now?: Date;
  maxEvents?: number;
  maxJobs?: number;
  concurrency?: number;
  leaseMs?: number;
}

export interface ResearchBatchSummary {
  status: "succeeded" | "partial" | "failed" | "skipped";
  leaseAcquired: boolean;
  recoveredEvents: number;
  recoveredJobs: number;
  dailyJobsEnqueued: number;
  eventsProcessed: number;
  eventsFailed: number;
  jobsClaimed: number;
  succeeded: number;
  retried: number;
  failed: number;
  skipped: number;
  remaining: number;
}

export class ResearchWorkerFatalError extends Error {
  readonly code = "scheduler_unavailable";

  constructor() {
    super("Research scheduler is unavailable.");
    this.name = "ResearchWorkerFatalError";
  }
}

function bounded(value: number, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ResearchWorkerFatalError();
  }
  return value;
}

function workerId(value: string): string {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > 120 ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new ResearchWorkerFatalError();
  }
  return normalized;
}

function emptySummary(leaseAcquired: boolean): ResearchBatchSummary {
  return {
    status: leaseAcquired ? "succeeded" : "skipped",
    leaseAcquired,
    recoveredEvents: 0,
    recoveredJobs: 0,
    dailyJobsEnqueued: 0,
    eventsProcessed: 0,
    eventsFailed: 0,
    jobsClaimed: 0,
    succeeded: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
    remaining: 0,
  };
}

async function mapConcurrent<T>(
  items: readonly T[],
  concurrency: number,
  operation: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const next = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await operation(items[index]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => next()),
  );
}

export async function runResearchBatch(
  options: RunResearchBatchOptions,
  dependencies: ResearchWorkerDependencies,
): Promise<ResearchBatchSummary> {
  const id = workerId(options.workerId);
  const now = options.now ?? new Date();
  const maxEvents = bounded(options.maxEvents ?? 50, 1, 250);
  const maxJobs = bounded(options.maxJobs ?? 25, 1, 250);
  const concurrency = bounded(options.concurrency ?? 2, 1, 10);
  const leaseMs = bounded(options.leaseMs ?? 10 * 60_000, 30_000, 60 * 60_000);

  let acquired: boolean;
  try {
    acquired = await dependencies.acquireGlobalLease(id);
  } catch {
    throw new ResearchWorkerFatalError();
  }
  if (!acquired) return emptySummary(false);

  const summary = emptySummary(true);
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);
  try {
    const recovered = await dependencies.recoverExpiredLeases(now);
    summary.recoveredEvents = recovered.events;
    summary.recoveredJobs = recovered.jobs;
    summary.dailyJobsEnqueued = await dependencies.enqueueDueDailyJobs(now);

    const events = await dependencies.claimTriggerEvents({
      workerId: id,
      limit: maxEvents,
      now,
      leaseExpiresAt,
    });
    for (const event of events) {
      try {
        await dependencies.processTriggerEvent({ event, workerId: id, now });
        summary.eventsProcessed += 1;
      } catch {
        summary.eventsFailed += 1;
      }
    }

    const jobs = await dependencies.claimJobs({
      workerId: id,
      limit: maxJobs,
      now,
      leaseExpiresAt,
    });
    summary.jobsClaimed = jobs.length;
    await mapConcurrent(jobs, concurrency, async (job) => {
      try {
        const result = await dependencies.runJob({
          userId: job.userId,
          jobId: job.id,
          workerId: id,
        });
        if (result.status === "succeeded") summary.succeeded += 1;
        else if (result.status === "retrying") summary.retried += 1;
        else if (result.status === "dead_letter") summary.failed += 1;
        else summary.skipped += 1;
      } catch {
        summary.failed += 1;
      }
    });
    summary.remaining = await dependencies.countRemainingJobs(now);

    const failures = summary.eventsFailed + summary.failed;
    if (failures > 0) {
      summary.status =
        summary.succeeded + summary.retried > 0 ? "partial" : "failed";
    } else if (summary.retried > 0 || summary.skipped > 0) {
      summary.status = "partial";
    }
    return summary;
  } catch (error) {
    if (error instanceof ResearchWorkerFatalError) throw error;
    throw new ResearchWorkerFatalError();
  } finally {
    try {
      await dependencies.releaseGlobalLease(id);
    } catch {
      if (summary.status !== "failed") throw new ResearchWorkerFatalError();
    }
  }
}
