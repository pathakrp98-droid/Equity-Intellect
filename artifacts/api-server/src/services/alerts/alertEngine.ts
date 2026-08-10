export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertRuleType =
  | "price_above"
  | "price_below"
  | "day_change_above"
  | "day_change_below"
  | "thesis_status"
  | "thesis_review_due"
  | "invalidation_trigger"
  | "news_keyword"
  | "earnings_upcoming"
  | "corporate_action_upcoming"
  | "data_stale"
  | "provider_failure";

export interface AlertRuleEvaluationInput {
  id: number;
  name: string;
  ticker: string | null;
  ruleType: AlertRuleType;
  severity: AlertSeverity;
  threshold: number | null;
  textValue: string | null;
  lookaheadDays: number | null;
  cooldownMinutes: number;
  lastTriggeredAt: Date | null;
  config?: Record<string, unknown>;
}

export interface QuoteForAlert {
  ticker: string;
  price: number;
  changePct: number | null;
  previousClose: number | null;
  asOf: Date;
  source: string;
  sourceUrl?: string | null;
}

export interface NewsForAlert {
  id: number;
  ticker: string | null;
  headline: string;
  summary: string | null;
  sentiment: string;
  relevanceScore: number;
  publishedAt: Date;
  source: string;
  sourceUrl?: string | null;
}

export interface EventForAlert {
  id: number;
  ticker: string | null;
  eventType: string;
  title: string;
  description: string | null;
  eventAt: Date;
  source: string;
  sourceUrl?: string | null;
}

export interface ThesisForAlert {
  ticker: string;
  name: string;
  status: string;
  nextReviewAt: Date | null;
  targetPrice?: number | null;
}

export interface HoldingForSystemAlert {
  ticker: string;
  name: string;
  marketPrice: number;
  dayChangePct: number;
  allocationPct: number;
  priceSource: string;
  priceAsOf: Date | null;
}

export interface AlertCandidate {
  ruleId: number | null;
  ticker: string | null;
  alertType: AlertRuleType;
  severity: AlertSeverity;
  title: string;
  detail: string;
  source: string;
  sourceUrl: string | null;
  dedupeKey: string;
  triggeredAt: Date;
  metadata: Record<string, unknown>;
}

const severityRanks: Record<AlertSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function meetsSeverityThreshold(
  severity: AlertSeverity,
  threshold: AlertSeverity,
): boolean {
  return severityRanks[severity] >= severityRanks[threshold];
}

export function isRuleCoolingDown(
  rule: Pick<AlertRuleEvaluationInput, "cooldownMinutes" | "lastTriggeredAt">,
  now: Date,
): boolean {
  if (!rule.lastTriggeredAt) return false;
  const cooldownMs = Math.max(0, rule.cooldownMinutes) * 60_000;
  return now.getTime() - rule.lastTriggeredAt.getTime() < cooldownMs;
}

function dayBucket(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizedTicker(value: string | null | undefined): string | null {
  const ticker = value?.trim().toUpperCase();
  return ticker || null;
}

function includesText(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function evaluateRule(
  rule: AlertRuleEvaluationInput,
  context: {
    quotes: QuoteForAlert[];
    news: NewsForAlert[];
    events: EventForAlert[];
    theses: ThesisForAlert[];
    now: Date;
  },
): AlertCandidate[] {
  if (isRuleCoolingDown(rule, context.now)) return [];

  const ticker = normalizedTicker(rule.ticker);
  const quotes = ticker
    ? context.quotes.filter((quote) => quote.ticker === ticker)
    : context.quotes;
  const news = ticker
    ? context.news.filter((item) => item.ticker === ticker)
    : context.news;
  const events = ticker
    ? context.events.filter((event) => event.ticker === ticker)
    : context.events;
  const theses = ticker
    ? context.theses.filter((thesis) => thesis.ticker === ticker)
    : context.theses;

  switch (rule.ruleType) {
    case "price_above":
    case "price_below":
    case "day_change_above":
    case "day_change_below": {
      if (rule.threshold === null || !Number.isFinite(rule.threshold))
        return [];
      return quotes.flatMap((quote) => {
        const value = rule.ruleType.startsWith("day_change")
          ? quote.changePct
          : quote.price;
        if (value === null || !Number.isFinite(value)) return [];
        const isAbove = rule.ruleType.endsWith("above");
        const triggered = isAbove
          ? value >= rule.threshold!
          : value <= rule.threshold!;
        if (!triggered) return [];
        const metricLabel = rule.ruleType.startsWith("day_change")
          ? "daily change"
          : "price";
        const displayed = rule.ruleType.startsWith("day_change")
          ? `${value.toFixed(2)}%`
          : `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
        return [
          {
            ruleId: rule.id,
            ticker: quote.ticker,
            alertType: rule.ruleType,
            severity: rule.severity,
            title: `${quote.ticker} ${metricLabel} alert`,
            detail: `${quote.ticker} ${metricLabel} is ${displayed}, meeting the configured ${isAbove ? "above" : "below"} threshold of ${rule.threshold}.`,
            source: quote.source,
            sourceUrl: quote.sourceUrl ?? null,
            dedupeKey: `rule:${rule.id}:${quote.ticker}:${dayBucket(context.now)}`,
            triggeredAt: context.now,
            metadata: {
              observedValue: value,
              threshold: rule.threshold,
              quoteAsOf: quote.asOf.toISOString(),
            },
          },
        ];
      });
    }

    case "thesis_status": {
      const statuses = Array.isArray(rule.config?.thesisStatuses)
        ? (rule.config?.thesisStatuses as unknown[])
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.toLowerCase())
        : rule.textValue
          ? [rule.textValue.toLowerCase()]
          : ["weakening", "broken"];
      return theses.flatMap((thesis) => {
        if (!statuses.includes(thesis.status.toLowerCase())) return [];
        return [
          {
            ruleId: rule.id,
            ticker: thesis.ticker,
            alertType: rule.ruleType,
            severity: thesis.status === "broken" ? "critical" : rule.severity,
            title: `${thesis.ticker} thesis is ${thesis.status}`,
            detail: `${thesis.name} currently has thesis status “${thesis.status}”. Review the latest evidence before taking further portfolio action.`,
            source: "Research Engine",
            sourceUrl: null,
            dedupeKey: `rule:${rule.id}:${thesis.ticker}:${thesis.status}`,
            triggeredAt: context.now,
            metadata: { thesisStatus: thesis.status },
          },
        ];
      });
    }

    case "thesis_review_due": {
      const lookaheadDays = Math.max(0, rule.lookaheadDays ?? 0);
      const until = context.now.getTime() + lookaheadDays * 86_400_000;
      return theses.flatMap((thesis) => {
        if (!thesis.nextReviewAt || thesis.nextReviewAt.getTime() > until)
          return [];
        return [
          {
            ruleId: rule.id,
            ticker: thesis.ticker,
            alertType: rule.ruleType,
            severity: rule.severity,
            title: `${thesis.ticker} thesis review due`,
            detail: `${thesis.name} has a research review due on ${thesis.nextReviewAt.toLocaleDateString("en-IN")}.`,
            source: "Research Engine",
            sourceUrl: null,
            dedupeKey: `rule:${rule.id}:${thesis.ticker}:${dayBucket(thesis.nextReviewAt)}`,
            triggeredAt: context.now,
            metadata: { reviewAt: thesis.nextReviewAt.toISOString() },
          },
        ];
      });
    }

    case "news_keyword": {
      const keyword = (
        rule.textValue ?? String(rule.config?.keyword ?? "")
      ).trim();
      if (!keyword) return [];
      return news.flatMap((item) => {
        const body = `${item.headline} ${item.summary ?? ""}`;
        if (!includesText(body, keyword)) return [];
        return [
          {
            ruleId: rule.id,
            ticker: item.ticker,
            alertType: rule.ruleType,
            severity: rule.severity,
            title: item.headline,
            detail: item.summary ?? `News matched keyword “${keyword}”.`,
            source: item.source,
            sourceUrl: item.sourceUrl ?? null,
            dedupeKey: `rule:${rule.id}:news:${item.id}`,
            triggeredAt: context.now,
            metadata: {
              keyword,
              publishedAt: item.publishedAt.toISOString(),
              sentiment: item.sentiment,
              relevanceScore: item.relevanceScore,
            },
          },
        ];
      });
    }

    case "earnings_upcoming":
    case "corporate_action_upcoming": {
      const lookaheadDays = Math.max(1, rule.lookaheadDays ?? 7);
      const until = context.now.getTime() + lookaheadDays * 86_400_000;
      const targetTypes =
        rule.ruleType === "earnings_upcoming"
          ? new Set(["earnings"])
          : new Set(["corporate_action", "dividend"]);
      return events.flatMap((event) => {
        if (!targetTypes.has(event.eventType)) return [];
        if (
          event.eventAt.getTime() < context.now.getTime() ||
          event.eventAt.getTime() > until
        ) {
          return [];
        }
        return [
          {
            ruleId: rule.id,
            ticker: event.ticker,
            alertType: rule.ruleType,
            severity: rule.severity,
            title: event.title,
            detail:
              event.description ??
              `${event.eventType.replaceAll("_", " ")} scheduled for ${event.eventAt.toLocaleDateString("en-IN")}.`,
            source: event.source,
            sourceUrl: event.sourceUrl ?? null,
            dedupeKey: `rule:${rule.id}:event:${event.id}`,
            triggeredAt: context.now,
            metadata: {
              eventAt: event.eventAt.toISOString(),
              eventType: event.eventType,
            },
          },
        ];
      });
    }

    case "invalidation_trigger":
    case "data_stale":
    case "provider_failure":
      return [];
  }
}

export function makeSystemDedupeKey(
  type: AlertRuleType,
  entity: string,
  occurrence: string,
): string {
  return `system:${type}:${entity}:${occurrence}`;
}

export function evaluateSystemPortfolioAlerts(input: {
  holdings: HoldingForSystemAlert[];
  sectorAllocations?: Array<{ sector: string; allocationPct: number }>;
  theses: ThesisForAlert[];
  now: Date;
  largeMovePct?: number;
  concentrationPct?: number;
  sectorConcentrationPct?: number;
}): AlertCandidate[] {
  const largeMovePct = Math.max(0.1, input.largeMovePct ?? 5);
  const concentrationPct = Math.max(1, input.concentrationPct ?? 25);
  const sectorConcentrationPct = Math.max(
    1,
    input.sectorConcentrationPct ?? 35,
  );
  const thesesByTicker = new Map(
    input.theses.map((thesis) => [thesis.ticker.toUpperCase(), thesis]),
  );
  const date = dayBucket(input.now);
  const candidates: AlertCandidate[] = [];

  for (const holding of input.holdings) {
    const ticker = holding.ticker.toUpperCase();
    const thesis = thesesByTicker.get(ticker);
    const targetPrice = thesis?.targetPrice;
    if (
      typeof targetPrice === "number" &&
      targetPrice > 0 &&
      holding.marketPrice >= targetPrice
    ) {
      candidates.push({
        ruleId: null,
        ticker,
        alertType: "price_above",
        severity: "high",
        title: `${ticker} reached its research target`,
        detail: `${ticker} is at ₹${holding.marketPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}, at or above the saved research target of ₹${targetPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}. Review the thesis and valuation before acting.`,
        source: "Research Engine",
        sourceUrl: null,
        dedupeKey: makeSystemDedupeKey(
          "price_above",
          ticker,
          `research-target-${targetPrice}`,
        ),
        triggeredAt: input.now,
        metadata: {
          category: "target_price",
          observedValue: holding.marketPrice,
          targetPrice,
        },
      });
    }

    if (Math.abs(holding.dayChangePct) >= largeMovePct) {
      const positive = holding.dayChangePct > 0;
      const alertType = positive
        ? ("day_change_above" as const)
        : ("day_change_below" as const);
      candidates.push({
        ruleId: null,
        ticker,
        alertType,
        severity: Math.abs(holding.dayChangePct) >= 8 ? "high" : "medium",
        title: `${ticker} moved ${Math.abs(holding.dayChangePct).toFixed(2)}% today`,
        detail: `${holding.name} has a ${positive ? "positive" : "negative"} daily move above the ${largeMovePct.toFixed(1)}% monitoring threshold.`,
        source: "Portfolio Engine",
        sourceUrl: null,
        dedupeKey: makeSystemDedupeKey(alertType, ticker, date),
        triggeredAt: input.now,
        metadata: {
          category: "large_move",
          dayChangePct: holding.dayChangePct,
          threshold: largeMovePct,
          priceSource: holding.priceSource,
          priceAsOf: holding.priceAsOf?.toISOString() ?? null,
        },
      });
    }

    if (holding.allocationPct > concentrationPct) {
      candidates.push({
        ruleId: null,
        ticker,
        alertType: "price_above",
        severity:
          holding.allocationPct >= concentrationPct + 10 ? "high" : "medium",
        title: `${ticker} concentration exceeds ${concentrationPct}%`,
        detail: `${ticker} represents ${holding.allocationPct.toFixed(1)}% of portfolio value. Review position sizing in Guardian Mode.`,
        source: "Guardian Mode",
        sourceUrl: null,
        dedupeKey: makeSystemDedupeKey(
          "price_above",
          ticker,
          `concentration-${date}`,
        ),
        triggeredAt: input.now,
        metadata: {
          category: "concentration",
          allocationPct: holding.allocationPct,
          threshold: concentrationPct,
        },
      });
    }
  }

  for (const sector of input.sectorAllocations ?? []) {
    if (sector.allocationPct <= sectorConcentrationPct) continue;
    const sectorKey = sector.sector.trim().toUpperCase() || "UNCLASSIFIED";
    candidates.push({
      ruleId: null,
      ticker: null,
      alertType: "price_above",
      severity:
        sector.allocationPct >= sectorConcentrationPct + 10 ? "high" : "medium",
      title: `${sector.sector} sector concentration exceeds ${sectorConcentrationPct}%`,
      detail: `${sector.sector} represents ${sector.allocationPct.toFixed(1)}% of portfolio value. Review sector exposure in Guardian Mode.`,
      source: "Guardian Mode",
      sourceUrl: null,
      dedupeKey: makeSystemDedupeKey(
        "price_above",
        `sector-${sectorKey}`,
        `concentration-${date}`,
      ),
      triggeredAt: input.now,
      metadata: {
        category: "concentration",
        concentrationKind: "sector",
        sector: sector.sector,
        allocationPct: sector.allocationPct,
        threshold: sectorConcentrationPct,
      },
    });
  }

  return candidates;
}
