import type {
  BriefEventItem,
  BriefHolding,
  BriefMarketPoint,
  BriefNewsItem,
  BriefPortfolioSnapshot,
  BriefPreferences,
  BriefResearchSignal,
} from "./types";
import { isMarketPointStale, isNewsStale } from "./normalization";

export interface MorningBriefActionResult {
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

export interface MorningBriefRiskResult {
  id: string;
  severity: "high" | "medium" | "low";
  ticker?: string | null;
  title: string;
  detail: string;
  sourceIds: string[];
}

export interface MorningBriefResult {
  briefDate: string;
  title: string;
  headline: string;
  summary: string;
  marketPulse: {
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
  };
  portfolioPulse: {
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
  };
  priorityActions: MorningBriefActionResult[];
  upcomingEvents: Array<{
    id: number;
    ticker?: string | null;
    title: string;
    eventType: string;
    eventAt: string;
    impact: string;
    source: string;
  }>;
  risks: MorningBriefRiskResult[];
  dataQuality: {
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
  };
}

export interface BuildMorningBriefInput {
  now?: Date;
  providerConfigured: boolean;
  portfolio: BriefPortfolioSnapshot;
  holdings: BriefHolding[];
  researchSignals: BriefResearchSignal[];
  marketPoints: BriefMarketPoint[];
  news: BriefNewsItem[];
  events: BriefEventItem[];
  preferences: BriefPreferences;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${round(value, 2).toFixed(2)}%`;
}

function formatMoney(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 10_000_000) return `₹${round(value / 10_000_000, 2)} Cr`;
  if (absolute >= 100_000) return `₹${round(value / 100_000, 2)} L`;
  return `₹${round(value, 0).toLocaleString("en-IN")}`;
}

function localDateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayPnl(holdings: BriefHolding[]): number {
  return holdings.reduce(
    (sum, holding) => sum + holding.dayChange * holding.quantity,
    0,
  );
}

function getMarketTone(points: BriefMarketPoint[]): MorningBriefResult["marketPulse"]["tone"] {
  const changes = points
    .map((point) => point.changePct)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (changes.length === 0) return "unknown";
  const positive = changes.filter((change) => change > 0.15).length;
  const negative = changes.filter((change) => change < -0.15).length;
  if (positive > negative * 1.5) return "positive";
  if (negative > positive * 1.5) return "negative";
  if (positive > 0 && negative > 0) return "mixed";
  return "neutral";
}

function priorityRank(value: "high" | "medium" | "low"): number {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}

function eventRank(value: string): number {
  if (value === "critical") return 4;
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function newsSourceId(item: BriefNewsItem): string {
  return `NEWS-${item.id}`;
}

function eventSourceId(item: BriefEventItem): string {
  return `EVENT-${item.id}`;
}

function holdingSourceId(ticker: string): string {
  return `HOLDING-${ticker}`;
}

function researchSourceId(ticker: string): string {
  return `RESEARCH-${ticker}`;
}

export function buildMorningBrief(input: BuildMorningBriefInput): MorningBriefResult {
  const now = input.now ?? new Date();
  const briefDate = localDateKey(now, input.preferences.timezone);
  const portfolioTickers = new Set(input.holdings.map((holding) => holding.ticker));
  const marketPoints = input.marketPoints.filter((point) => {
    if (
      !input.preferences.includeGlobalMarkets &&
      point.kind === "index" &&
      point.region &&
      !/india/i.test(point.region)
    ) {
      return false;
    }
    if (
      !input.preferences.includeMacro &&
      (point.kind === "macro" || point.kind === "rate")
    ) {
      return false;
    }
    return true;
  });
  const portfolioNews = input.preferences.includePortfolioNews
    ? input.news.filter(
        (item) =>
          item.isPortfolioRelevant ||
          Boolean(item.ticker && portfolioTickers.has(item.ticker)),
      )
    : [];
  const upcomingCutoff = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const upcomingEvents = input.preferences.includeUpcomingEvents
    ? input.events
        .filter(
          (event) =>
            event.eventAt >= now &&
            event.eventAt <= upcomingCutoff &&
            (event.isPortfolioRelevant ||
              !event.ticker ||
              portfolioTickers.has(event.ticker)),
        )
        .sort(
          (left, right) =>
            eventRank(right.impact) - eventRank(left.impact) ||
            left.eventAt.getTime() - right.eventAt.getTime(),
        )
        .slice(0, 12)
    : [];

  const staleMarketPoints = marketPoints.filter((point) =>
    isMarketPointStale(point.asOf, input.preferences.staleMarketMinutes, now),
  );
  const staleNews = portfolioNews.filter((item) =>
    isNewsStale(item.publishedAt, input.preferences.staleNewsHours, now),
  );
  const recentPoints = marketPoints.filter(
    (point) => !isMarketPointStale(point.asOf, input.preferences.staleMarketMinutes, now),
  );
  const tone = getMarketTone(recentPoints);
  const sortedMarketMoves = [...marketPoints]
    .sort(
      (left, right) =>
        Math.abs(right.changePct ?? 0) - Math.abs(left.changePct ?? 0),
    )
    .slice(0, 8);

  const dailyPnl = dayPnl(input.holdings);
  const dailyBase = input.portfolio.totalValue - dailyPnl;
  const dailyPnlPct = dailyBase !== 0 ? (dailyPnl / dailyBase) * 100 : 0;
  const actions: MorningBriefActionResult[] = [];
  const risks: MorningBriefRiskResult[] = [];

  if (!input.providerConfigured) {
    actions.push({
      id: "connect-market-provider",
      priority: "high",
      title: "Connect or import a market-data feed",
      rationale:
        "No external market-intelligence provider is configured. The brief can use portfolio and saved research, but it cannot verify current market moves or news.",
      actionType: "verify_data",
      sourceIds: [],
    });
  }

  if (marketPoints.length === 0) {
    actions.push({
      id: "import-market-snapshot",
      priority: "high",
      title: "Import the latest market snapshot",
      rationale:
        "No market indicators are available, so overnight direction and macro context are unknown.",
      actionType: "verify_data",
      sourceIds: [],
    });
  } else if (staleMarketPoints.length > 0) {
    actions.push({
      id: "refresh-stale-market-data",
      priority: staleMarketPoints.length === marketPoints.length ? "high" : "medium",
      title: "Refresh stale market indicators",
      rationale: `${staleMarketPoints.length} of ${marketPoints.length} market indicators exceed the configured freshness threshold.`,
      actionType: "verify_data",
      sourceIds: staleMarketPoints.map((point) => `MARKET-${point.kind}-${point.symbol}`),
    });
  }

  if (input.portfolio.concentrationRisk === "high" || input.portfolio.largestPositionPct > 25) {
    risks.push({
      id: "portfolio-concentration",
      severity: "high",
      ticker: input.portfolio.largestPositionTicker,
      title: "High single-position concentration",
      detail: `${input.portfolio.largestPositionTicker ?? "The largest holding"} represents ${round(input.portfolio.largestPositionPct, 1)}% of portfolio value.`,
      sourceIds: input.portfolio.largestPositionTicker
        ? [holdingSourceId(input.portfolio.largestPositionTicker)]
        : [],
    });
    actions.push({
      id: "review-largest-position",
      priority: "high",
      ticker: input.portfolio.largestPositionTicker,
      title: "Review largest-position sizing",
      rationale: `The largest holding is ${round(input.portfolio.largestPositionPct, 1)}% of the portfolio, which creates material idiosyncratic risk.`,
      actionType: "rebalance",
      sourceIds: input.portfolio.largestPositionTicker
        ? [holdingSourceId(input.portfolio.largestPositionTicker)]
        : [],
    });
  }

  for (const flag of input.portfolio.riskFlags.slice(0, 5)) {
    risks.push({
      id: `portfolio-risk-${risks.length + 1}`,
      severity: /high|negative|below|exceed/i.test(flag) ? "high" : "medium",
      title: "Portfolio Engine risk flag",
      detail: flag,
      sourceIds: [],
    });
  }

  const negativeNews = portfolioNews
    .filter((item) => item.sentiment === "negative" || item.sentiment === "mixed")
    .sort(
      (left, right) =>
        right.relevanceScore - left.relevanceScore ||
        right.publishedAt.getTime() - left.publishedAt.getTime(),
    )
    .slice(0, 6);
  for (const item of negativeNews) {
    const ticker = item.ticker ?? null;
    risks.push({
      id: `news-risk-${item.id}`,
      severity: item.relevanceScore >= 0.9 ? "high" : "medium",
      ticker,
      title: item.headline,
      detail: item.summary ?? `Negative or mixed portfolio-relevant news from ${item.source}.`,
      sourceIds: [newsSourceId(item)],
    });
    actions.push({
      id: `review-news-${item.id}`,
      priority: item.relevanceScore >= 0.9 ? "high" : "medium",
      ticker,
      title: ticker ? `Review ${ticker} news impact` : "Review market news impact",
      rationale: item.headline,
      actionType: "review",
      sourceIds: [newsSourceId(item)],
    });
  }

  for (const signal of input.researchSignals) {
    const statusRisk = signal.status === "broken" || signal.status === "weakening";
    if (statusRisk) {
      risks.push({
        id: `thesis-${signal.ticker}`,
        severity: signal.status === "broken" ? "high" : "medium",
        ticker: signal.ticker,
        title: `Thesis status: ${signal.status}`,
        detail: `${signal.ticker} has a saved thesis status of ${signal.status} with ${signal.completenessScore}% research completeness.`,
        sourceIds: [researchSourceId(signal.ticker)],
      });
      actions.push({
        id: `thesis-review-${signal.ticker}`,
        priority: signal.status === "broken" ? "high" : "medium",
        ticker: signal.ticker,
        title: `Reassess ${signal.ticker} thesis`,
        rationale: `Saved thesis status is ${signal.status}. Confirm whether position sizing and exit conditions remain appropriate.`,
        actionType: "review",
        sourceIds: [researchSourceId(signal.ticker)],
      });
    }
    if (signal.completenessScore < 60) {
      actions.push({
        id: `research-gap-${signal.ticker}`,
        priority: signal.completenessScore < 35 ? "high" : "medium",
        ticker: signal.ticker,
        title: `Complete ${signal.ticker} research gaps`,
        rationale: `Research completeness is ${signal.completenessScore}%, below the decision-ready threshold.`,
        actionType: "research",
        sourceIds: [researchSourceId(signal.ticker)],
      });
    }
    if (signal.nextReviewAt && signal.nextReviewAt <= new Date(now.getTime() + 7 * 86_400_000)) {
      actions.push({
        id: `scheduled-review-${signal.ticker}`,
        priority: signal.nextReviewAt < now ? "high" : "medium",
        ticker: signal.ticker,
        title: `${signal.ticker} thesis review is due`,
        rationale: `Scheduled review date: ${signal.nextReviewAt.toISOString().slice(0, 10)}.`,
        actionType: "review",
        sourceIds: [researchSourceId(signal.ticker)],
      });
    }
  }

  for (const event of upcomingEvents.filter((item) => item.impact === "critical" || item.impact === "high")) {
    actions.push({
      id: `prepare-event-${event.id}`,
      priority: event.impact === "critical" ? "high" : "medium",
      ticker: event.ticker,
      title: `Prepare for ${event.title}`,
      rationale: `${event.eventType.replaceAll("_", " ")} scheduled for ${event.eventAt.toISOString().slice(0, 10)}.`,
      actionType: "monitor",
      sourceIds: [eventSourceId(event)],
    });
  }

  const priorityActions = uniqueById(actions)
    .sort(
      (left, right) =>
        priorityRank(right.priority) - priorityRank(left.priority),
    )
    .slice(0, 10);
  const sortedRisks = uniqueById(risks)
    .sort(
      (left, right) =>
        priorityRank(right.severity) - priorityRank(left.severity),
    )
    .slice(0, 10);

  const latestMarketAsOf = marketPoints.length
    ? new Date(Math.max(...marketPoints.map((point) => point.asOf.getTime()))).toISOString()
    : null;
  const latestNewsAt = portfolioNews.length
    ? new Date(Math.max(...portfolioNews.map((item) => item.publishedAt.getTime()))).toISOString()
    : null;
  const warnings: string[] = [];
  if (!input.providerConfigured) warnings.push("No external provider is configured.");
  if (marketPoints.length === 0) warnings.push("No market snapshot is available.");
  if (staleMarketPoints.length > 0) warnings.push(`${staleMarketPoints.length} market indicators are stale.`);
  if (staleNews.length > 0) warnings.push(`${staleNews.length} portfolio-news items are stale.`);
  if (input.holdings.some((holding) => holding.priceSource === "last_transaction")) {
    warnings.push("Some holdings use last-transaction prices instead of current quotes.");
  }

  const marketSummary =
    marketPoints.length === 0
      ? "Market direction is unknown because no snapshot has been imported or refreshed."
      : `${tone[0].toUpperCase()}${tone.slice(1)} market tone across ${marketPoints.length} tracked indicators; ${staleMarketPoints.length} indicator${staleMarketPoints.length === 1 ? " is" : "s are"} stale.`;
  const headlineParts = [
    dailyPnl === 0
      ? "Portfolio day move is unavailable or flat"
      : `Portfolio ${dailyPnl >= 0 ? "up" : "down"} ${formatMoney(Math.abs(dailyPnl))} (${formatPct(dailyPnlPct)})`,
    priorityActions.length > 0
      ? `${priorityActions.filter((action) => action.priority === "high").length} high-priority review${priorityActions.filter((action) => action.priority === "high").length === 1 ? "" : "s"}`
      : "no urgent actions",
  ];
  const summaryParts = [
    `Portfolio value is ${formatMoney(input.portfolio.totalValue)} with ${formatMoney(input.portfolio.cashBalance)} in cash.`,
    marketSummary,
    portfolioNews.length > 0
      ? `${portfolioNews.length} portfolio-relevant news item${portfolioNews.length === 1 ? "" : "s"} are in the current feed.`
      : "No portfolio-relevant news is available in the current feed.",
    upcomingEvents.length > 0
      ? `${upcomingEvents.length} relevant event${upcomingEvents.length === 1 ? " is" : "s are"} scheduled within 14 days.`
      : "No relevant events are scheduled within 14 days.",
  ];

  return {
    briefDate,
    title: `AlphaDesk Morning Brief — ${briefDate}`,
    headline: headlineParts.join(" · "),
    summary: summaryParts.join(" "),
    marketPulse: {
      tone,
      summary: marketSummary,
      keyMoves: sortedMarketMoves.map((point) => ({
        symbol: point.symbol,
        name: point.name,
        value: point.value,
        changePct: point.changePct,
        asOf: point.asOf.toISOString(),
        source: point.source,
      })),
    },
    portfolioPulse: {
      totalValue: input.portfolio.totalValue,
      cashBalance: input.portfolio.cashBalance,
      dailyPnl: round(dailyPnl),
      dailyPnlPct: round(dailyPnlPct),
      totalPnl: input.portfolio.totalPnl,
      totalReturnPct: input.portfolio.totalReturnPct,
      largestPositionTicker: input.portfolio.largestPositionTicker,
      largestPositionPct: input.portfolio.largestPositionPct,
      holdingsCount: input.portfolio.holdingsCount,
      concentrationRisk: input.portfolio.concentrationRisk,
    },
    priorityActions,
    upcomingEvents: upcomingEvents.map((event) => ({
      id: event.id,
      ticker: event.ticker,
      title: event.title,
      eventType: event.eventType,
      eventAt: event.eventAt.toISOString(),
      impact: event.impact,
      source: event.source,
    })),
    risks: sortedRisks,
    dataQuality: {
      generatedAt: now.toISOString(),
      marketPointCount: marketPoints.length,
      portfolioNewsCount: portfolioNews.length,
      upcomingEventCount: upcomingEvents.length,
      staleMarketPointCount: staleMarketPoints.length,
      staleNewsCount: staleNews.length,
      latestMarketAsOf,
      latestNewsAt,
      providerConfigured: input.providerConfigured,
      warnings,
    },
  };
}
