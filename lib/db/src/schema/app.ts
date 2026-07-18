import { boolean, index, jsonb, pgEnum, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { usersTable } from './auth';

// ── Watchlist ──────────────────────────────────────────────────────────────
export const watchlistTable = pgTable(
  'watchlist',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    ticker: varchar('ticker', { length: 20 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    sector: varchar('sector', { length: 100 }),
    notes: text('notes'),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('watchlist_user_id_idx').on(t.userId)],
);

export type WatchlistItem = typeof watchlistTable.$inferSelect;
export type InsertWatchlistItem = typeof watchlistTable.$inferInsert;

// ── Decision Journal ────────────────────────────────────────────────────────
export const decisionJournalTable = pgTable(
  'decision_journal',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    ticker: varchar('ticker', { length: 20 }).notNull(),
    name: varchar('name', { length: 100 }),
    action: varchar('action', { length: 20 }).notNull(),
    date: varchar('date', { length: 30 }).notNull(),
    rationale: text('rationale'),
    outcome: varchar('outcome', { length: 20 }),
    pnl: text('pnl'),
    learnings: text('learnings'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('journal_user_id_idx').on(t.userId)],
);

export type JournalEntry = typeof decisionJournalTable.$inferSelect;
export type InsertJournalEntry = typeof decisionJournalTable.$inferInsert;

// ── Guardrail Settings ──────────────────────────────────────────────────────
export const guardrailSettingsTable = pgTable('guardrail_settings', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id')
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  settings: jsonb('settings').notNull().$type<GuardrailSettingsData>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface GuardrailSettingsData {
  portfolioLimits: {
    maxStockConcentrationPct: number;
    maxSectorConcentrationPct: number;
    maxSmallCapExposurePct: number;
    minCashBufferPct: number;
    maxCorrelatedPositions: number;
    maxWeeklyNewPositions: number;
    maxPortfolioDrawdownPct: number;
  };
  preTradeRequirements: {
    requireRationale: boolean;
    requireInvestmentHorizon: boolean;
    requireBearCase: boolean;
    requireTargetPrice: boolean;
    requireThesisInvalidation: boolean;
    requireMaxAcceptableLoss: boolean;
    requireExitConditions: boolean;
    minResearchCompletenessScore: number;
  };
  biasChecks: {
    enabled: boolean;
    recency: boolean;
    confirmationBias: boolean;
    anchoring: boolean;
    overconfidence: boolean;
    narrativeBias: boolean;
    fomo: boolean;
    revengeTrading: boolean;
    panicSelling: boolean;
    overtrading: boolean;
    unjustifiedAveragingDown: boolean;
  };
  stressTests: {
    enabled: boolean;
    marketCorrection: boolean;
    recession: boolean;
    rateHike: boolean;
    crudeShock: boolean;
    currencyShock: boolean;
    companySpecific: boolean;
  };
  guardianMode: {
    enabled: boolean;
    allowOverrideWithRationale: boolean;
    requireAuditLog: boolean;
  };
}

export type GuardrailSettings = typeof guardrailSettingsTable.$inferSelect;

// ── Guardrail Audit Trail ───────────────────────────────────────────────────
export const guardrailAuditTable = pgTable(
  'guardrail_audit',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    checkId: varchar('check_id', { length: 64 }),
    ticker: varchar('ticker', { length: 20 }).notNull(),
    name: varchar('name', { length: 100 }),
    action: varchar('action', { length: 20 }).notNull(),
    guardianDecision: varchar('guardian_decision', { length: 30 }).notNull(),
    severity: varchar('severity', { length: 20 }),
    breachedRules: jsonb('breached_rules').$type<string[]>().default([]),
    biasFlags: jsonb('bias_flags').$type<string[]>().default([]),
    preTradeFailures: jsonb('pre_trade_failures').$type<string[]>().default([]),
    researchCompletenessScore: serial('research_completeness_score'),
    isOverride: boolean('is_override').notNull().default(false),
    overrideRationale: text('override_rationale'),
    finalAction: varchar('final_action', { length: 20 }).default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_user_id_idx').on(t.userId)],
);

export type AuditEntry = typeof guardrailAuditTable.$inferSelect;
export type InsertAuditEntry = typeof guardrailAuditTable.$inferInsert;

// ── AI Copilot History ──────────────────────────────────────────────────────
export const copilotHistoryTable = pgTable(
  'copilot_history',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 10 }).notNull(),
    content: text('content').notNull(),
    responseData: jsonb('response_data'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('copilot_user_id_idx').on(t.userId)],
);

export type CopilotMessage = typeof copilotHistoryTable.$inferSelect;
export type InsertCopilotMessage = typeof copilotHistoryTable.$inferInsert;
