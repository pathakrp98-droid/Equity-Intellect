import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateGuardianHealth,
  runGuardianCheck,
  type GuardianPortfolioContext,
  type GuardianResearchContext,
  type GuardianSettings,
} from "./guardianEngine";

const settings: GuardianSettings = {
  portfolioLimits: {
    maxStockConcentrationPct: 20,
    maxSectorConcentrationPct: 35,
    maxSmallCapExposurePct: 20,
    minCashBufferPct: 5,
    maxCorrelatedPositions: 4,
    maxWeeklyNewPositions: 2,
    maxPortfolioDrawdownPct: 15,
  },
  preTradeRequirements: {
    requireRationale: true,
    requireInvestmentHorizon: true,
    requireBearCase: true,
    requireTargetPrice: true,
    requireThesisInvalidation: true,
    requireMaxAcceptableLoss: true,
    requireExitConditions: true,
    minResearchCompletenessScore: 70,
  },
  biasChecks: {
    enabled: true,
    recency: true,
    confirmationBias: true,
    anchoring: true,
    overconfidence: true,
    narrativeBias: true,
    fomo: true,
    revengeTrading: true,
    panicSelling: true,
    overtrading: true,
    unjustifiedAveragingDown: true,
  },
  stressTests: {
    enabled: true,
    marketCorrection: true,
    recession: true,
    rateHike: true,
    crudeShock: true,
    currencyShock: true,
    companySpecific: true,
  },
  guardianMode: {
    enabled: true,
    allowOverrideWithRationale: true,
    requireAuditLog: true,
  },
};

const portfolio: GuardianPortfolioContext = {
  portfolioId: 1,
  totalValue: 1_000_000,
  cashBalance: 150_000,
  cashBufferPct: 15,
  holdings: [
    {
      ticker: "INFY",
      name: "Infosys",
      sector: "Technology",
      quantity: 100,
      averageCost: 1_400,
      marketPrice: 1_600,
      marketValue: 160_000,
      allocationPct: 16,
      unrealizedPnlPct: 14.3,
    },
  ],
  sectorAllocation: [
    { sector: "Technology", value: 160_000, allocationPct: 16 },
  ],
  largestPositionPct: 16,
  topFiveConcentrationPct: 16,
  maxDrawdownPct: 5,
  weeklyNewPositions: 0,
  weeklyPortfolioChanges: 1,
  smallCapExposurePct: 0,
  correlatedClusters: [],
  priceCoveragePct: 100,
};

const research: GuardianResearchContext = {
  ticker: "INFY",
  isCovered: true,
  completenessScore: 90,
  thesisStatus: "intact",
  conviction: "high",
  targetPrice: 2_000,
  bearPrice: 1_250,
  maxAcceptableLossPct: 20,
  investmentHorizon: "3 years",
  invalidationCount: 2,
  riskCount: 3,
  sourceCount: 4,
  lastReviewedAt: new Date().toISOString(),
  isSmallCap: false,
};

const completeProposal = {
  action: "add" as const,
  ticker: "INFY",
  quantity: 10,
  price: 1_600,
  rationale:
    "Add after FY27 EPS estimate rose 12%; valuation remains at 24x PE versus a 28x base-case multiple.",
  investmentHorizon: "3 years",
  bearCase:
    "US discretionary spending may slow, reducing constant-currency growth below 4% and compressing margins.",
  targetPrice: 2_000,
  thesisInvalidation:
    "Two quarters below 4% constant-currency growth with EBIT margin below 19%.",
  maxAcceptableLossPct: 18,
  exitConditions:
    "Trim at target value or exit if the invalidation conditions are met.",
  citedSourceIds: ["research:INFY", "news:42"],
};

test("approves a complete proposal inside portfolio limits", () => {
  const result = runGuardianCheck({
    proposal: completeProposal,
    portfolio,
    research,
    market: {
      priceChange5dPct: 2,
      highSeverityNewsCount: 0,
      negativeNewsCount: 0,
      latestNewsAt: null,
      priceAsOf: new Date().toISOString(),
    },
    settings,
  });
  assert.equal(result.decision, "approve");
  assert.equal(result.hardRuleBreaches.length, 0);
  assert.equal(result.preTradeFailures.length, 0);
  assert.equal(result.stressTestResults.length, 6);
});

test("blocks a buy that breaches stock concentration", () => {
  const result = runGuardianCheck({
    proposal: { ...completeProposal, quantity: 100 },
    portfolio,
    research,
    market: null,
    settings,
  });
  assert.equal(result.decision, "reject");
  assert.ok(
    result.hardRuleBreaches.some(
      (item) => item.ruleId === "MAX_STOCK_CONCENTRATION",
    ),
  );
});

test("requires evidence when research coverage is absent", () => {
  const result = runGuardianCheck({
    proposal: { ...completeProposal, ticker: "NEWCO" },
    portfolio,
    research: null,
    market: null,
    settings,
  });
  assert.equal(result.decision, "require_evidence");
  assert.ok(
    result.preTradeFailures.some(
      (item) => item.field === "researchCoverage",
    ),
  );
});

test("detects FOMO after a sharp five-day move", () => {
  const result = runGuardianCheck({
    proposal: completeProposal,
    portfolio,
    research,
    market: {
      priceChange5dPct: 12,
      highSeverityNewsCount: 0,
      negativeNewsCount: 0,
      latestNewsAt: null,
      priceAsOf: new Date().toISOString(),
    },
    settings,
  });
  assert.equal(result.decision, "approve_with_warnings");
  assert.ok(result.biasFlags.some((item) => item.bias === "FOMO" && item.detected));
});

test("blocks overselling", () => {
  const result = runGuardianCheck({
    proposal: {
      action: "sell",
      ticker: "INFY",
      quantity: 101,
      price: 1_600,
      rationale: "Reduce risk because the thesis has weakened after a quantified guidance cut.",
      investmentHorizon: "closed",
      bearCase: "Further guidance cuts could deepen downside.",
      targetPrice: 1_500,
      thesisInvalidation: "Management withdraws medium-term margin guidance.",
      maxAcceptableLossPct: 10,
      exitConditions: "Complete the exit if guidance is withdrawn.",
      citedSourceIds: ["research:INFY"],
    },
    portfolio,
    research,
    market: null,
    settings,
  });
  assert.equal(result.decision, "reject");
  assert.ok(result.hardRuleBreaches.some((item) => item.ruleId === "OVERSELL"));
});

test("health score falls for broken theses and weak liquidity", () => {
  const health = calculateGuardianHealth({
    portfolio: {
      ...portfolio,
      cashBalance: 10_000,
      cashBufferPct: 1,
      largestPositionPct: 25,
      priceCoveragePct: 70,
      sectorAllocation: [
        { sector: "Technology", value: 500_000, allocationPct: 50 },
      ],
    },
    research: [
      { ...research, thesisStatus: "broken", completenessScore: 30 },
    ],
    settings,
    activeHighSeverityNews: 2,
  });
  assert.ok(health.score < 55);
  assert.ok(["high_risk", "critical"].includes(health.band));
  assert.ok(health.topRisks.length > 0);
});
