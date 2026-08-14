import assert from "node:assert/strict";
import test from "node:test";

import type { AutomatedResearchSnapshotPayload } from "@workspace/research-contracts";

import { diffSnapshots } from "./snapshotDiff";

function snapshot(overrides: Partial<AutomatedResearchSnapshotPayload> = {}): AutomatedResearchSnapshotPayload {
  return {
    securityType: "equity",
    claims: [
      { id: "own", text: "Listed equity.", kind: "fact", confidence: "high", evidenceIds: ["E1"], section: "whatYouOwn" },
      { id: "thesis-status", text: "Thesis is intact.", kind: "ai_judgement", confidence: "high", evidenceIds: ["E1"], section: "investmentCase" },
      { id: "change", text: "No material change.", kind: "fact", confidence: "high", evidenceIds: ["E1"], section: "whatChanged" },
      { id: "risk:medium:pricing", text: "Pricing pressure is possible.", kind: "ai_judgement", confidence: "moderate", evidenceIds: ["E1"], section: "risks" },
      { id: "catalyst", text: "Results are upcoming.", kind: "ai_judgement", confidence: "moderate", evidenceIds: ["E1"], section: "catalysts" },
      { id: "assessment", text: "Assessment remains favourable.", kind: "ai_judgement", confidence: "moderate", evidenceIds: ["E1"], section: "assessment" },
      { id: "watch", text: "Watch earnings.", kind: "ai_judgement", confidence: "moderate", evidenceIds: ["E1"], section: "watchNext" },
    ],
    unknowns: [],
    evidenceStrength: "moderate",
    evidenceStrengthReason: "The evidence supports the core claims.",
    generatedAt: "2026-08-13T00:00:00.000Z",
    staleAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

test("snapshot diff: ignores whitespace, source ordering, and generated timestamps", () => {
  const previous = snapshot();
  const current = snapshot({
    claims: previous.claims.map((claim) => claim.id === "catalyst" ? { ...claim, text: "  Results   are upcoming.  ", evidenceIds: ["E2", "E1"] } : claim),
    generatedAt: "2026-08-14T00:00:00.000Z",
  });
  const result = diffSnapshots(previous, current);
  assert.equal(result.material, false);
  assert.deepEqual(result.changedStatementIds, []);
});

test("snapshot diff: marks changed thesis status as material", () => {
  const previous = snapshot();
  const current = snapshot({
    claims: previous.claims.map((claim) => claim.id === "thesis-status" ? { ...claim, text: "Thesis is impaired." } : claim),
  });
  const result = diffSnapshots(previous, current);
  assert.equal(result.material, true);
  assert.deepEqual(result.changedStatementIds, ["thesis-status"]);
});

test("snapshot diff: surfaces a new high-severity risk as material", () => {
  const previous = snapshot();
  const current = snapshot({
    claims: [...previous.claims, { id: "risk:high:liquidity", text: "Liquidity risk increased.", kind: "ai_judgement", confidence: "high", evidenceIds: ["E1"], section: "risks" }],
  });
  const result = diffSnapshots(previous, current);
  assert.equal(result.material, true);
  assert.deepEqual(result.addedRiskIds, ["risk:high:liquidity"]);
});

test("snapshot diff: treats an invalidation claim as material", () => {
  const previous = snapshot();
  const current = snapshot({
    claims: [...previous.claims, { id: "invalidation:margin", text: "Margins below the stated floor invalidate the thesis.", kind: "ai_judgement", confidence: "high", evidenceIds: ["E1"], section: "investmentCase" }],
  });
  assert.equal(diffSnapshots(previous, current).material, true);
});

test("snapshot diff: treats an assessment-only conclusion change as material", () => {
  const previous = snapshot();
  const changedAssessment = snapshot({
    claims: previous.claims.map((claim) => claim.id === "assessment" ? { ...claim, text: "Assessment is now unfavourable." } : claim),
  });
  const result = diffSnapshots(previous, changedAssessment);
  assert.equal(result.material, true);
  assert.equal(result.evidenceStrengthChanged, false);
  assert.ok(result.changedStatementIds.includes("assessment"));
});

test("snapshot diff: treats an evidence-strength-only change as material", () => {
  const result = diffSnapshots(snapshot(), snapshot({ evidenceStrength: "limited" }));
  assert.equal(result.material, true);
  assert.equal(result.evidenceStrengthChanged, true);
  assert.deepEqual(result.changedStatementIds, []);
});

test("snapshot diff: treats a resolved high-severity risk as material", () => {
  const previous = snapshot({
    claims: [...snapshot().claims, { id: "risk:critical:liquidity", text: "Liquidity risk is critical.", kind: "ai_judgement", confidence: "high", evidenceIds: ["E1"], section: "risks" }],
  });
  const result = diffSnapshots(previous, snapshot());
  assert.equal(result.material, true);
  assert.deepEqual(result.resolvedRiskIds, ["risk:critical:liquidity"]);
});

test("snapshot diff: does not classify severity-boundary risk IDs as high severity", () => {
  const result = diffSnapshots(snapshot(), snapshot({
    claims: [...snapshot().claims, { id: "risk:highest:marketing", text: "Marketing risk rose.", kind: "ai_judgement", confidence: "moderate", evidenceIds: ["E1"], section: "risks" }],
  }));
  assert.equal(result.material, false);
  assert.deepEqual(result.addedRiskIds, ["risk:highest:marketing"]);
});

test("snapshot diff: requires the documented risk token before an exact severity token", () => {
  for (const id of ["valuation:high:multiple", "risk:highlight:marketing", "valuation:severe:multiple", "analysis:critical:liquidity"]) {
    const result = diffSnapshots(snapshot(), snapshot({
      claims: [...snapshot().claims, { id, text: "A non-high-risk identifier changed.", kind: "ai_judgement", confidence: "moderate", evidenceIds: ["E1"], section: "risks" }],
    }));
    assert.equal(result.material, false, id);
  }
  for (const id of ["risk:high:multiple", "risk:severe:multiple", "risk:critical:liquidity"]) {
    const result = diffSnapshots(snapshot(), snapshot({
      claims: [...snapshot().claims, { id, text: "A high-risk identifier changed.", kind: "ai_judgement", confidence: "high", evidenceIds: ["E1"], section: "risks" }],
    }));
    assert.equal(result.material, true, id);
  }
});

test("snapshot diff: fails closed when duplicate IDs could hide a material claim", () => {
  const duplicated = snapshot({
    claims: [...snapshot().claims, { id: "assessment", text: "Assessment is now unfavourable.", kind: "ai_judgement", confidence: "high", evidenceIds: ["E1"], section: "assessment" }],
  });
  assert.throws(() => diffSnapshots(snapshot(), duplicated), /Duplicate claim ID: assessment/);
  assert.throws(() => diffSnapshots(duplicated, snapshot()), /Duplicate claim ID: assessment/);
});
