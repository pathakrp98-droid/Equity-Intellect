import {
  brokerAccountsTable,
  db,
  portfolioCashAccountsTable,
  portfolioDirectHoldingsTable,
  portfolioHoldingsTable,
  portfolioMarketPricesTable,
  portfolioSnapshotsTable,
  portfolioTransactionsTable,
  portfoliosTable,
  type InsertPortfolioTransaction,
} from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";

import {
  buildManualCsvTemplate,
  parsePortfolioCsv,
  type SupportedBroker,
} from "./csv";
import {
  calculatePortfolio,
  type EngineTransaction,
  type MarketQuote,
  type PortfolioCalculation,
  type PortfolioTransactionType,
} from "./engine";
import {
  buildHoldingsCsvTemplate,
  parseHoldingsCsv,
} from "./holdingsCsv";

export interface CreateTransactionInput {
  portfolioId?: number;
  broker?: string;
  accountName?: string;
  externalId?: string | null;
  ticker?: string | null;
  name?: string | null;
  exchange?: string | null;
  sector?: string | null;
  type: PortfolioTransactionType;
  quantity?: number | null;
  price?: number | null;
  amount?: number | null;
  fees?: number | null;
  taxes?: number | null;
  currency?: string | null;
  tradeDate: Date;
  settlementDate?: Date | null;
  splitNumerator?: number | null;
  splitDenominator?: number | null;
  notes?: string | null;
}

export interface MarketPriceInput {
  ticker: string;
  price: number;
  previousClose?: number | null;
  asOf?: Date;
  source?: string;
}

export interface ImportCsvInput {
  portfolioId?: number;
  broker: SupportedBroker;
  accountName?: string;
  csv: string;
}

export interface ImportHoldingsCsvInput {
  portfolioId?: number;
  csv: string;
}

function normalizeTicker(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

function asEngineTransaction(
  transaction: typeof portfolioTransactionsTable.$inferSelect,
  brokerName?: string,
): EngineTransaction {
  return {
    id: transaction.id,
    ticker: transaction.ticker,
    name: transaction.name,
    exchange: transaction.exchange,
    sector: transaction.sector,
    type: transaction.type,
    quantity: transaction.quantity,
    price: transaction.price,
    amount: transaction.amount,
    fees: transaction.fees,
    taxes: transaction.taxes,
    currency: transaction.currency,
    tradeDate: transaction.tradeDate,
    splitNumerator: transaction.splitNumerator,
    splitDenominator: transaction.splitDenominator,
    broker: brokerName,
  };
}

function asMarketQuote(
  price: typeof portfolioMarketPricesTable.$inferSelect,
): MarketQuote {
  return {
    ticker: price.ticker,
    price: price.price,
    previousClose: price.previousClose,
    asOf: price.asOf,
    source: price.source,
  };
}

export class PortfolioService {
  async getOrCreateDefaultPortfolio(userId: string) {
    const [defaultPortfolio] = await db
      .select()
      .from(portfoliosTable)
      .where(
        and(
          eq(portfoliosTable.userId, userId),
          eq(portfoliosTable.isDefault, true),
        ),
      )
      .limit(1);

    if (defaultPortfolio) return defaultPortfolio;

    const [existing] = await db
      .select()
      .from(portfoliosTable)
      .where(eq(portfoliosTable.userId, userId))
      .orderBy(asc(portfoliosTable.id))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(portfoliosTable)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(portfoliosTable.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(portfoliosTable)
      .values({
        userId,
        name: "My Portfolio",
        baseCurrency: "INR",
        benchmark: "NIFTY50",
        isDefault: true,
      })
      .returning();
    return created;
  }

  async getPortfolio(userId: string, portfolioId?: number) {
    if (!portfolioId) return this.getOrCreateDefaultPortfolio(userId);

    const [portfolio] = await db
      .select()
      .from(portfoliosTable)
      .where(
        and(
          eq(portfoliosTable.id, portfolioId),
          eq(portfoliosTable.userId, userId),
        ),
      )
      .limit(1);

    if (!portfolio) throw new Error("Portfolio not found");
    return portfolio;
  }

  private async getOrCreateBrokerAccount(
    portfolioId: number,
    broker: string,
    accountName = "Primary",
  ) {
    const normalizedBroker = broker.trim().toLowerCase();
    const [account] = await db
      .insert(brokerAccountsTable)
      .values({
        portfolioId,
        broker: normalizedBroker,
        accountName,
        currency: "INR",
        isActive: true,
        lastSyncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          brokerAccountsTable.portfolioId,
          brokerAccountsTable.broker,
          brokerAccountsTable.accountName,
        ],
        set: { isActive: true, lastSyncedAt: new Date() },
      })
      .returning();
    return account;
  }

  async listTransactions(userId: string, portfolioId?: number) {
    const portfolio = await this.getPortfolio(userId, portfolioId);
    const rows = await db
      .select({
        transaction: portfolioTransactionsTable,
        broker: brokerAccountsTable.broker,
        accountName: brokerAccountsTable.accountName,
      })
      .from(portfolioTransactionsTable)
      .leftJoin(
        brokerAccountsTable,
        eq(portfolioTransactionsTable.brokerAccountId, brokerAccountsTable.id),
      )
      .where(eq(portfolioTransactionsTable.portfolioId, portfolio.id))
      .orderBy(desc(portfolioTransactionsTable.tradeDate), desc(portfolioTransactionsTable.id));

    return rows.map(({ transaction, broker, accountName }) => ({
      ...transaction,
      broker,
      accountName,
    }));
  }

  async createTransaction(userId: string, input: CreateTransactionInput) {
    const portfolio = await this.getPortfolio(userId, input.portfolioId);
    const brokerAccount = await this.getOrCreateBrokerAccount(
      portfolio.id,
      input.broker ?? "manual",
      input.accountName ?? "Manual",
    );

    const values: InsertPortfolioTransaction = {
      portfolioId: portfolio.id,
      brokerAccountId: brokerAccount.id,
      externalId: input.externalId ?? null,
      ticker: normalizeTicker(input.ticker),
      name: input.name?.trim() || null,
      exchange: input.exchange?.trim().toUpperCase() || "NSE",
      sector: input.sector?.trim() || "Unclassified",
      type: input.type,
      quantity: input.quantity ?? null,
      price: input.price ?? null,
      amount: input.amount ?? null,
      fees: input.fees ?? 0,
      taxes: input.taxes ?? 0,
      currency: input.currency?.trim().toUpperCase() || portfolio.baseCurrency,
      tradeDate: input.tradeDate,
      settlementDate: input.settlementDate ?? null,
      splitNumerator: input.splitNumerator ?? null,
      splitDenominator: input.splitDenominator ?? null,
      notes: input.notes ?? null,
      metadata: { source: "manual" },
    };

    const [created] = await db
      .insert(portfolioTransactionsTable)
      .values(values)
      .returning();

    try {
      const calculation = await this.recalculate(userId, portfolio.id);
      return { transaction: created, calculation };
    } catch (error) {
      // Do not leave an invalid transaction in the source-of-truth ledger.
      await db
        .delete(portfolioTransactionsTable)
        .where(eq(portfolioTransactionsTable.id, created.id));
      throw error;
    }
  }

  async deleteTransaction(userId: string, transactionId: number, portfolioId?: number) {
    const portfolio = await this.getPortfolio(userId, portfolioId);
    const [deleted] = await db
      .delete(portfolioTransactionsTable)
      .where(
        and(
          eq(portfolioTransactionsTable.id, transactionId),
          eq(portfolioTransactionsTable.portfolioId, portfolio.id),
        ),
      )
      .returning();

    if (!deleted) throw new Error("Transaction not found");

    try {
      return await this.recalculate(userId, portfolio.id);
    } catch (error) {
      // Removing an earlier buy can invalidate later sells. Restore the ledger row.
      await db.insert(portfolioTransactionsTable).values(deleted);
      throw error;
    }
  }


  async importHoldingsCsv(
    userId: string,
    input: ImportHoldingsCsvInput,
  ) {
    const portfolio = await this.getPortfolio(userId, input.portfolioId);
    const parsed = parseHoldingsCsv(input.csv);
    if (parsed.holdings.length === 0) {
      throw new Error(
        parsed.errors[0]?.message ?? "No valid holdings were found in the CSV",
      );
    }

    const importedAt = new Date();
    await db.transaction(async (tx) => {
      await tx
        .delete(portfolioDirectHoldingsTable)
        .where(eq(portfolioDirectHoldingsTable.portfolioId, portfolio.id));

      await tx.insert(portfolioDirectHoldingsTable).values(
        parsed.holdings.map((holding) => ({
          portfolioId: portfolio.id,
          symbol: holding.symbol,
          isin: holding.isin,
          name: holding.name,
          exchange: holding.exchange,
          sector: holding.sector,
          quantity: holding.quantity,
          availableQuantity: holding.availableQuantity,
          averageCost: holding.averageCost,
          previousClose: holding.previousClose,
          reportedUnrealizedPnl: holding.reportedUnrealizedPnl,
          reportedUnrealizedPnlPct: holding.reportedUnrealizedPnlPct,
          importedAt,
        })),
      );

      for (const holding of parsed.holdings) {
        await tx
          .insert(portfolioMarketPricesTable)
          .values({
            portfolioId: portfolio.id,
            ticker: holding.symbol,
            price: holding.previousClose,
            previousClose: holding.previousClose,
            source: "holdings_csv",
            asOf: importedAt,
          })
          .onConflictDoUpdate({
            target: [
              portfolioMarketPricesTable.portfolioId,
              portfolioMarketPricesTable.ticker,
            ],
            set: {
              price: holding.previousClose,
              previousClose: holding.previousClose,
              source: "holdings_csv",
              asOf: importedAt,
            },
          });
      }
    });

    const calculation = await this.recalculate(userId, portfolio.id);
    return {
      imported: parsed.holdings.length,
      failed: parsed.errors.length,
      errors: parsed.errors,
      warnings: parsed.warnings,
      calculation,
    };
  }

  async importCsv(userId: string, input: ImportCsvInput) {
    const portfolio = await this.getPortfolio(userId, input.portfolioId);
    const parsed = parsePortfolioCsv(input.csv, input.broker);
    const brokerAccount = await this.getOrCreateBrokerAccount(
      portfolio.id,
      input.broker,
      input.accountName ?? `${input.broker} import`,
    );

    let imported = 0;
    if (parsed.transactions.length > 0) {
      const rows: InsertPortfolioTransaction[] = parsed.transactions.map(
        (transaction) => ({
          portfolioId: portfolio.id,
          brokerAccountId: brokerAccount.id,
          externalId: transaction.externalId,
          ticker: normalizeTicker(transaction.ticker),
          name: transaction.name ?? null,
          exchange: transaction.exchange ?? "NSE",
          sector: transaction.sector ?? "Unclassified",
          type: transaction.type,
          quantity: transaction.quantity ?? null,
          price: transaction.price ?? null,
          amount: transaction.amount ?? null,
          fees: transaction.fees ?? 0,
          taxes: transaction.taxes ?? 0,
          currency: transaction.currency ?? portfolio.baseCurrency,
          tradeDate: new Date(transaction.tradeDate),
          settlementDate: transaction.settlementDate ?? null,
          splitNumerator: transaction.splitNumerator ?? null,
          splitDenominator: transaction.splitDenominator ?? null,
          notes: transaction.notes ?? null,
          metadata: transaction.metadata,
        }),
      );

      const inserted = await db
        .insert(portfolioTransactionsTable)
        .values(rows)
        .onConflictDoNothing()
        .returning();
      imported = inserted.length;

      try {
        const calculation = await this.recalculate(userId, portfolio.id);
        return {
          imported,
          duplicates: parsed.transactions.length - imported,
          failed: parsed.errors.length,
          errors: parsed.errors,
          calculation,
        };
      } catch (error) {
        // Roll back only rows inserted by this import, preserving prior ledger data.
        for (const transaction of inserted) {
          await db
            .delete(portfolioTransactionsTable)
            .where(eq(portfolioTransactionsTable.id, transaction.id));
        }
        throw error;
      }
    }

    const calculation = await this.recalculate(userId, portfolio.id);
    return {
      imported,
      duplicates: parsed.transactions.length - imported,
      failed: parsed.errors.length,
      errors: parsed.errors,
      calculation,
    };
  }

  async setMarketPrices(
    userId: string,
    prices: MarketPriceInput[],
    portfolioId?: number,
  ) {
    const portfolio = await this.getPortfolio(userId, portfolioId);

    for (const input of prices) {
      const ticker = normalizeTicker(input.ticker);
      if (!ticker) throw new Error("ticker is required for every market price");
      if (!Number.isFinite(input.price) || input.price < 0) {
        throw new Error(`Invalid market price for ${ticker}`);
      }

      await db
        .insert(portfolioMarketPricesTable)
        .values({
          portfolioId: portfolio.id,
          ticker,
          price: input.price,
          previousClose: input.previousClose ?? null,
          source: input.source ?? "manual",
          asOf: input.asOf ?? new Date(),
        })
        .onConflictDoUpdate({
          target: [
            portfolioMarketPricesTable.portfolioId,
            portfolioMarketPricesTable.ticker,
          ],
          set: {
            price: input.price,
            previousClose: input.previousClose ?? null,
            source: input.source ?? "manual",
            asOf: input.asOf ?? new Date(),
          },
        });
    }

    return this.recalculate(userId, portfolio.id);
  }

  async recalculate(userId: string, portfolioId?: number): Promise<PortfolioCalculation> {
    const portfolio = await this.getPortfolio(userId, portfolioId);
    const [directHoldings, transactions, prices, accounts] = await Promise.all([
      db
        .select()
        .from(portfolioDirectHoldingsTable)
        .where(eq(portfolioDirectHoldingsTable.portfolioId, portfolio.id))
        .orderBy(asc(portfolioDirectHoldingsTable.id)),
      db
        .select()
        .from(portfolioTransactionsTable)
        .where(eq(portfolioTransactionsTable.portfolioId, portfolio.id))
        .orderBy(asc(portfolioTransactionsTable.tradeDate), asc(portfolioTransactionsTable.id)),
      db
        .select()
        .from(portfolioMarketPricesTable)
        .where(eq(portfolioMarketPricesTable.portfolioId, portfolio.id)),
      db
        .select()
        .from(brokerAccountsTable)
        .where(eq(brokerAccountsTable.portfolioId, portfolio.id)),
    ]);

    const brokerNames = new Map(
      accounts.map((account) => [account.id, account.broker]),
    );
    const openingDate = directHoldings[0]?.importedAt ?? new Date();
    const openingCost = directHoldings.reduce(
      (sum, holding) => sum + holding.quantity * holding.averageCost,
      0,
    );
    const directTransactions: EngineTransaction[] =
      directHoldings.length === 0
        ? []
        : [
            {
              id: "holdings-opening-deposit",
              type: "deposit",
              amount: openingCost,
              tradeDate: openingDate,
            },
            ...directHoldings.map((holding) => ({
              id: `holding-${holding.id}`,
              ticker: holding.symbol,
              name: holding.name,
              exchange: holding.exchange,
              sector: holding.sector,
              type: "buy" as const,
              quantity: holding.quantity,
              price: holding.averageCost > 0 ? holding.averageCost : Number.EPSILON,
              tradeDate: openingDate,
              broker: "holdings_csv",
            })),
          ];
    const calculation = calculatePortfolio(
      directHoldings.length > 0
        ? directTransactions
        : transactions.map((transaction) =>
            asEngineTransaction(
              transaction,
              transaction.brokerAccountId
                ? brokerNames.get(transaction.brokerAccountId)
                : undefined,
            ),
          ),
      prices.map(asMarketQuote),
      new Date(),
    );

    await db.transaction(async (tx) => {
      await tx
        .delete(portfolioHoldingsTable)
        .where(eq(portfolioHoldingsTable.portfolioId, portfolio.id));

      if (calculation.holdings.length > 0) {
        await tx.insert(portfolioHoldingsTable).values(
          calculation.holdings.map((holding) => ({
            portfolioId: portfolio.id,
            ticker: holding.ticker,
            name: holding.name,
            exchange: holding.exchange,
            sector: holding.sector,
            quantity: holding.quantity,
            averageCost: holding.averageCost,
            marketPrice: holding.marketPrice,
            previousClose: holding.previousClose,
            marketValue: holding.marketValue,
            costBasis: holding.costBasis,
            unrealizedPnl: holding.unrealizedPnl,
            realizedPnl: holding.realizedPnl,
            allocationPct: holding.allocationPct,
            firstTradeDate: holding.firstTradeDate,
            updatedAt: calculation.asOf,
          })),
        );
      }

      await tx
        .insert(portfolioCashAccountsTable)
        .values({
          portfolioId: portfolio.id,
          currency: portfolio.baseCurrency,
          balance: calculation.cashBalance,
          updatedAt: calculation.asOf,
        })
        .onConflictDoUpdate({
          target: [
            portfolioCashAccountsTable.portfolioId,
            portfolioCashAccountsTable.currency,
          ],
          set: {
            balance: calculation.cashBalance,
            updatedAt: calculation.asOf,
          },
        });

      await tx.insert(portfolioSnapshotsTable).values({
        portfolioId: portfolio.id,
        asOf: calculation.asOf,
        totalValue: calculation.totalValue,
        marketValue: calculation.marketValue,
        cashBalance: calculation.cashBalance,
        costBasis: calculation.costBasis,
        realizedPnl: calculation.realizedPnl,
        unrealizedPnl: calculation.unrealizedPnl,
        dividendIncome: calculation.dividendIncome,
        interestIncome: calculation.interestIncome,
        feesPaid: calculation.feesPaid,
        netContributions: calculation.netContributions,
        totalPnl: calculation.totalPnl,
        totalReturnPct: calculation.totalReturnPct,
        xirrPct: calculation.xirrPct,
        largestPositionTicker: calculation.largestPositionTicker,
        largestPositionPct: calculation.largestPositionPct,
        topFiveConcentrationPct: calculation.topFiveConcentrationPct,
        concentrationRisk: calculation.concentrationRisk,
        holdingsCount: calculation.holdingsCount,
        sectorAllocation: calculation.sectorAllocation,
        riskFlags: calculation.riskFlags,
      });

      await tx
        .update(portfoliosTable)
        .set({ updatedAt: calculation.asOf })
        .where(eq(portfoliosTable.id, portfolio.id));
    });

    return calculation;
  }

  private async latestSnapshot(portfolioId: number) {
    const [snapshot] = await db
      .select()
      .from(portfolioSnapshotsTable)
      .where(eq(portfolioSnapshotsTable.portfolioId, portfolioId))
      .orderBy(desc(portfolioSnapshotsTable.asOf), desc(portfolioSnapshotsTable.id))
      .limit(1);
    return snapshot;
  }

  async getOverview(userId: string, portfolioId?: number) {
    const portfolio = await this.getPortfolio(userId, portfolioId);
    let snapshot = await this.latestSnapshot(portfolio.id);
    if (!snapshot) {
      await this.recalculate(userId, portfolio.id);
      snapshot = await this.latestSnapshot(portfolio.id);
    }

    const [holdings, transactionCount] = await Promise.all([
      this.getHoldings(userId, portfolio.id),
      db
        .select({ id: portfolioTransactionsTable.id })
        .from(portfolioTransactionsTable)
        .where(eq(portfolioTransactionsTable.portfolioId, portfolio.id)),
    ]);

    return {
      portfolio,
      snapshot,
      holdings,
      transactionCount: transactionCount.length,
      priceCoverage: {
        quoted: holdings.filter(
          (holding) => holding.priceSource !== "last_transaction",
        ).length,
        fallback: holdings.filter(
          (holding) => holding.priceSource === "last_transaction",
        ).length,
      },
    };
  }

  async getHoldings(userId: string, portfolioId?: number) {
    const portfolio = await this.getPortfolio(userId, portfolioId);
    const [holdings, directHoldings, prices, transactions, accounts] =
      await Promise.all([
        db
          .select()
          .from(portfolioHoldingsTable)
          .where(eq(portfolioHoldingsTable.portfolioId, portfolio.id))
          .orderBy(desc(portfolioHoldingsTable.marketValue)),
        db
          .select()
          .from(portfolioDirectHoldingsTable)
          .where(eq(portfolioDirectHoldingsTable.portfolioId, portfolio.id)),
        db
          .select()
          .from(portfolioMarketPricesTable)
        .where(eq(portfolioMarketPricesTable.portfolioId, portfolio.id)),
      db
        .select()
        .from(portfolioTransactionsTable)
        .where(eq(portfolioTransactionsTable.portfolioId, portfolio.id)),
      db
        .select()
          .from(brokerAccountsTable)
          .where(eq(brokerAccountsTable.portfolioId, portfolio.id)),
      ]);

    const directByTicker = new Map(
      directHoldings.map((holding) => [holding.symbol, holding]),
    );
    const priceSources = new Map(prices.map((price) => [price.ticker, price.source]));
    const accountNames = new Map(accounts.map((account) => [account.id, account.broker]));
    const brokersByTicker = new Map<string, Set<string>>();
    for (const transaction of transactions) {
      if (!transaction.ticker || !transaction.brokerAccountId) continue;
      const broker = accountNames.get(transaction.brokerAccountId);
      if (!broker) continue;
      const ticker = transaction.ticker.toUpperCase();
      const set = brokersByTicker.get(ticker) ?? new Set<string>();
      set.add(broker);
      brokersByTicker.set(ticker, set);
    }

    return holdings.map((holding) => {
      const previousClose = holding.previousClose ?? holding.marketPrice;
      const dayChange = holding.marketPrice - previousClose;
      const direct = directByTicker.get(holding.ticker);
      return {
        ...holding,
        name: holding.name ?? holding.ticker,
        sector: holding.sector ?? "Unclassified",
        isin: direct?.isin ?? null,
        availableQuantity: direct?.availableQuantity ?? null,
        reportedUnrealizedPnl: direct?.reportedUnrealizedPnl ?? null,
        reportedUnrealizedPnlPct: direct?.reportedUnrealizedPnlPct ?? null,
        sourceType: direct ? "direct" : "ledger",
        unrealizedPnlPct:
          holding.costBasis > 0
            ? (holding.unrealizedPnl / holding.costBasis) * 100
            : 0,
        dayChange,
        dayChangePct: previousClose > 0 ? (dayChange / previousClose) * 100 : 0,
        priceSource: priceSources.get(holding.ticker) ?? "last_transaction",
        brokers: [...(brokersByTicker.get(holding.ticker) ?? new Set())],
      };
    });
  }

  async getPerformance(userId: string, portfolioId?: number) {
    const portfolio = await this.getPortfolio(userId, portfolioId);
    const snapshot = await this.latestSnapshot(portfolio.id);
    const holdings = await this.getHoldings(userId, portfolio.id);
    if (!snapshot) return null;

    return {
      absoluteReturn: snapshot.totalReturnPct,
      xirr: snapshot.xirrPct ?? 0,
      niftyReturn: 0,
      alpha: snapshot.totalReturnPct,
      beta: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      attributions: holdings.map((holding) => ({
        ticker: holding.ticker,
        name: holding.name,
        contribution:
          snapshot.totalValue !== 0
            ? (holding.unrealizedPnl / snapshot.totalValue) * 100
            : 0,
        allocationEffect: 0,
        selectionEffect:
          snapshot.totalValue !== 0
            ? (holding.unrealizedPnl / snapshot.totalValue) * 100
            : 0,
      })),
      monthlyReturns: [],
      dataQuality: {
        benchmarkHistoryAvailable: false,
        priceHistoryAvailable: false,
      },
    };
  }

  async getRisk(userId: string, portfolioId?: number) {
    const portfolio = await this.getPortfolio(userId, portfolioId);
    const snapshot = await this.latestSnapshot(portfolio.id);
    if (!snapshot) return null;

    const sectors = snapshot.sectorAllocation ?? [];
    const concentrationRisk =
      snapshot.largestPositionPct > 25
        ? "high"
        : snapshot.largestPositionPct > 15
          ? "medium"
          : "low";

    return {
      concentrationRisk,
      topHoldingsConcentration: snapshot.largestPositionPct,
      sectorConcentration: sectors.map((sector) => ({
        sector: sector.sector,
        weight: sector.allocationPct,
        herfindahlIndex: (sector.allocationPct / 100) ** 2,
      })),
      correlationMatrix: [],
      stressTests: [
        {
          scenario: "Broad market correction",
          portfolioImpactPct: -20,
          description: "Deterministic 20% mark-to-market shock across equity holdings.",
        },
        {
          scenario: "Moderate recession",
          portfolioImpactPct: -15,
          description: "Deterministic 15% mark-to-market shock across equity holdings.",
        },
      ],
      var95: 0,
      var99: 0,
      riskFlags: snapshot.riskFlags,
      dataQuality: {
        returnHistoryAvailable: false,
        correlationAvailable: false,
      },
    };
  }

  async getBrokerSnapshots(userId: string, portfolioId?: number) {
    const portfolio = await this.getPortfolio(userId, portfolioId);
    const [accounts, allTransactions, prices] = await Promise.all([
      db
        .select()
        .from(brokerAccountsTable)
        .where(eq(brokerAccountsTable.portfolioId, portfolio.id)),
      db
        .select()
        .from(portfolioTransactionsTable)
        .where(eq(portfolioTransactionsTable.portfolioId, portfolio.id))
        .orderBy(asc(portfolioTransactionsTable.tradeDate), asc(portfolioTransactionsTable.id)),
      db
        .select()
        .from(portfolioMarketPricesTable)
        .where(eq(portfolioMarketPricesTable.portfolioId, portfolio.id)),
    ]);

    return accounts.map((account) => {
      const calculation = calculatePortfolio(
        allTransactions
          .filter((transaction) => transaction.brokerAccountId === account.id)
          .map((transaction) => asEngineTransaction(transaction, account.broker)),
        prices.map(asMarketQuote),
      );
      return {
        broker: account.broker,
        accountId: String(account.id),
        totalValue: calculation.totalValue,
        cashBalance: calculation.cashBalance,
        holdingsCount: calculation.holdingsCount,
        lastSynced: (account.lastSyncedAt ?? account.createdAt).toISOString(),
        status: account.isActive ? "synced" : "stale",
        discrepancies: 0,
      };
    });
  }

  getHoldingsCsvTemplate() {
    return buildHoldingsCsvTemplate();
  }

  getManualCsvTemplate() {
    return buildManualCsvTemplate();
  }
}

export const portfolioService = new PortfolioService();
