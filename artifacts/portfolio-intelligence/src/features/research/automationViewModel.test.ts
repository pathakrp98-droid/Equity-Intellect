import assert from "node:assert/strict";
import test from "node:test";

import {
  claimKindCopy,
  displayAutomationState,
  evidenceLinkCopy,
  safeEvidenceUrl,
  sortCoverageForReview,
  statusCopy,
} from "./automationViewModel";

test("coverage status copy explains each user-actionable state", () => {
  assert.equal(statusCopy("queued").title, "Preparing research");
  assert.equal(statusCopy("running").title, "Updating research");
  assert.equal(statusCopy("current").title, "Current");
  assert.equal(statusCopy("limited").title, "Limited evidence");
  assert.equal(statusCopy("stale").title, "Research needs refreshing");
  assert.equal(statusCopy("failed").title, "Research update failed");
  assert.equal(statusCopy("needs_identity").title, "Needs identity");
  assert.equal(statusCopy("archived").title, "No longer in portfolio");
});

test("every AI conclusion receives the exact visible AI judgement label", () => {
  assert.deepEqual(claimKindCopy("ai_judgement"), {
    label: "AI judgement",
    description: "AlphaDesk's interpretation of the cited evidence.",
  });
  assert.equal(claimKindCopy("fact").label, "Fact");
  assert.equal(claimKindCopy("calculation").label, "Calculation");
});

test("evidence link copy includes publisher and the published date", () => {
  assert.deepEqual(
    evidenceLinkCopy({
      publisher: "Securities and Exchange Board of India",
      publishedAt: "2026-08-14T08:00:00.000Z",
      retrievedAt: "2026-08-15T08:00:00.000Z",
    }),
    {
      publisher: "Securities and Exchange Board of India",
      date: "14 Aug 2026",
      accessibleLabel:
        "Securities and Exchange Board of India, published 14 Aug 2026",
    },
  );
});

test("evidence without a publication date is labelled with its retrieval date", () => {
  assert.deepEqual(
    evidenceLinkCopy({
      publisher: null,
      publishedAt: null,
      retrievedAt: "2026-08-15T08:00:00.000Z",
    }),
    {
      publisher: "Source",
      date: "Retrieved 15 Aug 2026",
      accessibleLabel: "Source, retrieved 15 Aug 2026",
    },
  );
});

test("evidence links fail closed when the URL is not HTTPS", () => {
  assert.equal(
    safeEvidenceUrl("https://www.sebi.gov.in/filing"),
    "https://www.sebi.gov.in/filing",
  );
  assert.equal(safeEvidenceUrl("javascript:alert(1)"), null);
  assert.equal(safeEvidenceUrl("http://example.com/filing"), null);
  assert.equal(safeEvidenceUrl("not a url"), null);
});

test("coverage ordering puts attention states before portfolio weight", () => {
  const rows = [
    { ticker: "LARGE", automationState: "current" as const, allocationPct: 35 },
    { ticker: "SMALL", automationState: "failed" as const, allocationPct: 2 },
    { ticker: "MEDIUM", automationState: "limited" as const, allocationPct: 8 },
    { ticker: "OTHER", automationState: "current" as const, allocationPct: 10 },
  ];

  assert.deepEqual(
    sortCoverageForReview(rows).map((row) => row.ticker),
    ["SMALL", "MEDIUM", "LARGE", "OTHER"],
  );
});

test("a completed refresh replaces queued copy with the new snapshot state", () => {
  assert.equal(
    displayAutomationState({
      coverageState: "queued",
      runStatus: "succeeded",
      snapshot: {
        evidenceStrength: "strong",
        validUntil: "2026-08-21T00:00:00.000Z",
      },
      now: "2026-08-20T00:00:00.000Z",
    }),
    "current",
  );
  assert.equal(
    displayAutomationState({
      coverageState: "running",
      runStatus: "succeeded",
      snapshot: {
        evidenceStrength: "limited",
        validUntil: "2026-08-21T00:00:00.000Z",
      },
      now: "2026-08-20T00:00:00.000Z",
    }),
    "limited",
  );
});

test("active jobs and expired snapshots retain honest status copy", () => {
  assert.equal(
    displayAutomationState({
      coverageState: "current",
      runStatus: "running",
      snapshot: {
        evidenceStrength: "strong",
        validUntil: "2026-08-21T00:00:00.000Z",
      },
      now: "2026-08-20T00:00:00.000Z",
    }),
    "running",
  );
  assert.equal(
    displayAutomationState({
      coverageState: "queued",
      runStatus: "succeeded",
      snapshot: {
        evidenceStrength: "strong",
        validUntil: "2026-08-19T00:00:00.000Z",
      },
      now: "2026-08-20T00:00:00.000Z",
    }),
    "stale",
  );
});

test("a partial or failed refresh cannot look current", () => {
  for (const runStatus of ["partial", "failed", "dead_letter"] as const) {
    assert.equal(
      displayAutomationState({
        coverageState: "running",
        runStatus,
        snapshot: {
          evidenceStrength: "strong",
          validUntil: "2026-08-21T00:00:00.000Z",
        },
        now: "2026-08-20T00:00:00.000Z",
      }),
      "failed",
    );
  }
});
