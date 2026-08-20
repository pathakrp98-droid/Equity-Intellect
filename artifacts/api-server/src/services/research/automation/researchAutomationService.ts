import { createHash } from "node:crypto";

import {
  researchEvidenceInputSchema,
  validateSnapshotClaims,
  type AutomatedResearchSnapshotPayload,
  type EvidenceStrength,
  type IdentityStatus,
  type SecurityType,
} from "@workspace/research-contracts";
import type {
  AutomatedResearchSnapshot,
  ResearchAutomationJob,
} from "@workspace/db/schema";

import {
  calculateEvidenceStrength,
  classifyEvidenceTier,
  type EvidenceStrengthResult,
} from "./evidenceQuality";
import {
  ResearchProviderError,
  type HoldingPriceContext,
  type ResearchProvider,
  type ResearchProviderErrorCode,
  type ResearchSecurityIdentity,
} from "./openAIResearchProvider";
import type {
  GeneratedResearchBundle,
  MarkJobDeadLetterInput,
  MarkJobRetryInput,
  PublishSnapshotFence,
  SnapshotValidationResult,
} from "./researchAutomationRepository";
import { diffSnapshots } from "./snapshotDiff";

export type ResearchAutomationFailureCode =
  ResearchProviderErrorCode | "database_error";

export interface ResearchAutomationContext {
  company: {
    id: number;
    userId: string;
    ticker: string;
    name: string;
    exchange: string;
    isin: string | null;
    securityType: SecurityType;
    identityStatus: IdentityStatus;
    automationEnabled: boolean;
    officialDomains?: readonly string[];
    verifiedIssuerWebsite?: string | null;
  };
  holdingContext: HoldingPriceContext;
  userResearchSummary: string | null;
}

export interface ResearchAutomationContextReader {
  loadOwnedContext(
    userId: string,
    companyId: number,
  ): Promise<ResearchAutomationContext | null>;
}

export interface ResearchAutomationServiceRepository {
  getJob(userId: string, jobId: number): Promise<ResearchAutomationJob | null>;
  getCurrentSnapshot(
    userId: string,
    companyId: number,
  ): Promise<AutomatedResearchSnapshot | null>;
  publishSnapshot(
    job: ResearchAutomationJob,
    bundle: GeneratedResearchBundle,
    validation: SnapshotValidationResult,
    fence: PublishSnapshotFence,
  ): Promise<number>;
  markJobRetry(input: MarkJobRetryInput): Promise<void>;
  markJobDeadLetter(input: MarkJobDeadLetterInput): Promise<void>;
}

export interface ResearchAutomationClock {
  now(): Date;
}

export interface RunResearchJobInput {
  userId: string;
  jobId: number;
  workerId: string;
}

export type RunResearchJobResult =
  | {
      status: "succeeded";
      snapshotId: number;
      evidenceStrength: EvidenceStrength;
      errorCode: null;
      retryAt: null;
    }
  | {
      status: "retrying";
      snapshotId: null;
      evidenceStrength: null;
      errorCode: ResearchAutomationFailureCode;
      retryAt: Date;
    }
  | {
      status: "dead_letter";
      snapshotId: null;
      evidenceStrength: null;
      errorCode: ResearchAutomationFailureCode;
      retryAt: null;
    }
  | {
      status: "skipped";
      snapshotId: null;
      evidenceStrength: null;
      errorCode: null;
      retryAt: null;
    };

interface ResearchAutomationServiceDependencies {
  repository: ResearchAutomationServiceRepository;
  contextReader: ResearchAutomationContextReader;
  provider: ResearchProvider;
  clock?: ResearchAutomationClock;
  jitter?: () => number;
}

const FAILURE_MESSAGES: Record<ResearchAutomationFailureCode, string> = {
  provider_unconfigured: "Research provider is not configured.",
  identity_unresolved: "Research identity is unresolved.",
  provider_timeout: "Research provider request timed out.",
  provider_rate_limited: "Research provider rate limited the request.",
  provider_unavailable: "Research provider is temporarily unavailable.",
  insufficient_evidence: "Research has insufficient verified evidence.",
  invalid_generated_output: "Research provider returned invalid output.",
  database_error: "Research automation could not access its stored data.",
};

const TRANSIENT_FAILURES = new Set<ResearchAutomationFailureCode>([
  "provider_timeout",
  "provider_rate_limited",
  "provider_unavailable",
  "database_error",
]);

class ResearchAutomationServiceError extends Error {
  constructor(
    readonly code: ResearchAutomationFailureCode,
    readonly retryable = false,
  ) {
    super(FAILURE_MESSAGES[code]);
    this.name = "ResearchAutomationServiceError";
  }
}

function validWorkerId(value: string): string | null {
  const workerId = value.trim();
  return workerId &&
    workerId.length <= 120 &&
    !/[\u0000-\u001f\u007f]/.test(workerId)
    ? workerId
    : null;
}

function validUserId(value: string): string | null {
  const userId = value.trim();
  return userId && !/[\u0000-\u001f\u007f]/.test(userId) ? userId : null;
}

function hasLiveLease(
  job: ResearchAutomationJob,
  workerId: string,
  now: Date,
): boolean {
  return (
    job.status === "running" &&
    job.workerId === workerId &&
    job.leaseExpiresAt instanceof Date &&
    job.leaseExpiresAt.getTime() > now.getTime()
  );
}

function identityFromContext(
  context: ResearchAutomationContext,
): ResearchSecurityIdentity {
  return {
    status: context.company.identityStatus,
    securityType: context.company.securityType,
    ticker: context.company.ticker,
    name: context.company.name,
    exchange: context.company.exchange,
    isin: context.company.isin,
    officialDomains: context.company.officialDomains ?? [],
    verifiedIssuerWebsite: context.company.verifiedIssuerWebsite ?? null,
  };
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function asValidDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ResearchAutomationServiceError("invalid_generated_output");
  }
  return date;
}

function validateSecurityRules(
  snapshot: AutomatedResearchSnapshotPayload,
  expectedType: SecurityType,
  evidenceIds: ReadonlySet<string>,
): void {
  if (expectedType === "unknown" || snapshot.securityType !== expectedType) {
    throw new ResearchAutomationServiceError("invalid_generated_output");
  }
  if (snapshot.numericTarget === undefined) return;
  if (snapshot.securityType !== "equity") {
    throw new ResearchAutomationServiceError("invalid_generated_output");
  }
  const targetClaim = snapshot.claims.find(
    (claim) =>
      claim.id === "valuation:target" &&
      claim.section === "assessment" &&
      claim.kind === "ai_judgement" &&
      claim.evidenceIds.some((id) => evidenceIds.has(id)),
  );
  if (!targetClaim) {
    throw new ResearchAutomationServiceError("invalid_generated_output");
  }
}

function serverEvidenceReason(quality: EvidenceStrengthResult): string {
  const detail = [...quality.reasons, ...quality.gaps].join(" ").trim();
  return `Server evidence assessment: ${detail || "Evidence quality was assessed conservatively."}`.slice(
    0,
    2_000,
  );
}

function applySecurityEvidenceCap(
  quality: EvidenceStrengthResult,
  securityType: SecurityType,
): EvidenceStrengthResult {
  if (securityType !== "unlisted") return quality;
  return {
    ...quality,
    strength: "limited",
    gaps: [
      ...quality.gaps,
      "Unlisted holdings remain Limited because public evidence, transferability, liquidity, and price discovery cannot be verified as completely as listed securities.",
    ],
  };
}

function totalTokens(...values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0
    ? null
    : present.reduce((total, value) => total + value, 0);
}

function failureCode(error: unknown): ResearchAutomationFailureCode {
  if (error instanceof ResearchProviderError) return error.code;
  if (error instanceof ResearchAutomationServiceError) return error.code;
  return "database_error";
}

function retryableFailure(
  error: unknown,
  code: ResearchAutomationFailureCode,
): boolean {
  if (error instanceof ResearchAutomationServiceError) return error.retryable;
  return TRANSIENT_FAILURES.has(code);
}

function retryTime(
  job: ResearchAutomationJob,
  now: Date,
  jitter: () => number,
): Date {
  const attempt = Math.max(1, job.attempts);
  const exponential = Math.min(
    6 * 60 * 60_000,
    5 * 60_000 * 2 ** (attempt - 1),
  );
  const jitterValue = Math.min(1, Math.max(0, jitter()));
  return new Date(
    now.getTime() + exponential + Math.floor(jitterValue * 30_000),
  );
}

export class ResearchAutomationService {
  private readonly repository: ResearchAutomationServiceRepository;
  private readonly contextReader: ResearchAutomationContextReader;
  private readonly provider: ResearchProvider;
  private readonly clock: ResearchAutomationClock;
  private readonly jitter: () => number;

  constructor(dependencies: ResearchAutomationServiceDependencies) {
    this.repository = dependencies.repository;
    this.contextReader = dependencies.contextReader;
    this.provider = dependencies.provider;
    this.clock = dependencies.clock ?? { now: () => new Date() };
    this.jitter = dependencies.jitter ?? Math.random;
  }

  async runJob(input: RunResearchJobInput): Promise<RunResearchJobResult> {
    const userId = validUserId(input.userId);
    const workerId = validWorkerId(input.workerId);
    if (
      !userId ||
      !workerId ||
      !Number.isInteger(input.jobId) ||
      input.jobId <= 0
    ) {
      return this.skipped();
    }

    const startedAt = this.clock.now();
    const job = await this.repository.getJob(userId, input.jobId);
    if (!job || !hasLiveLease(job, workerId, startedAt)) return this.skipped();

    try {
      const context = await this.loadContext(job);
      const identity = identityFromContext(context);
      if (
        !context.company.automationEnabled ||
        identity.status !== "resolved" ||
        identity.securityType === "unknown"
      ) {
        throw new ResearchAutomationServiceError("identity_unresolved");
      }
      if (!this.provider.isConfigured()) {
        throw new ResearchAutomationServiceError("provider_unconfigured");
      }

      const previous = await this.loadCurrentSnapshot(job);
      const discovery = await this.provider.discoverEvidence({
        userId,
        identity,
      });
      const acceptedEvidence = this.validateDiscoveredEvidence(
        discovery.evidence,
        identity,
      );
      if (acceptedEvidence.length === 0) {
        throw new ResearchAutomationServiceError("insufficient_evidence");
      }
      this.validateEvidenceDates(acceptedEvidence, startedAt);

      const generation = await this.provider.generateSnapshot({
        userId,
        identity,
        evidence: acceptedEvidence,
        holdingContext: context.holdingContext,
        priorSnapshot: previous?.payload ?? null,
        userResearchSummary:
          context.userResearchSummary?.slice(0, 20_000) ?? null,
      });

      const completedAt = this.clock.now();
      const evidenceIds = new Set(acceptedEvidence.map((item) => item.id));
      const validated = this.validateGeneratedSnapshot(
        generation.snapshot,
        identity.securityType,
        evidenceIds,
        completedAt,
      );
      const quality = applySecurityEvidenceCap(
        calculateEvidenceStrength({
          evidence: acceptedEvidence,
          claims: validated.claims,
          identity: {
            status: identity.status,
            officialDomains: identity.officialDomains,
            verifiedIssuerWebsite: identity.verifiedIssuerWebsite,
          },
          now: completedAt,
          decisionRelevantUnknownCount: validated.unknowns.length,
        }),
        identity.securityType,
      );
      const strength = quality.strength;
      if (strength === "limited" && validated.unknowns.length === 0) {
        throw new ResearchAutomationServiceError("invalid_generated_output");
      }
      const payload = validateSnapshotClaims(
        {
          ...validated,
          evidenceStrength: strength,
          evidenceStrengthReason: serverEvidenceReason(quality),
        },
        evidenceIds,
      );
      validateSecurityRules(payload, identity.securityType, evidenceIds);

      const citedEvidenceIds = new Set(
        payload.claims.flatMap((claim) => claim.evidenceIds),
      );
      const sources = acceptedEvidence
        .filter((item) => citedEvidenceIds.has(item.id))
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((item) => ({
          citationKey: item.id,
          authority: item.tier,
          sourceType: item.sourceType ?? "other",
          title: item.title,
          publisher: item.publisher,
          canonicalUrl: item.url!,
          publishedAt: item.publishedAt ? asValidDate(item.publishedAt) : null,
          retrievedAt: asValidDate(item.retrievedAt),
          evidenceSummary: item.summary,
          contentFingerprint: sha256(
            stableJson([item.url, item.publishedAt, item.summary]),
          ),
          metadata: { evidenceId: item.id },
        }));
      const changeSet = diffSnapshots(previous?.payload ?? null, payload);
      const contentHash = sha256(stableJson({ payload, sources }));
      const bundle: GeneratedResearchBundle = {
        payload,
        schemaVersion: "1",
        templateVersion: `${identity.securityType}-v1`,
        quality: quality as unknown as Record<string, unknown>,
        changeSet: changeSet as unknown as Record<string, unknown>,
        freshAt: completedAt,
        validUntil: asValidDate(payload.staleAt),
        provider: generation.provider,
        model: generation.model,
        inputTokens: totalTokens(discovery.inputTokens, generation.inputTokens),
        outputTokens: totalTokens(
          discovery.outputTokens,
          generation.outputTokens,
        ),
        latencyMs: discovery.latencyMs + generation.latencyMs,
        contentHash,
        sources,
      };
      const snapshotId = await this.repository.publishSnapshot(
        job,
        bundle,
        { evidenceStrength: strength },
        { workerId, now: completedAt },
      );
      return {
        status: "succeeded",
        snapshotId,
        evidenceStrength: strength,
        errorCode: null,
        retryAt: null,
      };
    } catch (error) {
      return this.recordFailure(job, workerId, error);
    }
  }

  private async loadContext(
    job: ResearchAutomationJob,
  ): Promise<ResearchAutomationContext> {
    try {
      const context = await this.contextReader.loadOwnedContext(
        job.userId,
        job.companyId,
      );
      if (
        !context ||
        context.company.userId !== job.userId ||
        context.company.id !== job.companyId
      ) {
        throw new ResearchAutomationServiceError("database_error", false);
      }
      return context;
    } catch (error) {
      if (error instanceof ResearchAutomationServiceError) throw error;
      throw new ResearchAutomationServiceError("database_error", true);
    }
  }

  private async loadCurrentSnapshot(
    job: ResearchAutomationJob,
  ): Promise<AutomatedResearchSnapshot | null> {
    try {
      return await this.repository.getCurrentSnapshot(
        job.userId,
        job.companyId,
      );
    } catch {
      throw new ResearchAutomationServiceError("database_error", true);
    }
  }

  private validateDiscoveredEvidence(
    values: readonly unknown[],
    identity: ResearchSecurityIdentity,
  ) {
    try {
      const parsed = values.map((item) =>
        researchEvidenceInputSchema.parse(item),
      );
      const ids = new Set<string>();
      for (const item of parsed) {
        if (ids.has(item.id)) {
          throw new ResearchAutomationServiceError("invalid_generated_output");
        }
        ids.add(item.id);
      }
      return parsed
        .map((item) => {
          const classification = classifyEvidenceTier(item, identity);
          return classification.canonicalUrl &&
            classification.tier !== "excluded"
            ? {
                ...item,
                url: classification.canonicalUrl,
                tier: classification.tier,
              }
            : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    } catch (error) {
      if (error instanceof ResearchAutomationServiceError) throw error;
      throw new ResearchAutomationServiceError("invalid_generated_output");
    }
  }

  private validateGeneratedSnapshot(
    value: unknown,
    expectedType: SecurityType,
    evidenceIds: ReadonlySet<string>,
    completedAt: Date,
  ): AutomatedResearchSnapshotPayload {
    try {
      const validated = validateSnapshotClaims(value, evidenceIds);
      validateSecurityRules(validated, expectedType, evidenceIds);
      const generatedAt = asValidDate(validated.generatedAt);
      const staleAt = asValidDate(validated.staleAt);
      if (
        generatedAt.getTime() > completedAt.getTime() + 5 * 60_000 ||
        staleAt.getTime() <= completedAt.getTime()
      ) {
        throw new ResearchAutomationServiceError("invalid_generated_output");
      }
      return validated;
    } catch (error) {
      if (error instanceof ResearchAutomationServiceError) throw error;
      throw new ResearchAutomationServiceError("invalid_generated_output");
    }
  }

  private validateEvidenceDates(
    evidence: readonly { publishedAt: string | null; retrievedAt: string }[],
    completedAt: Date,
  ): void {
    for (const item of evidence) {
      const retrievedAt = asValidDate(item.retrievedAt);
      const publishedAt = item.publishedAt
        ? asValidDate(item.publishedAt)
        : null;
      if (
        retrievedAt.getTime() > completedAt.getTime() + 5 * 60_000 ||
        (publishedAt &&
          publishedAt.getTime() > completedAt.getTime() + 5 * 60_000)
      ) {
        throw new ResearchAutomationServiceError("invalid_generated_output");
      }
    }
  }

  private async recordFailure(
    job: ResearchAutomationJob,
    workerId: string,
    error: unknown,
  ): Promise<RunResearchJobResult> {
    const code = failureCode(error);
    const now = this.clock.now();
    const failure = { code, message: FAILURE_MESSAGES[code] };
    if (retryableFailure(error, code) && job.attempts < job.maxAttempts) {
      const retryAt = retryTime(job, now, this.jitter);
      await this.repository.markJobRetry({
        userId: job.userId,
        jobId: job.id,
        workerId,
        now,
        retryAt,
        failure,
      });
      return {
        status: "retrying",
        snapshotId: null,
        evidenceStrength: null,
        errorCode: code,
        retryAt,
      };
    }
    await this.repository.markJobDeadLetter({
      userId: job.userId,
      jobId: job.id,
      workerId,
      now,
      failure,
    });
    return {
      status: "dead_letter",
      snapshotId: null,
      evidenceStrength: null,
      errorCode: code,
      retryAt: null,
    };
  }

  private skipped(): RunResearchJobResult {
    return {
      status: "skipped",
      snapshotId: null,
      evidenceStrength: null,
      errorCode: null,
      retryAt: null,
    };
  }
}
