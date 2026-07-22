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

export const portfolioTransactionTypeEnum = pgEnum(
  "portfolio_transaction_type",
  [
    "buy",
    "sell",
    "dividend",
    "bonus",
    "split",
    "rights",
    "deposit",
    "withdrawal",
    "interest",
    "fees",
  ],
);

export const portfoliosTable = pgTable(
  "portfolios",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull().default("My Portfolio"),
    baseCurrency: varchar("base_currency", { length: 3 })
      .notNull()
      .default("INR"),
    benchmark: varchar("benchmark", { length: 40 })
      .notNull()
      .default("NIFTY50"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("portfolios_user_id_idx").on(table.userId)],
);

export const brokerAccountsTable = pgTable(
  "broker_accounts",
  {
    id: serial("id").primaryKey(),
    portfolioId: integer("portfolio_id")
      .notNull()
      .references(() => portfoliosTable.id, { onDelete: "cascade" }),
    broker: varchar("broker", { length: 60 }).notNull(),
    accountName: varchar("account_name", { length: 120 })
      .notNull()
      .default("Primary"),
    accountNumberMasked: varchar("account_number_masked", { length: 40 }),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    isActive: boolean("is_active").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("broker_accounts_portfolio_id_idx").on(table.portfolioId),
    uniqueIndex("broker_accounts_portfolio_broker_name_uidx").on(
      table.portfolioId,
      table.broker,
      table.accountName,
    ),
  ],
);

export const portfolioTransactionsTable = pgTable(
  "portfolio_transactions",
  {
    id: serial("id").primaryKey(),
    portfolioId: integer("portfolio_id")
      .notNull()
      .references(() => portfoliosTable.id, { onDelete: "cascade" }),
    brokerAccountId: integer("broker_account_id").references(
      () => brokerAccountsTable.id,
      { onDelete: "set null" },
    ),
    externalId: varchar("external_id", { length: 120 }),
    ticker: varchar("ticker", { length: 30 }),
    name: varchar("name", { length: 160 }),
    exchange: varchar("exchange", { length: 20 }).default("NSE"),
    sector: varchar("sector", { length: 100 }),
    type: portfolioTransactionTypeEnum("type").notNull(),
    quantity: doublePrecision("quantity"),
    price: doublePrecision("price"),
    amount: doublePrecision("amount"),
    fees: doublePrecision("fees").notNull().default(0),
    taxes: doublePrecision("taxes").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    tradeDate: timestamp("trade_date", { withTimezone: true }).notNull(),
    settlementDate: timestamp("settlement_date", { withTimezone: true }),
    splitNumerator: doublePrecision("split_numerator"),
    splitDenominator: doublePrecision("split_denominator"),
    notes: text("notes"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("portfolio_transactions_portfolio_id_idx").on(table.portfolioId),
    index("portfolio_transactions_trade_date_idx").on(table.tradeDate),
    index("portfolio_transactions_ticker_idx").on(table.ticker),
    uniqueIndex("portfolio_transactions_external_id_uidx").on(
      table.portfolioId,
      table.brokerAccountId,
      table.externalId,
    ),
  ],
);

export const portfolioMarketPricesTable = pgTable(
  "portfolio_market_prices",
  {
    id: serial("id").primaryKey(),
    portfolioId: integer("portfolio_id")
      .notNull()
      .references(() => portfoliosTable.id, { onDelete: "cascade" }),
    ticker: varchar("ticker", { length: 30 }).notNull(),
    price: doublePrecision("price").notNull(),
    previousClose: doublePrecision("previous_close"),
    source: varchar("source", { length: 40 }).notNull().default("manual"),
    asOf: timestamp("as_of", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("portfolio_market_prices_portfolio_ticker_uidx").on(
      table.portfolioId,
      table.ticker,
    ),
  ],
);

export const portfolioHoldingsTable = pgTable(
  "portfolio_holdings",
  {
    id: serial("id").primaryKey(),
    portfolioId: integer("portfolio_id")
      .notNull()
      .references(() => portfoliosTable.id, { onDelete: "cascade" }),
    ticker: varchar("ticker", { length: 30 }).notNull(),
    name: varchar("name", { length: 160 }),
    exchange: varchar("exchange", { length: 20 }).notNull().default("NSE"),
    sector: varchar("sector", { length: 100 }),
    quantity: doublePrecision("quantity").notNull(),
    averageCost: doublePrecision("average_cost").notNull(),
    marketPrice: doublePrecision("market_price").notNull(),
    previousClose: doublePrecision("previous_close"),
    marketValue: doublePrecision("market_value").notNull(),
    costBasis: doublePrecision("cost_basis").notNull(),
    unrealizedPnl: doublePrecision("unrealized_pnl").notNull(),
    realizedPnl: doublePrecision("realized_pnl").notNull().default(0),
    allocationPct: doublePrecision("allocation_pct").notNull().default(0),
    firstTradeDate: timestamp("first_trade_date", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("portfolio_holdings_portfolio_ticker_uidx").on(
      table.portfolioId,
      table.ticker,
    ),
  ],
);

export const portfolioCashAccountsTable = pgTable(
  "portfolio_cash_accounts",
  {
    id: serial("id").primaryKey(),
    portfolioId: integer("portfolio_id")
      .notNull()
      .references(() => portfoliosTable.id, { onDelete: "cascade" }),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    balance: doublePrecision("balance").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("portfolio_cash_accounts_portfolio_currency_uidx").on(
      table.portfolioId,
      table.currency,
    ),
  ],
);

export interface SectorAllocationSnapshot {
  sector: string;
  value: number;
  allocationPct: number;
}

export const portfolioSnapshotsTable = pgTable(
  "portfolio_snapshots",
  {
    id: serial("id").primaryKey(),
    portfolioId: integer("portfolio_id")
      .notNull()
      .references(() => portfoliosTable.id, { onDelete: "cascade" }),
    asOf: timestamp("as_of", { withTimezone: true }).notNull().defaultNow(),
    totalValue: doublePrecision("total_value").notNull(),
    marketValue: doublePrecision("market_value").notNull(),
    cashBalance: doublePrecision("cash_balance").notNull(),
    costBasis: doublePrecision("cost_basis").notNull(),
    realizedPnl: doublePrecision("realized_pnl").notNull(),
    unrealizedPnl: doublePrecision("unrealized_pnl").notNull(),
    dividendIncome: doublePrecision("dividend_income").notNull(),
    interestIncome: doublePrecision("interest_income").notNull().default(0),
    feesPaid: doublePrecision("fees_paid").notNull().default(0),
    netContributions: doublePrecision("net_contributions").notNull().default(0),
    totalPnl: doublePrecision("total_pnl").notNull().default(0),
    totalReturnPct: doublePrecision("total_return_pct").notNull(),
    xirrPct: doublePrecision("xirr_pct"),
    largestPositionTicker: varchar("largest_position_ticker", { length: 30 }),
    largestPositionPct: doublePrecision("largest_position_pct").notNull().default(0),
    topFiveConcentrationPct: doublePrecision("top_five_concentration_pct")
      .notNull()
      .default(0),
    concentrationRisk: varchar("concentration_risk", { length: 12 })
      .notNull()
      .default("low"),
    holdingsCount: integer("holdings_count").notNull().default(0),
    sectorAllocation: jsonb("sector_allocation")
      .$type<SectorAllocationSnapshot[]>()
      .notNull()
      .default([]),
    riskFlags: jsonb("risk_flags")
      .$type<string[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("portfolio_snapshots_portfolio_as_of_idx").on(
      table.portfolioId,
      table.asOf,
    ),
  ],
);

export type Portfolio = typeof portfoliosTable.$inferSelect;
export type InsertPortfolio = typeof portfoliosTable.$inferInsert;
export type BrokerAccount = typeof brokerAccountsTable.$inferSelect;
export type InsertBrokerAccount = typeof brokerAccountsTable.$inferInsert;
export type PortfolioTransaction = typeof portfolioTransactionsTable.$inferSelect;
export type InsertPortfolioTransaction =
  typeof portfolioTransactionsTable.$inferInsert;
export type PortfolioMarketPrice = typeof portfolioMarketPricesTable.$inferSelect;
export type PortfolioHolding = typeof portfolioHoldingsTable.$inferSelect;
export type PortfolioCashAccount = typeof portfolioCashAccountsTable.$inferSelect;
export type PortfolioSnapshot = typeof portfolioSnapshotsTable.$inferSelect;
