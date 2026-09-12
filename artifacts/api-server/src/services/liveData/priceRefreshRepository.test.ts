import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PriceRefreshRepository,
  localDateInKolkata,
  type PriceRefreshQueryAdapter,
} from "./priceRefreshRepository";

interface RecordedQuery {
  text: string;
  values: unknown[];
}

function adapter(
  responses: Array<{ rows: Array<Record<string, unknown>>; rowCount?: number }>,
) {
  const queries: RecordedQuery[] = [];
  const queryAdapter: PriceRefreshQueryAdapter = {
    async query(text, values = []) {
      queries.push({ text, values });
      const response = responses.shift();
      if (!response) throw new Error("Unexpected query");
      return {
        rows: response.rows,
        rowCount: response.rowCount ?? response.rows.length,
      };
    },
  };
  return { queryAdapter, queries };
}

describe("price refresh repository", () => {
  it("buckets attempts at the Asia/Kolkata midnight boundary", () => {
    assert.equal(
      localDateInKolkata(new Date("2026-09-09T18:29:59.999Z")),
      "2026-09-09",
    );
    assert.equal(
      localDateInKolkata(new Date("2026-09-09T18:30:00.000Z")),
      "2026-09-10",
    );
  });

  it("discovers portfolio owners dynamically from either holdings source", async () => {
    const fake = adapter([
      { rows: [{ user_id: "owner-b" }, { user_id: "owner-a" }] },
    ]);
    const repository = new PriceRefreshRepository(fake.queryAdapter);

    assert.deepEqual(await repository.listActivePortfolioUserIds(), [
      "owner-b",
      "owner-a",
    ]);
    assert.match(fake.queries[0]!.text, /FROM portfolios p/i);
    assert.match(fake.queries[0]!.text, /portfolio_holdings/i);
    assert.match(fake.queries[0]!.text, /portfolio_direct_holdings/i);
    assert.match(fake.queries[0]!.text, /p\.user_id/i);
    assert.doesNotMatch(fake.queries[0]!.text, /NIFTY|RELIANCE|ETF/i);
  });

  it("acquires leases atomically, allowing only expiry takeover or owner renewal", async () => {
    const now = new Date("2026-09-10T10:00:00.000Z");
    const fake = adapter([
      { rows: [{ name: "user:owner-a" }] },
      { rows: [] },
    ]);
    const repository = new PriceRefreshRepository(fake.queryAdapter);

    assert.equal(
      await repository.acquirePriceRefreshLease({
        name: "user:owner-a",
        workerId: "worker-a",
        now,
        leaseMs: 600_000,
      }),
      true,
    );
    assert.equal(
      await repository.acquirePriceRefreshLease({
        name: "user:owner-a",
        workerId: "worker-b",
        now,
        leaseMs: 600_000,
      }),
      false,
    );
    assert.match(fake.queries[0]!.text, /ON CONFLICT \(name\) DO UPDATE/i);
    assert.match(
      fake.queries[0]!.text,
      /price_refresh_leases\.expires_at\s*<=\s*\$4/i,
    );
    assert.match(
      fake.queries[0]!.text,
      /price_refresh_leases\.worker_id\s*=\s*\$2/i,
    );
    assert.equal(
      (fake.queries[0]!.values[2] as Date).toISOString(),
      "2026-09-10T10:10:00.000Z",
    );
    assert.equal(fake.queries[0]!.values[3], now);
  });

  it("releases a lease only for its exact name and owner", async () => {
    const fake = adapter([{ rows: [{ name: "scheduler" }] }]);
    const repository = new PriceRefreshRepository(fake.queryAdapter);

    assert.equal(
      await repository.releasePriceRefreshLease({
        name: "scheduler",
        workerId: "worker-a",
      }),
      true,
    );
    assert.match(
      fake.queries[0]!.text,
      /WHERE name = \$1 AND worker_id = \$2/i,
    );
    assert.deepEqual(fake.queries[0]!.values, ["scheduler", "worker-a"]);
  });

  it("claims the next attempt atomically with cooldown and daily limits", async () => {
    const now = new Date("2026-09-10T10:00:00.000Z");
    const fake = adapter([
      {
        rows: [
          {
            id: 12,
            attempt_number: 2,
            local_day: "2026-09-10",
          },
        ],
      },
    ]);
    const repository = new PriceRefreshRepository(fake.queryAdapter);

    assert.deepEqual(
      await repository.claimAutomaticPriceAttempt({
        userId: "owner-a",
        workerId: "worker-a",
        now,
      }),
      {
        claimed: true,
        attemptId: 12,
        attemptNumber: 2,
        localDay: "2026-09-10",
      },
    );
    const query = fake.queries[0]!;
    assert.match(query.text, /status = 'fresh'/i);
    assert.match(query.text, /attempt_count < 3/i);
    assert.match(query.text, /last_started_at <= \$5/i);
    assert.match(query.text, /ON CONFLICT DO NOTHING/i);
    assert.deepEqual(query.values.slice(0, 4), [
      "owner-a",
      "2026-09-10",
      "worker-a",
      now,
    ]);
    assert.equal(
      (query.values[4] as Date).toISOString(),
      "2026-09-10T09:30:00.000Z",
    );
  });

  for (const scenario of [
    {
      name: "suppresses a completed fresh day",
      rows: [{ status: "fresh", attempt_number: 1, started_at: new Date(0) }],
      reason: "already_fresh",
    },
    {
      name: "enforces the three-attempt ceiling",
      rows: [
        { status: "failed", attempt_number: 3, started_at: new Date(0) },
      ],
      reason: "attempt_limit",
    },
    {
      name: "enforces thirty minutes between retries",
      rows: [
        {
          status: "partial",
          attempt_number: 1,
          started_at: new Date("2026-09-10T09:45:00.000Z"),
        },
      ],
      reason: "retry_not_due",
    },
  ] as const) {
    it(scenario.name, async () => {
      const fake = adapter([{ rows: [] }, { rows: [...scenario.rows] }]);
      const repository = new PriceRefreshRepository(fake.queryAdapter);
      const result = await repository.claimAutomaticPriceAttempt({
        userId: "owner-a",
        workerId: "worker-a",
        now: new Date("2026-09-10T10:00:00.000Z"),
      });
      assert.deepEqual(result, { claimed: false, reason: scenario.reason });
      assert.match(
        fake.queries[1]!.text,
        /WHERE user_id = \$1 AND local_day = \$2/i,
      );
    });
  }

  it("reports a race safely when a unique concurrent claim wins", async () => {
    const fake = adapter([{ rows: [] }, { rows: [] }]);
    const repository = new PriceRefreshRepository(fake.queryAdapter);
    assert.deepEqual(
      await repository.claimAutomaticPriceAttempt({
        userId: "owner-a",
        workerId: "worker-a",
        now: new Date("2026-09-10T10:00:00.000Z"),
      }),
      { claimed: false, reason: "concurrent_attempt" },
    );
  });

  it("completes only the exact running user attempt and worker", async () => {
    const fake = adapter([{ rows: [{ id: 12 }] }]);
    const repository = new PriceRefreshRepository(fake.queryAdapter);
    assert.equal(
      await repository.completeAutomaticPriceAttempt({
        attemptId: 12,
        userId: "owner-a",
        workerId: "worker-a",
        status: "partial",
        completedAt: new Date("2026-09-10T10:01:00.000Z"),
        diagnostics: {
          expectedSymbols: 4,
          receivedSymbols: 3,
          providers: [
            { provider: "alpha-vantage", status: "stale_fallback", records: 3 },
          ],
        },
        errorCode: "quotes_partial",
      }),
      true,
    );
    assert.match(
      fake.queries[0]!.text,
      /WHERE id = \$1[\s\S]*user_id = \$2[\s\S]*worker_id = \$3[\s\S]*status = 'running'/i,
    );
    assert.equal(fake.queries[0]!.values[1], "owner-a");
    assert.equal(fake.queries[0]!.values[2], "worker-a");
    assert.equal(typeof fake.queries[0]!.values[6], "string");
    assert.doesNotMatch(String(fake.queries[0]!.values[6]), /password|token/i);
  });
});
