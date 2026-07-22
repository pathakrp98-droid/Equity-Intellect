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

export const researchConvictionEnum = pgEnum("research_conviction", [
  "high",
  "medium",
  "low",
  "watch",
]);

export const researchThesisStatusEnum = pgEnum("research_thesis_status", [
  "draft",
  "intact",
  "monitoring",
  "weakening",
  "broken",
  "closed",
]);

export const researchNoteCategoryEnum = pgEnum("research_note_category", [
  "thesis",
  "financials",
  "valuation",
  "management",
  "industry",
  "earnings",
  "risk",
  "catalyst",
  "general",
]);

export const researchImpactEnum = pgEnum("research_impact", [
  "high",
  "medium",
  "low",
]);

export const researchProbabilityEnum = pgEnum("research_probability", [
  "high",
  "medium",
  "low",
]);

export const researchItemStatusEnum = pgEnum("research_item_status", [
  "active",
  "monitoring",
  "triggered",
  "resolved",
  "archived",
]);

export const researchScenarioEnum = pgEnum("research_scenario", [
  "common",
  "bull",
  "base",
  "bear",
]);

export const researchCompaniesTable = pgTable(
  "research_companies",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    ticker: varchar("ticker", { length: 30 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    exchange: varchar("exchange", { length: 20 }).notNull().default("NSE"),
    sector: varchar("sector", { length: 120 }),
    industry: varchar("industry", { length: 160 }),
    description: text("description"),
    website: varchar("website", { length: 500 }),
    marketCap: doublePrecision("market_cap"),
    currentPrice: doublePrecision("current_price"),
    previousClose: doublePrecision("previous_close"),
    pe: doublePrecision("pe"),
    dataSource: varchar("data_source", { length: 80 }).default("manual"),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("research_companies_user_ticker_uidx").on(
      table.userId,
      table.ticker,
    ),
    index("research_companies_user_id_idx").on(table.userId),
  ],
);

export const investmentThesesTable = pgTable(
  "investment_theses",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => researchCompaniesTable.id, { onDelete: "cascade" }),
    summary: text("summary"),
    bullCase: text("bull_case"),
    baseCase: text("base_case"),
    bearCase: text("bear_case"),
    conviction: researchConvictionEnum("conviction")
      .notNull()
      .default("medium"),
    status: researchThesisStatusEnum("status").notNull().default("draft"),
    moatRating: varchar("moat_rating", { length: 30 }),
    managementRating: varchar("management_rating", { length: 30 }),
    investmentHorizon: varchar("investment_horizon", { length: 100 }),
    expectedReturnPct: doublePrecision("expected_return_pct"),
    maxAcceptableLossPct: doublePrecision("max_acceptable_loss_pct"),
    targetPrice: doublePrecision("target_price"),
    bullPrice: doublePrecision("bull_price"),
    basePrice: doublePrecision("base_price"),
    bearPrice: doublePrecision("bear_price"),
    valuationMethodology: text("valuation_methodology"),
    keyAssumptions: jsonb("key_assumptions")
      .$type<string[]>()
      .notNull()
      .default([]),
    version: integer("version").notNull().default(1),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("investment_theses_company_id_uidx").on(table.companyId),
  ],
);

export const researchNotesTable = pgTable(
  "research_notes",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => researchCompaniesTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    category: researchNoteCategoryEnum("category").notNull().default("general"),
    content: text("content").notNull(),
    sourceLabel: varchar("source_label", { length: 180 }),
    sourceUrl: varchar("source_url", { length: 1000 }),
    eventDate: timestamp("event_date", { withTimezone: true }),
    isPinned: boolean("is_pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("research_notes_company_id_idx").on(table.companyId),
    index("research_notes_user_id_idx").on(table.userId),
  ],
);

export const researchCatalystsTable = pgTable(
  "research_catalysts",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => researchCompaniesTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    expectedDate: timestamp("expected_date", { withTimezone: true }),
    impact: researchImpactEnum("impact").notNull().default("medium"),
    probability: researchProbabilityEnum("probability")
      .notNull()
      .default("medium"),
    status: researchItemStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("research_catalysts_company_id_idx").on(table.companyId)],
);

export const researchRisksTable = pgTable(
  "research_risks",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => researchCompaniesTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    severity: researchImpactEnum("severity").notNull().default("medium"),
    probability: researchProbabilityEnum("probability")
      .notNull()
      .default("medium"),
    mitigation: text("mitigation"),
    status: researchItemStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("research_risks_company_id_idx").on(table.companyId)],
);

export const researchInvalidationTriggersTable = pgTable(
  "research_invalidation_triggers",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => researchCompaniesTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    trigger: varchar("trigger", { length: 260 }).notNull(),
    description: text("description"),
    severity: researchImpactEnum("severity").notNull().default("high"),
    metricName: varchar("metric_name", { length: 160 }),
    operator: varchar("operator", { length: 10 }),
    threshold: doublePrecision("threshold"),
    unit: varchar("unit", { length: 40 }),
    currentValue: doublePrecision("current_value"),
    status: researchItemStatusEnum("status").notNull().default("monitoring"),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("research_invalidation_company_id_idx").on(table.companyId),
  ],
);

export const researchValuationAssumptionsTable = pgTable(
  "research_valuation_assumptions",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => researchCompaniesTable.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 180 }).notNull(),
    value: varchar("value", { length: 180 }).notNull(),
    unit: varchar("unit", { length: 50 }),
    scenario: researchScenarioEnum("scenario").notNull().default("common"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("research_valuation_company_id_idx").on(table.companyId)],
);

export type ResearchCompany = typeof researchCompaniesTable.$inferSelect;
export type InsertResearchCompany = typeof researchCompaniesTable.$inferInsert;
export type InvestmentThesis = typeof investmentThesesTable.$inferSelect;
export type InsertInvestmentThesis = typeof investmentThesesTable.$inferInsert;
export type ResearchNote = typeof researchNotesTable.$inferSelect;
export type ResearchCatalyst = typeof researchCatalystsTable.$inferSelect;
export type ResearchRisk = typeof researchRisksTable.$inferSelect;
export type ResearchInvalidationTrigger =
  typeof researchInvalidationTriggersTable.$inferSelect;
export type ResearchValuationAssumption =
  typeof researchValuationAssumptionsTable.$inferSelect;
