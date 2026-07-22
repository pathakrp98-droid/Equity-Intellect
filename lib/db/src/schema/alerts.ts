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

export const alertRuleTypeEnum = pgEnum("alert_rule_type", [
  "price_above",
  "price_below",
  "day_change_above",
  "day_change_below",
  "thesis_status",
  "thesis_review_due",
  "invalidation_trigger",
  "news_keyword",
  "earnings_upcoming",
  "corporate_action_upcoming",
  "data_stale",
  "provider_failure",
]);

export const alertSeverityEnum = pgEnum("investment_alert_severity", [
  "critical",
  "high",
  "medium",
  "low",
]);

export interface AlertRuleConfig {
  keyword?: string;
  thesisStatuses?: string[];
  eventTypes?: string[];
  compareAgainst?: "price" | "change_pct";
  [key: string]: unknown;
}

export interface InvestmentAlertMetadata {
  quoteAsOf?: string;
  eventAt?: string;
  publishedAt?: string;
  providerRunId?: number;
  ruleSnapshot?: Record<string, unknown>;
  [key: string]: unknown;
}

export const alertRulesTable = pgTable(
  "alert_rules",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 220 }).notNull(),
    ticker: varchar("ticker", { length: 30 }),
    ruleType: alertRuleTypeEnum("rule_type").notNull(),
    severity: alertSeverityEnum("severity").notNull().default("medium"),
    threshold: doublePrecision("threshold"),
    textValue: varchar("text_value", { length: 300 }),
    lookaheadDays: integer("lookahead_days"),
    cooldownMinutes: integer("cooldown_minutes").notNull().default(1_440),
    isEnabled: boolean("is_enabled").notNull().default(true),
    config: jsonb("config").$type<AlertRuleConfig>().notNull().default({}),
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true }),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("alert_rules_user_id_idx").on(table.userId),
    index("alert_rules_ticker_idx").on(table.ticker),
  ],
);

export const investmentAlertsTable = pgTable(
  "investment_alerts",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    ruleId: integer("rule_id").references(() => alertRulesTable.id, {
      onDelete: "set null",
    }),
    ticker: varchar("ticker", { length: 30 }),
    alertType: alertRuleTypeEnum("alert_type").notNull(),
    severity: alertSeverityEnum("severity").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    detail: text("detail").notNull(),
    source: varchar("source", { length: 180 }).notNull(),
    sourceUrl: varchar("source_url", { length: 1200 }),
    dedupeKey: varchar("dedupe_key", { length: 500 }).notNull(),
    triggeredAt: timestamp("triggered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<InvestmentAlertMetadata>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("investment_alerts_user_dedupe_uidx").on(
      table.userId,
      table.dedupeKey,
    ),
    index("investment_alerts_user_id_idx").on(table.userId),
    index("investment_alerts_ticker_idx").on(table.ticker),
    index("investment_alerts_triggered_at_idx").on(table.triggeredAt),
  ],
);

export const alertPreferencesTable = pgTable(
  "alert_preferences",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .unique()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    severityThreshold: alertSeverityEnum("severity_threshold")
      .notNull()
      .default("low"),
    portfolioOnly: boolean("portfolio_only").notNull().default(true),
    enablePriceAlerts: boolean("enable_price_alerts").notNull().default(true),
    enableThesisAlerts: boolean("enable_thesis_alerts").notNull().default(true),
    enableNewsAlerts: boolean("enable_news_alerts").notNull().default(true),
    enableCalendarAlerts: boolean("enable_calendar_alerts")
      .notNull()
      .default(true),
    enableDataQualityAlerts: boolean("enable_data_quality_alerts")
      .notNull()
      .default(true),
    enableProviderFailureAlerts: boolean("enable_provider_failure_alerts")
      .notNull()
      .default(true),
    inAppNotifications: boolean("in_app_notifications")
      .notNull()
      .default(true),
    quietHoursStart: varchar("quiet_hours_start", { length: 5 }),
    quietHoursEnd: varchar("quiet_hours_end", { length: 5 }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export type AlertRuleRow = typeof alertRulesTable.$inferSelect;
export type InvestmentAlertRow = typeof investmentAlertsTable.$inferSelect;
export type AlertPreferencesRow = typeof alertPreferencesTable.$inferSelect;
