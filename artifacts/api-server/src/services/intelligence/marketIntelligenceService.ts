import {
  db,
  investmentThesesTable,
  marketDataPointsTable,
  marketEventsTable,
  marketIntelligencePreferencesTable,
  marketNewsTable,
  marketProviderRunsTable,
  morningBriefsTable,
  researchCompaniesTable,
} from "@workspace/db";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";

import { portfolioService } from "../portfolio/portfolioService";
import { researchService } from "../research/researchService";
import { buildMorningBrief } from "./briefEngine";
import { marketIntelligenceProvider } from "./httpProvider";
import { normalizeMarketImport } from "./normalization";
import type {
  BriefEventItem,
  BriefMarketPoint,
  BriefNewsItem,
  BriefPreferences,
  MarketImportPayload,
} from "./types";

export interface UpdateMarketPreferencesInput {
  timezone?: string;
  briefHour?: number;
  includeGlobalMarkets?: boolean;
  includeMacro?: boolean;
  includePortfolioNews?: boolean;
  includeUpcomingEvents?: boolean;
  staleMarketMinutes?: number;
  staleNewsHours?: number;
}

function clampInteger(value: number | undefined, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) throw new Error("Preference value must be numeric");
  return Math.max(min, Math.min(max, Math.round(value)));
}

function safeTimezone(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const timezone = value.trim();
  if (!timezone) throw new Error("timezone cannot be empty");
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error("timezone is not a valid IANA timezone");
  }
  return timezone;
}

class MarketIntelligenceService {
  async getPreferences(userId: string) {
    const [existing] = await db
      .select()
      .from(marketIntelligencePreferencesTable)
      .where(eq(marketIntelligencePreferencesTable.userId, userId))
      .limit(1);
    if (existing) return existing;

    const [created] = await db
      .insert(marketIntelligencePreferencesTable)
      .values({ userId })
      .returning();
    return created;
  }

  async updatePreferences(userId: string, input: UpdateMarketPreferencesInput) {
    await this.getPreferences(userId);
    const timezone = safeTimezone(input.timezone);
    const briefHour = clampInteger(input.briefHour, 0, 23);
    const staleMarketMinutes = clampInteger(
      input.staleMarketMinutes,
      15,
      10_080,
    );
    const staleNewsHours = clampInteger(input.staleNewsHours, 1, 720);
    const updates = {
      ...(timezone !== undefined ? { timezone } : {}),
      ...(briefHour !== undefined ? { briefHour } : {}),
      ...(input.includeGlobalMarkets !== undefined
        ? { includeGlobalMarkets: input.includeGlobalMarkets }
        : {}),
      ...(input.includeMacro !== undefined
        ? { includeMacro: input.includeMacro }
        : {}),
      ...(input.includePortfolioNews !== undefined
        ? { includePortfolioNews: input.includePortfolioNews }
        : {}),
      ...(input.includeUpcomingEvents !== undefined
        ? { includeUpcomingEvents: input.includeUpcomingEvents }
        : {}),
      ...(staleMarketMinutes !== undefined ? { staleMarketMinutes } : {}),
      ...(staleNewsHours !== undefined ? { staleNewsHours } : {}),
      updatedAt: new Date(),
    };
    const [updated] = await db
      .update(marketIntelligencePreferencesTable)
      .set(updates)
      .where(eq(marketIntelligencePreferencesTable.userId, userId))
      .returning();
    return updated;
  }

  private async getPortfolioTickers(userId: string): Promise<string[]> {
    const overview = await portfolioService.getOverview(userId);
    return overview.holdings.map((holding) => holding.ticker);
  }

  async importNormalizedData(
    userId: string,
    payload: MarketImportPayload,
    providerOverride?: string,
    options: { syncPortfolioPrices?: boolean } = {},
  ) {
    const tickers = await this.getPortfolioTickers(userId);
    const normalized = normalizeMarketImport(
      { ...payload, provider: providerOverride ?? payload.provider },
      tickers,
    );

    await db.transaction(async (tx) => {
      for (const point of normalized.points) {
        await tx
          .insert(marketDataPointsTable)
          .values({ userId, ...point })
          .onConflictDoUpdate({
            target: [
              marketDataPointsTable.userId,
              marketDataPointsTable.kind,
              marketDataPointsTable.symbol,
            ],
            set: {
              name: point.name,
              value: point.value,
              change: point.change,
              changePct: point.changePct,
              unit: point.unit,
              region: point.region,
              source: point.source,
              sourceUrl: point.sourceUrl,
              asOf: point.asOf,
              receivedAt: normalized.fetchedAt,
              metadata: point.metadata,
            },
          });
      }
      for (const item of normalized.news) {
        await tx
          .insert(marketNewsTable)
          .values({ userId, ...item })
          .onConflictDoUpdate({
            target: [
              marketNewsTable.userId,
              marketNewsTable.source,
              marketNewsTable.externalId,
            ],
            set: {
              ticker: item.ticker,
              headline: item.headline,
              summary: item.summary,
              sourceUrl: item.sourceUrl,
              publishedAt: item.publishedAt,
              sentiment: item.sentiment,
              relevanceScore: item.relevanceScore,
              isPortfolioRelevant: item.isPortfolioRelevant,
              metadata: item.metadata,
            },
          });
      }
      for (const event of normalized.events) {
        await tx
          .insert(marketEventsTable)
          .values({ userId, ...event })
          .onConflictDoUpdate({
            target: [
              marketEventsTable.userId,
              marketEventsTable.source,
              marketEventsTable.externalId,
            ],
            set: {
              ticker: event.ticker,
              companyName: event.companyName,
              eventType: event.eventType,
              title: event.title,
              description: event.description,
              eventAt: event.eventAt,
              impact: event.impact,
              sourceUrl: event.sourceUrl,
              isPortfolioRelevant: event.isPortfolioRelevant,
              metadata: event.metadata,
              updatedAt: new Date(),
            },
          });
      }
    });

    const portfolioTickerSet = new Set(tickers);
    const equityPrices = normalized.points
      .filter(
        (point) =>
          point.kind === "equity" && portfolioTickerSet.has(point.symbol),
      )
      .map((point) => ({
        ticker: point.symbol,
        price: point.value,
        previousClose:
          typeof point.metadata.previousClose === "number" &&
          Number.isFinite(point.metadata.previousClose)
            ? point.metadata.previousClose
            : point.change !== null
              ? point.value - point.change
              : null,
        source: point.source,
        asOf: point.asOf,
      }));
    if (equityPrices.length > 0 && options.syncPortfolioPrices !== false) {
      await portfolioService.setMarketPrices(userId, equityPrices);
    }

    return {
      provider: normalized.provider,
      fetchedAt: normalized.fetchedAt,
      points: normalized.points.length,
      news: normalized.news.length,
      events: normalized.events.length,
      equityPricesSynced:
        options.syncPortfolioPrices === false ? 0 : equityPrices.length,
      total:
        normalized.points.length + normalized.news.length + normalized.events.length,
      warnings: normalized.warnings,
    };
  }

  async refresh(userId: string) {
    const startedAt = new Date();
    const [run] = await db
      .insert(marketProviderRunsTable)
      .values({
        userId,
        provider: marketIntelligenceProvider.name,
        status: marketIntelligenceProvider.isConfigured() ? "running" : "skipped",
        startedAt,
        completedAt: marketIntelligenceProvider.isConfigured() ? null : startedAt,
        metadata: {},
      })
      .returning();

    if (!marketIntelligenceProvider.isConfigured()) {
      return {
        run,
        configured: false,
        message:
          "No provider is configured. Import normalized JSON or set MARKET_INTELLIGENCE_URL.",
      };
    }

    try {
      const payload = await marketIntelligenceProvider.fetchSnapshot(
        await this.getPortfolioTickers(userId),
      );
      const imported = await this.importNormalizedData(
        userId,
        payload,
        marketIntelligenceProvider.name,
      );
      const [updatedRun] = await db
        .update(marketProviderRunsTable)
        .set({
          status: imported.warnings.length > 0 ? "partial" : "success",
          completedAt: new Date(),
          recordsUpserted: imported.total,
          metadata: { warnings: imported.warnings },
        })
        .where(eq(marketProviderRunsTable.id, run.id))
        .returning();
      return { run: updatedRun, configured: true, imported };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider refresh failed";
      const [updatedRun] = await db
        .update(marketProviderRunsTable)
        .set({ status: "failed", completedAt: new Date(), error: message })
        .where(eq(marketProviderRunsTable.id, run.id))
        .returning();
      return { run: updatedRun, configured: true, error: message };
    }
  }

  async getSnapshot(userId: string) {
    const rows = await db
      .select()
      .from(marketDataPointsTable)
      .where(eq(marketDataPointsTable.userId, userId))
      .orderBy(asc(marketDataPointsTable.kind), asc(marketDataPointsTable.name));
    return rows;
  }

  async getNews(
    userId: string,
    options: { portfolioOnly?: boolean; days?: number; limit?: number } = {},
  ) {
    const since = new Date(
      Date.now() - Math.max(1, Math.min(90, options.days ?? 7)) * 86_400_000,
    );
    const conditions = [
      eq(marketNewsTable.userId, userId),
      gte(marketNewsTable.publishedAt, since),
    ];
    if (options.portfolioOnly !== false) {
      conditions.push(eq(marketNewsTable.isPortfolioRelevant, true));
    }
    return db
      .select()
      .from(marketNewsTable)
      .where(and(...conditions))
      .orderBy(desc(marketNewsTable.publishedAt), desc(marketNewsTable.relevanceScore))
      .limit(Math.max(1, Math.min(200, options.limit ?? 50)));
  }

  async getCalendar(
    userId: string,
    options: { days?: number; portfolioOnly?: boolean } = {},
  ) {
    const now = new Date();
    const until = new Date(
      now.getTime() + Math.max(1, Math.min(365, options.days ?? 30)) * 86_400_000,
    );
    const conditions = [
      eq(marketEventsTable.userId, userId),
      gte(marketEventsTable.eventAt, now),
      lte(marketEventsTable.eventAt, until),
    ];
    if (options.portfolioOnly !== false) {
      conditions.push(eq(marketEventsTable.isPortfolioRelevant, true));
    }
    return db
      .select()
      .from(marketEventsTable)
      .where(and(...conditions))
      .orderBy(asc(marketEventsTable.eventAt));
  }

  private async getResearchSignals(userId: string) {
    const [companies, thesisRows] = await Promise.all([
      researchService.listCompanies(userId, { holdingsOnly: true }),
      db
        .select({
          ticker: researchCompaniesTable.ticker,
          nextReviewAt: investmentThesesTable.nextReviewAt,
          targetPrice: investmentThesesTable.targetPrice,
        })
        .from(researchCompaniesTable)
        .leftJoin(
          investmentThesesTable,
          eq(investmentThesesTable.companyId, researchCompaniesTable.id),
        )
        .where(eq(researchCompaniesTable.userId, userId)),
    ]);
    const detailByTicker = new Map(thesisRows.map((row) => [row.ticker, row]));
    return companies
      .filter((company) => company.isHolding)
      .map((company) => ({
        ticker: company.ticker,
        conviction: company.conviction,
        status: company.thesisStatus,
        completenessScore: company.completenessScore,
        nextReviewAt: detailByTicker.get(company.ticker)?.nextReviewAt ?? null,
        targetPrice: detailByTicker.get(company.ticker)?.targetPrice ?? null,
      }));
  }

  async generateBrief(userId: string, now = new Date()) {
    const [overview, preferences, points, news, events, researchSignals] =
      await Promise.all([
        portfolioService.getOverview(userId),
        this.getPreferences(userId),
        this.getSnapshot(userId),
        this.getNews(userId, { portfolioOnly: true, days: 14, limit: 100 }),
        this.getCalendar(userId, { portfolioOnly: true, days: 30 }),
        this.getResearchSignals(userId),
      ]);
    if (!overview.snapshot) throw new Error("Portfolio snapshot is unavailable");

    const brief = buildMorningBrief({
      now,
      providerConfigured: marketIntelligenceProvider.isConfigured(),
      portfolio: {
        totalValue: overview.snapshot.totalValue,
        cashBalance: overview.snapshot.cashBalance,
        totalPnl: overview.snapshot.totalPnl,
        totalReturnPct: overview.snapshot.totalReturnPct,
        largestPositionTicker: overview.snapshot.largestPositionTicker,
        largestPositionPct: overview.snapshot.largestPositionPct,
        concentrationRisk: overview.snapshot.concentrationRisk,
        holdingsCount: overview.snapshot.holdingsCount,
        riskFlags: overview.snapshot.riskFlags ?? [],
      },
      holdings: overview.holdings.map((holding) => ({
        ticker: holding.ticker,
        name: holding.name,
        sector: holding.sector,
        quantity: holding.quantity,
        marketValue: holding.marketValue,
        allocationPct: holding.allocationPct,
        marketPrice: holding.marketPrice,
        previousClose: holding.previousClose,
        dayChange: holding.dayChange,
        dayChangePct: holding.dayChangePct,
        unrealizedPnl: holding.unrealizedPnl,
        unrealizedPnlPct: holding.unrealizedPnlPct,
        priceSource: holding.priceSource,
      })),
      researchSignals,
      marketPoints: points as BriefMarketPoint[],
      news: news as BriefNewsItem[],
      events: events as BriefEventItem[],
      preferences: preferences as BriefPreferences,
    });

    const [saved] = await db
      .insert(morningBriefsTable)
      .values({
        userId,
        portfolioId: overview.portfolio.id,
        briefDate: brief.briefDate,
        title: brief.title,
        headline: brief.headline,
        summary: brief.summary,
        marketPulse: brief.marketPulse,
        portfolioPulse: brief.portfolioPulse,
        priorityActions: brief.priorityActions,
        upcomingEvents: brief.upcomingEvents,
        risks: brief.risks,
        dataQuality: brief.dataQuality,
        generatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          morningBriefsTable.userId,
          morningBriefsTable.portfolioId,
          morningBriefsTable.briefDate,
        ],
        set: {
          title: brief.title,
          headline: brief.headline,
          summary: brief.summary,
          marketPulse: brief.marketPulse,
          portfolioPulse: brief.portfolioPulse,
          priorityActions: brief.priorityActions,
          upcomingEvents: brief.upcomingEvents,
          risks: brief.risks,
          dataQuality: brief.dataQuality,
          generatedAt: now,
        },
      })
      .returning();
    return saved;
  }

  async getLatestBrief(userId: string, autoGenerate = true) {
    const [latest] = await db
      .select()
      .from(morningBriefsTable)
      .where(eq(morningBriefsTable.userId, userId))
      .orderBy(desc(morningBriefsTable.generatedAt))
      .limit(1);
    if (latest || !autoGenerate) return latest ?? null;
    return this.generateBrief(userId);
  }

  async getBriefHistory(userId: string, limit = 30) {
    return db
      .select()
      .from(morningBriefsTable)
      .where(eq(morningBriefsTable.userId, userId))
      .orderBy(desc(morningBriefsTable.generatedAt))
      .limit(Math.max(1, Math.min(100, limit)));
  }

  async getProviderStatus(userId: string) {
    const [latestRun, latestPoint, latestNews, latestEvent] = await Promise.all([
      db
        .select()
        .from(marketProviderRunsTable)
        .where(eq(marketProviderRunsTable.userId, userId))
        .orderBy(desc(marketProviderRunsTable.startedAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({ asOf: marketDataPointsTable.asOf })
        .from(marketDataPointsTable)
        .where(eq(marketDataPointsTable.userId, userId))
        .orderBy(desc(marketDataPointsTable.asOf))
        .limit(1)
        .then((rows) => rows[0]?.asOf ?? null),
      db
        .select({ publishedAt: marketNewsTable.publishedAt })
        .from(marketNewsTable)
        .where(eq(marketNewsTable.userId, userId))
        .orderBy(desc(marketNewsTable.publishedAt))
        .limit(1)
        .then((rows) => rows[0]?.publishedAt ?? null),
      db
        .select({ eventAt: marketEventsTable.eventAt })
        .from(marketEventsTable)
        .where(eq(marketEventsTable.userId, userId))
        .orderBy(desc(marketEventsTable.eventAt))
        .limit(1)
        .then((rows) => rows[0]?.eventAt ?? null),
    ]);
    return {
      configured: marketIntelligenceProvider.isConfigured(),
      provider: marketIntelligenceProvider.name,
      latestRun,
      latestData: {
        marketAsOf: latestPoint,
        newsPublishedAt: latestNews,
        calendarEventAt: latestEvent,
      },
      requiredEnvironment: {
        url: "MARKET_INTELLIGENCE_URL",
        apiKey: "MARKET_INTELLIGENCE_API_KEY (optional)",
      },
      normalizedContract: "alphadesk-normalized-v1",
    };
  }
}

export const marketIntelligenceService = new MarketIntelligenceService();
