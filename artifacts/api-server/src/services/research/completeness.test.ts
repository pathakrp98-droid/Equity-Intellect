import assert from "node:assert/strict";
import test from "node:test";

import { calculateResearchCompleteness } from "./completeness";

test("returns zero for a completely empty research record", () => {
  const result = calculateResearchCompleteness({ company: {} });
  assert.equal(result.score, 0);
  assert.equal(result.band, "empty");
  assert.ok(result.missing.length > 0);
});

test("reaches decision-ready status for a well-developed thesis", () => {
  const result = calculateResearchCompleteness({
    company: {
      name: "Alpha Ltd",
      sector: "Industrials",
      description:
        "A sufficiently detailed company description explaining the business model and competitive position.",
    },
    thesis: {
      summary:
        "A detailed core thesis covering the earnings driver, competitive advantage, valuation gap and expected rerating path.",
      bullCase:
        "Bull case with strong growth, margin expansion and a valuation rerating.",
      baseCase:
        "Base case with sustainable growth and stable margins over the forecast period.",
      bearCase:
        "Bear case with slower demand, lower margins and multiple compression.",
      conviction: "high",
      status: "intact",
      valuationMethodology:
        "DCF cross-checked against forward EV/EBITDA peers.",
      bullPrice: 150,
      basePrice: 125,
      bearPrice: 80,
      keyAssumptions: ["a", "b", "c", "d", "e"],
      nextReviewAt: new Date("2026-09-30"),
    },
    noteCount: 4,
    catalystCount: 3,
    riskCount: 4,
    invalidationCount: 3,
    valuationAssumptionCount: 5,
  });

  assert.equal(result.score, 100);
  assert.equal(result.band, "complete");
  assert.equal(result.missing.length, 0);
});

test("does not award full scenario points for short placeholders", () => {
  const result = calculateResearchCompleteness({
    company: { name: "Alpha Ltd", sector: "Industrials" },
    thesis: {
      summary: "Brief thesis",
      bullCase: "Good",
      baseCase: "Okay",
      bearCase: "Bad",
    },
  });
  const scenario = result.sections.find(
    (section) => section.key === "scenarios",
  );
  assert.equal(scenario?.score, 0);
});
