import type {
  AutomatedResearchSnapshotPayload,
  AutomationTrigger,
  EvidenceStrength,
} from "@workspace/research-contracts";
import * as schema from "@workspace/db/schema";
import { and, desc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  ReconciliationCompany,
  ReconciliationRepository,
  ReconciliationTarget,
  ReconciliationTransaction,
} from "./researchReconciler";

export interface ClaimInput {
  workerId: string;
  limit: number;
  now: Date;
  leaseExpiresAt: Date;
}

export interface SanitizedFailure {
  code: string;
  message: string;
}

export interface JobLeaseFence {
  userId: string;
  jobId: number;
  workerId: string;
  now: Date;
}

export interface MarkJobRetryInput extends JobLeaseFence {
  retryAt: Date;
  failure: SanitizedFailure;
}

export interface MarkJobDeadLetterInput extends JobLeaseFence {
  failure: SanitizedFailure;
}

export interface PublishSnapshotFence {
  workerId: string;
  now: Date;
}

export interface EnqueueResearchJobInput {
  userId: string;
  companyId: number;
  normalizedIdentityKey: string;
  trigger: AutomationTrigger;
  refreshBucket: string;
  triggerEventId?: number | null;
  priority?: number;
  context?: Record<string, unknown>;
  runAfter?: Date;
  maxAttempts?: number;
}

export interface GeneratedResearchSource {
  citationKey: string;
  authority: "primary" | "secondary" | "excluded";
  sourceType: string;
  title: string;
  publisher: string;
  canonicalUrl: string;
  publishedAt: Date | null;
  retrievedAt: Date;
  evidenceSummary: string;
  contentFingerprint: string;
  metadata?: Record<string, unknown>;
}

export interface GeneratedResearchBundle {
  payload: AutomatedResearchSnapshotPayload;
  schemaVersion: string;
  templateVersion: string;
  quality: Record<string, unknown>;
  changeSet: Record<string, unknown>;
  freshAt: Date;
  validUntil: Date;
  provider: string;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs?: number | null;
  contentHash: string;
  sources: GeneratedResearchSource[];
}

export interface SnapshotValidationResult {
  evidenceStrength: EvidenceStrength;
}

type AutomationDatabase = NodePgDatabase<typeof schema>;

const SAFE_FAILURE_CODES = new Set([
  "identity_unresolved",
  "provider_unconfigured",
  "provider_timeout",
  "provider_rate_limited",
  "provider_unavailable",
  "insufficient_evidence",
  "invalid_generated_output",
  "database_error",
]);

function boundedInteger(
  value: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `value must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

function safeWorkerId(value: string): string {
  const workerId = value.trim();
  if (
    !workerId ||
    workerId.length > 120 ||
    /[\u0000-\u001f\u007f]/.test(workerId)
  ) {
    throw new Error("workerId is invalid");
  }
  return workerId;
}

export function sanitizeStoredFailure(input: {
  code: string;
  message: string;
}): SanitizedFailure {
  const rawCode = input.code.trim().toLowerCase();
  const code = SAFE_FAILURE_CODES.has(rawCode) ? rawCode : "database_error";
  const message = input.message
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
  return { code, message: message || "Research automation failed." };
}

export function buildIdempotencyKey(input: {
  userId: string;
  normalizedIdentityKey: string;
  trigger: AutomationTrigger;
  refreshBucket: string;
}): string {
  const parts = [
    input.userId.trim(),
    input.normalizedIdentityKey.trim(),
    input.trigger,
    input.refreshBucket.trim(),
  ];
  if (parts.some((part) => !part || /[\u0000-\u001f\u007f]/.test(part))) {
    throw new Error("idempotency key parts are invalid");
  }
  const key = parts.join(":");
  if (key.length > 180)
    throw new Error("idempotency key exceeds 180 characters");
  return key;
}

function localDayBucket(now: Date, timezone: string): string {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function utcIntervalBucket(now: Date, intervalMinutes: number): string {
  const intervalMilliseconds = intervalMinutes * 60_000;
  return new Date(
    Math.floor(now.getTime() / intervalMilliseconds) * intervalMilliseconds,
  ).toISOString();
}

export function buildRefreshBucket(input: {
  trigger: AutomationTrigger;
  now: Date;
  timezone: string;
  holdingFingerprint?: string;
}): string {
  if (
    input.trigger === "holding_added" ||
    input.trigger === "holding_changed"
  ) {
    const fingerprint = input.holdingFingerprint?.trim();
    if (!fingerprint) {
      throw new Error("holding fingerprint is required for holding triggers");
    }
    return fingerprint;
  }
  if (
    input.trigger === "scheduled_refresh" ||
    input.trigger === "portfolio_reconciled"
  ) {
    return localDayBucket(input.now, input.timezone);
  }
  if (input.trigger === "material_event") {
    return utcIntervalBucket(input.now, 240);
  }
  if (input.trigger === "manual_refresh") {
    return utcIntervalBucket(input.now, 15);
  }
  throw new Error(`Unsupported research trigger: ${input.trigger}`);
}

export function buildClaimTriggerEventsStatement(input: ClaimInput): SQL {
  const workerId = safeWorkerId(input.workerId);
  const limit = boundedInteger(input.limit, 1, 250);
  return sql`
    with "candidates" as (
      select "id"
      from "research_automation_trigger_events"
      where "status" = 'queued'
        and "available_at" <= ${input.now}
      order by "priority" desc, "available_at" asc, "id" asc
      for update skip locked
      limit ${limit}
    )
    update "research_automation_trigger_events" as "claimed"
    set "status" = 'running',
        "attempts" = "claimed"."attempts" + 1,
        "locked_at" = ${input.now},
        "lease_expires_at" = ${input.leaseExpiresAt},
        "worker_id" = ${workerId},
        "updated_at" = ${input.now}
    from "candidates"
    where "claimed"."id" = "candidates"."id"
    returning "claimed".*
  `;
}

export function buildClaimJobsStatement(input: ClaimInput): SQL {
  const workerId = safeWorkerId(input.workerId);
  const limit = boundedInteger(input.limit, 1, 250);
  return sql`
    with "candidates" as (
      select "id"
      from "research_automation_jobs"
      where "status" = 'queued'
        and "run_after" <= ${input.now}
        and "attempts" < "max_attempts"
      order by "priority" desc, "run_after" asc, "id" asc
      for update skip locked
      limit ${limit}
    )
    update "research_automation_jobs" as "claimed"
    set "status" = 'running',
        "attempts" = "claimed"."attempts" + 1,
        "started_at" = coalesce("claimed"."started_at", ${input.now}),
        "lease_expires_at" = ${input.leaseExpiresAt},
        "worker_id" = ${workerId},
        "updated_at" = ${input.now}
    from "candidates"
    where "claimed"."id" = "candidates"."id"
    returning "claimed".*
  `;
}

export function buildRequeueExpiredJobsStatement(now: Date): SQL {
  return sql`
    update "research_automation_jobs"
    set "status" = case
          when "attempts" >= "max_attempts" then 'dead_letter'::research_automation_status
          else 'queued'::research_automation_status
        end,
        "worker_id" = null,
        "lease_expires_at" = null,
        "run_after" = case when "attempts" >= "max_attempts" then "run_after" else ${now} end,
        "completed_at" = case when "attempts" >= "max_attempts" then ${now}::timestamptz else null end,
        "updated_at" = ${now}
    where "status" = 'running'
      and "lease_expires_at" <= ${now}
    returning "status"
  `;
}

function buildRequeueExpiredEventsStatement(now: Date): SQL {
  return sql`
    update "research_automation_trigger_events"
    set "status" = 'queued',
        "worker_id" = null,
        "locked_at" = null,
        "lease_expires_at" = null,
        "available_at" = ${now},
        "updated_at" = ${now}
    where "status" = 'running'
      and "lease_expires_at" <= ${now}
    returning "id"
  `;
}

export function buildCurrentSnapshotStatement(
  userId: string,
  companyId: number,
): SQL {
  return sql`
    select "automated_research_snapshots".*
    from "automated_research_snapshots"
    inner join "research_automation_jobs"
      on "research_automation_jobs"."id" = "automated_research_snapshots"."job_id"
     and "research_automation_jobs"."user_id" = "automated_research_snapshots"."user_id"
     and "research_automation_jobs"."company_id" = "automated_research_snapshots"."company_id"
    where "automated_research_snapshots"."user_id" = ${userId}
      and "automated_research_snapshots"."company_id" = ${companyId}
      and "research_automation_jobs"."status" = 'succeeded'
    order by "automated_research_snapshots"."version" desc
    limit 1
  `;
}

export function buildOwnedJobStatement(userId: string, jobId: number): SQL {
  return sql`
    select *
    from "research_automation_jobs"
    where "research_automation_jobs"."user_id" = ${userId}
      and "research_automation_jobs"."id" = ${jobId}
    limit 1
  `;
}

export function buildIdentityAdvisoryLockStatement(input: {
  userId: string;
  normalizedIdentityKey: string;
}): SQL {
  return sql`
    select pg_advisory_xact_lock(
      hashtextextended(${`${input.userId}:${input.normalizedIdentityKey}`}, 0)
    )
  `;
}

export function buildFindExactIdentityCompanyStatement(input: {
  userId: string;
  normalizedIdentityKey: string;
}): SQL {
  return sql`
    select *
    from "research_companies"
    where "user_id" = ${input.userId}
      and "normalized_identity_key" = ${input.normalizedIdentityKey}
    limit 1
  `;
}

export function buildFindTickerFallbackCompanyStatement(input: {
  userId: string;
  ticker: string;
}): SQL {
  return sql`
    select *
    from "research_companies"
    where "user_id" = ${input.userId}
      and "ticker" = ${input.ticker}
    limit 1
  `;
}

export function buildCreateCompanyStatement(input: {
  userId: string;
  ticker: string;
  name: string;
  exchange: string;
  sector: string | null;
  isin: string | null;
  normalizedIdentityKey: string;
  securityType: string;
  identityStatus: string;
  identityConfidence: number;
}): SQL {
  return sql`
    insert into "research_companies" (
      "user_id", "ticker", "name", "exchange", "sector", "isin",
      "normalized_identity_key", "security_type", "identity_status",
      "identity_confidence", "data_source", "is_archived"
    ) values (
      ${input.userId}, ${input.ticker}, ${input.name}, ${input.exchange},
      ${input.sector}, ${input.isin}, ${input.normalizedIdentityKey},
      ${input.securityType}, ${input.identityStatus},
      ${input.identityConfidence}, 'portfolio', false
    )
    on conflict ("user_id", "ticker") do nothing
    returning *
  `;
}

export function buildUpsertCoverageTargetStatement(input: {
  userId: string;
  portfolioId: number;
  companyId: number;
  ticker: string;
  holdingFingerprint: string;
  now: Date;
}): SQL {
  return sql`
    insert into "research_coverage_targets" (
      "user_id", "portfolio_id", "company_id", "ticker",
      "holding_fingerprint", "is_active", "first_seen_at", "last_seen_at"
    ) values (
      ${input.userId}, ${input.portfolioId}, ${input.companyId}, ${input.ticker},
      ${input.holdingFingerprint}, true, ${input.now}, ${input.now}
    )
    on conflict ("user_id", "portfolio_id", "ticker") do update
    set "company_id" = excluded."company_id",
        "holding_fingerprint" = excluded."holding_fingerprint",
        "is_active" = true,
        "last_seen_at" = excluded."last_seen_at",
        "removed_at" = null
    returning *
  `;
}

export function buildMarkJobRetryStatement(input: MarkJobRetryInput): SQL {
  const workerId = safeWorkerId(input.workerId);
  const failure = sanitizeStoredFailure(input.failure);
  return sql`
    update "research_automation_jobs"
    set "status" = 'queued',
        "run_after" = ${input.retryAt},
        "worker_id" = null,
        "lease_expires_at" = null,
        "error_code" = ${failure.code},
        "error_message" = ${failure.message},
        "updated_at" = ${input.now}
    where "id" = ${input.jobId}
      and "user_id" = ${input.userId}
      and "status" = 'running'
      and "worker_id" = ${workerId}
      and "lease_expires_at" > ${input.now}
    returning "id"
  `;
}

export function buildMarkJobDeadLetterStatement(
  input: MarkJobDeadLetterInput,
): SQL {
  const workerId = safeWorkerId(input.workerId);
  const failure = sanitizeStoredFailure(input.failure);
  return sql`
    update "research_automation_jobs"
    set "status" = 'dead_letter',
        "completed_at" = ${input.now},
        "worker_id" = null,
        "lease_expires_at" = null,
        "error_code" = ${failure.code},
        "error_message" = ${failure.message},
        "updated_at" = ${input.now}
    where "id" = ${input.jobId}
      and "user_id" = ${input.userId}
      and "status" = 'running'
      and "worker_id" = ${workerId}
      and "lease_expires_at" > ${input.now}
    returning "id"
  `;
}

export function buildFencedJobLockStatement(
  input: JobLeaseFence & { companyId: number },
): SQL {
  const workerId = safeWorkerId(input.workerId);
  return sql`
    select "id"
    from "research_automation_jobs"
    where "id" = ${input.jobId}
      and "user_id" = ${input.userId}
      and "company_id" = ${input.companyId}
      and "status" = 'running'
      and "worker_id" = ${workerId}
      and "lease_expires_at" > ${input.now}
    for update
  `;
}

export function buildOwnedCompanyLockStatement(
  userId: string,
  companyId: number,
): SQL {
  return sql`
    select "id"
    from "research_companies"
    where "user_id" = ${userId}
      and "id" = ${companyId}
    for update
  `;
}

function buildSnapshotByJobStatement(input: {
  userId: string;
  companyId: number;
  jobId: number;
}): SQL {
  return sql`
    select "id"
    from "automated_research_snapshots"
    where "user_id" = ${input.userId}
      and "company_id" = ${input.companyId}
      and "job_id" = ${input.jobId}
    limit 1
  `;
}

function buildSnapshotByContentStatement(input: {
  userId: string;
  companyId: number;
  contentHash: string;
}): SQL {
  return sql`
    select "id"
    from "automated_research_snapshots"
    where "user_id" = ${input.userId}
      and "company_id" = ${input.companyId}
      and "content_hash" = ${input.contentHash}
    limit 1
  `;
}

function buildLatestSnapshotVersionStatement(input: {
  userId: string;
  companyId: number;
}): SQL {
  return sql`
    select "version"
    from "automated_research_snapshots"
    where "user_id" = ${input.userId}
      and "company_id" = ${input.companyId}
    order by "version" desc
    limit 1
  `;
}

function buildCompleteJobStatement(
  input: JobLeaseFence & { companyId: number },
): SQL {
  const workerId = safeWorkerId(input.workerId);
  return sql`
    update "research_automation_jobs"
    set "status" = 'succeeded',
        "completed_at" = ${input.now},
        "worker_id" = null,
        "lease_expires_at" = null,
        "error_code" = null,
        "error_message" = null,
        "updated_at" = ${input.now}
    where "id" = ${input.jobId}
      and "user_id" = ${input.userId}
      and "company_id" = ${input.companyId}
      and "status" = 'running'
      and "worker_id" = ${workerId}
      and "lease_expires_at" > ${input.now}
    returning "id"
  `;
}

function resultRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? (rows as T[]) : [];
  }
  return [];
}

function mappedDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }
  throw new Error("Database returned an invalid timestamp");
}

function mappedNullableDate(value: unknown): Date | null {
  return value === null || value === undefined ? null : mappedDate(value);
}

function mapJobRow(row: Record<string, unknown>): schema.ResearchAutomationJob {
  return {
    id: Number(row.id),
    userId: String(row.userId ?? row.user_id),
    companyId: Number(row.companyId ?? row.company_id),
    triggerEventId: (row.triggerEventId ?? row.trigger_event_id ?? null) as
      number | null,
    trigger: row.trigger as schema.ResearchAutomationJob["trigger"],
    status: row.status as schema.ResearchAutomationJob["status"],
    priority: Number(row.priority),
    idempotencyKey: String(row.idempotencyKey ?? row.idempotency_key),
    context: (row.context ?? {}) as Record<string, unknown>,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.maxAttempts ?? row.max_attempts),
    runAfter: mappedDate(row.runAfter ?? row.run_after),
    startedAt: mappedNullableDate(row.startedAt ?? row.started_at),
    completedAt: mappedNullableDate(row.completedAt ?? row.completed_at),
    leaseExpiresAt: mappedNullableDate(
      row.leaseExpiresAt ?? row.lease_expires_at,
    ),
    workerId: (row.workerId ?? row.worker_id ?? null) as string | null,
    errorCode: (row.errorCode ?? row.error_code ?? null) as string | null,
    errorMessage: (row.errorMessage ?? row.error_message ?? null) as
      string | null,
    createdAt: mappedDate(row.createdAt ?? row.created_at),
    updatedAt: mappedDate(row.updatedAt ?? row.updated_at),
  };
}

function mapEventRow(
  row: Record<string, unknown>,
): schema.ResearchAutomationTriggerEvent {
  return {
    id: Number(row.id),
    userId: String(row.userId ?? row.user_id),
    portfolioId: (row.portfolioId ?? row.portfolio_id ?? null) as number | null,
    ticker: (row.ticker ?? null) as string | null,
    trigger: row.trigger as schema.ResearchAutomationTriggerEvent["trigger"],
    status: row.status as schema.ResearchAutomationTriggerEvent["status"],
    dedupeKey: String(row.dedupeKey ?? row.dedupe_key),
    priority: Number(row.priority),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    attempts: Number(row.attempts),
    availableAt: mappedDate(row.availableAt ?? row.available_at),
    lockedAt: mappedNullableDate(row.lockedAt ?? row.locked_at),
    leaseExpiresAt: mappedNullableDate(
      row.leaseExpiresAt ?? row.lease_expires_at,
    ),
    workerId: (row.workerId ?? row.worker_id ?? null) as string | null,
    processedAt: mappedNullableDate(row.processedAt ?? row.processed_at),
    lastError: (row.lastError ?? row.last_error ?? null) as string | null,
    createdAt: mappedDate(row.createdAt ?? row.created_at),
    updatedAt: mappedDate(row.updatedAt ?? row.updated_at),
  };
}

function mapSnapshotRow(
  row: Record<string, unknown>,
): schema.AutomatedResearchSnapshot {
  return {
    id: Number(row.id),
    userId: String(row.userId ?? row.user_id),
    companyId: Number(row.companyId ?? row.company_id),
    jobId: Number(row.jobId ?? row.job_id),
    version: Number(row.version),
    schemaVersion: String(row.schemaVersion ?? row.schema_version),
    securityType: (row.securityType ??
      row.security_type) as schema.AutomatedResearchSnapshot["securityType"],
    templateVersion: String(row.templateVersion ?? row.template_version),
    payload: row.payload as schema.AutomatedResearchSnapshot["payload"],
    quality: (row.quality ?? {}) as Record<string, unknown>,
    changeSet: (row.changeSet ?? row.change_set ?? {}) as Record<
      string,
      unknown
    >,
    evidenceStrength: (row.evidenceStrength ??
      row.evidence_strength) as schema.AutomatedResearchSnapshot["evidenceStrength"],
    freshAt: mappedDate(row.freshAt ?? row.fresh_at),
    validUntil: mappedDate(row.validUntil ?? row.valid_until),
    provider: String(row.provider),
    model: String(row.model),
    inputTokens: (row.inputTokens ?? row.input_tokens ?? null) as number | null,
    outputTokens: (row.outputTokens ?? row.output_tokens ?? null) as
      number | null,
    latencyMs: (row.latencyMs ?? row.latency_ms ?? null) as number | null,
    evidenceCount: Number(row.evidenceCount ?? row.evidence_count),
    primaryEvidenceCount: Number(
      row.primaryEvidenceCount ?? row.primary_evidence_count,
    ),
    contentHash: String(row.contentHash ?? row.content_hash),
    publishedAt: mappedDate(row.publishedAt ?? row.published_at),
  };
}

function mapReconciliationCompanyRow(
  row: Record<string, unknown>,
): ReconciliationCompany {
  return {
    id: Number(row.id),
    userId: String(row.userId ?? row.user_id),
    ticker: String(row.ticker),
    name: String(row.name),
    exchange: String(row.exchange),
    sector: (row.sector ?? null) as string | null,
    isin: (row.isin ?? null) as string | null,
    normalizedIdentityKey: (row.normalizedIdentityKey ??
      row.normalized_identity_key ??
      null) as string | null,
    securityType: (row.securityType ??
      row.security_type) as schema.ResearchCompany["securityType"],
    identityStatus: (row.identityStatus ??
      row.identity_status) as schema.ResearchCompany["identityStatus"],
    identityConfidence: Number(
      row.identityConfidence ?? row.identity_confidence,
    ),
    automationEnabled: Boolean(row.automationEnabled ?? row.automation_enabled),
    isArchived: Boolean(row.isArchived ?? row.is_archived),
  };
}

function mapReconciliationTargetRow(
  row: Record<string, unknown>,
): ReconciliationTarget {
  return {
    id: Number(row.id),
    userId: String(row.userId ?? row.user_id),
    portfolioId: Number(row.portfolioId ?? row.portfolio_id),
    companyId: Number(row.companyId ?? row.company_id),
    ticker: String(row.ticker),
    holdingFingerprint: String(
      row.holdingFingerprint ?? row.holding_fingerprint,
    ),
    isActive: Boolean(row.isActive ?? row.is_active),
    firstSeenAt: mappedDate(row.firstSeenAt ?? row.first_seen_at),
    lastSeenAt: mappedDate(row.lastSeenAt ?? row.last_seen_at),
    removedAt: mappedNullableDate(row.removedAt ?? row.removed_at),
  };
}

export class ResearchAutomationRepository implements ReconciliationRepository {
  constructor(private readonly database: AutomationDatabase) {}

  async claimTriggerEvents(
    input: ClaimInput,
  ): Promise<schema.ResearchAutomationTriggerEvent[]> {
    await this.requeueExpiredLeases(input.now);
    const result = await this.database.execute(
      buildClaimTriggerEventsStatement(input),
    );
    return resultRows<Record<string, unknown>>(result).map(mapEventRow);
  }

  async claimJobs(input: ClaimInput): Promise<schema.ResearchAutomationJob[]> {
    await this.requeueExpiredLeases(input.now);
    const result = await this.database.execute(buildClaimJobsStatement(input));
    return resultRows<Record<string, unknown>>(result).map(mapJobRow);
  }

  async requeueExpiredLeases(
    now: Date,
  ): Promise<{ events: number; jobs: number }> {
    return this.database.transaction(async (tx) => {
      const events = resultRows(
        await tx.execute(buildRequeueExpiredEventsStatement(now)),
      );
      const jobs = resultRows(
        await tx.execute(buildRequeueExpiredJobsStatement(now)),
      );
      return { events: events.length, jobs: jobs.length };
    });
  }

  async enqueueJob(input: EnqueueResearchJobInput): Promise<{
    job: schema.ResearchAutomationJob;
    created: boolean;
  }> {
    return this.database.transaction(async (tx) => {
      const [ownedCompany] = await tx
        .select({ id: schema.researchCompaniesTable.id })
        .from(schema.researchCompaniesTable)
        .where(
          and(
            eq(schema.researchCompaniesTable.id, input.companyId),
            eq(schema.researchCompaniesTable.userId, input.userId),
          ),
        )
        .limit(1);
      if (!ownedCompany) throw new Error("Research company was not found");

      const idempotencyKey = buildIdempotencyKey(input);
      const [created] = await tx
        .insert(schema.researchAutomationJobsTable)
        .values({
          userId: input.userId,
          companyId: input.companyId,
          triggerEventId: input.triggerEventId ?? null,
          trigger: input.trigger,
          priority: input.priority ?? 100,
          idempotencyKey,
          context: input.context ?? {},
          maxAttempts: input.maxAttempts ?? 5,
          runAfter: input.runAfter ?? new Date(),
        })
        .onConflictDoNothing({
          target: [
            schema.researchAutomationJobsTable.userId,
            schema.researchAutomationJobsTable.idempotencyKey,
          ],
        })
        .returning();
      if (created) return { job: created, created: true };

      const [existing] = await tx
        .select()
        .from(schema.researchAutomationJobsTable)
        .where(
          and(
            eq(schema.researchAutomationJobsTable.userId, input.userId),
            eq(
              schema.researchAutomationJobsTable.idempotencyKey,
              idempotencyKey,
            ),
          ),
        )
        .limit(1);
      if (!existing) throw new Error("Research job could not be enqueued");
      return { job: existing, created: false };
    });
  }

  async markJobRetry(input: MarkJobRetryInput): Promise<void> {
    const result = await this.database.execute(
      buildMarkJobRetryStatement(input),
    );
    if (resultRows(result).length === 0) {
      throw new Error("Research job lease is no longer owned");
    }
  }

  async markJobDeadLetter(input: MarkJobDeadLetterInput): Promise<void> {
    const result = await this.database.execute(
      buildMarkJobDeadLetterStatement(input),
    );
    if (resultRows(result).length === 0) {
      throw new Error("Research job lease is no longer owned");
    }
  }

  async getJob(
    userId: string,
    jobId: number,
  ): Promise<schema.ResearchAutomationJob | null> {
    const result = await this.database.execute(
      buildOwnedJobStatement(userId, jobId),
    );
    const row = resultRows<Record<string, unknown>>(result)[0];
    return row ? mapJobRow(row) : null;
  }

  async getCurrentSnapshot(
    userId: string,
    companyId: number,
  ): Promise<schema.AutomatedResearchSnapshot | null> {
    const result = await this.database.execute(
      buildCurrentSnapshotStatement(userId, companyId),
    );
    const row = resultRows<Record<string, unknown>>(result)[0];
    return row ? mapSnapshotRow(row) : null;
  }

  async publishSnapshot(
    job: schema.ResearchAutomationJob,
    bundle: GeneratedResearchBundle,
    validation: SnapshotValidationResult,
    fence: PublishSnapshotFence,
  ): Promise<number> {
    return this.database.transaction(async (tx) => {
      const existingForJob = resultRows<{ id: number }>(
        await tx.execute(
          buildSnapshotByJobStatement({
            userId: job.userId,
            companyId: job.companyId,
            jobId: job.id,
          }),
        ),
      )[0];
      if (existingForJob) return Number(existingForJob.id);

      const lease = {
        userId: job.userId,
        jobId: job.id,
        companyId: job.companyId,
        workerId: fence.workerId,
        now: fence.now,
      };
      const lockedJob = resultRows<{ id: number }>(
        await tx.execute(buildFencedJobLockStatement(lease)),
      )[0];
      if (!lockedJob) {
        throw new Error("Research job lease is no longer owned");
      }
      const lockedCompany = resultRows<{ id: number }>(
        await tx.execute(
          buildOwnedCompanyLockStatement(job.userId, job.companyId),
        ),
      )[0];
      if (!lockedCompany) throw new Error("Research company was not found");

      const completeJob = async (): Promise<void> => {
        const completed = resultRows<{ id: number }>(
          await tx.execute(buildCompleteJobStatement(lease)),
        )[0];
        if (!completed) {
          throw new Error("Research job lease is no longer owned");
        }
      };

      const existingForContent = resultRows<{ id: number }>(
        await tx.execute(
          buildSnapshotByContentStatement({
            userId: job.userId,
            companyId: job.companyId,
            contentHash: bundle.contentHash,
          }),
        ),
      )[0];
      if (existingForContent) {
        await completeJob();
        return Number(existingForContent.id);
      }

      const latest = resultRows<{ version: number }>(
        await tx.execute(
          buildLatestSnapshotVersionStatement({
            userId: job.userId,
            companyId: job.companyId,
          }),
        ),
      )[0];
      const [snapshot] = await tx
        .insert(schema.automatedResearchSnapshotsTable)
        .values({
          userId: job.userId,
          companyId: job.companyId,
          jobId: job.id,
          version: (latest?.version ?? 0) + 1,
          schemaVersion: bundle.schemaVersion,
          securityType: bundle.payload.securityType,
          templateVersion: bundle.templateVersion,
          payload: bundle.payload,
          quality: bundle.quality,
          changeSet: bundle.changeSet,
          evidenceStrength: validation.evidenceStrength,
          freshAt: bundle.freshAt,
          validUntil: bundle.validUntil,
          provider: bundle.provider,
          model: bundle.model,
          inputTokens: bundle.inputTokens ?? null,
          outputTokens: bundle.outputTokens ?? null,
          latencyMs: bundle.latencyMs ?? null,
          evidenceCount: bundle.sources.length,
          primaryEvidenceCount: bundle.sources.filter(
            (source) => source.authority === "primary",
          ).length,
          contentHash: bundle.contentHash,
        })
        .returning({ id: schema.automatedResearchSnapshotsTable.id });
      if (!snapshot) throw new Error("Research snapshot was not published");

      if (bundle.sources.length > 0) {
        await tx.insert(schema.automatedResearchSourcesTable).values(
          bundle.sources.map((source) => ({
            snapshotId: snapshot.id,
            userId: job.userId,
            companyId: job.companyId,
            ...source,
            metadata: source.metadata ?? {},
          })),
        );
      }

      await completeJob();
      return snapshot.id;
    });
  }

  async transaction<T>(
    userId: string,
    portfolioId: number,
    operation: (tx: ReconciliationTransaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (databaseTx) => {
      const client = databaseTx as unknown as AutomationDatabase;
      const [portfolio] = await client
        .select({ id: schema.portfoliosTable.id })
        .from(schema.portfoliosTable)
        .where(
          and(
            eq(schema.portfoliosTable.id, portfolioId),
            eq(schema.portfoliosTable.userId, userId),
          ),
        )
        .limit(1);
      if (!portfolio) throw new Error("portfolio_not_found");

      const scoped: ReconciliationTransaction = {
        listHoldings: async () => {
          const [calculated, direct] = await Promise.all([
            client
              .select({
                ticker: schema.portfolioHoldingsTable.ticker,
                name: schema.portfolioHoldingsTable.name,
                exchange: schema.portfolioHoldingsTable.exchange,
                sector: schema.portfolioHoldingsTable.sector,
                marketPrice: schema.portfolioHoldingsTable.marketPrice,
                previousClose: schema.portfolioHoldingsTable.previousClose,
              })
              .from(schema.portfolioHoldingsTable)
              .innerJoin(
                schema.portfoliosTable,
                and(
                  eq(
                    schema.portfolioHoldingsTable.portfolioId,
                    schema.portfoliosTable.id,
                  ),
                  eq(schema.portfoliosTable.userId, userId),
                ),
              )
              .where(
                and(
                  eq(schema.portfolioHoldingsTable.portfolioId, portfolioId),
                  gt(schema.portfolioHoldingsTable.quantity, 0),
                ),
              ),
            client
              .select({
                ticker: schema.portfolioDirectHoldingsTable.symbol,
                isin: schema.portfolioDirectHoldingsTable.isin,
                name: schema.portfolioDirectHoldingsTable.name,
                exchange: schema.portfolioDirectHoldingsTable.exchange,
                sector: schema.portfolioDirectHoldingsTable.sector,
              })
              .from(schema.portfolioDirectHoldingsTable)
              .innerJoin(
                schema.portfoliosTable,
                and(
                  eq(
                    schema.portfolioDirectHoldingsTable.portfolioId,
                    schema.portfoliosTable.id,
                  ),
                  eq(schema.portfoliosTable.userId, userId),
                ),
              )
              .where(
                and(
                  eq(
                    schema.portfolioDirectHoldingsTable.portfolioId,
                    portfolioId,
                  ),
                  gt(schema.portfolioDirectHoldingsTable.quantity, 0),
                ),
              ),
          ]);
          const directByTicker = new Map(
            direct.map((holding) => [
              holding.ticker.trim().toUpperCase(),
              holding,
            ]),
          );
          return calculated.map((holding) => {
            const imported = directByTicker.get(
              holding.ticker.trim().toUpperCase(),
            );
            return {
              ...holding,
              name: holding.name ?? imported?.name ?? null,
              exchange: holding.exchange || imported?.exchange || "NSE",
              sector: holding.sector ?? imported?.sector ?? null,
              isin: imported?.isin ?? null,
            };
          });
        },
        listTargets: () =>
          client
            .select()
            .from(schema.researchCoverageTargetsTable)
            .where(
              and(
                eq(schema.researchCoverageTargetsTable.userId, userId),
                eq(
                  schema.researchCoverageTargetsTable.portfolioId,
                  portfolioId,
                ),
              ),
            ),
        lockIdentity: async (normalizedIdentityKey) => {
          await client.execute(
            buildIdentityAdvisoryLockStatement({
              userId,
              normalizedIdentityKey,
            }),
          );
        },
        findCompany: async ({ normalizedIdentityKey, ticker }) => {
          const exact = resultRows<Record<string, unknown>>(
            await client.execute(
              buildFindExactIdentityCompanyStatement({
                userId,
                normalizedIdentityKey,
              }),
            ),
          )[0];
          if (exact) return mapReconciliationCompanyRow(exact);
          const tickerFallback = resultRows<Record<string, unknown>>(
            await client.execute(
              buildFindTickerFallbackCompanyStatement({ userId, ticker }),
            ),
          )[0];
          return tickerFallback
            ? mapReconciliationCompanyRow(tickerFallback)
            : null;
        },
        createCompany: async (input) => {
          const company = resultRows<Record<string, unknown>>(
            await client.execute(
              buildCreateCompanyStatement({ userId, ...input }),
            ),
          )[0];
          if (company) return mapReconciliationCompanyRow(company);
          const exact = resultRows<Record<string, unknown>>(
            await client.execute(
              buildFindExactIdentityCompanyStatement({
                userId,
                normalizedIdentityKey: input.normalizedIdentityKey,
              }),
            ),
          )[0];
          if (exact) return mapReconciliationCompanyRow(exact);
          const existing = resultRows<Record<string, unknown>>(
            await client.execute(
              buildFindTickerFallbackCompanyStatement({
                userId,
                ticker: input.ticker,
              }),
            ),
          )[0];
          if (!existing) {
            throw new Error("Research company could not be created");
          }
          return mapReconciliationCompanyRow(existing);
        },
        updateCompanyAutomation: async (companyId, input) => {
          const [company] = await client
            .update(schema.researchCompaniesTable)
            .set({ ...input, isArchived: false, updatedAt: new Date() })
            .where(
              and(
                eq(schema.researchCompaniesTable.id, companyId),
                eq(schema.researchCompaniesTable.userId, userId),
              ),
            )
            .returning();
          if (!company) throw new Error("Research company was not found");
          return company;
        },
        createTarget: async (input) => {
          const target = resultRows<Record<string, unknown>>(
            await client.execute(
              buildUpsertCoverageTargetStatement({
                userId,
                portfolioId,
                ...input,
              }),
            ),
          )[0];
          if (!target) throw new Error("Research target could not be created");
          return mapReconciliationTargetRow(target);
        },
        updateTarget: async (targetId, input) => {
          const [target] = await client
            .update(schema.researchCoverageTargetsTable)
            .set(input)
            .where(
              and(
                eq(schema.researchCoverageTargetsTable.id, targetId),
                eq(schema.researchCoverageTargetsTable.userId, userId),
                eq(
                  schema.researchCoverageTargetsTable.portfolioId,
                  portfolioId,
                ),
              ),
            )
            .returning();
          if (!target) throw new Error("Research target was not found");
          return target;
        },
        latestSuccessfulSnapshot: async (companyId) => {
          const [snapshot] = await client
            .select({
              userId: schema.automatedResearchSnapshotsTable.userId,
              companyId: schema.automatedResearchSnapshotsTable.companyId,
              validUntil: schema.automatedResearchSnapshotsTable.validUntil,
            })
            .from(schema.automatedResearchSnapshotsTable)
            .innerJoin(
              schema.researchAutomationJobsTable,
              and(
                eq(
                  schema.researchAutomationJobsTable.id,
                  schema.automatedResearchSnapshotsTable.jobId,
                ),
                eq(schema.researchAutomationJobsTable.userId, userId),
                eq(schema.researchAutomationJobsTable.companyId, companyId),
                eq(schema.researchAutomationJobsTable.status, "succeeded"),
              ),
            )
            .where(
              and(
                eq(schema.automatedResearchSnapshotsTable.userId, userId),
                eq(schema.automatedResearchSnapshotsTable.companyId, companyId),
              ),
            )
            .orderBy(desc(schema.automatedResearchSnapshotsTable.version))
            .limit(1);
          return snapshot ?? null;
        },
        hasPendingJob: async (companyId) => {
          const [job] = await client
            .select({ id: schema.researchAutomationJobsTable.id })
            .from(schema.researchAutomationJobsTable)
            .where(
              and(
                eq(schema.researchAutomationJobsTable.userId, userId),
                eq(schema.researchAutomationJobsTable.companyId, companyId),
                inArray(schema.researchAutomationJobsTable.status, [
                  "queued",
                  "running",
                ]),
              ),
            )
            .limit(1);
          return Boolean(job);
        },
        enqueueJob: async (input) => {
          const [created] = await client
            .insert(schema.researchAutomationJobsTable)
            .values({
              userId,
              companyId: input.companyId,
              trigger: input.trigger,
              idempotencyKey: input.idempotencyKey,
              context: input.context,
              runAfter: input.runAfter,
            })
            .onConflictDoNothing({
              target: [
                schema.researchAutomationJobsTable.userId,
                schema.researchAutomationJobsTable.idempotencyKey,
              ],
            })
            .returning();
          if (created) return { job: created, created: true };
          const [existing] = await client
            .select()
            .from(schema.researchAutomationJobsTable)
            .where(
              and(
                eq(schema.researchAutomationJobsTable.userId, userId),
                eq(
                  schema.researchAutomationJobsTable.idempotencyKey,
                  input.idempotencyKey,
                ),
              ),
            )
            .limit(1);
          if (!existing) throw new Error("Research job could not be enqueued");
          return { job: existing, created: false };
        },
        hasActiveTarget: async (companyId) => {
          const [target] = await client
            .select({ id: schema.researchCoverageTargetsTable.id })
            .from(schema.researchCoverageTargetsTable)
            .where(
              and(
                eq(schema.researchCoverageTargetsTable.userId, userId),
                eq(schema.researchCoverageTargetsTable.companyId, companyId),
                eq(schema.researchCoverageTargetsTable.isActive, true),
              ),
            )
            .limit(1);
          return Boolean(target);
        },
        markReconciled: async (now) => {
          await client
            .insert(schema.researchAutomationPreferencesTable)
            .values({ userId, lastReconciledAt: now })
            .onConflictDoUpdate({
              target: schema.researchAutomationPreferencesTable.userId,
              set: { lastReconciledAt: now, updatedAt: now },
            });
        },
      };

      return operation(scoped);
    });
  }
}
