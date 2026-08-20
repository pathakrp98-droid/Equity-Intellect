import assert from "node:assert/strict";
import test from "node:test";

import type {
  AutomatedResearchSnapshotPayload,
  ResearchEvidenceInput,
  SecurityType,
} from "@workspace/research-contracts";

import {
  ResearchAutomationService,
  type ResearchAutomationContext,
  type ResearchAutomationServiceRepository,
} from "./researchAutomationService";
import {
  ResearchProviderError,
  type EvidenceDiscoveryInput,
  type ResearchProvider,
  type SnapshotGenerationInput,
} from "./openAIResearchProvider";

const START = new Date("2026-08-20T06:00:00.000Z");
const COMPLETE = new Date("2026-08-20T06:00:30.000Z");

function evidence(
  overrides: Partial<ResearchEvidenceInput> = {},
): ResearchEvidenceInput {
  return {
    id: "E1",
    title: "Exchange filing",
    publisher: "National Stock Exchange of India",
    sourceType: "exchange_filing",
    url: "https://www.nseindia.com/companies-listing/corporate-filings",
    publishedAt: "2026-08-19T00:00:00.000Z",
    retrievedAt: "2026-08-20T05:55:00.000Z",
    tier: "primary",
    summary: "The issuer reported current operating and financial data.",
    ...overrides,
  };
}

function snapshot(
  securityType: Exclude<SecurityType, "unknown"> = "equity",
  overrides: Partial<AutomatedResearchSnapshotPayload> = {},
): AutomatedResearchSnapshotPayload {
  const claims: AutomatedResearchSnapshotPayload["claims"] = [
    {
      id: "own",
      section: "whatYouOwn",
      kind: "fact",
      text: "The listed security identity is verified.",
      confidence: "high",
      evidenceIds: ["E1"],
    },
    {
      id: "case",
      section: "investmentCase",
      kind: "ai_judgement",
      text: "AI judgement: current execution supports the investment case.",
      confidence: "moderate",
      evidenceIds: ["E1"],
    },
    {
      id: "change",
      section: "whatChanged",
      kind: "fact",
      text: "The exchange filing is the latest material evidence.",
      confidence: "high",
      evidenceIds: ["E1"],
    },
    {
      id: "risk:high:demand",
      section: "risks",
      kind: "ai_judgement",
      text: "AI judgement: weaker demand could pressure results.",
      confidence: "moderate",
      evidenceIds: ["E1"],
    },
    {
      id: "catalyst",
      section: "catalysts",
      kind: "ai_judgement",
      text: "AI judgement: the next filing may provide a catalyst.",
      confidence: "moderate",
      evidenceIds: ["E1"],
    },
    {
      id: securityType === "equity" ? "valuation:target" : "assessment",
      section: "assessment",
      kind: "ai_judgement",
      text: "AI judgement: the evidence supports a measured assessment.",
      confidence: "moderate",
      evidenceIds: ["E1"],
    },
    {
      id: "watch",
      section: "watchNext",
      kind: "ai_judgement",
      text: "AI judgement: monitor the next official disclosure.",
      confidence: "moderate",
      evidenceIds: ["E1"],
    },
  ];
  return {
    securityType,
    claims,
    unknowns: [],
    ...(securityType === "equity" ? { numericTarget: 125 } : {}),
    evidenceStrength: securityType === "unlisted" ? "limited" : "moderate",
    evidenceStrengthReason: "The generated assessment cites official evidence.",
    generatedAt: "2026-08-20T06:00:00.000Z",
    staleAt: "2026-08-27T06:00:00.000Z",
    ...overrides,
  };
}

function job(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 9,
    userId: "user-a",
    companyId: 7,
    triggerEventId: null,
    trigger: "holding_added",
    status: "running",
    priority: 100,
    idempotencyKey: "user-a:isin:INE002A01018:holding_added:fingerprint",
    context: {},
    attempts: 1,
    maxAttempts: 4,
    runAfter: START,
    startedAt: START,
    completedAt: null,
    leaseExpiresAt: new Date("2026-08-20T06:10:00.000Z"),
    workerId: "worker-a",
    errorCode: null,
    errorMessage: null,
    createdAt: START,
    updatedAt: START,
    ...overrides,
  };
}

function context(
  overrides: Partial<ResearchAutomationContext> = {},
): ResearchAutomationContext {
  return {
    company: {
      id: 7,
      userId: "user-a",
      ticker: "RELIANCE",
      name: "Reliance Industries Limited",
      exchange: "NSE",
      isin: "INE002A01018",
      securityType: "equity",
      identityStatus: "resolved",
      automationEnabled: true,
      officialDomains: [],
      verifiedIssuerWebsite: null,
    },
    holdingContext: {
      quantity: 10,
      averageCost: 110,
      currentPrice: 120,
      currency: "INR",
      portfolioWeightPct: 8,
      priceAsOf: "2026-08-20T05:30:00.000Z",
    },
    userResearchSummary:
      "Manual thesis: watch execution and balance-sheet discipline.",
    ...overrides,
  };
}

class FakeRepository implements ResearchAutomationServiceRepository {
  readonly operations: string[] = [];
  currentJob = job() as never;
  currentSnapshot: Record<string, unknown> | null = null;
  published: Array<Record<string, unknown>> = [];
  retries: Array<Record<string, unknown>> = [];
  deadLetters: Array<Record<string, unknown>> = [];

  async getJob(userId: string, jobId: number) {
    this.operations.push("get-job");
    const current = this.currentJob as Record<string, unknown> | null;
    return current?.userId === userId && current.id === jobId
      ? (this.currentJob as never)
      : null;
  }

  async getCurrentSnapshot(userId: string, companyId: number) {
    this.operations.push("get-current");
    if (
      this.currentSnapshot?.userId !== userId ||
      this.currentSnapshot?.companyId !== companyId
    ) {
      return null;
    }
    return this.currentSnapshot as never;
  }

  async publishSnapshot(
    claimedJob: never,
    bundle: never,
    validation: never,
    fence: never,
  ) {
    this.operations.push("publish");
    this.published.push({ claimedJob, bundle, validation, fence });
    const payload = (bundle as { payload: AutomatedResearchSnapshotPayload })
      .payload;
    this.currentSnapshot = {
      id: 77 + this.published.length - 1,
      userId: "user-a",
      companyId: 7,
      version: this.published.length,
      payload: structuredClone(payload),
      contentHash: (bundle as { contentHash: string }).contentHash,
    };
    return Number(this.currentSnapshot.id);
  }

  async markJobRetry(input: never) {
    this.operations.push("retry");
    this.retries.push(input);
  }

  async markJobDeadLetter(input: never) {
    this.operations.push("dead-letter");
    this.deadLetters.push(input);
  }
}

class FakeContextReader {
  readonly operations: string[] = [];
  value = context();

  async loadOwnedContext(userId: string, companyId: number) {
    this.operations.push("load-context");
    if (
      this.value.company.userId !== userId ||
      this.value.company.id !== companyId
    ) {
      return null;
    }
    return structuredClone(this.value);
  }
}

class FakeProvider implements ResearchProvider {
  readonly operations: string[] = [];
  configured = true;
  discovered = [evidence()];
  generated = snapshot();
  discoveryError: Error | null = null;
  generationError: Error | null = null;
  generationInput: SnapshotGenerationInput | null = null;

  isConfigured() {
    this.operations.push("configured");
    return this.configured;
  }

  async discoverEvidence(_input: EvidenceDiscoveryInput) {
    this.operations.push("discover");
    if (this.discoveryError) throw this.discoveryError;
    return {
      evidence: structuredClone(this.discovered),
      provider: "openai_responses" as const,
      model: "test-research-model",
      inputTokens: 100,
      outputTokens: 30,
      latencyMs: 20,
    };
  }

  async generateSnapshot(input: SnapshotGenerationInput) {
    this.operations.push("generate");
    this.generationInput = structuredClone(input);
    if (this.generationError) throw this.generationError;
    return {
      snapshot: structuredClone(this.generated),
      provider: "openai_responses" as const,
      model: "test-research-model",
      inputTokens: 200,
      outputTokens: 80,
      latencyMs: 30,
    };
  }
}

function fixture() {
  const repository = new FakeRepository();
  const contextReader = new FakeContextReader();
  const provider = new FakeProvider();
  const times = [START, COMPLETE];
  const service = new ResearchAutomationService({
    repository,
    contextReader,
    provider,
    clock: { now: () => times.shift() ?? COMPLETE },
    jitter: () => 0,
  });
  return { service, repository, contextReader, provider };
}

test("automation service: resolved identity publishes a server-scored immutable snapshot", async () => {
  const { service, repository, contextReader, provider } = fixture();

  const result = await service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });

  assert.deepEqual(result, {
    status: "succeeded",
    snapshotId: 77,
    evidenceStrength: "strong",
    errorCode: null,
    retryAt: null,
  });
  assert.deepEqual(repository.operations, [
    "get-job",
    "get-current",
    "publish",
  ]);
  assert.deepEqual(contextReader.operations, ["load-context"]);
  assert.deepEqual(provider.operations, ["configured", "discover", "generate"]);
  assert.equal(
    provider.generationInput?.userResearchSummary?.startsWith("Manual thesis:"),
    true,
  );
  assert.equal(repository.published.length, 1);
  const publication = repository.published[0]!;
  const bundle = publication.bundle as {
    payload: AutomatedResearchSnapshotPayload;
    contentHash: string;
    sources: Array<{ authority: string; canonicalUrl: string }>;
    changeSet: { material: boolean };
  };
  assert.equal(bundle.payload.evidenceStrength, "strong");
  assert.match(
    bundle.payload.evidenceStrengthReason,
    /server evidence assessment/i,
  );
  assert.match(bundle.contentHash, /^[a-f0-9]{64}$/);
  assert.equal(bundle.sources[0]?.authority, "primary");
  assert.equal(bundle.sources[0]?.canonicalUrl.startsWith("https://"), true);
  assert.equal(bundle.changeSet.material, true);
  assert.deepEqual(publication.fence, { workerId: "worker-a", now: COMPLETE });
});

test("automation service: invalid generated output preserves the previous snapshot", async () => {
  const { service, repository, provider } = fixture();
  const previousPayload = snapshot("equity", {
    claims: snapshot().claims.map((claim) =>
      claim.id === "case"
        ? { ...claim, text: "Original immutable text." }
        : claim,
    ),
  });
  repository.currentSnapshot = {
    id: 44,
    userId: "user-a",
    companyId: 7,
    version: 3,
    payload: structuredClone(previousPayload),
  };
  provider.generated = snapshot("equity", {
    claims: snapshot().claims.map((claim) => ({
      ...claim,
      evidenceIds:
        claim.id === "case" ? ["another-user-evidence"] : claim.evidenceIds,
    })),
  });

  const result = await service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });

  assert.equal(result.status, "dead_letter");
  assert.equal(result.errorCode, "invalid_generated_output");
  assert.equal(repository.published.length, 0);
  assert.equal(repository.deadLetters.length, 1);
  assert.deepEqual(repository.currentSnapshot.payload, previousPayload);
});

test("automation service: limited evidence publishes only with explicit unknowns", async () => {
  const allowed = fixture();
  allowed.provider.discovered = [
    evidence({
      url: "https://reuters.com/markets/example",
      publisher: "Reuters",
      tier: "secondary",
      publishedAt: null,
      retrievedAt: "2025-08-20T05:55:00.000Z",
    }),
  ];
  allowed.provider.generated = snapshot("equity", {
    unknowns: [
      "A current primary filing was not available.",
      "The secondary report could not be independently corroborated.",
    ],
    evidenceStrength: "limited",
  });

  const published = await allowed.service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });
  assert.equal(published.status, "succeeded");
  assert.equal(published.evidenceStrength, "limited");

  const rejected = fixture();
  rejected.provider.discovered = allowed.provider.discovered;
  rejected.contextReader.value = context({
    company: {
      ...context().company,
      ticker: "ACME-UNLISTED",
      exchange: "UNLISTED",
      isin: null,
      securityType: "unlisted",
    },
  });
  rejected.provider.generated = snapshot("unlisted", {
    unknowns: [],
    evidenceStrength: "limited",
  });
  const result = await rejected.service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });
  assert.equal(result.status, "dead_letter");
  assert.equal(result.errorCode, "invalid_generated_output");
  assert.equal(rejected.repository.published.length, 0);
});

test("automation service: provider timeout retries with deterministic bounded backoff", async () => {
  const { service, repository, provider } = fixture();
  provider.discoveryError = new ResearchProviderError("provider_timeout");

  const result = await service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });

  assert.equal(result.status, "retrying");
  assert.equal(result.errorCode, "provider_timeout");
  assert.equal(result.retryAt?.toISOString(), "2026-08-20T06:05:30.000Z");
  assert.equal(repository.retries.length, 1);
  assert.equal(repository.deadLetters.length, 0);
  assert.equal(repository.published.length, 0);
});

test("automation service: maximum attempts dead-letters a transient provider failure", async () => {
  const { service, repository, provider } = fixture();
  repository.currentJob = job({ attempts: 4, maxAttempts: 4 }) as never;
  provider.discoveryError = new ResearchProviderError("provider_rate_limited");

  const result = await service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });

  assert.equal(result.status, "dead_letter");
  assert.equal(result.errorCode, "provider_rate_limited");
  assert.equal(repository.retries.length, 0);
  assert.equal(repository.deadLetters.length, 1);
});

test("automation service: unresolved or cross-tenant identity stops before provider work", async () => {
  const unresolved = fixture();
  unresolved.contextReader.value = context({
    company: {
      ...context().company,
      identityStatus: "needs_identity",
    },
  });
  const unresolvedResult = await unresolved.service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });
  assert.equal(unresolvedResult.errorCode, "identity_unresolved");
  assert.deepEqual(unresolved.provider.operations, []);
  assert.equal(unresolved.repository.deadLetters.length, 1);

  const crossTenant = fixture();
  crossTenant.contextReader.value = context({
    company: { ...context().company, userId: "user-b" },
  });
  const crossTenantResult = await crossTenant.service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });
  assert.equal(crossTenantResult.status, "dead_letter");
  assert.equal(crossTenantResult.errorCode, "database_error");
  assert.deepEqual(crossTenant.provider.operations, []);
  assert.equal(crossTenant.repository.published.length, 0);
  assert.equal(crossTenant.repository.retries.length, 0);
  assert.equal(crossTenant.repository.deadLetters.length, 1);
});

test("automation service: malformed or duplicate discovery evidence is terminal", async () => {
  const malformed = fixture();
  malformed.provider.discovered = [
    evidence({ id: "", url: "https://www.nseindia.com/filing" }),
  ];
  const malformedResult = await malformed.service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });
  assert.equal(malformedResult.status, "dead_letter");
  assert.equal(malformedResult.errorCode, "invalid_generated_output");
  assert.equal(malformed.repository.retries.length, 0);
  assert.equal(malformed.repository.deadLetters.length, 1);

  const duplicate = fixture();
  duplicate.provider.discovered = [
    evidence(),
    evidence({
      title: "A second source reusing the same evidence ID",
      url: "https://www.bseindia.com/corporates/ann.html",
    }),
  ];
  const duplicateResult = await duplicate.service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });
  assert.equal(duplicateResult.status, "dead_letter");
  assert.equal(duplicateResult.errorCode, "invalid_generated_output");
  assert.equal(duplicate.repository.published.length, 0);
});

test("automation service: publication stores only evidence cited by the snapshot", async () => {
  const { service, repository, provider } = fixture();
  provider.discovered = [
    evidence(),
    evidence({
      id: "E2",
      title: "Unused secondary report",
      publisher: "Reuters",
      sourceType: "news",
      url: "https://reuters.com/markets/unused-report",
      tier: "secondary",
    }),
  ];

  const result = await service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });

  assert.equal(result.status, "succeeded");
  const sources = (
    repository.published[0]?.bundle as {
      sources: Array<{ citationKey: string }>;
    }
  ).sources;
  assert.deepEqual(
    sources.map((source) => source.citationKey),
    ["E1"],
  );
});

test("automation service: stolen or expired lease is skipped without mutation", async () => {
  const stolen = fixture();
  stolen.repository.currentJob = job({ workerId: "worker-b" }) as never;
  const stolenResult = await stolen.service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });
  assert.equal(stolenResult.status, "skipped");
  assert.deepEqual(stolen.provider.operations, []);
  assert.equal(stolen.repository.retries.length, 0);
  assert.equal(stolen.repository.deadLetters.length, 0);

  const expired = fixture();
  expired.repository.currentJob = job({ leaseExpiresAt: START }) as never;
  const expiredResult = await expired.service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });
  assert.equal(expiredResult.status, "skipped");
  assert.deepEqual(expired.provider.operations, []);
});

test("automation service: server rules reject an unsupported equity target judgement", async () => {
  const { service, repository, provider } = fixture();
  provider.generated = snapshot("equity", {
    claims: snapshot().claims.map((claim) =>
      claim.id === "valuation:target" ? { ...claim, id: "assessment" } : claim,
    ),
  });

  const result = await service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });

  assert.equal(result.status, "dead_letter");
  assert.equal(result.errorCode, "invalid_generated_output");
  assert.equal(repository.published.length, 0);
});

test("automation service: unlisted research is capped Limited and retains explicit gaps", async () => {
  const { service, repository, contextReader, provider } = fixture();
  contextReader.value = context({
    company: {
      ...context().company,
      ticker: "ACME-UNLISTED",
      exchange: "UNLISTED",
      isin: null,
      securityType: "unlisted",
    },
  });
  provider.generated = snapshot("unlisted", {
    unknowns: ["Transferability and reliable price discovery remain unknown."],
    evidenceStrength: "limited",
  });

  const result = await service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.evidenceStrength, "limited");
  const publishedPayload = (
    repository.published[0]?.bundle as {
      payload: AutomatedResearchSnapshotPayload;
    }
  ).payload;
  const publishedQuality = (
    repository.published[0]?.bundle as {
      quality: { strength: string; gaps: string[] };
    }
  ).quality;
  assert.equal(publishedPayload.securityType, "unlisted");
  assert.equal(publishedPayload.evidenceStrength, "limited");
  assert.equal(publishedQuality.strength, "limited");
  assert.equal(
    publishedQuality.gaps.some((gap) => /unlisted/i.test(gap)),
    true,
  );
});

test("automation service: future-dated evidence cannot be published", async () => {
  const published = fixture();
  published.provider.discovered = [
    evidence({ publishedAt: "2026-08-21T00:00:00.000Z" }),
  ];

  const publishedResult = await published.service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });

  assert.equal(publishedResult.status, "dead_letter");
  assert.equal(publishedResult.errorCode, "invalid_generated_output");
  assert.equal(published.repository.published.length, 0);
  assert.equal(published.provider.operations.includes("generate"), false);

  const retrieved = fixture();
  retrieved.provider.discovered = [
    evidence({
      publishedAt: null,
      retrievedAt: "2026-08-21T00:00:00.000Z",
    }),
  ];

  const retrievedResult = await retrieved.service.runJob({
    userId: "user-a",
    jobId: 9,
    workerId: "worker-a",
  });

  assert.equal(retrievedResult.status, "dead_letter");
  assert.equal(retrievedResult.errorCode, "invalid_generated_output");
  assert.equal(retrieved.repository.published.length, 0);
  assert.equal(retrieved.provider.operations.includes("generate"), false);
});
