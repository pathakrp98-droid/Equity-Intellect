import crypto from "node:crypto";

import {
  db,
  guardrailAuditTable,
  guardrailSettingsTable,
  guardianDecisionPacketsTable,
  guardianHealthSnapshotsTable,
  marketDataPointsTable,
  marketNewsTable,
  type GuardrailSettingsData,
  type GuardianDecisionPacketContext,
  type GuardianDecisionPacketInput,
  type GuardianDecisionPacketResult,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

import { portfolioService } from "../portfolio/portfolioService";
import { researchService } from "../research/researchService";
import {
  calculateGuardianHealth,
  runGuardianCheck,
  type GuardianCheckResult,
  type GuardianMarketContext,
  type GuardianPortfolioContext,
  type GuardianProposal,
  type GuardianResearchContext,
  type GuardianSettings,
} from "./guardianEngine";

export const DEFAULT_GUARDIAN_SETTINGS: GuardrailSettingsData = {
  portfolioLimits: {
    maxStockConcentrationPct: 20,
    maxSectorConcentrationPct: 35,
    maxSmallCapExposurePct: 20,
    minCashBufferPct: 5,
    maxCorrelatedPositions: 4,
    maxWeeklyNewPositions: 2,
    maxPortfolioDrawdownPct: 15,
  },
  preTradeRequirements: {
    requireRationale: true,
    requireInvestmentHorizon: true,
    requireBearCase: true,
    requireTargetPrice: true,
    requireThesisInvalidation: true,
    requireMaxAcceptableLoss: true,
    requireExitConditions: true,
    minResearchCompletenessScore: 70,
  },
  biasChecks: {
    enabled: true,
    recency: true,
    confirmationBias: true,
    anchoring: true,
    overconfidence: true,
    narrativeBias: true,
    fomo: true,
    revengeTrading: true,
    panicSelling: true,
    overtrading: true,
    unjustifiedAveragingDown: true,
  },
  stressTests: {
    enabled: true,
    marketCorrection: true,
    recession: true,
    rateHike: true,
    crudeShock: true,
    currencyShock: true,
    companySpecific: true,
  },
  guardianMode: {
    enabled: true,
    allowOverrideWithRationale: true,
    requireAuditLog: true,
  },
};

function normalizeTicker(value: string): string {
  const ticker = value.trim().toUpperCase();
  if (!/^[A-Z0-9.&_-]{1,30}$/.test(ticker)) {
    throw new Error("ticker contains unsupported characters");
  }
  return ticker;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeSettings(
  partial: Partial<GuardrailSettingsData>,
  existing: GuardrailSettingsData,
): GuardrailSettingsData {
  const merged: GuardrailSettingsData = {
    portfolioLimits: {
      ...DEFAULT_GUARDIAN_SETTINGS.portfolioLimits,
      ...existing.portfolioLimits,
      ...partial.portfolioLimits,
    },
    preTradeRequirements: {
      ...DEFAULT_GUARDIAN_SETTINGS.preTradeRequirements,
      ...existing.preTradeRequirements,
      ...partial.preTradeRequirements,
    },
    biasChecks: {
      ...DEFAULT_GUARDIAN_SETTINGS.biasChecks,
      ...existing.biasChecks,
      ...partial.biasChecks,
    },
    stressTests: {
      ...DEFAULT_GUARDIAN_SETTINGS.stressTests,
      ...existing.stressTests,
      ...partial.stressTests,
    },
    guardianMode: {
      ...DEFAULT_GUARDIAN_SETTINGS.guardianMode,
      ...existing.guardianMode,
      ...partial.guardianMode,
    },
  };
  merged.portfolioLimits.maxStockConcentrationPct = clamp(
    finite(merged.portfolioLimits.maxStockConcentrationPct, 20),
    1,
    100,
  );
  merged.portfolioLimits.maxSectorConcentrationPct = clamp(
    finite(merged.portfolioLimits.maxSectorConcentrationPct, 35),
    1,
    100,
  );
  merged.portfolioLimits.maxSmallCapExposurePct = clamp(
    finite(merged.portfolioLimits.maxSmallCapExposurePct, 20),
    0,
    100,
  );
  merged.portfolioLimits.minCashBufferPct = clamp(
    finite(merged.portfolioLimits.minCashBufferPct, 5),
    0,
    100,
  );
  merged.portfolioLimits.maxCorrelatedPositions = Math.round(
    clamp(finite(merged.portfolioLimits.maxCorrelatedPositions, 4), 1, 50),
  );
  merged.portfolioLimits.maxWeeklyNewPositions = Math.round(
    clamp(finite(merged.portfolioLimits.maxWeeklyNewPositions, 2), 0, 50),
  );
  merged.portfolioLimits.maxPortfolioDrawdownPct = clamp(
    finite(merged.portfolioLimits.maxPortfolioDrawdownPct, 15),
    1,
    100,
  );
  merged.preTradeRequirements.minResearchCompletenessScore = Math.round(
    clamp(
      finite(merged.preTradeRequirements.minResearchCompletenessScore, 70),
      0,
      100,
    ),
  );
  return merged;
}

function correlationClusters(
  holdings: Array<{ ticker: string; sector: string }>,
): GuardianPortfolioContext["correlatedClusters"] {
  const groups = new Map<string, string[]>();
  for (const holding of holdings) {
    const key = holding.sector || "Unclassified";
    const values = groups.get(key) ?? [];
    values.push(holding.ticker);
    groups.set(key, values);
  }
  return [...groups.entries()]
    .filter(([, tickers]) => tickers.length >= 2)
    .map(([label, tickers]) => ({ label, tickers, count: tickers.length }))
    .sort((a, b) => b.count - a.count);
}

class GuardianService {
  async getSettings(userId: string) {
    const [row] = await db
      .select()
      .from(guardrailSettingsTable)
      .where(eq(guardrailSettingsTable.userId, userId))
      .limit(1);
    return {
      settings: row?.settings ?? DEFAULT_GUARDIAN_SETTINGS,
      isDefault: !row,
    };
  }

  async updateSettings(
    userId: string,
    partial: Partial<GuardrailSettingsData>,
  ) {
    const current = await this.getSettings(userId);
    const settings = sanitizeSettings(partial, current.settings);
    await db
      .insert(guardrailSettingsTable)
      .values({ userId, settings, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: guardrailSettingsTable.userId,
        set: { settings, updatedAt: new Date() },
      });
    return { settings, isDefault: false };
  }

  private async buildPortfolioContext(
    userId: string,
  ): Promise<GuardianPortfolioContext> {
    const overview = await portfolioService.getOverview(userId);
    const snapshot = overview.snapshot;
    if (!snapshot) throw new Error("Portfolio snapshot is unavailable");
    const holdings = overview.holdings.map((holding) => ({
      ticker: holding.ticker,
      name: holding.name,
      sector: holding.sector,
      quantity: holding.quantity,
      averageCost: holding.averageCost,
      marketPrice: holding.marketPrice,
      marketValue: holding.marketValue,
      allocationPct: holding.allocationPct,
      unrealizedPnlPct: holding.unrealizedPnlPct,
    }));
    const transactions = await portfolioService.listTransactions(
      userId,
      overview.portfolio.id,
    );
    const weekStart = Date.now() - 7 * 86_400_000;
    const weeklyTrades = transactions.filter(
      (item) =>
        ["buy", "sell", "rights"].includes(item.type) &&
        new Date(item.tradeDate).getTime() >= weekStart,
    );
    const firstBuyByTicker = new Map<string, number>();
    for (const item of [...transactions].reverse()) {
      if (!item.ticker || !["buy", "rights"].includes(item.type)) continue;
      const time = new Date(item.tradeDate).getTime();
      if (!firstBuyByTicker.has(item.ticker)) firstBuyByTicker.set(item.ticker, time);
    }
    const weeklyNewPositions = [...firstBuyByTicker.values()].filter(
      (time) => time >= weekStart,
    ).length;
    const sectorAllocation = (
      (snapshot.sectorAllocation ?? []) as Array<{
        sector: string;
        value: number;
        allocationPct: number;
      }>
    ).map((item) => ({
      sector: item.sector,
      value: finite(item.value, 0),
      allocationPct:
        finite(item.allocationPct, NaN) ||
        (snapshot.totalValue > 0 ? (finite(item.value, 0) / snapshot.totalValue) * 100 : 0),
    }));
    return {
      portfolioId: overview.portfolio.id,
      totalValue: snapshot.totalValue,
      cashBalance: snapshot.cashBalance,
      cashBufferPct:
        snapshot.totalValue > 0
          ? (snapshot.cashBalance / snapshot.totalValue) * 100
          : 0,
      holdings,
      sectorAllocation,
      largestPositionPct: snapshot.largestPositionPct,
      topFiveConcentrationPct: snapshot.topFiveConcentrationPct,
      maxDrawdownPct: 0,
      weeklyNewPositions,
      weeklyPortfolioChanges: weeklyTrades.length,
      smallCapExposurePct: 0,
      correlatedClusters: correlationClusters(holdings),
      priceCoveragePct:
        holdings.length > 0
          ? (overview.priceCoverage.quoted / holdings.length) * 100
          : 0,
    };
  }

  private async buildResearchContexts(
    userId: string,
  ): Promise<GuardianResearchContext[]> {
    const rows = await researchService.listCompanies(userId, {
      holdingsOnly: true,
      archived: false,
    });
    return Promise.all(
      rows.map(async (row) => {
        if (!row.isCovered) {
          return {
            ticker: row.ticker,
            isCovered: false,
            completenessScore: 0,
            thesisStatus: "draft" as const,
            conviction: "watch" as const,
            targetPrice: null,
            bearPrice: null,
            maxAcceptableLossPct: null,
            investmentHorizon: null,
            invalidationCount: 0,
            riskCount: 0,
            sourceCount: 0,
            lastReviewedAt: null,
            isSmallCap: false,
          };
        }
        const workspace = await researchService.getWorkspace(userId, row.ticker);
        return {
          ticker: row.ticker,
          isCovered: true,
          completenessScore: workspace.completeness.score,
          thesisStatus: workspace.thesis?.status ?? "draft",
          conviction: workspace.thesis?.conviction ?? "watch",
          targetPrice: workspace.thesis?.targetPrice ?? null,
          bearPrice: workspace.thesis?.bearPrice ?? null,
          maxAcceptableLossPct:
            workspace.thesis?.maxAcceptableLossPct ?? null,
          investmentHorizon:
            workspace.thesis?.investmentHorizon ?? null,
          invalidationCount: workspace.invalidationTriggers.length,
          riskCount: workspace.risks.length,
          sourceCount: workspace.notes.filter(
            (note) => note.sourceUrl || note.sourceLabel,
          ).length,
          lastReviewedAt: workspace.thesis?.lastReviewedAt
            ? new Date(workspace.thesis.lastReviewedAt).toISOString()
            : null,
          isSmallCap:
            typeof workspace.company.marketCap === "number" &&
            workspace.company.marketCap > 0 &&
            workspace.company.marketCap < 20_000,
        };
      }),
    );
  }

  private async buildMarketContext(
    userId: string,
    ticker: string,
  ): Promise<GuardianMarketContext | null> {
    const [point] = await db
      .select()
      .from(marketDataPointsTable)
      .where(
        and(
          eq(marketDataPointsTable.userId, userId),
          eq(marketDataPointsTable.kind, "equity"),
          eq(marketDataPointsTable.symbol, ticker),
        ),
      )
      .orderBy(desc(marketDataPointsTable.asOf))
      .limit(1);
    const news = await db
      .select()
      .from(marketNewsTable)
      .where(
        and(
          eq(marketNewsTable.userId, userId),
          eq(marketNewsTable.ticker, ticker),
        ),
      )
      .orderBy(desc(marketNewsTable.publishedAt))
      .limit(20);
    if (!point && news.length === 0) return null;
    const highSeverityNewsCount = news.filter((item) => {
      const impact = String(item.metadata?.impact ?? "").toLowerCase();
      return impact === "high" || impact === "critical";
    }).length;
    const metadataChange5d = point?.metadata?.change5dPct;
    return {
      priceChange5dPct:
        typeof metadataChange5d === "number"
          ? metadataChange5d
          : point?.changePct ?? null,
      highSeverityNewsCount,
      negativeNewsCount: news.filter((item) => item.sentiment === "negative")
        .length,
      latestNewsAt: news[0]?.publishedAt?.toISOString() ?? null,
      priceAsOf: point?.asOf?.toISOString() ?? null,
    };
  }

  async getContext(userId: string, tickerValue?: string) {
    const [portfolio, research] = await Promise.all([
      this.buildPortfolioContext(userId),
      this.buildResearchContexts(userId),
    ]);
    const ticker = tickerValue ? normalizeTicker(tickerValue) : null;
    const holding = ticker
      ? portfolio.holdings.find((item) => item.ticker === ticker) ?? null
      : null;
    const companyResearch = ticker
      ? research.find((item) => item.ticker === ticker) ?? null
      : null;
    const market = ticker
      ? await this.buildMarketContext(userId, ticker)
      : null;
    return {
      generatedAt: new Date().toISOString(),
      portfolio,
      holding,
      research: companyResearch,
      market,
    };
  }

  async check(userId: string, proposalInput: GuardianProposal) {
    const proposal: GuardianProposal = {
      ...proposalInput,
      ticker: normalizeTicker(proposalInput.ticker),
      quantity: proposalInput.quantity ?? null,
      price: proposalInput.price ?? null,
      fees: proposalInput.fees ?? 0,
      citedSourceIds: proposalInput.citedSourceIds ?? [],
    };
    const [{ settings }, context] = await Promise.all([
      this.getSettings(userId),
      this.getContext(userId, proposal.ticker),
    ]);
    const result = runGuardianCheck({
      proposal,
      portfolio: context.portfolio,
      research: context.research,
      market: context.market,
      settings: settings as GuardianSettings,
    });
    const checkId = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    await db.transaction(async (tx) => {
      await tx.insert(guardianDecisionPacketsTable).values({
        userId,
        checkId,
        ticker: proposal.ticker,
        action: proposal.action,
        input: proposal as GuardianDecisionPacketInput,
        contextSnapshot:
          context as unknown as GuardianDecisionPacketContext,
        result:
          result as unknown as GuardianDecisionPacketResult,
        status:
          result.decision === "approve" ||
          result.decision === "approve_with_warnings"
            ? "approved"
            : "pending",
        expiresAt,
      });
      if (settings.guardianMode.requireAuditLog) {
        await tx.insert(guardrailAuditTable).values({
          userId,
          checkId,
          ticker: proposal.ticker,
          name: proposal.name ?? context.holding?.name ?? null,
          action: proposal.action,
          guardianDecision: result.decision,
          severity: result.severity,
          breachedRules: [
            ...result.hardRuleBreaches.map((item) => item.ruleName),
            ...result.softRuleWarnings.map((item) => item.ruleName),
          ],
          biasFlags: result.biasFlags
            .filter((item) => item.detected)
            .map((item) => item.bias),
          preTradeFailures: result.preTradeFailures.map((item) => item.field),
          researchCompletenessScore: result.researchCompletenessScore,
          isOverride: false,
          finalAction: "pending",
        });
      }
    });
    return { checkId, expiresAt: expiresAt.toISOString(), ...result };
  }

  async execute(
    userId: string,
    input: {
      checkId: string;
      userConfirmed: boolean;
      overrideRationale?: string | null;
    },
  ) {
    if (!input.userConfirmed) throw new Error("User confirmation is required");
    const [packet] = await db
      .select()
      .from(guardianDecisionPacketsTable)
      .where(
        and(
          eq(guardianDecisionPacketsTable.userId, userId),
          eq(guardianDecisionPacketsTable.checkId, input.checkId),
        ),
      )
      .limit(1);
    if (!packet) throw new Error("Guardian decision packet was not found");
    if (packet.expiresAt.getTime() < Date.now()) {
      await db
        .update(guardianDecisionPacketsTable)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(guardianDecisionPacketsTable.id, packet.id));
      throw new Error("Guardian decision packet has expired; run the check again");
    }
    const decision = String(packet.result.decision);
    if (decision === "require_evidence") {
      throw new Error("Required evidence must be completed before execution");
    }
    const isOverride = decision === "reject";
    if (isOverride) {
      const settings = await this.getSettings(userId);
      if (!settings.settings.guardianMode.allowOverrideWithRationale) {
        throw new Error("Overrides are disabled in Guardian settings");
      }
      if (!input.overrideRationale || input.overrideRationale.trim().length < 30) {
        throw new Error("A specific override rationale of at least 30 characters is required");
      }
    }
    await db.transaction(async (tx) => {
      await tx
        .update(guardianDecisionPacketsTable)
        .set({
          status: isOverride ? "overridden" : "executed",
          overrideRationale: input.overrideRationale?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(guardianDecisionPacketsTable.id, packet.id));
      await tx
        .update(guardrailAuditTable)
        .set({
          isOverride,
          overrideRationale: input.overrideRationale?.trim() || null,
          finalAction: isOverride ? "executed_override" : "executed",
        })
        .where(
          and(
            eq(guardrailAuditTable.userId, userId),
            eq(guardrailAuditTable.checkId, input.checkId),
          ),
        );
    });
    return {
      success: true,
      checkId: input.checkId,
      isOverride,
      message:
        "Guardian logged the decision. This does not place an order with a broker.",
    };
  }

  async cancel(userId: string, checkId: string) {
    const [packet] = await db
      .update(guardianDecisionPacketsTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(guardianDecisionPacketsTable.userId, userId),
          eq(guardianDecisionPacketsTable.checkId, checkId),
        ),
      )
      .returning();
    if (!packet) throw new Error("Guardian decision packet was not found");
    await db
      .update(guardrailAuditTable)
      .set({ finalAction: "cancelled" })
      .where(
        and(
          eq(guardrailAuditTable.userId, userId),
          eq(guardrailAuditTable.checkId, checkId),
        ),
      );
    return { success: true };
  }

  async listDecisionPackets(userId: string, limit = 100) {
    return db
      .select()
      .from(guardianDecisionPacketsTable)
      .where(eq(guardianDecisionPacketsTable.userId, userId))
      .orderBy(desc(guardianDecisionPacketsTable.createdAt))
      .limit(clamp(Math.round(limit), 1, 250));
  }

  async getHealth(userId: string, persist = true) {
    const [{ settings }, portfolio, research, highNews] = await Promise.all([
      this.getSettings(userId),
      this.buildPortfolioContext(userId),
      this.buildResearchContexts(userId),
      db
        .select()
        .from(marketNewsTable)
        .where(eq(marketNewsTable.userId, userId))
        .orderBy(desc(marketNewsTable.publishedAt))
        .limit(100),
    ]);
    const activeHighSeverityNews = highNews.filter((item) => {
      const impact = String(item.metadata?.impact ?? "").toLowerCase();
      return impact === "high" || impact === "critical";
    }).length;
    const result = calculateGuardianHealth({
      portfolio,
      research,
      settings: settings as GuardianSettings,
      activeHighSeverityNews,
    });
    if (persist) {
      await db.insert(guardianHealthSnapshotsTable).values({
        userId,
        score: result.score,
        band: result.band,
        components: result.components,
        topRisks: result.topRisks,
        dataQuality: result.dataQuality,
      });
    }
    return {
      ...result,
      portfolio: {
        totalValue: portfolio.totalValue,
        cashBalance: portfolio.cashBalance,
        cashBufferPct: portfolio.cashBufferPct,
        largestPositionPct: portfolio.largestPositionPct,
        topFiveConcentrationPct: portfolio.topFiveConcentrationPct,
        holdingsCount: portfolio.holdings.length,
        sectorAllocation: portfolio.sectorAllocation,
        weeklyNewPositions: portfolio.weeklyNewPositions,
        weeklyPortfolioChanges: portfolio.weeklyPortfolioChanges,
      },
    };
  }

  async getHealthHistory(userId: string, limit = 30) {
    return db
      .select()
      .from(guardianHealthSnapshotsTable)
      .where(eq(guardianHealthSnapshotsTable.userId, userId))
      .orderBy(desc(guardianHealthSnapshotsTable.createdAt))
      .limit(clamp(Math.round(limit), 1, 365));
  }

  async getAuditTrail(userId: string, limit = 100) {
    return db
      .select()
      .from(guardrailAuditTable)
      .where(eq(guardrailAuditTable.userId, userId))
      .orderBy(desc(guardrailAuditTable.createdAt))
      .limit(clamp(Math.round(limit), 1, 250));
  }
}

export const guardianService = new GuardianService();
