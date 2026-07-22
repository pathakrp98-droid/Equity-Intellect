import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  integer,
} from "drizzle-orm/pg-core";

import { usersTable } from "./auth";

export const guardianPacketStatusEnum = pgEnum("guardian_packet_status", [
  "pending",
  "approved",
  "cancelled",
  "executed",
  "overridden",
  "expired",
]);

export const guardianHealthBandEnum = pgEnum("guardian_health_band", [
  "healthy",
  "watch",
  "caution",
  "high_risk",
  "critical",
]);

export interface GuardianDecisionPacketInput {
  action: string;
  ticker: string;
  name?: string | null;
  quantity?: number | null;
  price?: number | null;
  fees?: number | null;
  rationale?: string | null;
  investmentHorizon?: string | null;
  bearCase?: string | null;
  targetPrice?: number | null;
  thesisInvalidation?: string | null;
  maxAcceptableLossPct?: number | null;
  exitConditions?: string | null;
  evidenceQuality?: string | null;
  citedSourceIds?: string[];
}

export interface GuardianDecisionPacketContext {
  generatedAt: string;
  portfolio: Record<string, unknown>;
  holding: Record<string, unknown> | null;
  research: Record<string, unknown> | null;
  market: Record<string, unknown> | null;
}

export interface GuardianDecisionPacketResult {
  decision: string;
  severity: string;
  summary: string;
  hardRuleBreaches: Array<Record<string, unknown>>;
  softRuleWarnings: Array<Record<string, unknown>>;
  preTradeFailures: Array<Record<string, unknown>>;
  biasFlags: Array<Record<string, unknown>>;
  stressTestResults: Array<Record<string, unknown>>;
  passedChecks: string[];
  researchCompletenessScore: number;
}

export const guardianDecisionPacketsTable = pgTable(
  "guardian_decision_packets",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    checkId: varchar("check_id", { length: 64 }).notNull(),
    ticker: varchar("ticker", { length: 30 }).notNull(),
    action: varchar("action", { length: 20 }).notNull(),
    input: jsonb("input").$type<GuardianDecisionPacketInput>().notNull(),
    contextSnapshot: jsonb("context_snapshot")
      .$type<GuardianDecisionPacketContext>()
      .notNull(),
    result: jsonb("result").$type<GuardianDecisionPacketResult>().notNull(),
    status: guardianPacketStatusEnum("status").notNull().default("pending"),
    overrideRationale: text("override_rationale"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("guardian_packets_user_check_uidx").on(
      table.userId,
      table.checkId,
    ),
    index("guardian_packets_user_id_idx").on(table.userId),
    index("guardian_packets_created_at_idx").on(table.createdAt),
  ],
);

export interface GuardianHealthComponentData {
  key: string;
  name: string;
  score: number;
  maxScore: number;
  status: "ok" | "warning" | "breach";
  description: string;
}

export const guardianHealthSnapshotsTable = pgTable(
  "guardian_health_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    band: guardianHealthBandEnum("band").notNull(),
    components: jsonb("components")
      .$type<GuardianHealthComponentData[]>()
      .notNull(),
    topRisks: jsonb("top_risks").$type<string[]>().notNull().default([]),
    dataQuality: jsonb("data_quality")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("guardian_health_user_id_idx").on(table.userId),
    index("guardian_health_created_at_idx").on(table.createdAt),
  ],
);

export type GuardianDecisionPacket =
  typeof guardianDecisionPacketsTable.$inferSelect;
export type GuardianHealthSnapshot =
  typeof guardianHealthSnapshotsTable.$inferSelect;
