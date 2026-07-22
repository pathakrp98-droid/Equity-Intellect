import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { usersTable } from "./auth";
import { portfoliosTable, portfolioTransactionsTable } from "./portfolio";
import { researchCompaniesTable } from "./research";

export const journalDecisionTypeEnum = pgEnum("journal_decision_type", [
  "buy",
  "add",
  "sell",
  "trim",
  "hold",
  "review",
  "avoid",
]);

export const journalDecisionStatusEnum = pgEnum("journal_decision_status", [
  "planned",
  "executed",
  "cancelled",
  "closed",
]);

export const journalEmotionEnum = pgEnum("journal_emotion", [
  "confident",
  "calm",
  "neutral",
  "uncertain",
  "anxious",
  "fearful",
  "greedy",
  "frustrated",
]);

export const journalOutcomeEnum = pgEnum("journal_outcome", [
  "pending",
  "win",
  "loss",
  "mixed",
  "unknown",
]);

export const journalReviewStatusEnum = pgEnum("journal_review_status", [
  "due",
  "completed",
  "skipped",
]);

export const journalReviewTypeEnum = pgEnum("journal_review_type", [
  "scheduled",
  "earnings",
  "event",
  "thesis_break",
  "manual",
]);

export const journalReviewActionEnum = pgEnum("journal_review_action", [
  "no_change",
  "hold",
  "add",
  "trim",
  "exit",
  "research_more",
]);

export interface JournalSourceReference {
  id: string;
  label: string;
  url?: string | null;
  publishedAt?: string | null;
}

export const decisionJournalEntriesTable = pgTable(
  "decision_journal_entries",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    portfolioId: integer("portfolio_id").references(() => portfoliosTable.id, {
      onDelete: "set null",
    }),
    researchCompanyId: integer("research_company_id").references(
      () => researchCompaniesTable.id,
      { onDelete: "set null" },
    ),
    transactionId: integer("transaction_id").references(
      () => portfolioTransactionsTable.id,
      { onDelete: "set null" },
    ),
    guardianCheckId: varchar("guardian_check_id", { length: 64 }),
    ticker: varchar("ticker", { length: 30 }).notNull(),
    name: varchar("name", { length: 180 }),
    decisionType: journalDecisionTypeEnum("decision_type").notNull(),
    status: journalDecisionStatusEnum("status").notNull().default("planned"),
    decisionDate: timestamp("decision_date", { withTimezone: true })
      .notNull()
      .defaultNow(),
    executionPrice: doublePrecision("execution_price"),
    quantity: doublePrecision("quantity"),
    thesisSummary: text("thesis_summary"),
    rationale: text("rationale").notNull(),
    expectedReturnPct: doublePrecision("expected_return_pct"),
    expectedDownsidePct: doublePrecision("expected_downside_pct"),
    targetPrice: doublePrecision("target_price"),
    bearPrice: doublePrecision("bear_price"),
    investmentHorizon: varchar("investment_horizon", { length: 120 }),
    emotionalState: journalEmotionEnum("emotional_state")
      .notNull()
      .default("neutral"),
    confidenceScore: integer("confidence_score").notNull().default(3),
    evidenceQuality: varchar("evidence_quality", { length: 20 })
      .notNull()
      .default("medium"),
    keyFactors: jsonb("key_factors").$type<string[]>().notNull().default([]),
    contraryEvidence: jsonb("contrary_evidence")
      .$type<string[]>()
      .notNull()
      .default([]),
    sourceReferences: jsonb("source_references")
      .$type<JournalSourceReference[]>()
      .notNull()
      .default([]),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    outcome: journalOutcomeEnum("outcome").notNull().default("pending"),
    actualReturnPct: doublePrecision("actual_return_pct"),
    outcomeNotes: text("outcome_notes"),
    lessonsLearned: text("lessons_learned"),
    isArchived: boolean("is_archived").notNull().default(false),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("decision_journal_user_id_idx").on(table.userId),
    index("decision_journal_ticker_idx").on(table.ticker),
    index("decision_journal_decision_date_idx").on(table.decisionDate),
    index("decision_journal_next_review_idx").on(table.nextReviewAt),
    uniqueIndex("decision_journal_user_transaction_uidx").on(
      table.userId,
      table.transactionId,
    ),
  ],
);

export const decisionJournalReviewsTable = pgTable(
  "decision_journal_reviews",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id")
      .notNull()
      .references(() => decisionJournalEntriesTable.id, {
        onDelete: "cascade",
      }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    reviewType: journalReviewTypeEnum("review_type")
      .notNull()
      .default("scheduled"),
    status: journalReviewStatusEnum("status").notNull().default("due"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    currentPrice: doublePrecision("current_price"),
    returnSinceDecisionPct: doublePrecision("return_since_decision_pct"),
    thesisStatusBefore: varchar("thesis_status_before", { length: 30 }),
    thesisStatusAfter: varchar("thesis_status_after", { length: 30 }),
    convictionBefore: varchar("conviction_before", { length: 20 }),
    convictionAfter: varchar("conviction_after", { length: 20 }),
    whatChanged: text("what_changed"),
    evidenceFor: text("evidence_for"),
    evidenceAgainst: text("evidence_against"),
    actionAfterReview: journalReviewActionEnum("action_after_review")
      .notNull()
      .default("no_change"),
    reviewQualityScore: integer("review_quality_score"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("decision_journal_reviews_entry_id_idx").on(table.entryId),
    index("decision_journal_reviews_user_id_idx").on(table.userId),
    index("decision_journal_reviews_schedule_idx").on(table.scheduledFor),
  ],
);

export const decisionQualitySnapshotsTable = pgTable(
  "decision_quality_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    asOf: timestamp("as_of", { withTimezone: true }).notNull().defaultNow(),
    overallScore: integer("overall_score").notNull(),
    documentationScore: integer("documentation_score").notNull(),
    evidenceBalanceScore: integer("evidence_balance_score").notNull(),
    reviewDisciplineScore: integer("review_discipline_score").notNull(),
    outcomeLearningScore: integer("outcome_learning_score").notNull(),
    metrics: jsonb("metrics")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("decision_quality_user_id_idx").on(table.userId),
    index("decision_quality_as_of_idx").on(table.asOf),
  ],
);

export type DecisionJournalEntry =
  typeof decisionJournalEntriesTable.$inferSelect;
export type DecisionJournalReview =
  typeof decisionJournalReviewsTable.$inferSelect;
export type DecisionQualitySnapshot =
  typeof decisionQualitySnapshotsTable.$inferSelect;
