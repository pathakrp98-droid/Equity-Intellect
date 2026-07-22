import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateIntegrationReadiness,
  type IntegrationFacts,
} from "./readiness";

function facts(overrides: Partial<IntegrationFacts> = {}): IntegrationFacts {
  return {
    portfolio: {
      portfolios: 1,
      holdings: 5,
      transactions: 20,
      holdingsWithPrices: 5,
      stalePrices: 0,
    },
    research: {
      companies: 5,
      activeTheses: 5,
      brokenTheses: 0,
      overdueReviews: 0,
    },
    copilot: { conversations: 2, memories: 3, aiProviderConfigured: true },
    intelligence: {
      briefs: 4,
      marketDataPoints: 20,
      latestBriefAt: new Date().toISOString(),
      latestProviderStatus: "success",
    },
    guardian: { healthSnapshots: 3, latestHealthScore: 82, pendingPackets: 0 },
    journal: { entries: 5, dueReviews: 0, completedReviews: 3 },
    liveData: {
      configuredProviders: ["normalized-http"],
      cachedRecords: 20,
      latestFetchAt: new Date().toISOString(),
    },
    alerts: { active: 0, critical: 0, enabledRules: 4 },
    ...overrides,
  };
}

test("fully configured installation is ready", () => {
  const result = evaluateIntegrationReadiness(facts());
  assert.equal(result.band, "ready");
  assert.ok(result.score >= 80);
  assert.equal(result.blockers.length, 0);
});

test("missing portfolio is a blocker", () => {
  const result = evaluateIntegrationReadiness(
    facts({
      portfolio: {
        portfolios: 0,
        holdings: 0,
        transactions: 0,
        holdingsWithPrices: 0,
        stalePrices: 0,
      },
    }),
  );
  assert.equal(result.band, "setup_required");
  assert.ok(
    result.blockers.some((item) => item.includes("Create a portfolio")),
  );
  assert.equal(
    result.modules.find((item) => item.key === "portfolio")?.status,
    "blocked",
  );
});

test("live AI and live data are optional", () => {
  const result = evaluateIntegrationReadiness(
    facts({
      copilot: { conversations: 0, memories: 0, aiProviderConfigured: false },
      liveData: {
        configuredProviders: [],
        cachedRecords: 0,
        latestFetchAt: null,
      },
    }),
  );
  assert.equal(result.blockers.length, 0);
  assert.equal(
    result.modules.find((item) => item.key === "copilot")?.status,
    "optional",
  );
  assert.equal(
    result.modules.find((item) => item.key === "liveData")?.status,
    "optional",
  );
});

test("critical alerts are surfaced as blockers", () => {
  const result = evaluateIntegrationReadiness(
    facts({ alerts: { active: 3, critical: 2, enabledRules: 4 } }),
  );
  assert.ok(result.blockers.some((item) => item.includes("critical alerts")));
  assert.equal(
    result.modules.find((item) => item.key === "alerts")?.status,
    "attention",
  );
});
