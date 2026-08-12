import assert from "node:assert/strict";
import test from "node:test";

import {
  type AutomatedResearchSnapshotPayload,
  validateSnapshotClaims,
} from "@workspace/research-contracts";

import { classifySecurity } from "./securityClassifier";

function snapshot(
  overrides: Partial<AutomatedResearchSnapshotPayload> = {},
): AutomatedResearchSnapshotPayload {
  return {
    securityType: "equity",
    whatYouOwn: [
      {
        id: "S1",
        text: "The holding is a listed equity.",
        kind: "fact",
        confidence: "high",
        evidenceIds: ["E1"],
      },
    ],
    investmentCase: [
      {
        id: "S2",
        text: "The investment case depends on execution.",
        kind: "ai_judgement",
        confidence: "moderate",
        evidenceIds: ["E1"],
      },
    ],
    whatChanged: [
      {
        id: "S3",
        text: "No material changes were identified.",
        kind: "fact",
        confidence: "high",
        evidenceIds: ["E1"],
      },
    ],
    risks: [
      {
        id: "S4",
        text: "Demand may weaken.",
        kind: "ai_judgement",
        confidence: "moderate",
        evidenceIds: ["E1"],
      },
    ],
    catalysts: [
      {
        id: "S5",
        text: "A filing could provide a catalyst.",
        kind: "ai_judgement",
        confidence: "limited",
        evidenceIds: ["E1"],
      },
    ],
    assessment: [
      {
        id: "S6",
        text: "The valuation needs continued review.",
        kind: "ai_judgement",
        confidence: "moderate",
        evidenceIds: ["E1"],
      },
    ],
    watchNext: [
      {
        id: "S7",
        text: "Watch the next earnings update.",
        kind: "ai_judgement",
        confidence: "moderate",
        evidenceIds: ["E1"],
      },
    ],
    unknowns: [],
    evidenceStrength: "moderate",
    evidenceStrengthReason: "Primary evidence supports the core claims.",
    generatedAt: "2026-08-13T00:00:00.000Z",
    staleAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

test("classification uses holding identity evidence without guessing", () => {
  assert.equal(classifySecurity({ ticker: "RELIANCE", name: "Reliance Industries", exchange: "NSE", isin: "INE002A01018" }).securityType, "equity");
  assert.equal(classifySecurity({ ticker: "NIFTYBEES", name: "Nippon India ETF Nifty BeES", exchange: "NSE", isin: null }).securityType, "etf");
  assert.equal(classifySecurity({ ticker: "LIQUIDCASE", name: "Zerodha Nifty 1D Rate Liquid ETF", exchange: "NSE", isin: null }).securityType, "etf");
  assert.equal(classifySecurity({ ticker: "SBIFUNDS", name: "SBI Funds Management Limited", exchange: "UNLISTED", isin: "INE640G01020" }).securityType, "unlisted");
  assert.equal(classifySecurity({ ticker: "UNKNOWN1", name: "Unknown security", exchange: "NSE", isin: null }).securityType, "unknown");
});

test("classification returns unknown when name and ticker signals conflict", () => {
  const result = classifySecurity({
    ticker: "NIFTYBEES",
    name: "Reliance Industries",
    exchange: "NSE",
    isin: null,
  });

  assert.equal(result.securityType, "unknown");
  assert.ok(result.reasons.some((reason) => reason.includes("conflict")));
});

test("snapshot validation rejects a fact without evidence", () => {
  const payload = snapshot({
    whatYouOwn: [
      {
        id: "S1",
        text: "The holding is a listed equity.",
        kind: "fact",
        confidence: "high",
        evidenceIds: [],
      },
    ],
  });

  assert.throws(() => validateSnapshotClaims(payload, new Set(["E1"])));
});

test("snapshot validation accepts an evidenced AI judgement", () => {
  assert.doesNotThrow(() => validateSnapshotClaims(snapshot(), new Set(["E1"])));
});

test("snapshot validation rejects evidence not collected for the run", () => {
  assert.throws(() => validateSnapshotClaims(snapshot(), new Set(["E2"])));
});

test("snapshot validation rejects numeric targets for non-equities", () => {
  assert.throws(() =>
    validateSnapshotClaims(
      snapshot({ securityType: "etf", numericTarget: 120 }),
      new Set(["E1"]),
    ),
  );
});
