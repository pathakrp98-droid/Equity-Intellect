import { isIP } from "node:net";

import type {
  AutomatedResearchSnapshotPayload,
  EvidenceStrength,
  EvidenceTier,
  IdentityStatus,
  ResearchEvidenceInput,
} from "@workspace/research-contracts";

const REQUIRED_SECTIONS = [
  "whatYouOwn",
  "investmentCase",
  "whatChanged",
  "risks",
  "catalysts",
  "assessment",
  "watchNext",
] as const;

const PRIMARY_DOMAINS = [
  "nseindia.com",
  "bseindia.com",
  "sebi.gov.in",
  "amfiindia.com",
  "niftyindices.com",
  "nseindices.com",
  "spglobal.com",
  "msci.com",
  "ftserussell.com",
];
const EXCLUDED_SOURCE_TYPES = new Set(["social", "forum", "aggregator", "excluded"]);
const PRIMARY_SOURCE_TYPES = new Set(["amc", "index_provider", "exchange", "regulator"]);
const TRACKING_PARAMETER = /^(utm_[a-z0-9_]+|gclid|dclid|fbclid|mc_cid|mc_eid|_ga|_gl|ref)$/i;

export interface ResearchIdentityInput {
  status: IdentityStatus;
  /** Domains already verified against the holding identity, not free-form issuer input. */
  officialDomains?: readonly string[];
  /** A user-supplied website. It never grants primary status by itself. */
  issuerWebsite?: string | null;
  /** Independently verified issuer website from the identity-resolution flow. */
  verifiedIssuerWebsite?: string | null;
}

export interface EvidenceClassification {
  tier: EvidenceTier;
  canonicalUrl: string | null;
  reason: string;
}

interface ComponentResult {
  satisfied: boolean;
  reason: string;
}

export interface EvidenceStrengthResult {
  strength: EvidenceStrength;
  reasons: string[];
  gaps: string[];
  components: {
    citationCoverage: ComponentResult;
    primaryCoverage: ComponentResult;
    requiredSectionCoverage: ComponentResult;
    freshness: ComponentResult;
    identity: ComponentResult;
    corroboration: ComponentResult;
  };
}

export interface EvidenceStrengthInput {
  evidence: readonly ResearchEvidenceInput[];
  claims: AutomatedResearchSnapshotPayload["claims"];
  identity: ResearchIdentityInput;
  now: string | Date;
  materialConflictCount?: number;
  decisionRelevantUnknownCount?: number;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "local" || host.endsWith(".local")) return true;
  const kind = isIP(host);
  if (kind === 4) {
    const [a, b] = host.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 ||
      a === 100 && b >= 64 && b <= 127;
  }
  if (kind === 6) {
    return host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("::ffff:127.");
  }
  return false;
}

function matchesDomain(hostname: string, domain: string): boolean {
  const normalizedDomain = domain.toLowerCase().replace(/\.$/, "");
  return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
}

function domainFromVerifiedWebsite(value: string | null | undefined): string | null {
  if (!value) return null;
  const canonical = normalizeCanonicalUrl(value);
  if (!canonical) return null;
  return new URL(canonical).hostname;
}

/** Returns null for unsafe, non-canonicalizable input. */
export function normalizeCanonicalUrl(value: string | null | undefined): string | null {
  if (!value || value !== value.trim() || /[\u0000-\u001f\u007f\s]/.test(value)) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || isPrivateHost(parsed.hostname)) return null;

  parsed.hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (PRIMARY_DOMAINS.some((domain) => parsed.hostname.startsWith(`${domain}.`))) return null;
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAMETER.test(key)) parsed.searchParams.delete(key);
  }
  parsed.searchParams.sort();
  return parsed.toString();
}

export function classifyEvidenceTier(
  evidence: ResearchEvidenceInput,
  identity: ResearchIdentityInput,
): EvidenceClassification {
  const canonicalUrl = normalizeCanonicalUrl(evidence.url);
  const sourceType = evidence.sourceType?.trim().toLowerCase();
  if (!canonicalUrl) return { tier: "excluded", canonicalUrl: null, reason: "The source URL is missing or unsafe." };
  if (sourceType && EXCLUDED_SOURCE_TYPES.has(sourceType)) {
    return { tier: "excluded", canonicalUrl, reason: "Social, forum, and aggregator sources are excluded." };
  }

  const hostname = new URL(canonicalUrl).hostname;
  const verifiedIssuerDomain = domainFromVerifiedWebsite(identity.verifiedIssuerWebsite);
  const verifiedDomains = [
    ...PRIMARY_DOMAINS,
    ...(identity.officialDomains ?? []).map((domain) => domain.toLowerCase().replace(/\.$/, "")),
    ...(verifiedIssuerDomain ? [verifiedIssuerDomain] : []),
  ];
  if (verifiedDomains.some((domain) => matchesDomain(hostname, domain))) {
    return { tier: "primary", canonicalUrl, reason: "The source is on a verified official domain." };
  }
  if (sourceType && PRIMARY_SOURCE_TYPES.has(sourceType)) {
    return { tier: "primary", canonicalUrl, reason: "The source has a primary institutional source type." };
  }
  return { tier: "secondary", canonicalUrl, reason: "The secure source is treated as secondary until independently verified as primary." };
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function freshnessValue(date: Date, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.7;
  if (ageDays <= 90) return 0.4;
  return 0.15;
}

function validDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function component(satisfied: boolean, reason: string): ComponentResult {
  return { satisfied, reason };
}

export function calculateEvidenceStrength(input: EvidenceStrengthInput): EvidenceStrengthResult {
  const gaps: string[] = [];
  const classified = input.evidence.map((item) => ({ item, ...classifyEvidenceTier(item, input.identity) }));
  const byId = new Map(classified.map((item) => [item.item.id, item]));
  const byCanonical = new Map<string, typeof classified[number]>();
  for (const item of classified) {
    if (!item.canonicalUrl || item.tier === "excluded") continue;
    const current = byCanonical.get(item.canonicalUrl);
    const currentDate = current ? validDate(current.item.publishedAt ?? current.item.retrievedAt)?.getTime() ?? 0 : -1;
    const itemDate = validDate(item.item.publishedAt ?? item.item.retrievedAt)?.getTime() ?? 0;
    if (!current || itemDate > currentDate || itemDate === currentDate && item.item.id < current.item.id) byCanonical.set(item.canonicalUrl, item);
  }

  const usable = new Set([...byCanonical.values()].map((item) => item.item.id));
  const usableEvidenceForClaim = (claim: AutomatedResearchSnapshotPayload["claims"][number]) =>
    claim.evidenceIds.map((id) => byId.get(id)).filter((item): item is typeof classified[number] => Boolean(item && item.tier !== "excluded" && item.canonicalUrl));
  const citedClaims = input.claims.filter((claim) => usableEvidenceForClaim(claim).length > 0);
  const primaryClaims = citedClaims.filter((claim) => usableEvidenceForClaim(claim).some((item) => item.tier === "primary"));
  const citedSections = new Set(citedClaims.map((claim) => claim.section));
  const citationCoverage = ratio(citedClaims.length, input.claims.length);
  const primaryCoverage = ratio(primaryClaims.length, input.claims.length);
  const sectionCoverage = ratio(REQUIRED_SECTIONS.filter((section) => citedSections.has(section)).length, REQUIRED_SECTIONS.length);

  let freshness = 0;
  if (byCanonical.size > 0) {
    const values = [...byCanonical.values()].map(({ item }) => {
      const published = item.publishedAt ? validDate(item.publishedAt) : null;
      const retrieved = validDate(item.retrievedAt);
      if (!published) {
        gaps.push(`Publication date is missing for ${item.id}; retrieval time was used with a freshness cap.`);
        return Math.min(0.5, retrieved ? freshnessValue(retrieved, new Date(input.now)) : 0);
      }
      return freshnessValue(published, new Date(input.now));
    });
    freshness = values.reduce((total, value) => total + value, 0) / values.length;
  }
  const identityValue = input.identity.status === "resolved" ? 1 : 0;
  const corroboration = byCanonical.size >= 2 ? 1 : byCanonical.size === 1 ? 0.5 : 0;
  const conflicts = Math.max(0, input.materialConflictCount ?? 0);
  const unknowns = Math.max(0, input.decisionRelevantUnknownCount ?? 0);
  const score = citationCoverage * 25 + primaryCoverage * 25 + sectionCoverage * 20 + freshness * 15 + identityValue * 10 + corroboration * 5 - Math.min(30, conflicts * 15) - Math.min(20, unknowns * 5);

  if (input.identity.status !== "resolved") gaps.push("The holding identity is unresolved, so evidence strength is limited.");
  if (citationCoverage < 1) gaps.push("Not every claim has usable cited evidence.");
  if (primaryCoverage < 0.6) gaps.push("Primary evidence does not cover enough claims for Strong evidence.");
  if (sectionCoverage < 1) gaps.push("One or more required research sections lack usable evidence.");
  if (conflicts > 0) gaps.push("Material evidence conflicts require review.");
  if (unknowns > 0) gaps.push("Decision-relevant unknowns remain.");

  const strong = score >= 80 && identityValue >= 0.9 && primaryCoverage >= 0.6 && freshness >= 0.7 && citationCoverage === 1 && sectionCoverage === 1 && conflicts === 0;
  const moderate = score >= 55 && identityValue >= 0.9;
  const strength: EvidenceStrength = strong ? "strong" : moderate ? "moderate" : "limited";
  const reasons = [
    `${byCanonical.size === 1 ? "one distinct canonical source" : `${byCanonical.size} distinct canonical sources`} were counted after deduplication.`,
    `${citedClaims.length} of ${input.claims.length} claims have usable citations.`,
    `${primaryClaims.length} of ${input.claims.length} claims have primary evidence.`,
  ];

  return {
    strength,
    reasons,
    gaps,
    components: {
      citationCoverage: component(citationCoverage === 1, citationCoverage === 1 ? "Every claim has usable cited evidence." : "Some claims lack usable cited evidence."),
      primaryCoverage: component(primaryCoverage >= 0.6, primaryCoverage >= 0.6 ? "Primary evidence covers the required share of claims." : "Primary evidence covers too few claims for Strong evidence."),
      requiredSectionCoverage: component(sectionCoverage === 1, sectionCoverage === 1 ? "Every required section has usable evidence." : "At least one required section lacks usable evidence."),
      freshness: component(freshness >= 0.7, freshness >= 0.7 ? "The evidence is sufficiently recent." : "The evidence is not sufficiently recent for Strong evidence."),
      identity: component(identityValue >= 0.9, identityValue >= 0.9 ? "The holding identity is resolved." : "The holding identity needs resolution."),
      corroboration: component(corroboration >= 1, corroboration >= 1 ? "At least two distinct canonical sources corroborate the research." : "Fewer than two distinct canonical sources corroborate the research."),
    },
  };
}
