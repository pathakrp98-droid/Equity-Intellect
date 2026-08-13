import assert from "node:assert/strict";
import test from "node:test";

import type { AutomatedResearchSnapshotPayload, ResearchEvidenceInput } from "@workspace/research-contracts";

import {
  calculateEvidenceStrength,
  classifyEvidenceTier,
  normalizeCanonicalUrl,
} from "./evidenceQuality";

const retrievedAt = "2026-08-13T00:00:00.000Z";

function evidence(overrides: Partial<ResearchEvidenceInput> = {}): ResearchEvidenceInput {
  return {
    id: "E1",
    title: "Source material",
    publisher: "Source publisher",
    url: "https://www.nseindia.com/company/filing?utm_source=newsletter&id=123",
    publishedAt: retrievedAt,
    retrievedAt,
    tier: "secondary",
    summary: "A source summary.",
    ...overrides,
  };
}

function claims(evidenceIds: string[] = ["E1"]): AutomatedResearchSnapshotPayload["claims"] {
  return [
    { id: "own", text: "Listed equity.", kind: "fact", confidence: "high", evidenceIds, section: "whatYouOwn" },
    { id: "thesis-status", text: "Thesis is intact.", kind: "ai_judgement", confidence: "high", evidenceIds, section: "investmentCase" },
    { id: "change", text: "No material change.", kind: "fact", confidence: "high", evidenceIds, section: "whatChanged" },
    { id: "risk:high:demand", text: "Demand could weaken.", kind: "ai_judgement", confidence: "moderate", evidenceIds, section: "risks" },
    { id: "catalyst", text: "Results are upcoming.", kind: "ai_judgement", confidence: "moderate", evidenceIds, section: "catalysts" },
    { id: "assessment", text: "Assessment remains favourable.", kind: "ai_judgement", confidence: "moderate", evidenceIds, section: "assessment" },
    { id: "watch", text: "Watch earnings.", kind: "ai_judgement", confidence: "moderate", evidenceIds, section: "watchNext" },
  ];
}

const resolvedIdentity = {
  status: "resolved" as const,
  verifiedIssuerWebsite: "https://investor.acme.in",
};

test("evidence quality: classifies official market, issuer, AMC, and index material as primary", () => {
  for (const item of [
    evidence({ url: "https://www.nseindia.com/get-quotes/equity?symbol=ACME" }),
    evidence({ url: "https://www.bseindia.com/stock-share-price/acme/123" }),
    evidence({ url: "https://www.sebi.gov.in/legal/circulars.html" }),
    evidence({ url: "https://investor.acme.in/financial-results" }),
    evidence({ url: "https://www.amfiindia.com/net-asset-value/nav-history" }),
    evidence({ url: "https://www.niftyindices.com/reports/index-factsheet" }),
  ]) {
    assert.equal(classifyEvidenceTier(item, resolvedIdentity).tier, "primary");
  }
});

test("evidence quality: classifies reputable financial reporting as secondary", () => {
  const result = classifyEvidenceTier(
    evidence({ publisher: "Reuters", sourceType: "financial_news", url: "https://www.reuters.com/markets/acme-results" }),
    resolvedIdentity,
  );
  assert.equal(result.tier, "secondary");
});

test("evidence quality: excludes missing URLs and social sources", () => {
  assert.equal(classifyEvidenceTier(evidence({ url: null }), resolvedIdentity).tier, "excluded");
  assert.equal(classifyEvidenceTier(evidence({ sourceType: "social", url: "https://x.com/acme" }), resolvedIdentity).tier, "excluded");
});

test("evidence quality: rejects unsafe and deceptive URLs", () => {
  for (const url of [
    "http://www.nseindia.com/filing",
    "https://user:password@www.nseindia.com/filing",
    "https://localhost/filing",
    "https://127.0.0.1/filing",
    "https://10.0.0.1/filing",
    "https://issuer.local/filing",
    "https://www.nseindia.com:8443/filing",
    "javascript:alert(1)",
    "data:text/plain,unsafe",
    "file:///tmp/unsafe",
    "https://sebi.gov.in.evil.com/filing",
    "https://sebi.gov.in@evil.com/filing",
  ]) {
    assert.equal(normalizeCanonicalUrl(url), null, url);
    assert.equal(classifyEvidenceTier(evidence({ url }), resolvedIdentity).tier, "excluded", url);
  }
});

test("evidence quality: rejects normalized private IPv4 and IPv6 addresses while allowing public IPv6", () => {
  for (const url of [
    "https://2130706433/filing",
    "https://0177.0.0.1/filing",
    "https://0x7f000001/filing",
    "https://[::]/filing",
    "https://[::1]/filing",
    "https://[fe80::1]/filing",
    "https://[feb0::1]/filing",
    "https://[fc00::1]/filing",
    "https://[fdff::1]/filing",
    "https://[::ffff:7f00:1]/filing",
    "https://[::ffff:a00:1]/filing",
  ]) {
    assert.equal(normalizeCanonicalUrl(url), null, url);
  }
  assert.equal(normalizeCanonicalUrl("https://[2606:4700:4700::1111]/dns-query"), "https://[2606:4700:4700::1111]/dns-query");
});

test("evidence quality: preserves public IDN hosts and removes fragments", () => {
  assert.equal(normalizeCanonicalUrl("https://xn--bcher-kva.example/report#overview"), "https://xn--bcher-kva.example/report");
});

test("evidence quality: requires identity-verified issuer websites before treating them as primary", () => {
  const item = evidence({ url: "https://investor.acme.in/financial-results" });
  assert.equal(classifyEvidenceTier(item, { status: "resolved", issuerWebsite: "https://investor.acme.in" }).tier, "secondary");
  assert.equal(classifyEvidenceTier(item, resolvedIdentity).tier, "primary");
});

test("evidence quality: never promotes an arbitrary host solely from its source type", () => {
  for (const sourceType of ["regulator", "exchange", "index_provider", "amc"]) {
    assert.equal(
      classifyEvidenceTier(evidence({ sourceType, url: "https://arbitrary.example/source" }), resolvedIdentity).tier,
      "secondary",
      sourceType,
    );
  }
  assert.equal(
    classifyEvidenceTier(evidence({ sourceType: "regulator", url: "https://www.sebi.gov.in/legal/circulars.html" }), resolvedIdentity).tier,
    "primary",
  );
});

test("evidence quality: removes tracking parameters without dropping material query parameters", () => {
  assert.equal(
    normalizeCanonicalUrl("https://www.nseindia.com/company?symbol=ACME&utm_source=email&gclid=abc"),
    "https://www.nseindia.com/company?symbol=ACME",
  );
});

test("evidence quality: deduplicates canonical URLs before calculating corroboration", () => {
  const result = calculateEvidenceStrength({
    evidence: [
      evidence({ id: "E1", url: "https://www.nseindia.com/company?symbol=ACME&utm_source=a" }),
      evidence({ id: "E2", url: "https://www.nseindia.com/company?utm_medium=b&symbol=ACME" }),
      evidence({ id: "E3", url: "https://www.nseindia.com/company?symbol=ACME" }),
    ],
    claims: claims(["E1", "E2", "E3"]),
    identity: resolvedIdentity,
    now: retrievedAt,
  });
  assert.ok(result.reasons.some((reason) => reason.includes("one distinct canonical source")));
});

test("evidence quality: prevents Strong strength without complete citations or primary evidence", () => {
  const missingCitation = calculateEvidenceStrength({
    evidence: [evidence()],
    claims: claims([]),
    identity: resolvedIdentity,
    now: retrievedAt,
  });
  const noPrimary = calculateEvidenceStrength({
    evidence: [evidence({ url: "https://www.reuters.com/markets/acme" })],
    claims: claims(),
    identity: resolvedIdentity,
    now: retrievedAt,
  });

  assert.notEqual(missingCitation.strength, "strong");
  assert.notEqual(noPrimary.strength, "strong");
});

test("evidence quality: gives unresolved identities Limited strength", () => {
  const result = calculateEvidenceStrength({
    evidence: [evidence()],
    claims: claims(),
    identity: { status: "needs_identity" },
    now: retrievedAt,
  });
  assert.equal(result.strength, "limited");
  assert.ok(result.gaps.some((gap) => gap.includes("identity")));
});

test("evidence quality: returns Strong only when cited primary evidence meets every explained component", () => {
  const result = calculateEvidenceStrength({
    evidence: [
      evidence({ id: "E1", url: "https://www.nseindia.com/company?symbol=ACME" }),
      evidence({ id: "E2", url: "https://www.sebi.gov.in/legal/circulars.html" }),
    ],
    claims: claims(["E1", "E2"]),
    identity: resolvedIdentity,
    now: retrievedAt,
  });
  assert.equal(result.strength, "strong");
  assert.deepEqual(
    Object.values(result.components).map((item) => item.satisfied),
    [true, true, true, true, true, true],
  );
});

test("evidence quality: returns Moderate for fully cited recent secondary evidence", () => {
  const result = calculateEvidenceStrength({
    evidence: [
      evidence({ id: "E1", url: "https://www.reuters.com/markets/acme" }),
      evidence({ id: "E2", url: "https://www.ft.com/content/acme" }),
    ],
    claims: claims(["E1", "E2"]),
    identity: resolvedIdentity,
    now: retrievedAt,
  });
  assert.equal(result.strength, "moderate");
  assert.equal(result.components.citationCoverage.satisfied, true);
  assert.equal(result.components.primaryCoverage.satisfied, false);
  assert.equal(result.components.freshness.satisfied, true);
});

test("evidence quality: caps missing-date freshness and rejects future publication freshness", () => {
  const missingDate = calculateEvidenceStrength({
    evidence: [evidence({ publishedAt: null })],
    claims: claims(),
    identity: resolvedIdentity,
    now: retrievedAt,
  });
  const futureDate = calculateEvidenceStrength({
    evidence: [evidence({ publishedAt: "2026-09-13T00:00:00.000Z" })],
    claims: claims(),
    identity: resolvedIdentity,
    now: retrievedAt,
  });
  assert.equal(missingDate.strength, "moderate");
  assert.equal(missingDate.components.freshness.satisfied, false);
  assert.ok(missingDate.gaps.some((gap) => gap.includes("freshness cap")));
  assert.equal(futureDate.components.freshness.satisfied, false);
  assert.ok(futureDate.gaps.some((gap) => gap.includes("future")));
});

test("evidence quality: ignores uncited evidence spam for freshness and corroboration", () => {
  const citedOldEvidence = evidence({ publishedAt: "2026-04-01T00:00:00.000Z" });
  const baseline = calculateEvidenceStrength({ evidence: [citedOldEvidence], claims: claims(), identity: resolvedIdentity, now: retrievedAt });
  const spammed = calculateEvidenceStrength({
    evidence: [
      citedOldEvidence,
      evidence({ id: "E2", url: "https://www.sebi.gov.in/legal/circulars.html" }),
      evidence({ id: "E3", url: "https://www.niftyindices.com/reports/index-factsheet" }),
    ],
    claims: claims(),
    identity: resolvedIdentity,
    now: retrievedAt,
  });
  assert.equal(baseline.strength, "moderate");
  assert.equal(spammed.strength, "moderate");
  assert.equal(spammed.components.freshness.satisfied, false);
  assert.ok(spammed.reasons.some((reason) => reason.includes("one distinct canonical source")));
});

test("evidence quality: applies the specified conflict and unknown deduction caps", () => {
  const primaryBase = { evidence: [evidence({ id: "E1" }), evidence({ id: "E2", url: "https://www.sebi.gov.in/legal/circulars.html" })], claims: claims(["E1", "E2"]), identity: resolvedIdentity, now: retrievedAt };
  const secondaryBase = { evidence: [evidence({ id: "E1", url: "https://www.reuters.com/markets/acme" }), evidence({ id: "E2", url: "https://www.ft.com/content/acme" })], claims: claims(["E1", "E2"]), identity: resolvedIdentity, now: retrievedAt };
  const cappedConflicts = calculateEvidenceStrength({ ...primaryBase, materialConflictCount: 3 });
  const cappedUnknowns = calculateEvidenceStrength({ ...secondaryBase, decisionRelevantUnknownCount: 5 });
  assert.equal(cappedConflicts.strength, "moderate");
  assert.equal(cappedUnknowns.strength, "moderate");
  assert.ok(cappedConflicts.gaps.some((gap) => gap.includes("conflicts")));
  assert.ok(cappedUnknowns.gaps.some((gap) => gap.includes("unknowns")));
});
