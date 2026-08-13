import type { AutomatedResearchSnapshotPayload } from "@workspace/research-contracts";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { usersTable } from "./auth";
import { portfoliosTable } from "./portfolio";
import { researchCompaniesTable, researchSecurityTypeEnum } from "./research";

export const researchAutomationTriggerEnum = pgEnum(
  "research_automation_trigger",
  [
    "holding_added",
    "holding_changed",
    "portfolio_reconciled",
    "scheduled_refresh",
    "material_event",
    "manual_refresh",
  ],
);

export const researchAutomationStatusEnum = pgEnum(
  "research_automation_status",
  [
    "queued",
    "running",
    "succeeded",
    "partial",
    "failed",
    "dead_letter",
    "cancelled",
    "skipped",
  ],
);

export const researchEvidenceStrengthEnum = pgEnum(
  "research_evidence_strength",
  ["strong", "moderate", "limited"],
);

export const researchEvidenceAuthorityEnum = pgEnum(
  "research_evidence_authority",
  ["primary", "secondary", "excluded"],
);

export const researchAutomationPreferencesTable = pgTable(
  "research_automation_preferences",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    timezone: varchar("timezone", { length: 80 })
      .notNull()
      .default("Asia/Kolkata"),
    dailyHour: integer("daily_hour").notNull().default(6),
    minimumRefreshIntervalMinutes: integer("minimum_refresh_interval_minutes")
      .notNull()
      .default(240),
    maxAssetsPerDailyRun: integer("max_assets_per_daily_run")
      .notNull()
      .default(25),
    nextDailyRunAt: timestamp("next_daily_run_at", { withTimezone: true }),
    lastDailyEnqueuedAt: timestamp("last_daily_enqueued_at", {
      withTimezone: true,
    }),
    lastReconciledAt: timestamp("last_reconciled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("research_automation_preferences_user_uidx").on(table.userId),
    check(
      "research_automation_preferences_daily_hour_check",
      sql`${table.dailyHour} between 0 and 23`,
    ),
    check(
      "research_automation_preferences_interval_check",
      sql`${table.minimumRefreshIntervalMinutes} between 15 and 10080`,
    ),
    check(
      "research_automation_preferences_asset_cap_check",
      sql`${table.maxAssetsPerDailyRun} between 1 and 250`,
    ),
  ],
);

export const researchCoverageTargetsTable = pgTable(
  "research_coverage_targets",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    portfolioId: integer("portfolio_id")
      .notNull()
      .references(() => portfoliosTable.id, { onDelete: "cascade" }),
    companyId: integer("company_id")
      .notNull()
      .references(() => researchCompaniesTable.id, { onDelete: "cascade" }),
    ticker: varchar("ticker", { length: 30 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    holdingFingerprint: varchar("holding_fingerprint", {
      length: 64,
    }).notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("research_coverage_targets_user_portfolio_ticker_uidx").on(
      table.userId,
      table.portfolioId,
      table.ticker,
    ),
    index("research_coverage_targets_active_user_company_idx")
      .on(table.userId, table.companyId)
      .where(sql`${table.isActive} = true`),
    check(
      "research_coverage_targets_normalized_ticker_check",
      sql`${table.ticker} = upper(trim(${table.ticker})) and ${table.ticker} <> ''`,
    ),
  ],
);

export const researchAutomationTriggerEventsTable = pgTable(
  "research_automation_trigger_events",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    portfolioId: integer("portfolio_id").references(() => portfoliosTable.id, {
      onDelete: "set null",
    }),
    ticker: varchar("ticker", { length: 30 }),
    trigger: researchAutomationTriggerEnum("trigger").notNull(),
    status: researchAutomationStatusEnum("status").notNull().default("queued"),
    dedupeKey: varchar("dedupe_key", { length: 180 }).notNull(),
    priority: integer("priority").notNull().default(100),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    workerId: varchar("worker_id", { length: 120 }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastError: varchar("last_error", { length: 1000 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("research_automation_trigger_events_user_dedupe_uidx").on(
      table.userId,
      table.dedupeKey,
    ),
    index("research_automation_trigger_events_claim_idx").on(
      table.status,
      table.availableAt,
      table.leaseExpiresAt,
      table.priority,
    ),
    check(
      "research_automation_trigger_events_attempts_check",
      sql`${table.attempts} >= 0`,
    ),
  ],
);

export const researchAutomationJobsTable = pgTable(
  "research_automation_jobs",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    companyId: integer("company_id")
      .notNull()
      .references(() => researchCompaniesTable.id, { onDelete: "cascade" }),
    triggerEventId: integer("trigger_event_id").references(
      () => researchAutomationTriggerEventsTable.id,
      { onDelete: "set null" },
    ),
    trigger: researchAutomationTriggerEnum("trigger").notNull(),
    status: researchAutomationStatusEnum("status").notNull().default("queued"),
    priority: integer("priority").notNull().default(100),
    idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
    context: jsonb("context")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAfter: timestamp("run_after", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    workerId: varchar("worker_id", { length: 120 }),
    errorCode: varchar("error_code", { length: 80 }),
    errorMessage: varchar("error_message", { length: 1000 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("research_automation_jobs_user_idempotency_uidx").on(
      table.userId,
      table.idempotencyKey,
    ),
    index("research_automation_jobs_claim_idx").on(
      table.status,
      table.runAfter,
      table.leaseExpiresAt,
      table.priority,
    ),
    check(
      "research_automation_jobs_attempts_check",
      sql`${table.attempts} >= 0 and ${table.maxAttempts} >= 1`,
    ),
  ],
);

export const automatedResearchSnapshotsTable = pgTable(
  "automated_research_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    companyId: integer("company_id")
      .notNull()
      .references(() => researchCompaniesTable.id, { onDelete: "cascade" }),
    jobId: integer("job_id")
      .notNull()
      .references(() => researchAutomationJobsTable.id, {
        onDelete: "restrict",
      }),
    version: integer("version").notNull(),
    schemaVersion: varchar("schema_version", { length: 40 }).notNull(),
    securityType: researchSecurityTypeEnum("security_type").notNull(),
    templateVersion: varchar("template_version", { length: 80 }).notNull(),
    payload: jsonb("payload")
      .$type<AutomatedResearchSnapshotPayload>()
      .notNull(),
    quality: jsonb("quality")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    changeSet: jsonb("change_set")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    evidenceStrength:
      researchEvidenceStrengthEnum("evidence_strength").notNull(),
    freshAt: timestamp("fresh_at", { withTimezone: true }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    evidenceCount: integer("evidence_count").notNull().default(0),
    primaryEvidenceCount: integer("primary_evidence_count")
      .notNull()
      .default(0),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("automated_research_snapshots_job_uidx").on(table.jobId),
    uniqueIndex("automated_research_snapshots_company_version_uidx").on(
      table.companyId,
      table.version,
    ),
    uniqueIndex("automated_research_snapshots_company_content_hash_uidx").on(
      table.companyId,
      table.contentHash,
    ),
    check(
      "automated_research_snapshots_version_check",
      sql`${table.version} >= 1`,
    ),
    check(
      "automated_research_snapshots_freshness_check",
      sql`${table.validUntil} >= ${table.freshAt}`,
    ),
    check(
      "automated_research_snapshots_counts_check",
      sql`${table.evidenceCount} >= 0 and ${table.primaryEvidenceCount} >= 0 and ${table.primaryEvidenceCount} <= ${table.evidenceCount}`,
    ),
    check(
      "automated_research_snapshots_usage_check",
      sql`(${table.inputTokens} is null or ${table.inputTokens} >= 0) and (${table.outputTokens} is null or ${table.outputTokens} >= 0) and (${table.latencyMs} is null or ${table.latencyMs} >= 0)`,
    ),
  ],
);

export const automatedResearchSourcesTable = pgTable(
  "automated_research_sources",
  {
    id: serial("id").primaryKey(),
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => automatedResearchSnapshotsTable.id, {
        onDelete: "cascade",
      }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    companyId: integer("company_id")
      .notNull()
      .references(() => researchCompaniesTable.id, { onDelete: "cascade" }),
    citationKey: varchar("citation_key", { length: 128 }).notNull(),
    authority: researchEvidenceAuthorityEnum("authority").notNull(),
    sourceType: varchar("source_type", { length: 100 }).notNull(),
    title: varchar("title", { length: 2000 }).notNull(),
    publisher: varchar("publisher", { length: 500 }).notNull(),
    canonicalUrl: varchar("canonical_url", { length: 2000 }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
    evidenceSummary: varchar("evidence_summary", { length: 1000 }).notNull(),
    contentFingerprint: varchar("content_fingerprint", {
      length: 128,
    }).notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("automated_research_sources_snapshot_citation_uidx").on(
      table.snapshotId,
      table.citationKey,
    ),
    check(
      "automated_research_sources_https_url_check",
      sql`${table.canonicalUrl} like 'https://%'`,
    ),
    check(
      "automated_research_sources_summary_length_check",
      sql`char_length(${table.evidenceSummary}) <= 1000`,
    ),
  ],
);

export type ResearchAutomationPreferences =
  typeof researchAutomationPreferencesTable.$inferSelect;
export type ResearchCoverageTarget =
  typeof researchCoverageTargetsTable.$inferSelect;
export type ResearchAutomationTriggerEvent =
  typeof researchAutomationTriggerEventsTable.$inferSelect;
export type ResearchAutomationJob =
  typeof researchAutomationJobsTable.$inferSelect;
export type AutomatedResearchSnapshot =
  typeof automatedResearchSnapshotsTable.$inferSelect;
export type AutomatedResearchSource =
  typeof automatedResearchSourcesTable.$inferSelect;
