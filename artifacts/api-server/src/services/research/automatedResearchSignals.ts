import type { AutomatedResearchSnapshotPayload } from "@workspace/research-contracts";

import type { ThesisStatus } from "./researchService";

export interface AutomatedResearchSignal {
  ticker: string;
  companyId: number;
  isCovered: boolean;
  researchOrigin: "automated" | "manual" | "none";
  freshnessStatus: "current" | "stale" | "failed" | "none";
  automationStatus: string | null;
  automationJobId: number | null;
  snapshotId: number | null;
  snapshotVersion: number | null;
  evidenceStrength: "strong" | "moderate" | "limited" | "none";
  completenessScore: number;
  thesisStatus: ThesisStatus;
  targetPrice: number | null;
  thresholdOrigin: "user_research" | "ai_judgement" | "none";
  generatedAt: Date | null;
  validUntil: Date | null;
  topRisks: string[];
  catalysts: string[];
  invalidations: string[];
  unknownCount: number;
  materialChange: {
    material: boolean;
    headline: string;
    addedRiskIds: string[];
    resolvedRiskIds: string[];
    changedStatementIds: string[];
    evidenceStrengthChanged: boolean;
  } | null;
  sources: Array<{
    citationKey: string;
    title: string;
    url: string;
    authority: string;
  }>;
}

export type AutomatedSignalSnapshot = {
  id: number;
  version: number;
  payload: AutomatedResearchSnapshotPayload;
  evidenceStrength: "strong" | "moderate" | "limited";
  validUntil: Date;
  publishedAt: Date;
  changeSet: Record<string, unknown>;
};

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase();
}

function automatedThesisStatus(
  payload: AutomatedSignalSnapshot["payload"],
): ThesisStatus {
  const judgement = payload.claims.find((claim) =>
    /^thesis[-_:]?status$/i.test(claim.id),
  )?.text;
  if (!judgement) return "draft";
  if (/broken|impaired|invalidated/i.test(judgement)) return "broken";
  if (/weakening|deteriorat|weakened/i.test(judgement)) return "weakening";
  if (/watch|monitor|caution/i.test(judgement)) return "monitoring";
  if (/closed|retired|exited/i.test(judgement)) return "closed";
  if (/intact|strengthening|strengthened|healthy/i.test(judgement))
    return "intact";
  return "draft";
}

function materialChange(
  value: Record<string, unknown>,
): AutomatedResearchSignal["materialChange"] {
  if (typeof value.material !== "boolean") return null;
  const strings = (candidate: unknown) =>
    Array.isArray(candidate)
      ? candidate.filter((item): item is string => typeof item === "string")
      : [];
  return {
    material: value.material,
    headline:
      typeof value.headline === "string"
        ? value.headline
        : value.material
          ? "Material automated research changes detected."
          : "No material automated research changes detected.",
    addedRiskIds: strings(value.addedRiskIds),
    resolvedRiskIds: strings(value.resolvedRiskIds),
    changedStatementIds: strings(value.changedStatementIds),
    evidenceStrengthChanged: value.evidenceStrengthChanged === true,
  };
}

export function buildAutomatedResearchSignal(input: {
  ticker: string;
  companyId: number;
  manualThesis: { status: ThesisStatus; targetPrice: number | null } | null;
  snapshot: AutomatedSignalSnapshot | null;
  latestJob: {
    id?: number;
    status: string;
    createdAt?: Date;
    completedAt?: Date | null;
  } | null;
  sources: AutomatedResearchSignal["sources"];
  now: Date;
}): AutomatedResearchSignal {
  const { snapshot, manualThesis } = input;
  const latestJobAt =
    input.latestJob?.completedAt ?? input.latestJob?.createdAt ?? null;
  const failed = Boolean(
    input.latestJob &&
      ["failed", "partial", "dead_letter"].includes(input.latestJob.status) &&
      (!snapshot || !latestJobAt || latestJobAt >= snapshot.publishedAt),
  );
  const stale = Boolean(
    snapshot && snapshot.validUntil.getTime() <= input.now.getTime(),
  );
  const freshnessStatus: AutomatedResearchSignal["freshnessStatus"] = failed
    ? "failed"
    : stale
      ? "stale"
      : snapshot
        ? "current"
        : "none";
  const evidenceStrength = snapshot?.evidenceStrength ?? "none";
  const manualTarget = manualThesis?.targetPrice ?? null;
  const automatedTarget =
    snapshot?.payload.securityType === "equity"
      ? (snapshot.payload.numericTarget ?? null)
      : null;
  const targetPrice = manualTarget ?? automatedTarget;
  const claims = snapshot?.payload.claims ?? [];

  return {
    ticker: normalizeTicker(input.ticker),
    companyId: input.companyId,
    isCovered: Boolean(snapshot || manualThesis),
    researchOrigin: snapshot ? "automated" : manualThesis ? "manual" : "none",
    freshnessStatus,
    automationStatus: input.latestJob?.status ?? null,
    automationJobId: input.latestJob?.id ?? null,
    snapshotId: snapshot?.id ?? null,
    snapshotVersion: snapshot?.version ?? null,
    evidenceStrength,
    completenessScore: snapshot
      ? evidenceStrength === "strong"
        ? 90
        : evidenceStrength === "moderate"
          ? 75
          : 50
      : manualThesis
        ? 60
        : 0,
    thesisStatus: snapshot
      ? automatedThesisStatus(snapshot.payload)
      : (manualThesis?.status ?? "draft"),
    targetPrice,
    thresholdOrigin: manualTarget
      ? "user_research"
      : automatedTarget
        ? "ai_judgement"
        : "none",
    generatedAt: snapshot?.publishedAt ?? null,
    validUntil: snapshot?.validUntil ?? null,
    topRisks: claims
      .filter((claim) => claim.section === "risks")
      .slice(0, 3)
      .map((claim) => claim.text),
    catalysts: claims
      .filter((claim) => claim.section === "catalysts")
      .slice(0, 3)
      .map((claim) => claim.text),
    invalidations: claims
      .filter((claim) => /^invalidation[-_:]/i.test(claim.id))
      .slice(0, 3)
      .map((claim) => claim.text),
    unknownCount: snapshot?.payload.unknowns.length ?? 0,
    materialChange: snapshot ? materialChange(snapshot.changeSet) : null,
    sources: input.sources,
  };
}
