export type MarketDataKind =
  | "index"
  | "equity"
  | "fx"
  | "commodity"
  | "rate"
  | "macro"
  | "flow"
  | "sector";

export type MarketEventType =
  | "earnings"
  | "corporate_action"
  | "dividend"
  | "macro"
  | "regulatory"
  | "investor_event"
  | "other";

export type MarketImpact = "critical" | "high" | "medium" | "low";
export type MarketSentiment =
  | "positive"
  | "negative"
  | "neutral"
  | "mixed"
  | "unknown";

export interface MarketPointInput {
  kind: MarketDataKind;
  symbol: string;
  name: string;
  value: number;
  change?: number | null;
  changePct?: number | null;
  unit?: string | null;
  region?: string | null;
  source: string;
  sourceUrl?: string | null;
  asOf: string | Date;
  metadata?: Record<string, unknown>;
}

export interface MarketNewsInput {
  externalId?: string | null;
  ticker?: string | null;
  headline: string;
  summary?: string | null;
  source: string;
  sourceUrl?: string | null;
  publishedAt: string | Date;
  sentiment?: MarketSentiment;
  relevanceScore?: number;
  metadata?: Record<string, unknown>;
}

export interface MarketEventInput {
  externalId?: string | null;
  ticker?: string | null;
  companyName?: string | null;
  eventType: MarketEventType;
  title: string;
  description?: string | null;
  eventAt: string | Date;
  impact?: MarketImpact;
  source: string;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MarketImportPayload {
  points?: MarketPointInput[];
  news?: MarketNewsInput[];
  events?: MarketEventInput[];
  provider?: string;
  fetchedAt?: string | Date;
}

export interface NormalizedMarketPoint extends Omit<MarketPointInput, "asOf"> {
  symbol: string;
  source: string;
  asOf: Date;
  sourceUrl: string | null;
  unit: string | null;
  region: string | null;
  change: number | null;
  changePct: number | null;
  metadata: Record<string, unknown>;
}

export interface NormalizedMarketNews extends Omit<MarketNewsInput, "publishedAt"> {
  externalId: string;
  ticker: string | null;
  headline: string;
  summary: string | null;
  source: string;
  sourceUrl: string | null;
  publishedAt: Date;
  sentiment: MarketSentiment;
  relevanceScore: number;
  isPortfolioRelevant: boolean;
  metadata: Record<string, unknown>;
}

export interface NormalizedMarketEvent extends Omit<MarketEventInput, "eventAt"> {
  externalId: string;
  ticker: string | null;
  companyName: string | null;
  title: string;
  description: string | null;
  eventAt: Date;
  impact: MarketImpact;
  source: string;
  sourceUrl: string | null;
  isPortfolioRelevant: boolean;
  metadata: Record<string, unknown>;
}

export interface NormalizedMarketImport {
  provider: string;
  fetchedAt: Date;
  points: NormalizedMarketPoint[];
  news: NormalizedMarketNews[];
  events: NormalizedMarketEvent[];
  warnings: string[];
}

export interface BriefHolding {
  ticker: string;
  name: string;
  sector: string;
  quantity: number;
  marketValue: number;
  allocationPct: number;
  marketPrice: number;
  previousClose: number | null;
  dayChange: number;
  dayChangePct: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  priceSource: string;
}

export interface BriefPortfolioSnapshot {
  totalValue: number;
  cashBalance: number;
  totalPnl: number;
  totalReturnPct: number;
  largestPositionTicker: string | null;
  largestPositionPct: number;
  concentrationRisk: string;
  holdingsCount: number;
  riskFlags: string[];
}

export interface BriefResearchSignal {
  ticker: string;
  conviction: string;
  status: string;
  completenessScore: number;
  nextReviewAt: Date | null;
  targetPrice: number | null;
}

export interface BriefMarketPoint {
  id?: number;
  kind: MarketDataKind;
  symbol: string;
  name: string;
  value: number;
  change: number | null;
  changePct: number | null;
  unit: string | null;
  region: string | null;
  source: string;
  sourceUrl: string | null;
  asOf: Date;
}

export interface BriefNewsItem {
  id: number;
  ticker: string | null;
  headline: string;
  summary: string | null;
  source: string;
  sourceUrl: string | null;
  publishedAt: Date;
  sentiment: MarketSentiment;
  relevanceScore: number;
  isPortfolioRelevant: boolean;
}

export interface BriefEventItem {
  id: number;
  ticker: string | null;
  title: string;
  eventType: MarketEventType;
  description: string | null;
  eventAt: Date;
  impact: MarketImpact;
  source: string;
  sourceUrl: string | null;
  isPortfolioRelevant: boolean;
}

export interface BriefPreferences {
  timezone: string;
  staleMarketMinutes: number;
  staleNewsHours: number;
  includeGlobalMarkets: boolean;
  includeMacro: boolean;
  includePortfolioNews: boolean;
  includeUpcomingEvents: boolean;
}
