import assert from "node:assert/strict";
import test from "node:test";

import {
  generateOfflineAnswer,
  inferMode,
  inferTickers,
  sanitizeGeneratedAnswer,
  type GroundingSource,
} from "./grounding";

const sources: GroundingSource[] = [
  {
    id: "S1",
    label: "Portfolio snapshot",
    kind: "portfolio",
    dataSource: "AlphaDesk Portfolio Engine",
    payload: { totalValue: 100_000 },
  },
  {
    id: "S2",
    label: "RELIANCE research workspace",
    kind: "research",
    dataSource: "AlphaDesk Research Engine",
    ticker: "RELIANCE",
    payload: { thesis: "Saved thesis" },
  },
];

test("infers analysis mode from the question", () => {
  assert.equal(inferMode("Challenge my RELIANCE bear case"), "thesis_challenge");
  assert.equal(inferMode("Why is portfolio P&L down?"), "performance_explain");
  assert.equal(inferMode("Compare RELIANCE vs TCS"), "company_compare");
});

test("infers explicit and mentioned tickers without duplicates", () => {
  assert.deepEqual(
    inferTickers("Compare reliance with TCS", ["RELIANCE", "TCS", "INFY"], [
      "tcs",
    ]),
    ["TCS", "RELIANCE"],
  );
});

test("removes unknown citations and low-confidence memory candidates", () => {
  const result = sanitizeGeneratedAnswer(
    {
      answer: "Portfolio fact [S1]. Invented citation [S99].",
      summary: "Summary",
      keyPoints: ["One"],
      risks: [],
      unknowns: [],
      suggestedNextQuestions: [],
      citations: [
        { sourceId: "S1", claim: "Supported" },
        { sourceId: "S99", claim: "Unsupported" },
      ],
      memoryCandidates: [
        {
          category: "preference",
          subject: "Risk preference",
          content: "Moderate risk",
          confidence: 0.9,
        },
        {
          category: "preference",
          subject: "Weak inference",
          content: "Do not save",
          confidence: 0.5,
        },
      ],
    },
    sources,
  );

  assert.match(result.answer, /\[S1\]/);
  assert.doesNotMatch(result.answer, /S99/);
  assert.deepEqual(result.citations, [{ sourceId: "S1", claim: "Supported" }]);
  assert.equal(result.memoryCandidates.length, 1);
});

test("offline portfolio review remains grounded and labels missing live data", () => {
  const result = generateOfflineAnswer({
    mode: "portfolio_review",
    question: "Review my portfolio",
    sources,
    portfolio: {
      snapshot: {
        totalValue: 100_000,
        cashBalance: 20_000,
        totalPnl: 5_000,
        totalReturnPct: 5,
        largestPositionTicker: "RELIANCE",
        largestPositionPct: 40,
        riskFlags: ["High concentration"],
      },
      holdings: [
        {
          ticker: "RELIANCE",
          marketValue: 40_000,
          allocationPct: 40,
        },
      ],
    },
  });

  assert.match(result.answer, /\[S1\]/);
  assert.ok(result.risks.some((risk) => /40\.00%/.test(risk)));
  assert.equal(result.citations[0]?.sourceId, "S1");
});
