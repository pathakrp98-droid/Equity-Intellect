import assert from "node:assert/strict";
import test from "node:test";

import type { NormalizedMarketImport } from "./types";
import { buildMaterialResearchTriggers } from "../research/automation/researchTriggers";

const NOW = new Date("2026-08-21T04:00:00.000Z");

function normalized(): NormalizedMarketImport {
  return {
    provider: "test-provider",
    fetchedAt: NOW,
    points: [],
    news: [
      {
        externalId: "news-high",
        ticker: "RELIANCE",
        headline: "Material update",
        summary: null,
        source: "exchange",
        sourceUrl: "https://example.com/high",
        publishedAt: NOW,
        sentiment: "neutral",
        relevanceScore: 0.8,
        isPortfolioRelevant: true,
        metadata: {},
      },
      {
        externalId: "news-low",
        ticker: "RELIANCE",
        headline: "Minor mention",
        summary: null,
        source: "newswire",
        sourceUrl: null,
        publishedAt: NOW,
        sentiment: "neutral",
        relevanceScore: 0.79,
        isPortfolioRelevant: true,
        metadata: {},
      },
    ],
    events: [
      {
        externalId: "earnings",
        ticker: "TCS",
        companyName: "TCS",
        eventType: "earnings",
        title: "Quarterly results",
        description: null,
        eventAt: NOW,
        impact: "medium",
        source: "exchange",
        sourceUrl: null,
        isPortfolioRelevant: true,
        metadata: {},
      },
      {
        externalId: "macro",
        ticker: null,
        companyName: null,
        eventType: "macro",
        title: "Macro event",
        description: null,
        eventAt: NOW,
        impact: "critical",
        source: "calendar",
        sourceUrl: null,
        isPortfolioRelevant: false,
        metadata: {},
      },
    ],
    warnings: [],
  };
}

test("market research trigger: only material portfolio news and events enter the outbox", () => {
  const events = buildMaterialResearchTriggers(
    "user-a",
    normalized(),
    new Set(["RELIANCE", "TCS"]),
  );

  assert.deepEqual(
    events.map((event) => ({
      ticker: event.ticker,
      dedupeKey: event.dedupeKey,
      externalId: event.payload.externalId,
    })),
    [
      {
        ticker: "RELIANCE",
        dedupeKey: "material:exchange:news-high",
        externalId: "news-high",
      },
      {
        ticker: "TCS",
        dedupeKey: "material:exchange:earnings",
        externalId: "earnings",
      },
    ],
  );
});

test("market research trigger: duplicate provider IDs collapse and non-portfolio tickers are excluded", () => {
  const data = normalized();
  data.news.push({ ...data.news[0]! });
  data.events.push({
    ...data.events[0]!,
    externalId: "other-company",
    ticker: "INFY",
  });

  const events = buildMaterialResearchTriggers(
    "user-a",
    data,
    new Set(["RELIANCE", "TCS"]),
  );
  assert.equal(events.length, 2);
  assert.equal(new Set(events.map((event) => event.dedupeKey)).size, 2);
});

test("market research trigger: long provider IDs remain collision-safe", () => {
  const data = normalized();
  data.events = [];
  data.news = [
    {
      ...data.news[0]!,
      externalId: `${"same-prefix".repeat(25)}-A`,
    },
    {
      ...data.news[0]!,
      externalId: `${"same-prefix".repeat(25)}-B`,
    },
  ];
  const events = buildMaterialResearchTriggers(
    "user-a",
    data,
    new Set(["RELIANCE"]),
  );
  assert.equal(events.length, 2);
  assert.equal(new Set(events.map((event) => event.dedupeKey)).size, 2);
  assert.equal(
    events.every((event) => event.dedupeKey.length <= 180),
    true,
  );
});
