import {
  alertRulesTable,
  copilotConversationsTable,
  copilotMemoriesTable,
  db,
  decisionJournalEntriesTable,
  decisionJournalReviewsTable,
  guardianDecisionPacketsTable,
  guardianHealthSnapshotsTable,
  investmentAlertsTable,
  investmentThesesTable,
  liveDataProviderCacheTable,
  marketDataPointsTable,
  marketProviderRunsTable,
  morningBriefsTable,
  portfolioHoldingsTable,
  portfolioMarketPricesTable,
  portfolioTransactionsTable,
  portfoliosTable,
  researchCompaniesTable,
} from "@workspace/db";
import { and, desc, eq, inArray, isNull, lte } from "drizzle-orm";

import { listLiveDataProviders } from "../liveData/providerRegistry";
import {
  evaluateIntegrationReadiness,
  type IntegrationFacts,
} from "./readiness";

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export interface SystemEnvironmentStatus {
  environment: string;
  corsAllowListConfigured: boolean;
  openAiConfigured: boolean;
  configuredLiveDataProviders: string[];
  normalizedHttpProviderConfigured: boolean;
  alphaVantageConfigured: boolean;
  buildVersion: string;
}

export interface IntegrationHealthResponse {
  checkedAt: string;
  databaseReady: boolean;
  readiness: ReturnType<typeof evaluateIntegrationReadiness>;
  facts: IntegrationFacts;
  environment: SystemEnvironmentStatus;
}

class IntegrationService {
  async getHealth(userId: string): Promise<IntegrationHealthResponse> {
    const now = new Date();
    const staleCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const portfolios = await db
      .select({ id: portfoliosTable.id, isDefault: portfoliosTable.isDefault })
      .from(portfoliosTable)
      .where(eq(portfoliosTable.userId, userId));
    const activePortfolio =
      portfolios.find((item) => item.isDefault) ?? portfolios[0] ?? null;

    const holdings = activePortfolio
      ? await db
          .select({
            ticker: portfolioHoldingsTable.ticker,
            marketPrice: portfolioHoldingsTable.marketPrice,
          })
          .from(portfolioHoldingsTable)
          .where(eq(portfolioHoldingsTable.portfolioId, activePortfolio.id))
      : [];

    const transactions = activePortfolio
      ? await db
          .select({ id: portfolioTransactionsTable.id })
          .from(portfolioTransactionsTable)
          .where(eq(portfolioTransactionsTable.portfolioId, activePortfolio.id))
      : [];

    const prices = activePortfolio
      ? await db
          .select({
            ticker: portfolioMarketPricesTable.ticker,
            asOf: portfolioMarketPricesTable.asOf,
          })
          .from(portfolioMarketPricesTable)
          .where(eq(portfolioMarketPricesTable.portfolioId, activePortfolio.id))
      : [];

    const priceByTicker = new Map(
      prices.map((price) => [price.ticker.toUpperCase(), price]),
    );
    const pricedHoldings = holdings.filter(
      (holding) =>
        holding.marketPrice > 0 ||
        priceByTicker.has(holding.ticker.toUpperCase()),
    );
    const stalePrices = holdings.filter((holding) => {
      const price = priceByTicker.get(holding.ticker.toUpperCase());
      return !price || new Date(price.asOf) < staleCutoff;
    });

    const companies = await db
      .select({ id: researchCompaniesTable.id })
      .from(researchCompaniesTable)
      .where(
        and(
          eq(researchCompaniesTable.userId, userId),
          eq(researchCompaniesTable.isArchived, false),
        ),
      );
    const companyIds = companies.map((company) => company.id);
    const theses = companyIds.length
      ? await db
          .select({
            status: investmentThesesTable.status,
            nextReviewAt: investmentThesesTable.nextReviewAt,
          })
          .from(investmentThesesTable)
          .where(inArray(investmentThesesTable.companyId, companyIds))
      : [];

    const conversations = await db
      .select({ id: copilotConversationsTable.id })
      .from(copilotConversationsTable)
      .where(eq(copilotConversationsTable.userId, userId));
    const memories = await db
      .select({ id: copilotMemoriesTable.id })
      .from(copilotMemoriesTable)
      .where(eq(copilotMemoriesTable.userId, userId));

    const briefs = await db
      .select({ generatedAt: morningBriefsTable.generatedAt })
      .from(morningBriefsTable)
      .where(eq(morningBriefsTable.userId, userId))
      .orderBy(desc(morningBriefsTable.generatedAt));
    const marketData = await db
      .select({ id: marketDataPointsTable.id })
      .from(marketDataPointsTable)
      .where(eq(marketDataPointsTable.userId, userId));
    const providerRuns = await db
      .select({
        status: marketProviderRunsTable.status,
        completedAt: marketProviderRunsTable.completedAt,
        startedAt: marketProviderRunsTable.startedAt,
      })
      .from(marketProviderRunsTable)
      .where(eq(marketProviderRunsTable.userId, userId))
      .orderBy(desc(marketProviderRunsTable.startedAt))
      .limit(1);

    const healthSnapshots = await db
      .select({ score: guardianHealthSnapshotsTable.score })
      .from(guardianHealthSnapshotsTable)
      .where(eq(guardianHealthSnapshotsTable.userId, userId))
      .orderBy(desc(guardianHealthSnapshotsTable.createdAt));
    const pendingPackets = await db
      .select({ id: guardianDecisionPacketsTable.id })
      .from(guardianDecisionPacketsTable)
      .where(
        and(
          eq(guardianDecisionPacketsTable.userId, userId),
          eq(guardianDecisionPacketsTable.status, "pending"),
        ),
      );

    const journalEntries = await db
      .select({ id: decisionJournalEntriesTable.id })
      .from(decisionJournalEntriesTable)
      .where(eq(decisionJournalEntriesTable.userId, userId));
    const dueReviews = await db
      .select({ id: decisionJournalReviewsTable.id })
      .from(decisionJournalReviewsTable)
      .where(
        and(
          eq(decisionJournalReviewsTable.userId, userId),
          eq(decisionJournalReviewsTable.status, "due"),
          lte(decisionJournalReviewsTable.scheduledFor, now),
        ),
      );
    const completedReviews = await db
      .select({ id: decisionJournalReviewsTable.id })
      .from(decisionJournalReviewsTable)
      .where(
        and(
          eq(decisionJournalReviewsTable.userId, userId),
          eq(decisionJournalReviewsTable.status, "completed"),
        ),
      );

    const cacheRows = await db
      .select({ fetchedAt: liveDataProviderCacheTable.fetchedAt })
      .from(liveDataProviderCacheTable)
      .where(eq(liveDataProviderCacheTable.userId, userId))
      .orderBy(desc(liveDataProviderCacheTable.fetchedAt));

    const activeAlerts = await db
      .select({ severity: investmentAlertsTable.severity })
      .from(investmentAlertsTable)
      .where(
        and(
          eq(investmentAlertsTable.userId, userId),
          isNull(investmentAlertsTable.dismissedAt),
          isNull(investmentAlertsTable.resolvedAt),
        ),
      );
    const enabledRules = await db
      .select({ id: alertRulesTable.id })
      .from(alertRulesTable)
      .where(
        and(
          eq(alertRulesTable.userId, userId),
          eq(alertRulesTable.isEnabled, true),
        ),
      );

    const configuredProviders = listLiveDataProviders()
      .filter((provider) => provider.isConfigured())
      .map((provider) => provider.name);

    const facts: IntegrationFacts = {
      portfolio: {
        portfolios: portfolios.length,
        holdings: holdings.length,
        transactions: transactions.length,
        holdingsWithPrices: pricedHoldings.length,
        stalePrices: stalePrices.length,
      },
      research: {
        companies: companies.length,
        activeTheses: theses.filter((thesis) =>
          ["intact", "monitoring", "weakening"].includes(thesis.status),
        ).length,
        brokenTheses: theses.filter((thesis) => thesis.status === "broken")
          .length,
        overdueReviews: theses.filter(
          (thesis) =>
            thesis.nextReviewAt !== null &&
            new Date(thesis.nextReviewAt) <= now,
        ).length,
      },
      copilot: {
        conversations: conversations.length,
        memories: memories.length,
        aiProviderConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      },
      intelligence: {
        briefs: briefs.length,
        marketDataPoints: marketData.length,
        latestBriefAt: iso(briefs[0]?.generatedAt),
        latestProviderStatus: providerRuns[0]?.status ?? null,
      },
      guardian: {
        healthSnapshots: healthSnapshots.length,
        latestHealthScore: healthSnapshots[0]?.score ?? null,
        pendingPackets: pendingPackets.length,
      },
      journal: {
        entries: journalEntries.length,
        dueReviews: dueReviews.length,
        completedReviews: completedReviews.length,
      },
      liveData: {
        configuredProviders,
        cachedRecords: cacheRows.length,
        latestFetchAt: iso(cacheRows[0]?.fetchedAt),
      },
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter((alert) => alert.severity === "critical")
          .length,
        enabledRules: enabledRules.length,
      },
    };

    return {
      checkedAt: now.toISOString(),
      databaseReady: true,
      readiness: evaluateIntegrationReadiness(facts),
      facts,
      environment: {
        environment: process.env.NODE_ENV ?? "development",
        corsAllowListConfigured: Boolean(
          process.env.CORS_ALLOWED_ORIGINS?.trim(),
        ),
        openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
        configuredLiveDataProviders: configuredProviders,
        normalizedHttpProviderConfigured:
          configuredProviders.includes("normalized-http"),
        alphaVantageConfigured: configuredProviders.includes("alpha-vantage"),
        buildVersion: process.env.APP_VERSION ?? "0.8.0",
      },
    };
  }
}

export const integrationService = new IntegrationService();
