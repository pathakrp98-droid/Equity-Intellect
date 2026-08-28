import assert from "node:assert/strict";
import test from "node:test";

import type { AutomatedResearchSnapshotPayload } from "@workspace/research-contracts";

import { buildAutomatedResearchSignal } from "./automatedResearchSignals";

function payload(
  overrides: Partial<AutomatedResearchSnapshotPayload> = {},
): AutomatedResearchSnapshotPayload {
  return {
    securityType: "equity",
    claims: [
      {
        id: "own",
        text: "Listed equity.",
        kind: "fact",
        confidence: "high",
        evidenceIds: ["E1"],
        section: "whatYouOwn",
      },
      {
        id: "thesis-status",
        text: "The thesis is weakening.",
        kind: "ai_judgement",
        confidence: "moderate",
        evidenceIds: ["E1"],
        section: "investmentCase",
      },
      {
        id: "change",
        text: "Margins declined.",
        kind: "fact",
        confidence: "high",
        evidenceIds: ["E1"],
        section: "whatChanged",
      },
      {
        id: "risk:high:margin",
        text: "Margin pressure may persist.",
        kind: "ai_judgement",
        confidence: "moderate",
        evidenceIds: ["E1"],
        section: "risks",
      },
      {
        id: "catalyst:results",
        text: "Results may clarify demand.",
        kind: "ai_judgement",
        confidence: "moderate",
        evidenceIds: ["E1"],
        section: "catalysts",
      },
      {
        id: "assessment",
        text: "Evidence warrants caution.",
        kind: "ai_judgement",
        confidence: "moderate",
        evidenceIds: ["E1"],
        section: "assessment",
      },
      {
        id: "invalidation:margin",
        text: "A further margin fall would impair the thesis.",
        kind: "ai_judgement",
        confidence: "moderate",
        evidenceIds: ["E1"],
        section: "watchNext",
      },
    ],
    unknowns: ["Next quarter demand is unknown."],
    numericTarget: 2_000,
    evidenceStrength: "moderate",
    evidenceStrengthReason: "Official evidence supports most claims.",
    generatedAt: "2026-08-19T06:00:00.000Z",
    staleAt: "2026-08-26T06:00:00.000Z",
    ...overrides,
  };
}

test("automated research signal gives the latest successful snapshot precedence", () => {
  const signal = buildAutomatedResearchSignal({
    ticker: "INFY",
    companyId: 1,
    manualThesis: { status: "intact", targetPrice: 1_900 },
    snapshot: {
      id: 9,
      version: 3,
      payload: payload(),
      evidenceStrength: "moderate",
      validUntil: new Date("2026-08-26T06:00:00.000Z"),
      publishedAt: new Date("2026-08-19T06:00:00.000Z"),
      changeSet: {
        material: true,
        headline: "Material automated research changes detected.",
        addedRiskIds: ["risk:high:margin"],
        resolvedRiskIds: [],
        changedStatementIds: ["assessment"],
        evidenceStrengthChanged: false,
      },
    },
    latestJob: { status: "succeeded" },
    sources: [
      {
        citationKey: "E1",
        title: "Exchange filing",
        url: "https://example.com/filing",
        authority: "primary",
      },
    ],
    now: new Date("2026-08-20T06:00:00.000Z"),
  });

  assert.equal(signal.researchOrigin, "automated");
  assert.equal(signal.thesisStatus, "weakening");
  assert.equal(signal.targetPrice, 1_900, "manual threshold remains authoritative");
  assert.equal(signal.thresholdOrigin, "user_research");
  assert.equal(signal.freshnessStatus, "current");
  assert.equal(signal.materialChange?.material, true);
  assert.deepEqual(signal.topRisks, ["Margin pressure may persist."]);
  assert.deepEqual(signal.invalidations, [
    "A further margin fall would impair the thesis.",
  ]);
});

test("automated research signal uses legacy thesis when no snapshot exists", () => {
  const signal = buildAutomatedResearchSignal({
    ticker: "TCS",
    companyId: 2,
    manualThesis: { status: "intact", targetPrice: 4_500 },
    snapshot: null,
    latestJob: null,
    sources: [],
    now: new Date("2026-08-20T06:00:00.000Z"),
  });

  assert.equal(signal.researchOrigin, "manual");
  assert.equal(signal.thesisStatus, "intact");
  assert.equal(signal.targetPrice, 4_500);
  assert.equal(signal.freshnessStatus, "none");
});

test("limited and failed automated coverage stays covered but needs attention", () => {
  const limited = buildAutomatedResearchSignal({
    ticker: "ETF",
    companyId: 3,
    manualThesis: null,
    snapshot: {
      id: 10,
      version: 1,
      payload: payload({
        securityType: "etf",
        numericTarget: undefined,
        evidenceStrength: "limited",
      }),
      evidenceStrength: "limited",
      validUntil: new Date("2026-08-25T00:00:00.000Z"),
      publishedAt: new Date("2026-08-19T00:00:00.000Z"),
      changeSet: {},
    },
    latestJob: { status: "failed" },
    sources: [],
    now: new Date("2026-08-20T00:00:00.000Z"),
  });

  assert.equal(limited.isCovered, true);
  assert.equal(limited.evidenceStrength, "limited");
  assert.equal(limited.freshnessStatus, "failed");
  assert.equal(limited.completenessScore, 50);
  assert.equal(limited.targetPrice, null);
});
