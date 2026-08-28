import { createHash } from "node:crypto";

import type { AutomatedResearchSnapshotPayload } from "@workspace/research-contracts";

export interface SnapshotChangeSummary {
  material: boolean;
  headline: string;
  addedRiskIds: string[];
  resolvedRiskIds: string[];
  changedStatementIds: string[];
  evidenceStrengthChanged: boolean;
}

type Claim = AutomatedResearchSnapshotPayload["claims"][number];

function normalizedTextHash(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

function claimsById(snapshot: AutomatedResearchSnapshotPayload): Map<string, Claim> {
  const claims = new Map<string, Claim>();
  for (const claim of snapshot.claims) {
    if (claims.has(claim.id)) throw new Error(`Duplicate claim ID: ${claim.id}`);
    claims.set(claim.id, claim);
  }
  return claims;
}

function isThesisStatus(claim: Claim): boolean {
  return /^thesis[-_:]?status$/i.test(claim.id);
}

function isInvalidation(claim: Claim): boolean {
  return /^invalidation[-_:]/i.test(claim.id);
}

function isHighSeverityRisk(claim: Claim): boolean {
  return claim.section === "risks" && /^risk[-_:](?:high|severe|critical)(?=$|[-_:])/i.test(claim.id);
}

function isAssessment(claim: Claim): boolean {
  return claim.section === "assessment";
}

/**
 * Contract convention: absent dedicated snapshot fields, stable claim IDs
 * `thesis-status` and `invalidation:*` encode those concepts; high-risk IDs
 * include `risk:high:*`, `risk:severe:*`, or `risk:critical:*`.
 */
export function diffSnapshots(
  previous: AutomatedResearchSnapshotPayload | null | undefined,
  current: AutomatedResearchSnapshotPayload,
): SnapshotChangeSummary {
  if (previous) claimsById(previous);
  claimsById(current);
  if (!previous) {
    const addedRiskIds = current.claims.filter((claim) => claim.section === "risks").map((claim) => claim.id).sort();
    return {
      material: true,
      headline: "Initial automated research snapshot created.",
      addedRiskIds,
      resolvedRiskIds: [],
      changedStatementIds: current.claims.map((claim) => claim.id).sort(),
      evidenceStrengthChanged: false,
    };
  }
  const oldClaims = claimsById(previous);
  const newClaims = claimsById(current);
  const statementIds = new Set([...oldClaims.keys(), ...newClaims.keys()]);
  const changedStatementIds = [...statementIds].filter((id) => {
    const before = oldClaims.get(id);
    const after = newClaims.get(id);
    return !before || !after || normalizedTextHash(before.text) !== normalizedTextHash(after.text) || before.section !== after.section;
  }).sort();
  const addedRiskIds = current.claims.filter((claim) => claim.section === "risks" && !oldClaims.has(claim.id)).map((claim) => claim.id).sort();
  const resolvedRiskIds = previous.claims.filter((claim) => claim.section === "risks" && !newClaims.has(claim.id)).map((claim) => claim.id).sort();
  const evidenceStrengthChanged = previous.evidenceStrength !== current.evidenceStrength;

  const materialStatements = changedStatementIds.some((id) => {
    const before = oldClaims.get(id);
    const after = newClaims.get(id);
    return [before, after].some((claim) => claim && (isThesisStatus(claim) || isInvalidation(claim) || isAssessment(claim) || isHighSeverityRisk(claim)));
  });
  const material = materialStatements || evidenceStrengthChanged;
  return {
    material,
    headline: material ? "Material automated research changes detected." : "No material automated research changes detected.",
    addedRiskIds,
    resolvedRiskIds,
    changedStatementIds,
    evidenceStrengthChanged,
  };
}
