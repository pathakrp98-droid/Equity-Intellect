import assert from "node:assert/strict";
import test from "node:test";

import {
  automatedResearchSnapshotJsonSchema,
  automatedResearchSnapshotSchema,
} from "./index";

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
    claims: [
      { ...statement, section: "whatYouOwn" },
      { ...statement, id: "S2", kind: "ai_judgement", section: "investmentCase" },
      { ...statement, id: "S3", section: "whatChanged" },
      { ...statement, id: "S4", kind: "ai_judgement", section: "risks" },
      { ...statement, id: "S5", kind: "ai_judgement", section: "catalysts" },
      { ...statement, id: "S6", kind: "ai_judgement", section: "assessment" },
      { ...statement, id: "S7", kind: "ai_judgement", section: "watchNext" },
    ],
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
    claims: [
      ...payload().claims.filter((claim) => claim.section !== "risks"),
      ...Array.from({ length: 21 }, (_, index) => ({
        ...statement,
        id: `R${index}`,
        kind: "ai_judgement",
        section: "risks",
      })),
    ],
  });

  assert.equal(result.success, false);
});

test("snapshot contract requires every layman section", () => {
  const result = automatedResearchSnapshotSchema.safeParse({
    ...payload(),
    claims: payload().claims.filter((claim) => claim.section !== "watchNext"),
  });

  assert.equal(result.success, false);
});

test("snapshot contract rejects more than one hundred total claims", () => {
  const hundredClaims = Array.from({ length: 100 }, (_, index) => ({
    ...statement,
    id: `C${index}`,
    kind: index % 7 === 0 ? "fact" : "ai_judgement",
    section: [
      "whatYouOwn",
      "investmentCase",
      "whatChanged",
      "risks",
      "catalysts",
      "assessment",
      "watchNext",
    ][index % 7],
  }));
  const validResult = automatedResearchSnapshotSchema.safeParse({
    ...payload(),
    claims: hundredClaims,
  });
  const invalidResult = automatedResearchSnapshotSchema.safeParse({
    ...payload(),
    claims: [...hundredClaims, { ...hundredClaims[0], id: "C100" }],
  });

  assert.equal(validResult.success, true);
  assert.equal(invalidResult.success, false);
});

test("snapshot contract requires AI judgement labels for evaluative sections", () => {
  const result = automatedResearchSnapshotSchema.safeParse({
    ...payload(),
    claims: payload().claims.map((claim) =>
      claim.section === "risks" ? { ...claim, kind: "fact" } : claim,
    ),
  });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(
    result.error.issues.some(
      (issue) => issue.path.join(".") === "claims.3.kind",
    ),
  );
});

test("Responses JSON Schema caps the aggregate claim array", () => {
  const schema = automatedResearchSnapshotJsonSchema as {
    properties?: { claims?: { maxItems?: number } };
  };

  assert.equal(schema.properties?.claims?.maxItems, 100);
});
