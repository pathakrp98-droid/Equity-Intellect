import assert from "node:assert/strict";
import test from "node:test";

import {
  isMarketPointStale,
  normalizeMarketImport,
  normalizeTicker,
  stableExternalId,
} from "./normalization";

test("normalizes tickers and rejects unsupported characters", () => {
  assert.equal(normalizeTicker(" reliance "), "RELIANCE");
  assert.equal(normalizeTicker(null), null);
  assert.throws(() => normalizeTicker("BAD TICKER"), /Unsupported ticker/);
});

test("generates deterministic external IDs", () => {
  assert.equal(
    stableExternalId(["source", "RELIANCE", "headline"]),
    stableExternalId(["source", "RELIANCE", "headline"]),
  );
  assert.notEqual(
    stableExternalId(["source", "RELIANCE", "headline"]),
    stableExternalId(["source", "TCS", "headline"]),
  );
});

test("deduplicates imports and marks portfolio relevance", () => {
  const now = new Date("2026-07-19T02:00:00.000Z");
  const result = normalizeMarketImport(
    {
      provider: "test",
      points: [
        {
          kind: "index",
          symbol: "nifty50",
          name: "Nifty 50",
          value: 25000,
          source: "Exchange",
          asOf: now,
        },
        {
          kind: "index",
          symbol: "NIFTY50",
          name: "Nifty 50",
          value: 25100,
          source: "Exchange",
          asOf: now,
        },
      ],
      news: [
        {
          externalId: "n1",
          ticker: "reliance",
          headline: "Verified update",
          source: "Exchange",
          publishedAt: now,
        },
      ],
      events: [],
    },
    ["RELIANCE"],
    now,
  );

  assert.equal(result.points.length, 1);
  assert.equal(result.points[0]?.value, 25100);
  assert.equal(result.news[0]?.ticker, "RELIANCE");
  assert.equal(result.news[0]?.isPortfolioRelevant, true);
  assert.equal(result.news[0]?.relevanceScore, 0.9);
  assert.ok(result.warnings.some((warning) => /Duplicate/.test(warning)));
});

test("classifies stale market points against a minute threshold", () => {
  const now = new Date("2026-07-19T02:00:00.000Z");
  assert.equal(
    isMarketPointStale(new Date("2026-07-19T01:00:00.000Z"), 90, now),
    false,
  );
  assert.equal(
    isMarketPointStale(new Date("2026-07-18T23:00:00.000Z"), 90, now),
    true,
  );
});


test("rejects unsupported event types from untrusted JSON", () => {
  assert.throws(
    () =>
      normalizeMarketImport(
        {
          events: [
            {
              eventType: "rumour" as never,
              title: "Unsupported event",
              eventAt: "2026-07-20T00:00:00.000Z",
              source: "Test source",
            },
          ],
        },
        [],
      ),
    /Unsupported market event type/,
  );
});


test("rejects unsafe source URL protocols", () => {
  assert.throws(
    () =>
      normalizeMarketImport(
        {
          news: [
            {
              headline: "Unsafe link",
              source: "Test source",
              sourceUrl: "javascript:alert(1)",
              publishedAt: "2026-07-19T00:00:00.000Z",
            },
          ],
        },
        [],
      ),
    /sourceUrl must use http or https/,
  );
});

test("rejects non-array import collections", () => {
  assert.throws(
    () => normalizeMarketImport({ points: {} as never }, []),
    /points must be an array/,
  );
});
