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
  varchar,
} from "drizzle-orm/pg-core";

import { usersTable } from "./auth";

export const copilotModeEnum = pgEnum("copilot_mode", [
  "general",
  "portfolio_review",
  "company_analysis",
  "thesis_challenge",
  "company_compare",
  "research_gap",
  "performance_explain",
]);

export const copilotRoleEnum = pgEnum("copilot_role", [
  "user",
  "assistant",
  "system",
]);

export const copilotMemoryCategoryEnum = pgEnum("copilot_memory_category", [
  "preference",
  "instruction",
  "portfolio",
  "thesis",
  "risk",
  "research",
  "decision",
]);

export interface CopilotCitationData {
  sourceId: string;
  label: string;
  kind: "portfolio" | "holding" | "research" | "memory" | "calculation";
  ticker?: string | null;
  asOf?: string | null;
  dataSource: string;
  claim?: string | null;
}

export interface CopilotContextSnapshotData {
  generatedAt: string;
  mode: string;
  tickers: string[];
  sourceCount: number;
  dataQuality: {
    liveMarketDataAvailable: boolean;
    priceHistoryAvailable: boolean;
    benchmarkHistoryAvailable: boolean;
    researchCoverageCount: number;
  };
  sources: CopilotCitationData[];
}

export const copilotConversationsTable = pgTable(
  "copilot_conversations",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull().default("New analysis"),
    mode: copilotModeEnum("mode").notNull().default("general"),
    primaryTicker: varchar("primary_ticker", { length: 30 }),
    comparisonTickers: jsonb("comparison_tickers")
      .$type<string[]>()
      .notNull()
      .default([]),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("copilot_conversations_user_id_idx").on(table.userId),
    index("copilot_conversations_updated_at_idx").on(table.updatedAt),
  ],
);

export const copilotMessagesTable = pgTable(
  "copilot_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => copilotConversationsTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: copilotRoleEnum("role").notNull(),
    content: text("content").notNull(),
    mode: copilotModeEnum("mode").notNull().default("general"),
    contextSnapshot: jsonb("context_snapshot").$type<CopilotContextSnapshotData>(),
    citations: jsonb("citations")
      .$type<CopilotCitationData[]>()
      .notNull()
      .default([]),
    responseData: jsonb("response_data").$type<Record<string, unknown>>(),
    model: varchar("model", { length: 100 }),
    provider: varchar("provider", { length: 60 }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("copilot_messages_conversation_id_idx").on(table.conversationId),
    index("copilot_messages_user_id_idx").on(table.userId),
  ],
);

export const copilotMemoriesTable = pgTable(
  "copilot_memories",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    category: copilotMemoryCategoryEnum("category").notNull(),
    subject: varchar("subject", { length: 160 }).notNull(),
    content: text("content").notNull(),
    confidence: doublePrecision("confidence").notNull().default(1),
    sourceConversationId: integer("source_conversation_id").references(
      () => copilotConversationsTable.id,
      { onDelete: "set null" },
    ),
    sourceMessageId: integer("source_message_id").references(
      () => copilotMessagesTable.id,
      { onDelete: "set null" },
    ),
    isPinned: boolean("is_pinned").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("copilot_memories_user_id_idx").on(table.userId),
    index("copilot_memories_subject_idx").on(table.subject),
  ],
);

export type CopilotConversationRow =
  typeof copilotConversationsTable.$inferSelect;
export type InsertCopilotConversationRow =
  typeof copilotConversationsTable.$inferInsert;
export type CopilotChatMessageRow = typeof copilotMessagesTable.$inferSelect;
export type InsertCopilotChatMessageRow =
  typeof copilotMessagesTable.$inferInsert;
export type CopilotMemoryRow = typeof copilotMemoriesTable.$inferSelect;
export type InsertCopilotMemoryRow = typeof copilotMemoriesTable.$inferInsert;
