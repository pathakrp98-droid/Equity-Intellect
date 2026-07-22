import {
  boolean,
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

export const liveDataCacheKindEnum = pgEnum("live_data_cache_kind", [
  "quotes",
  "news",
  "calendar",
  "corporate_actions",
  "snapshot",
  "raw",
]);

export interface LiveDataCachePayload {
  data: unknown;
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

export const liveDataProviderCacheTable = pgTable(
  "live_data_provider_cache",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 120 }).notNull(),
    cacheKey: varchar("cache_key", { length: 500 }).notNull(),
    kind: liveDataCacheKindEnum("kind").notNull(),
    payload: jsonb("payload").$type<LiveDataCachePayload>().notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    staleIfErrorUntil: timestamp("stale_if_error_until", {
      withTimezone: true,
    }).notNull(),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("live_data_cache_user_provider_key_uidx").on(
      table.userId,
      table.provider,
      table.cacheKey,
    ),
    index("live_data_cache_user_id_idx").on(table.userId),
    index("live_data_cache_expires_at_idx").on(table.expiresAt),
  ],
);

export const liveDataSymbolMappingsTable = pgTable(
  "live_data_symbol_mappings",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    ticker: varchar("ticker", { length: 30 }).notNull(),
    exchange: varchar("exchange", { length: 30 }).notNull().default("NSE"),
    provider: varchar("provider", { length: 120 }).notNull(),
    providerSymbol: varchar("provider_symbol", { length: 120 }).notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("live_data_mapping_user_provider_ticker_uidx").on(
      table.userId,
      table.provider,
      table.ticker,
    ),
    index("live_data_mapping_user_id_idx").on(table.userId),
  ],
);

export const liveDataPreferencesTable = pgTable(
  "live_data_preferences",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .unique()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    providerPriority: jsonb("provider_priority")
      .$type<string[]>()
      .notNull()
      .default(["normalized-http", "alpha-vantage"]),
    autoSyncPortfolio: boolean("auto_sync_portfolio")
      .notNull()
      .default(true),
    autoEvaluateAlerts: boolean("auto_evaluate_alerts")
      .notNull()
      .default(true),
    quoteTtlMinutes: integer("quote_ttl_minutes").notNull().default(15),
    newsTtlMinutes: integer("news_ttl_minutes").notNull().default(60),
    calendarTtlMinutes: integer("calendar_ttl_minutes")
      .notNull()
      .default(360),
    staleIfErrorMinutes: integer("stale_if_error_minutes")
      .notNull()
      .default(1_440),
    maxSymbolsPerRefresh: integer("max_symbols_per_refresh")
      .notNull()
      .default(25),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export type LiveDataCacheRow = typeof liveDataProviderCacheTable.$inferSelect;
export type LiveDataSymbolMappingRow =
  typeof liveDataSymbolMappingsTable.$inferSelect;
export type LiveDataPreferencesRow = typeof liveDataPreferencesTable.$inferSelect;
