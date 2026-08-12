import assert from "node:assert/strict";
import test from "node:test";

import { automatedResearchSnapshotSchema } from "./index";

const statement = {
  id: "S1",
  text: "A cited statement.",
  kind: "fact",
  confidence: "high",
  evidenceIds: ["E1"],
};

function payload() {
  return {
    securityType: "equity",
    whatYouOwn: [statement],
    investmentCase: [statement],
    whatChanged: [statement],
    risks: [statement],
    catalysts: [statement],
    assessment: [statement],
    watchNext: [statement],
    unknowns: [],
    evidenceStrength: "strong",
    evidenceStrengthReason: "Primary evidence supports the research.",
    generatedAt: "2026-08-13T00:00:00.000Z",
    staleAt: "2026-08-20T00:00:00.000Z",
  };
}

test("snapshot contract rejects unknown fields", () => {
  assert.equal(automatedResearchSnapshotSchema.safeParse({ ...payload(), extra: true }).success, false);
});

test("snapshot contract caps a section at twenty statements", () => {
  const result = automatedResearchSnapshotSchema.safeParse({
    ...payload(),
    risks: Array.from({ length: 21 }, (_, index) => ({ ...statement, id: `R${index}` })),
  });

  assert.equal(result.success, false);
});

test("snapshot contract requires every layman section", () => {
  const result = automatedResearchSnapshotSchema.safeParse({
    ...payload(),
    watchNext: [],
  });

  assert.equal(result.success, false);
});
