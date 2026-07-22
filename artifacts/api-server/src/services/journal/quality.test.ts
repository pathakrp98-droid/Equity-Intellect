import assert from "node:assert/strict";

import {
  calculateDecisionQuality,
  calculateReviewQuality,
  summarizeDecisionAnalytics,
} from "./quality";

const weak = calculateDecisionQuality({ rationale: "Buy because it may rise" });
assert.equal(weak.band, "weak");
assert.ok(weak.missing.includes("Contrary evidence"));

const excellent = calculateDecisionQuality({
  rationale:
    "Margins are recovering, valuation is below the five-year median and the order book provides visible earnings growth.",
  thesisSummary: "Earnings compounder with improving capital efficiency.",
  expectedReturnPct: 22,
  expectedDownsidePct: -14,
  targetPrice: 1250,
  bearPrice: 820,
  investmentHorizon: "24 months",
  confidenceScore: 4,
  evidenceQuality: "high",
  keyFactors: ["Order book growth", "Margin recovery"],
  contraryEvidence: ["Customer concentration remains elevated"],
  sourceReferences: [{ id: "annual-report", label: "FY26 annual report" }],
  nextReviewAt: "2026-10-01T00:00:00Z",
  guardianCheckId: "guardian-123",
  researchCompanyId: 9,
  outcome: "pending",
});
assert.equal(excellent.band, "excellent");
assert.ok(excellent.total >= 85);

assert.equal(
  calculateReviewQuality({
    whatChanged:
      "Revenue growth slowed but margins improved more than expected.",
    evidenceFor: "Margins expanded by 180 basis points.",
    evidenceAgainst: "Order intake declined year on year.",
    thesisStatusAfter: "monitoring",
    convictionAfter: "medium",
    actionAfterReview: "research_more",
    notes: "Revisit after the next earnings call.",
  }),
  100,
);

const analytics = summarizeDecisionAnalytics(
  [
    {
      qualityScore: 90,
      emotionalState: "calm",
      outcome: "win",
      actualReturnPct: 20,
      lessonsLearned:
        "Position sizing was appropriate and the catalyst was correctly identified.",
      decisionType: "buy",
    },
    {
      qualityScore: 60,
      emotionalState: "anxious",
      outcome: "loss",
      actualReturnPct: -10,
      lessonsLearned: null,
      decisionType: "sell",
    },
  ],
  [
    {
      status: "completed",
      scheduledFor: "2026-06-01",
      completedAt: "2026-06-01",
      reviewQualityScore: 80,
    },
    { status: "due", scheduledFor: "2026-01-01" },
  ],
  new Date("2026-07-01"),
);
assert.equal(analytics.winRatePct, 50);
assert.equal(analytics.averageActualReturnPct, 5);
assert.equal(analytics.overdueReviewCount, 1);
assert.equal(analytics.lessonsCapturedPct, 50);

console.log("journal quality tests passed");
