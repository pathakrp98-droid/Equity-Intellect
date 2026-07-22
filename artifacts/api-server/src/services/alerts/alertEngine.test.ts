import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateRule,
  isRuleCoolingDown,
  meetsSeverityThreshold,
} from "./alertEngine";

const now = new Date("2026-07-19T05:00:00.000Z");

test("severity threshold works in the expected direction", () => {
  assert.equal(meetsSeverityThreshold("high", "medium"), true);
  assert.equal(meetsSeverityThreshold("low", "medium"), false);
});

test("cooldown prevents repeated alerts", () => {
  assert.equal(
    isRuleCoolingDown(
      { cooldownMinutes: 60, lastTriggeredAt: new Date(now.getTime() - 30 * 60_000) },
      now,
    ),
    true,
  );
});

test("price-above rule creates a grounded candidate", () => {
  const candidates = evaluateRule(
    {
      id: 1,
      name: "Reliance target",
      ticker: "RELIANCE",
      ruleType: "price_above",
      severity: "medium",
      threshold: 3000,
      textValue: null,
      lookaheadDays: null,
      cooldownMinutes: 60,
      lastTriggeredAt: null,
      config: {},
    },
    {
      quotes: [
        {
          ticker: "RELIANCE",
          price: 3050,
          changePct: 1.2,
          previousClose: 3014,
          asOf: now,
          source: "test-provider",
        },
      ],
      news: [],
      events: [],
      theses: [],
      now,
    },
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].ticker, "RELIANCE");
  assert.equal(candidates[0].metadata.observedValue, 3050);
});

test("news keyword rule uses source item id for deduplication", () => {
  const candidates = evaluateRule(
    {
      id: 2,
      name: "Auditor alert",
      ticker: null,
      ruleType: "news_keyword",
      severity: "high",
      threshold: null,
      textValue: "auditor resignation",
      lookaheadDays: null,
      cooldownMinutes: 0,
      lastTriggeredAt: null,
      config: {},
    },
    {
      quotes: [],
      news: [
        {
          id: 99,
          ticker: "ABC",
          headline: "ABC announces auditor resignation",
          summary: null,
          sentiment: "negative",
          relevanceScore: 0.9,
          publishedAt: now,
          source: "Exchange filing",
        },
      ],
      events: [],
      theses: [],
      now,
    },
  );
  assert.equal(candidates[0].dedupeKey, "rule:2:news:99");
});
