import assert from "node:assert/strict";
import test from "node:test";

import { buildMorningBrief } from "./briefEngine";
import type { BuildMorningBriefInput } from "./briefEngine";

const now = new Date("2026-07-19T02:00:00.000Z");

function baseInput(): BuildMorningBriefInput {
  return {
    now,
    providerConfigured: true,
    portfolio: {
      totalValue: 110000,
      cashBalance: 10000,
      totalPnl: 10000,
      totalReturnPct: 10,
      largestPositionTicker: "RELIANCE",
      largestPositionPct: 45,
      concentrationRisk: "high",
      holdingsCount: 2,
      riskFlags: [],
    },
    holdings: [
      {
        ticker: "RELIANCE",
        name: "Reliance Industries",
        sector: "Energy",
        quantity: 10,
        marketValue: 50000,
        allocationPct: 45,
        marketPrice: 5000,
        previousClose: 4900,
        dayChange: 100,
        dayChangePct: 2.04,
        unrealizedPnl: 5000,
        unrealizedPnlPct: 11.11,
        priceSource: "provider",
        priceStatus: "fresh",
      },
      {
        ticker: "TCS",
        name: "TCS",
        sector: "Technology",
        quantity: 10,
        marketValue: 50000,
        allocationPct: 45,
        marketPrice: 5000,
        previousClose: 5050,
        dayChange: -50,
        dayChangePct: -0.99,
        unrealizedPnl: 5000,
        unrealizedPnlPct: 11.11,
        priceSource: "provider",
        priceStatus: "fresh",
      },
    ],
    researchSignals: [
      {
        ticker: "RELIANCE",
        conviction: "high",
        status: "weakening",
        completenessScore: 45,
        nextReviewAt: new Date("2026-07-18T00:00:00.000Z"),
        targetPrice: 5500,
      },
    ],
    marketPoints: [
      {
        kind: "index",
        symbol: "NIFTY50",
        name: "Nifty 50",
        value: 25000,
        change: 100,
        changePct: 0.4,
        unit: "points",
        region: "India",
        source: "Exchange",
        sourceUrl: null,
        asOf: new Date("2026-07-19T01:30:00.000Z"),
      },
    ],
    news: [
      {
        id: 1,
        ticker: "RELIANCE",
        headline: "Margin guidance reduced",
        summary: "Management reduced margin guidance.",
        source: "Company filing",
        sourceUrl: null,
        publishedAt: new Date("2026-07-19T00:30:00.000Z"),
        sentiment: "negative",
        relevanceScore: 1,
        isPortfolioRelevant: true,
      },
    ],
    events: [
      {
        id: 1,
        ticker: "RELIANCE",
        title: "Quarterly results",
        eventType: "earnings",
        description: null,
        eventAt: new Date("2026-07-22T10:00:00.000Z"),
        impact: "high",
        source: "Company calendar",
        sourceUrl: null,
        isPortfolioRelevant: true,
      },
    ],
    preferences: {
      timezone: "Asia/Kolkata",
      staleMarketMinutes: 120,
      staleNewsHours: 36,
      includeGlobalMarkets: true,
      includeMacro: true,
      includePortfolioNews: true,
      includeUpcomingEvents: true,
    },
  };
}

test("builds a portfolio-aware brief with day P&L", () => {
  const result = buildMorningBrief(baseInput());
  assert.equal(result.briefDate, "2026-07-19");
  assert.equal(result.portfolioPulse.dailyPnl, 500);
  assert.equal(result.marketPulse.tone, "positive");
  assert.match(result.headline, /Portfolio up/);
  assert.deepEqual(
    result.portfolioPulse.movers.map((move) => move.ticker),
    ["RELIANCE", "TCS"],
  );
  assert.equal(result.portfolioPulse.movers[0]?.dayPnl, 1000);
  assert.equal(result.portfolioPulse.movers[0]?.contributionPct, 0.91);
});

test("prioritizes concentration, negative news and weakening theses", () => {
  const result = buildMorningBrief(baseInput());
  const ids = result.priorityActions.map((action) => action.id);
  assert.ok(ids.includes("review-largest-position"));
  assert.ok(ids.includes("review-news-1"));
  assert.ok(ids.includes("thesis-review-RELIANCE"));
  assert.ok(ids.includes("research-gap-RELIANCE"));
  assert.ok(result.risks.some((risk) => risk.id === "news-risk-1"));
});

test("labels missing provider and market data instead of inventing context", () => {
  const input = baseInput();
  input.providerConfigured = false;
  input.marketPoints = [];
  input.news = [];
  const result = buildMorningBrief(input);
  assert.equal(result.marketPulse.tone, "unknown");
  assert.match(result.marketPulse.summary, /unknown/);
  assert.ok(
    result.dataQuality.warnings.includes("No external provider is configured."),
  );
  assert.ok(
    result.priorityActions.some(
      (action) => action.id === "connect-market-provider",
    ),
  );
});

test("flags stale data and includes high-impact upcoming events", () => {
  const input = baseInput();
  input.marketPoints[0]!.asOf = new Date("2026-07-18T00:00:00.000Z");
  const result = buildMorningBrief(input);
  assert.equal(result.dataQuality.staleMarketPointCount, 1);
  assert.equal(result.upcomingEvents[0]?.title, "Quarterly results");
  assert.ok(
    result.priorityActions.some((action) => action.id === "prepare-event-1"),
  );
});

test("snapshots material company news and Guardian warnings", () => {
  const input = baseInput();
  input.guardian = {
    score: 68,
    band: "caution",
    topRisks: ["Largest position exceeds the configured stock limit."],
  };
  const result = buildMorningBrief(input);
  assert.equal(
    result.marketPulse.materialNews[0]?.headline,
    "Margin guidance reduced",
  );
  assert.equal(result.marketPulse.materialNews[0]?.source, "Company filing");
  assert.equal(result.portfolioPulse.guardian?.score, 68);
  assert.equal(result.portfolioPulse.guardian?.topRisks.length, 1);
});

test("compares the current brief with the prior dated brief", () => {
  const input = baseInput();
  input.previousBrief = {
    briefDate: "2026-07-18",
    portfolioPulse: {
      totalValue: 108000,
      dailyPnl: -250,
      largestPositionPct: 42,
    },
    priorityActions: [{ priority: "high" }, { priority: "medium" }],
  };
  const result = buildMorningBrief(input);
  const comparison = result.portfolioPulse.changeSincePrevious;
  assert.equal(comparison.previousBriefDate, "2026-07-18");
  assert.equal(comparison.portfolioValueChange, 2000);
  assert.equal(comparison.dailyPnlChange, 750);
  assert.equal(comparison.largestPositionPctChange, 3);
  assert.match(comparison.summary, /increased/);
});

test("excludes missing prices from the mover ranking", () => {
  const input = baseInput();
  input.holdings[0]!.priceStatus = "missing";
  const result = buildMorningBrief(input);
  assert.deepEqual(
    result.portfolioPulse.movers.map((move) => move.ticker),
    ["TCS"],
  );
});

test("excludes legacy cash warnings from generated brief risks", () => {
  const input = baseInput();
  input.portfolio.riskFlags = [
    "Cash buffer is below 5% of total portfolio value.",
    "ETF is 53.5% of invested assets.",
  ];
  input.guardian = {
    score: 68,
    band: "caution",
    topRisks: [
      "Cash buffer is below the configured limit.",
      "Largest sector exceeds the configured limit.",
    ],
  };

  const result = buildMorningBrief(input);

  assert.equal(
    result.risks.some((risk) => /cash/i.test(risk.detail)),
    false,
  );
  assert.deepEqual(result.portfolioPulse.guardian?.topRisks, [
    "Largest sector exceeds the configured limit.",
  ]);
});
