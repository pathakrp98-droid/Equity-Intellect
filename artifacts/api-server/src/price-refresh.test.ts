import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  executePriceRefreshCommand,
  loadPriceRefreshCommandConfig,
} from "./price-refresh";

describe("finite price refresh command", () => {
  it("loads bounded no-spend scheduler settings", () => {
    assert.deepEqual(
      loadPriceRefreshCommandConfig({ PRICE_REFRESH_CONCURRENCY: "3" }),
      {
        concurrency: 3,
        globalLeaseMs: 600_000,
        userLeaseMs: 600_000,
      },
    );
    assert.throws(
      () => loadPriceRefreshCommandConfig({ PRICE_REFRESH_CONCURRENCY: "0" }),
      /PRICE_REFRESH_CONCURRENCY/,
    );
    assert.throws(
      () =>
        loadPriceRefreshCommandConfig({ PRICE_REFRESH_GLOBAL_LEASE_MS: "1" }),
      /PRICE_REFRESH_GLOBAL_LEASE_MS/,
    );
  });

  it("runs once, logs only the safe aggregate, and closes the pool", async () => {
    const calls: string[] = [];
    const logs: unknown[] = [];
    const result = await executePriceRefreshCommand(
      { env: {}, workerId: "host:123:uuid" },
      {
        runBatch: async (options) => {
          calls.push(`run:${options.concurrency}`);
          return {
            status: "partial",
            leaseAcquired: true,
            usersDiscovered: 2,
            attempted: 2,
            fresh: 1,
            partial: 1,
            failed: 0,
            skipped: 0,
          };
        },
        closePool: async () => {
          calls.push("close");
        },
        logCompleted: (summary) => logs.push(summary),
        logFatal: () => calls.push("fatal"),
      },
    );

    assert.equal(result.exitCode, 0);
    assert.deepEqual(calls, ["run:2", "close"]);
    assert.equal(logs.length, 1);
    assert.doesNotMatch(JSON.stringify(logs), /ticker|provider payload|user-/i);
  });

  it("returns a nonzero exit for fatal scheduler failures and still closes", async () => {
    const calls: string[] = [];
    const result = await executePriceRefreshCommand(
      { env: {}, workerId: "host:123:uuid" },
      {
        runBatch: async () => {
          throw new Error("database URL and private payload");
        },
        closePool: async () => {
          calls.push("close");
        },
        logCompleted: () => calls.push("completed"),
        logFatal: (code) => calls.push(`fatal:${code}`),
      },
    );

    assert.deepEqual(result, { exitCode: 1, summary: null });
    assert.deepEqual(calls, ["fatal:scheduler_unavailable", "close"]);
    assert.doesNotMatch(JSON.stringify(result), /database URL|private payload/);
  });
});
