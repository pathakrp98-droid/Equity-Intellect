import { db, decisionJournalTable, watchlistTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type Request, type Response } from "express";

import {
  portfolioService,
  type CreateTransactionInput,
  type MarketPriceInput,
} from "../services/portfolio/portfolioService";
import type { PortfolioTransactionType } from "../services/portfolio/engine";
import { researchService } from "../services/research/researchService";

const router = Router();

const TRANSACTION_TYPES = new Set<PortfolioTransactionType>([
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
]);

function requireUserId(req: Request, res: Response): string | null {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to use the portfolio engine" });
    return null;
  }
  return req.user.id;
}

function optionalPositiveInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("portfolioId must be a positive integer");
  }
  return parsed;
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new Error(`Invalid number: ${String(value)}`);
  return parsed;
}

function positiveNumber(value: unknown, field: string): number {
  const parsed = optionalNumber(value);
  if (parsed === null || parsed <= 0) {
    throw new Error(`${field} must be greater than zero`);
  }
  return parsed;
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = positiveNumber(value, field);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${field} must be a positive integer`);
  }
  return parsed;
}

function parseDate(value: unknown, field: string, fallback?: Date): Date {
  if ((value === undefined || value === null || value === "") && fallback) {
    return fallback;
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field} is invalid`);
  return parsed;
}

function parseTransactionBody(
  body: Record<string, unknown>,
): CreateTransactionInput {
  const rawType = String(body.type ?? "")
    .trim()
    .toLowerCase();
  if (!TRANSACTION_TYPES.has(rawType as PortfolioTransactionType)) {
    throw new Error(`Unsupported transaction type: ${rawType || "missing"}`);
  }
  const type = rawType as PortfolioTransactionType;
  const input: CreateTransactionInput = {
    portfolioId: optionalPositiveInteger(body.portfolioId),
    broker: typeof body.broker === "string" ? body.broker : "manual",
    accountName:
      typeof body.accountName === "string" ? body.accountName : "Manual",
    externalId:
      typeof body.externalId === "string"
        ? body.externalId.trim() || null
        : null,
    ticker: typeof body.ticker === "string" ? body.ticker : null,
    name: typeof body.name === "string" ? body.name : null,
    exchange: typeof body.exchange === "string" ? body.exchange : "NSE",
    sector: typeof body.sector === "string" ? body.sector : "Unclassified",
    type,
    quantity: optionalNumber(body.quantity),
    price: optionalNumber(body.price),
    amount: optionalNumber(body.amount),
    fees: optionalNumber(body.fees) ?? 0,
    taxes: optionalNumber(body.taxes) ?? 0,
    currency: typeof body.currency === "string" ? body.currency : "INR",
    tradeDate: parseDate(body.tradeDate, "tradeDate", new Date()),
    settlementDate:
      body.settlementDate === undefined || body.settlementDate === null
        ? null
        : parseDate(body.settlementDate, "settlementDate"),
    splitNumerator: optionalNumber(body.splitNumerator),
    splitDenominator: optionalNumber(body.splitDenominator),
    notes: typeof body.notes === "string" ? body.notes : null,
  };

  if (["buy", "sell", "rights"].includes(type)) {
    input.quantity = positiveNumber(body.quantity, "quantity");
    input.price = positiveNumber(body.price, "price");
    if (!input.ticker?.trim()) throw new Error(`${type} requires ticker`);
  }
  if (type === "bonus") {
    input.quantity = positiveNumber(body.quantity, "quantity");
    if (!input.ticker?.trim()) throw new Error("bonus requires ticker");
  }
  if (type === "split") {
    if (!input.ticker?.trim()) throw new Error("split requires ticker");
    input.splitNumerator = positiveNumber(
      body.splitNumerator,
      "splitNumerator",
    );
    input.splitDenominator = positiveNumber(
      body.splitDenominator,
      "splitDenominator",
    );
  }
  if (["deposit", "withdrawal", "interest", "fees"].includes(type)) {
    input.amount = positiveNumber(body.amount, "amount");
  }
  if (type === "dividend") {
    const explicitAmount = optionalNumber(body.amount);
    if (explicitAmount !== null && explicitAmount > 0) {
      input.amount = explicitAmount;
    } else {
      input.quantity = positiveNumber(body.quantity, "quantity");
      input.price = positiveNumber(body.price, "price");
    }
  }

  return input;
}

function sendError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = /not found/i.test(message)
    ? 404
    : /requires|invalid|unsupported|cannot|must/i.test(message)
      ? 400
      : 500;
  res.status(status).json({ error: message });
}

router.get("/", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const portfolioId = optionalPositiveInteger(req.query.portfolioId);
    res.json(await portfolioService.getOverview(userId, portfolioId));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/holdings", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const portfolioId = optionalPositiveInteger(req.query.portfolioId);
    const holdings = await portfolioService.getHoldings(userId, portfolioId);
    const thesisSignals = await researchService.getThesisSignals(
      userId,
      holdings.map((holding) => holding.ticker),
    );
    const equalWeight = holdings.length > 0 ? 100 / holdings.length : 0;
    res.json(
      holdings.map((holding) => {
        const signal = thesisSignals.get(holding.ticker);
        return {
          ticker: holding.ticker,
          name: holding.name,
          sector: holding.sector,
          quantity: holding.quantity,
          avgBuyPrice: holding.averageCost,
          ltp: holding.marketPrice,
          currentValue: holding.marketValue,
          investedValue: holding.costBasis,
          pnl: holding.unrealizedPnl,
          pnlPct: holding.unrealizedPnlPct,
          dayChange: holding.dayChange,
          dayChangePct: holding.dayChangePct,
          allocationPct: holding.allocationPct,
          conviction:
            signal?.conviction === "watch"
              ? "low"
              : (signal?.conviction ?? "medium"),
          thesisStatus:
            signal?.status === "draft" || signal?.status === "closed"
              ? "monitoring"
              : (signal?.status ?? "monitoring"),
          entryDate:
            holding.firstTradeDate?.toISOString().slice(0, 10) ??
            new Date().toISOString().slice(0, 10),
          targetPrice: signal?.targetPrice ?? null,
          stopLoss: null,
          idealWeight: equalWeight,
          broker: holding.brokers.join(", ") || null,
          hasAlert: false,
          priceSource: holding.priceSource,
        };
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/holdings/import", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const body = req.body as Record<string, unknown>;
    if (typeof body.csv !== "string" || !body.csv.trim()) {
      throw new Error("csv is required");
    }
    res.status(201).json(
      await portfolioService.importHoldingsCsv(userId, {
        portfolioId: optionalPositiveInteger(body.portfolioId),
        csv: body.csv,
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/holdings/template.csv", (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  res.type("text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="alphadesk-holdings-template.csv"',
  );
  res.send(portfolioService.getHoldingsCsvTemplate());
});

router.get("/transactions", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const portfolioId = optionalPositiveInteger(req.query.portfolioId);
    res.json(await portfolioService.listTransactions(userId, portfolioId));
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/transactions", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const input = parseTransactionBody(req.body as Record<string, unknown>);
    res
      .status(201)
      .json(await portfolioService.createTransaction(userId, input));
  } catch (error) {
    sendError(res, error);
  }
});

router.delete("/transactions/:id", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const transactionId = positiveInteger(req.params.id, "transaction id");
    const portfolioId = optionalPositiveInteger(req.query.portfolioId);
    res.json(
      await portfolioService.deleteTransaction(
        userId,
        transactionId,
        portfolioId,
      ),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/import", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const body = req.body as Record<string, unknown>;
    const broker = String(body.broker ?? "manual").toLowerCase();
    if (!new Set(["manual", "zerodha", "groww"]).has(broker)) {
      throw new Error("broker must be manual, zerodha, or groww");
    }
    if (typeof body.csv !== "string" || !body.csv.trim()) {
      throw new Error("csv is required");
    }
    res.status(201).json(
      await portfolioService.importCsv(userId, {
        portfolioId: optionalPositiveInteger(body.portfolioId),
        broker: broker as "manual" | "zerodha" | "groww",
        accountName:
          typeof body.accountName === "string" ? body.accountName : undefined,
        csv: body.csv,
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/template.csv", (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  res.type("text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="alphadesk-portfolio-template.csv"',
  );
  res.send(portfolioService.getManualCsvTemplate());
});

router.put("/prices", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const body = req.body as Record<string, unknown>;
    if (!Array.isArray(body.prices) || body.prices.length === 0) {
      throw new Error("prices must be a non-empty array");
    }
    const prices: MarketPriceInput[] = body.prices.map((raw) => {
      const item = raw as Record<string, unknown>;
      const ticker = String(item.ticker ?? "")
        .trim()
        .toUpperCase();
      if (!ticker) throw new Error("ticker is required for every price");
      return {
        ticker,
        price: positiveNumber(item.price, `price for ${ticker}`),
        previousClose:
          item.previousClose === undefined
            ? null
            : positiveNumber(item.previousClose, `previousClose for ${ticker}`),
        asOf:
          item.asOf === undefined
            ? new Date()
            : parseDate(item.asOf, `asOf for ${ticker}`),
        source: typeof item.source === "string" ? item.source : "manual",
      };
    });
    const portfolioId = optionalPositiveInteger(body.portfolioId);
    res.json(
      await portfolioService.setMarketPrices(userId, prices, portfolioId),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/recalculate", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const portfolioId = optionalPositiveInteger(
      (req.body as Record<string, unknown>).portfolioId,
    );
    res.json(await portfolioService.recalculate(userId, portfolioId));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/performance", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const portfolioId = optionalPositiveInteger(req.query.portfolioId);
    const performance = await portfolioService.getPerformance(
      userId,
      portfolioId,
    );
    res.json(
      performance ?? {
        absoluteReturn: 0,
        xirr: 0,
        niftyReturn: 0,
        alpha: 0,
        beta: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        attributions: [],
        monthlyReturns: [],
      },
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/risk", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const portfolioId = optionalPositiveInteger(req.query.portfolioId);
    res.json(
      (await portfolioService.getRisk(userId, portfolioId)) ?? {
        concentrationRisk: "low",
        topHoldingsConcentration: 0,
        sectorConcentration: [],
        correlationMatrix: [],
        stressTests: [],
        var95: 0,
        var99: 0,
        riskFlags: [],
      },
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/broker-snapshots", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const portfolioId = optionalPositiveInteger(req.query.portfolioId);
    res.json(await portfolioService.getBrokerSnapshots(userId, portfolioId));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/position-sizing", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const portfolioId = optionalPositiveInteger(req.query.portfolioId);
    const holdings = await portfolioService.getHoldings(userId, portfolioId);
    const idealWeight = holdings.length > 0 ? 100 / holdings.length : 0;
    res.json(
      holdings.map((holding) => {
        const difference = idealWeight - holding.allocationPct;
        return {
          ticker: holding.ticker,
          name: holding.name,
          currentWeight: holding.allocationPct,
          idealWeight,
          currentValue: holding.marketValue,
          suggestedAction:
            difference > 2 ? "add" : difference < -2 ? "trim" : "hold",
          stagedEntryLevels: [],
          trimLevels: [],
        };
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
});

// Existing personal watchlist is retained, but demo portfolio data is removed.
router.get("/watchlist", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const items = await db
    .select()
    .from(watchlistTable)
    .where(eq(watchlistTable.userId, userId))
    .orderBy(desc(watchlistTable.addedAt));
  res.json(
    items.map((item) => ({
      id: String(item.id),
      ticker: item.ticker,
      name: item.name,
      sector: item.sector ?? "Unclassified",
      ltp: 0,
      dayChange: 0,
      dayChangePct: 0,
      watchedSince: item.addedAt.toISOString().slice(0, 10),
      conviction: "medium",
      notes: item.notes ?? "",
      targetEntryPrice: null,
      pe: null,
      marketCap: null,
    })),
  );
});

router.post("/watchlist", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const body = req.body as Record<string, unknown>;
  const ticker = String(body.ticker ?? "")
    .trim()
    .toUpperCase();
  const name = String(body.name ?? "").trim();
  if (!ticker || !name) {
    res.status(400).json({ error: "ticker and name are required" });
    return;
  }
  const [item] = await db
    .insert(watchlistTable)
    .values({
      userId,
      ticker,
      name,
      sector: typeof body.sector === "string" ? body.sector : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    })
    .onConflictDoNothing()
    .returning();
  res.status(201).json(item ?? { ticker, name });
});

router.delete("/watchlist/:ticker", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  await db
    .delete(watchlistTable)
    .where(
      and(
        eq(watchlistTable.userId, userId),
        eq(watchlistTable.ticker, req.params.ticker.toUpperCase()),
      ),
    );
  res.status(204).send();
});

router.get("/recommendation-history", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const entries = await db
    .select()
    .from(decisionJournalTable)
    .where(eq(decisionJournalTable.userId, userId))
    .orderBy(desc(decisionJournalTable.createdAt));
  res.json(
    entries.map((entry) => ({
      id: String(entry.id),
      ticker: entry.ticker,
      name: entry.name ?? entry.ticker,
      action: entry.action.toLowerCase(),
      date: entry.date,
      price: 0,
      rationale: entry.rationale ?? "",
      outcome:
        entry.outcome === "win"
          ? "successful"
          : entry.outcome === "loss"
            ? "unsuccessful"
            : "pending",
      convictionAtTime: "medium",
      returnSinceRecommendation: null,
    })),
  );
});

router.post("/recommendation-history", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const body = req.body as Record<string, unknown>;
  const ticker = String(body.ticker ?? "")
    .trim()
    .toUpperCase();
  const action = String(body.action ?? "").trim();
  if (!ticker || !action) {
    res.status(400).json({ error: "ticker and action are required" });
    return;
  }
  const [entry] = await db
    .insert(decisionJournalTable)
    .values({
      userId,
      ticker,
      name: typeof body.name === "string" ? body.name : null,
      action,
      date:
        typeof body.date === "string"
          ? body.date
          : new Date().toISOString().slice(0, 10),
      rationale: typeof body.rationale === "string" ? body.rationale : null,
      outcome: typeof body.outcome === "string" ? body.outcome : null,
      pnl: typeof body.pnl === "string" ? body.pnl : null,
      learnings: typeof body.learnings === "string" ? body.learnings : null,
    })
    .returning();
  res.status(201).json(entry);
});

export default router;
