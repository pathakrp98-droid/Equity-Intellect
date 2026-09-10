import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  runAutomaticPriceRefreshForUser,
  runPriceRefreshBatch,
  userPriceRefreshLeaseName,
  type PriceRefreshSchedulerDependencies,
} from "./priceRefreshScheduler";

const NOW = new Date("2026-09-10T10:00:00.000Z");

function dependencies(
  overrides: Partial<PriceRefreshSchedulerDependencies> = {},
): PriceRefreshSchedulerDependencies {
  return {
    now: () => NOW,
    acquireLease: async () => true,
    releaseLease: async () => true,
    claimAttempt: async () => ({
      claimed: true,
      attemptId: 7,
      attemptNumber: 1,
      localDay: "2026-09-10",
    }),
    completeAttempt: async () => true,
    listActiveUserIds: async () => ["owner-a"],
    refreshQuotes: async () => ({
      refreshedAt: NOW,
      expectedSymbols: 2,
      receivedSymbols: 2,
      diagnostics: [
        {
          provider: "alpha-vantage",
          capability: "quotes",
          status: "success",
          records: 2,
        },
      ],
      autoEvaluateAlerts: false,
    }),
    evaluateAlerts: async () => ({
      evaluatedAt: NOW,
      candidates: 1,
      alertsUpserted: 1,
    }),
    ...overrides,
  };
}

describe("automatic price refresh scheduler", () => {
  it("uses a bounded opaque per-user lease name", () => {
    const first = userPriceRefreshLeaseName("owner-a");
    assert.match(first, /^price:user:[a-f0-9]{64}$/);
    assert.equal(first, userPriceRefreshLeaseName("owner-a"));
    assert.notEqual(first, userPriceRefreshLeaseName("owner-b"));
    assert.doesNotMatch(first, /owner-a/);
  });

  it("does not claim or fetch when another process owns the user lease", async () => {
    let claimed = false;
    let refreshed = false;
    const result = await runAutomaticPriceRefreshForUser(
      { userId: "owner-a", workerId: "worker-a" },
      dependencies({
        acquireLease: async () => false,
        claimAttempt: async () => {
          claimed = true;
          throw new Error("must not claim");
        },
        refreshQuotes: async () => {
          refreshed = true;
          throw new Error("must not refresh");
        },
      }),
    );

    assert.deepEqual(result, {
      attempted: false,
      reason: "concurrent_refresh",
    });
    assert.equal(claimed, false);
    assert.equal(refreshed, false);
  });

  it("does not fetch after the repository suppresses a fresh day", async () => {
    let refreshed = false;
    let released = false;
    const result = await runAutomaticPriceRefreshForUser(
      { userId: "owner-a", workerId: "worker-a" },
      dependencies({
        claimAttempt: async () => ({
          claimed: false,
          reason: "already_fresh",
        }),
        refreshQuotes: async () => {
          refreshed = true;
          throw new Error("must not refresh");
        },
        releaseLease: async () => {
          released = true;
          return true;
        },
      }),
    );

    assert.deepEqual(result, { attempted: false, reason: "already_fresh" });
    assert.equal(refreshed, false);
    assert.equal(released, true);
  });

  it("records a fully fresh quote result and optional alert evaluation", async () => {
    const order: string[] = [];
    const completions: Array<Record<string, unknown>> = [];
    const result = await runAutomaticPriceRefreshForUser(
      { userId: "owner-a", workerId: "worker-a" },
      dependencies({
        acquireLease: async ({ name }) => {
          order.push(`acquire:${name}`);
          return true;
        },
        claimAttempt: async () => {
          order.push("claim");
          return {
            claimed: true,
            attemptId: 7,
            attemptNumber: 1,
            localDay: "2026-09-10",
          };
        },
        refreshQuotes: async () => {
          order.push("quotes");
          return {
            refreshedAt: NOW,
            expectedSymbols: 2,
            receivedSymbols: 2,
            diagnostics: [
              {
                provider: "alpha-vantage",
                capability: "quotes",
                status: "success",
                records: 2,
              },
            ],
            autoEvaluateAlerts: true,
          };
        },
        evaluateAlerts: async () => {
          order.push("alerts");
          return { evaluatedAt: NOW, candidates: 1, alertsUpserted: 1 };
        },
        completeAttempt: async (input) => {
          order.push("complete");
          completions.push(input);
          return true;
        },
        releaseLease: async () => {
          order.push("release");
          return true;
        },
      }),
    );

    assert.deepEqual(order.slice(1), [
      "claim",
      "quotes",
      "alerts",
      "complete",
      "release",
    ]);
    assert.match(order[0]!, /^acquire:price:user:/);
    assert.equal(completions[0]?.status, "fresh");
    assert.equal(completions[0]?.errorCode, null);
    assert.equal(result.attempted, true);
    if (result.attempted) {
      assert.equal(result.status, "fresh");
      assert.equal(result.alertEvaluation?.alertsUpserted, 1);
    }
  });

  it("records missing tickers as partial and retains stale diagnostics", async () => {
    let completion: Record<string, unknown> | undefined;
    const result = await runAutomaticPriceRefreshForUser(
      { userId: "owner-a", workerId: "worker-a" },
      dependencies({
        refreshQuotes: async () => ({
          refreshedAt: NOW,
          expectedSymbols: 4,
          receivedSymbols: 3,
          diagnostics: [
            {
              provider: "alpha-vantage",
              capability: "quotes",
              status: "stale_fallback",
              records: 3,
              message: "upstream details must not enter the ledger",
            },
          ],
          autoEvaluateAlerts: false,
        }),
        completeAttempt: async (input) => {
          completion = input;
          return true;
        },
      }),
    );

    assert.equal(result.attempted && result.status, "partial");
    assert.equal(completion?.errorCode, "quotes_partial");
    assert.doesNotMatch(JSON.stringify(completion), /upstream details/);
  });

  it("records provider exceptions safely and always releases the lease", async () => {
    const order: string[] = [];
    let completion: Record<string, unknown> | undefined;
    const result = await runAutomaticPriceRefreshForUser(
      { userId: "owner-a", workerId: "worker-a" },
      dependencies({
        refreshQuotes: async () => {
          order.push("quotes");
          throw new Error("private provider payload");
        },
        completeAttempt: async (input) => {
          order.push("complete");
          completion = input;
          return true;
        },
        releaseLease: async () => {
          order.push("release");
          return true;
        },
      }),
    );

    assert.deepEqual(order, ["quotes", "complete", "release"]);
    assert.equal(result.attempted && result.status, "failed");
    assert.equal(completion?.errorCode, "quotes_unavailable");
    assert.doesNotMatch(JSON.stringify(result), /private provider payload/);
  });

  it("discovers users, bounds concurrency, and isolates one user's failure", async () => {
    let active = 0;
    let maximum = 0;
    const completed: string[] = [];
    const summary = await runPriceRefreshBatch(
      { workerId: "batch-a", concurrency: 2 },
      dependencies({
        listActiveUserIds: async () => ["owner-a", "owner-b", "owner-c"],
        claimAttempt: async ({ userId }) => {
          if (userId === "owner-b") throw new Error("one owner failed");
          return {
            claimed: true,
            attemptId: userId === "owner-a" ? 1 : 3,
            attemptNumber: 1,
            localDay: "2026-09-10",
          };
        },
        refreshQuotes: async ({ userId }) => {
          active += 1;
          maximum = Math.max(maximum, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active -= 1;
          completed.push(userId);
          return {
            refreshedAt: NOW,
            expectedSymbols: 1,
            receivedSymbols: 1,
            diagnostics: [
              {
                provider: "alpha-vantage",
                capability: "quotes",
                status: "success",
                records: 1,
              },
            ],
            autoEvaluateAlerts: false,
          };
        },
      }),
    );

    assert.equal(maximum <= 2, true);
    assert.deepEqual(completed.sort(), ["owner-a", "owner-c"]);
    assert.deepEqual(summary, {
      status: "partial",
      leaseAcquired: true,
      usersDiscovered: 3,
      attempted: 2,
      fresh: 2,
      partial: 0,
      failed: 1,
      skipped: 0,
    });
  });

  it("returns a finite skipped summary when another global batch is active", async () => {
    let listed = false;
    const summary = await runPriceRefreshBatch(
      { workerId: "batch-b" },
      dependencies({
        acquireLease: async ({ name }) => name !== "price:scheduler",
        listActiveUserIds: async () => {
          listed = true;
          return [];
        },
      }),
    );
    assert.equal(listed, false);
    assert.deepEqual(summary, {
      status: "skipped",
      leaseAcquired: false,
      usersDiscovered: 0,
      attempted: 0,
      fresh: 0,
      partial: 0,
      failed: 0,
      skipped: 0,
    });
  });
});
