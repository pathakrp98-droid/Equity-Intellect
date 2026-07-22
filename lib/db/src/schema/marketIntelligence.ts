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
import { portfoliosTable } from "./portfolio";

export const marketDataKindEnum = pgEnum("market_data_kind", [
  "index",
  "equity",
  "fx",
  "commodity",
  "rate",
  "macro",
  "flow",
  "sector",
]);

export const marketEventTypeEnum = pgEnum("market_event_type", [
  "earnings",
  "corporate_action",
  "dividend",
  "macro",
  "regulatory",
  "investor_event",
  "other",
]);

export const marketImpactEnum = pgEnum("market_impact", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const marketSentimentEnum = pgEnum("market_sentiment", [
  "positive",
  "negative",
  "neutral",
  "mixed",
  "unknown",
]);

export const providerRunStatusEnum = pgEnum("provider_run_status", [
  "running",
  "success",
  "partial",
  "failed",
  "skipped",
]);

export interface MarketPointMetadata {
  previousValue?: number | null;
  previousClose?: number | null;
  marketStatus?: string | null;
  [key: string]: unknown;
}

export interface MorningBriefMarketPulse {
  tone: "positive" | "negative" | "mixed" | "neutral" | "unknown";
  summary: string;
  keyMoves: Array<{
    symbol: string;
    name: string;
    value: number;
    changePct: number | null;
    asOf: string;
    source: string;
  }>;
}

export interface MorningBriefPortfolioPulse {
  totalValue: number;
  cashBalance: number;
  dailyPnl: number;
  dailyPnlPct: number;
  totalPnl: number;
  totalReturnPct: number;
  largestPositionTicker: string | null;
  largestPositionPct: number;
  holdingsCount: number;
  concentrationRisk: string;
}

export interface MorningBriefAction {
  id: string;
  priority: "high" | "medium" | "low";
  ticker?: string | null;
  title: string;
  rationale: string;
  actionType:
    | "review"
    | "research"
    | "monitor"
    | "rebalance"
    | "verify_data";
  sourceIds: string[];
}

export interface MorningBriefEvent {
  id: number;
  ticker?: string | null;
  title: string;
  eventType: string;
  eventAt: string;
  impact: string;
  source: string;
}

export interface MorningBriefRisk {
  id: string;
  severity: "high" | "medium" | "low";
  ticker?: string | null;
  title: string;
  detail: string;
  sourceIds: string[];
}

export interface MorningBriefDataQuality {
  generatedAt: string;
  marketPointCount: number;
  portfolioNewsCount: number;
  upcomingEventCount: number;
  staleMarketPointCount: number;
  staleNewsCount: number;
  latestMarketAsOf: string | null;
  latestNewsAt: string | null;
  providerConfigured: boolean;
  warnings: string[];
}

export const marketDataPointsTable = pgTable(
  "market_data_points",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    kind: marketDataKindEnum("kind").notNull(),
    symbol: varchar("symbol", { length: 40 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    value: doublePrecision("value").notNull(),
    change: doublePrecision("change"),
    changePct: doublePrecision("change_pct"),
    unit: varchar("unit", { length: 40 }),
    region: varchar("region", { length: 80 }),
    source: varchar("source", { length: 180 }).notNull(),
    sourceUrl: varchar("source_url", { length: 1200 }),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata")
      .$type<MarketPointMetadata>()
      .notNull()
      .default({}),
  },
  (table) => [
    uniqueIndex("market_data_points_user_kind_symbol_uidx").on(
      table.userId,
      table.kind,
      table.symbol,
    ),
    index("market_data_points_user_id_idx").on(table.userId),
    index("market_data_points_as_of_idx").on(table.asOf),
  ],
);

export const marketNewsTable = pgTable(
  "market_news",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 240 }).notNull(),
    ticker: varchar("ticker", { length: 30 }),
    headline: varchar("headline", { length: 500 }).notNull(),
    summary: text("summary"),
    source: varchar("source", { length: 180 }).notNull(),
    sourceUrl: varchar("source_url", { length: 1200 }),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    sentiment: marketSentimentEnum("sentiment").notNull().default("unknown"),
    relevanceScore: doublePrecision("relevance_score").notNull().default(0),
    isPortfolioRelevant: boolean("is_portfolio_relevant")
      .notNull()
      .default(false),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("market_news_user_source_external_uidx").on(
      table.userId,
      table.source,
      table.externalId,
    ),
    index("market_news_user_id_idx").on(table.userId),
    index("market_news_ticker_idx").on(table.ticker),
    index("market_news_published_at_idx").on(table.publishedAt),
  ],
);

export const marketEventsTable = pgTable(
  "market_events",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 240 }).notNull(),
    ticker: varchar("ticker", { length: 30 }),
    companyName: varchar("company_name", { length: 180 }),
    eventType: marketEventTypeEnum("event_type").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    eventAt: timestamp("event_at", { withTimezone: true }).notNull(),
    impact: marketImpactEnum("impact").notNull().default("medium"),
    source: varchar("source", { length: 180 }).notNull(),
    sourceUrl: varchar("source_url", { length: 1200 }),
    isPortfolioRelevant: boolean("is_portfolio_relevant")
      .notNull()
      .default(false),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
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
    uniqueIndex("market_events_user_source_external_uidx").on(
      table.userId,
      table.source,
      table.externalId,
    ),
    index("market_events_user_id_idx").on(table.userId),
    index("market_events_event_at_idx").on(table.eventAt),
    index("market_events_ticker_idx").on(table.ticker),
  ],
);

export const morningBriefsTable = pgTable(
  "morning_briefs",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    portfolioId: integer("portfolio_id")
      .notNull()
      .references(() => portfoliosTable.id, { onDelete: "cascade" }),
    briefDate: varchar("brief_date", { length: 10 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    headline: varchar("headline", { length: 500 }).notNull(),
    summary: text("summary").notNull(),
    marketPulse: jsonb("market_pulse")
      .$type<MorningBriefMarketPulse>()
      .notNull(),
    portfolioPulse: jsonb("portfolio_pulse")
      .$type<MorningBriefPortfolioPulse>()
      .notNull(),
    priorityActions: jsonb("priority_actions")
      .$type<MorningBriefAction[]>()
      .notNull()
      .default([]),
    upcomingEvents: jsonb("upcoming_events")
      .$type<MorningBriefEvent[]>()
      .notNull()
      .default([]),
    risks: jsonb("risks")
      .$type<MorningBriefRisk[]>()
      .notNull()
      .default([]),
    dataQuality: jsonb("data_quality")
      .$type<MorningBriefDataQuality>()
      .notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("morning_briefs_user_portfolio_date_uidx").on(
      table.userId,
      table.portfolioId,
      table.briefDate,
    ),
    index("morning_briefs_user_id_idx").on(table.userId),
    index("morning_briefs_generated_at_idx").on(table.generatedAt),
  ],
);

export const marketIntelligencePreferencesTable = pgTable(
  "market_intelligence_preferences",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .unique()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    timezone: varchar("timezone", { length: 80 })
      .notNull()
      .default("Asia/Kolkata"),
    briefHour: integer("brief_hour").notNull().default(8),
    includeGlobalMarkets: boolean("include_global_markets")
      .notNull()
      .default(true),
    includeMacro: boolean("include_macro").notNull().default(true),
    includePortfolioNews: boolean("include_portfolio_news")
      .notNull()
      .default(true),
    includeUpcomingEvents: boolean("include_upcoming_events")
      .notNull()
      .default(true),
    staleMarketMinutes: integer("stale_market_minutes")
      .notNull()
      .default(720),
    staleNewsHours: integer("stale_news_hours").notNull().default(36),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const marketProviderRunsTable = pgTable(
  "market_provider_runs",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 120 }).notNull(),
    status: providerRunStatusEnum("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    recordsUpserted: integer("records_upserted").notNull().default(0),
    error: text("error"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (table) => [
    index("market_provider_runs_user_id_idx").on(table.userId),
    index("market_provider_runs_started_at_idx").on(table.startedAt),
  ],
);

export type MarketDataPointRow = typeof marketDataPointsTable.$inferSelect;
export type InsertMarketDataPointRow = typeof marketDataPointsTable.$inferInsert;
export type MarketNewsRow = typeof marketNewsTable.$inferSelect;
export type InsertMarketNewsRow = typeof marketNewsTable.$inferInsert;
export type MarketEventRow = typeof marketEventsTable.$inferSelect;
export type InsertMarketEventRow = typeof marketEventsTable.$inferInsert;
export type MorningBriefRow = typeof morningBriefsTable.$inferSelect;
export type MarketIntelligencePreferencesRow =
  typeof marketIntelligencePreferencesTable.$inferSelect;
