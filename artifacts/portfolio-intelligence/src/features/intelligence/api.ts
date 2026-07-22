import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type MarketDataKind =
  | "index"
  | "equity"
  | "fx"
  | "commodity"
  | "rate"
  | "macro"
  | "flow"
  | "sector";

export type MarketImpact = "critical" | "high" | "medium" | "low";
export type MarketSentiment =
  | "positive"
  | "negative"
  | "neutral"
  | "mixed"
  | "unknown";

export interface MarketDataPoint {
  id: number;
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
  asOf: string;
  receivedAt: string;
}

export interface MarketNewsItem {
  id: number;
  externalId: string;
  ticker: string | null;
  headline: string;
  summary: string | null;
  source: string;
  sourceUrl: string | null;
  publishedAt: string;
  sentiment: MarketSentiment;
  relevanceScore: number;
  isPortfolioRelevant: boolean;
}

export interface MarketCalendarEvent {
  id: number;
  externalId: string;
  ticker: string | null;
  companyName: string | null;
  eventType:
    | "earnings"
    | "corporate_action"
    | "dividend"
    | "macro"
    | "regulatory"
    | "investor_event"
    | "other";
  title: string;
  description: string | null;
  eventAt: string;
  impact: MarketImpact;
  source: string;
  sourceUrl: string | null;
  isPortfolioRelevant: boolean;
}

export interface MorningBriefAction {
  id: string;
  priority: "high" | "medium" | "low";
  ticker?: string | null;
  title: string;
  rationale: string;
  actionType: "review" | "research" | "monitor" | "rebalance" | "verify_data";
  sourceIds: string[];
}

export interface MorningBriefRisk {
  id: string;
  severity: "high" | "medium" | "low";
  ticker?: string | null;
  title: string;
  detail: string;
  sourceIds: string[];
}

export interface MorningBrief {
  id: number;
  briefDate: string;
  title: string;
  headline: string;
  summary: string;
  generatedAt: string;
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
  priorityActions: MorningBriefAction[];
  upcomingEvents: Array<{
    id: number;
    ticker?: string | null;
    title: string;
    eventType: string;
    eventAt: string;
    impact: string;
    source: string;
  }>;
  risks: MorningBriefRisk[];
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

export interface MarketPreferences {
  id: number;
  timezone: string;
  briefHour: number;
  includeGlobalMarkets: boolean;
  includeMacro: boolean;
  includePortfolioNews: boolean;
  includeUpcomingEvents: boolean;
  staleMarketMinutes: number;
  staleNewsHours: number;
  updatedAt: string;
}

export interface ProviderStatus {
  configured: boolean;
  provider: string;
  latestRun: null | {
    id: number;
    status: "running" | "success" | "partial" | "failed" | "skipped";
    startedAt: string;
    completedAt: string | null;
    recordsUpserted: number;
    error: string | null;
  };
  latestData: {
    marketAsOf: string | null;
    newsPublishedAt: string | null;
    calendarEventAt: string | null;
  };
  requiredEnvironment: {
    url: string;
    apiKey: string;
  };
  normalizedContract: string;
}

export interface MarketImportResult {
  provider: string;
  fetchedAt: string;
  points: number;
  news: number;
  events: number;
  equityPricesSynced: number;
  total: number;
  warnings: string[];
}

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Keep the HTTP fallback message.
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

const intelligenceKey = ["market-intelligence"] as const;

export function useLatestMorningBrief() {
  return useQuery({
    queryKey: [...intelligenceKey, "brief", "latest"],
    queryFn: () =>
      apiRequest<MorningBrief | null>("/api/intelligence/brief/latest"),
    retry: (attempt, error) =>
      !(error instanceof ApiError && error.status === 401) && attempt < 2,
  });
}

export function useMorningBriefHistory(limit = 30) {
  return useQuery({
    queryKey: [...intelligenceKey, "brief", "history", limit],
    queryFn: () =>
      apiRequest<MorningBrief[]>(`/api/intelligence/brief/history?limit=${limit}`),
  });
}

export function useGenerateMorningBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<MorningBrief>("/api/intelligence/brief/generate", {
        method: "POST",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: intelligenceKey });
    },
  });
}

export function useMarketSnapshot() {
  return useQuery({
    queryKey: [...intelligenceKey, "snapshot"],
    queryFn: () => apiRequest<MarketDataPoint[]>("/api/intelligence/snapshot"),
  });
}

export function useMarketNews(portfolioOnly = true, days = 7, limit = 50) {
  return useQuery({
    queryKey: [...intelligenceKey, "news", portfolioOnly, days, limit],
    queryFn: () =>
      apiRequest<MarketNewsItem[]>(
        `/api/intelligence/news?portfolioOnly=${portfolioOnly}&days=${days}&limit=${limit}`,
      ),
  });
}

export function useMarketCalendar(portfolioOnly = true, days = 30) {
  return useQuery({
    queryKey: [...intelligenceKey, "calendar", portfolioOnly, days],
    queryFn: () =>
      apiRequest<MarketCalendarEvent[]>(
        `/api/intelligence/calendar?portfolioOnly=${portfolioOnly}&days=${days}`,
      ),
  });
}

export function useMarketPreferences() {
  return useQuery({
    queryKey: [...intelligenceKey, "preferences"],
    queryFn: () =>
      apiRequest<MarketPreferences>("/api/intelligence/preferences"),
  });
}

export function useUpdateMarketPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<MarketPreferences>) =>
      apiRequest<MarketPreferences>("/api/intelligence/preferences", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: intelligenceKey });
    },
  });
}

export function useProviderStatus() {
  return useQuery({
    queryKey: [...intelligenceKey, "provider-status"],
    queryFn: () =>
      apiRequest<ProviderStatus>("/api/intelligence/providers/status"),
  });
}

export function useRefreshMarketIntelligence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<Record<string, unknown>>("/api/intelligence/refresh", {
        method: "POST",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: intelligenceKey });
    },
  });
}

export function useImportMarketIntelligence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest<MarketImportResult>("/api/intelligence/import", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: intelligenceKey });
    },
  });
}
