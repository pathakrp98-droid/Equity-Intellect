import assert from "node:assert/strict";
import test from "node:test";

import {
  ResearchWorkerFatalError,
  runResearchBatch,
  type ResearchWorkerDependencies,
} from "./researchWorker";

const NOW = new Date("2026-08-21T00:15:00.000Z");

function dependencies(
  overrides: Partial<ResearchWorkerDependencies> = {},
): ResearchWorkerDependencies {
  let locked = false;
  return {
    acquireGlobalLease: async () => {
      if (locked) return false;
      locked = true;
      return true;
    },
    releaseGlobalLease: async () => {
      locked = false;
    },
    recoverExpiredLeases: async () => ({ events: 1, jobs: 2 }),
    enqueueDueDailyJobs: async () => 3,
    claimTriggerEvents: async () => [{ id: 1 }, { id: 2 }],
    processTriggerEvent: async () => undefined,
    claimJobs: async ({ limit }) =>
      Array.from({ length: Math.min(limit, 4) }, (_, index) => ({
        id: index + 10,
        userId: `user-${index + 1}`,
      })),
    runJob: async ({ jobId }) => ({
      status: jobId === 11 ? "retrying" : "succeeded",
    }),
    countRemainingJobs: async () => 7,
    ...overrides,
  };
}

test("worker: refuses a concurrent global batch", async () => {
  let claimed = false;
  const summary = await runResearchBatch(
    { workerId: "worker-b", now: NOW },
    dependencies({
      acquireGlobalLease: async () => false,
      claimJobs: async () => {
        claimed = true;
        return [];
      },
    }),
  );

  assert.equal(summary.status, "skipped");
  assert.equal(summary.leaseAcquired, false);
  assert.equal(claimed, false);
});

test("worker: recovers leases, schedules daily work, consumes events, then runs a bounded batch", async () => {
  const order: string[] = [];
  let claimLimit = 0;
  const summary = await runResearchBatch(
    {
      workerId: "worker-a",
      now: NOW,
      maxEvents: 8,
      maxJobs: 2,
      concurrency: 2,
      leaseMs: 120_000,
    },
    dependencies({
      recoverExpiredLeases: async () => {
        order.push("recover");
        return { events: 1, jobs: 2 };
      },
      enqueueDueDailyJobs: async () => {
        order.push("daily");
        return 3;
      },
      claimTriggerEvents: async () => {
        order.push("claim-events");
        return [{ id: 1 }, { id: 2 }];
      },
      processTriggerEvent: async ({ event }) => {
        order.push(`event-${event.id}`);
      },
      claimJobs: async ({ limit }) => {
        order.push("claim-jobs");
        claimLimit = limit;
        return [
          { id: 10, userId: "user-1" },
          { id: 11, userId: "user-2" },
        ];
      },
    }),
  );

  assert.deepEqual(order, [
    "recover",
    "daily",
    "claim-events",
    "event-1",
    "event-2",
    "claim-jobs",
  ]);
  assert.equal(claimLimit, 2);
  assert.equal(summary.recoveredJobs, 2);
  assert.equal(summary.dailyJobsEnqueued, 3);
  assert.equal(summary.eventsProcessed, 2);
  assert.equal(summary.jobsClaimed, 2);
  assert.equal(summary.succeeded, 1);
  assert.equal(summary.retried, 1);
  assert.equal(summary.remaining, 7);
  assert.equal(summary.status, "partial");
});

test("worker: job concurrency never exceeds the configured bound", async () => {
  let active = 0;
  let maximum = 0;
  const waits = new Map<number, () => void>();
  const started: number[] = [];
  const deps = dependencies({
    claimJobs: async () =>
      [1, 2, 3, 4].map((id) => ({ id, userId: `user-${id}` })),
    runJob: async ({ jobId }) => {
      active += 1;
      maximum = Math.max(maximum, active);
      started.push(jobId);
      await new Promise<void>((resolve) => waits.set(jobId, resolve));
      active -= 1;
      return { status: "succeeded" };
    },
  });

  const pending = runResearchBatch(
    { workerId: "worker-a", now: NOW, maxJobs: 4, concurrency: 2 },
    deps,
  );
  while (started.length < 2) await Promise.resolve();
  assert.deepEqual(started, [1, 2]);
  waits.get(1)!();
  waits.get(2)!();
  while (started.length < 4) await Promise.resolve();
  waits.get(3)!();
  waits.get(4)!();
  await pending;

  assert.equal(maximum, 2);
});

test("worker: one failed holding does not stop other jobs and produces a safe summary", async () => {
  const completed: number[] = [];
  const summary = await runResearchBatch(
    { workerId: "worker-a", now: NOW, maxJobs: 3, concurrency: 2 },
    dependencies({
      claimTriggerEvents: async () => [],
      claimJobs: async () => [
        { id: 1, userId: "user-a" },
        { id: 2, userId: "user-b" },
        { id: 3, userId: "user-c" },
      ],
      runJob: async ({ jobId }) => {
        completed.push(jobId);
        if (jobId === 2) throw new Error("upstream payload must not leak");
        return { status: jobId === 3 ? "dead_letter" : "succeeded" };
      },
    }),
  );

  assert.deepEqual(completed.sort(), [1, 2, 3]);
  assert.equal(summary.succeeded, 1);
  assert.equal(summary.failed, 2);
  assert.equal(summary.status, "partial");
  assert.equal(JSON.stringify(summary).includes("upstream payload"), false);
});

test("worker: fatal scheduler failures are distinguishable for a non-zero entry exit", async () => {
  await assert.rejects(
    runResearchBatch(
      { workerId: "worker-a", now: NOW },
      dependencies({
        recoverExpiredLeases: async () => {
          throw new Error("database unavailable");
        },
      }),
    ),
    (error: unknown) =>
      error instanceof ResearchWorkerFatalError &&
      error.code === "scheduler_unavailable" &&
      !error.message.includes("database unavailable"),
  );
});
