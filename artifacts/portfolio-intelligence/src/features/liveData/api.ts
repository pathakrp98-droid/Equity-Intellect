import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface LiveDataPreferences {
  id: number;
  providerPriority: string[];
  autoSyncPortfolio: boolean;
  autoEvaluateAlerts: boolean;
  quoteTtlMinutes: number;
  newsTtlMinutes: number;
  calendarTtlMinutes: number;
  staleIfErrorMinutes: number;
  maxSymbolsPerRefresh: number;
  updatedAt: string;
}

export interface SymbolMapping {
  id: number;
  ticker: string;
  exchange: string;
  provider: string;
  providerSymbol: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderRun {
  id: number;
  provider: string;
  status: "running" | "success" | "partial" | "failed" | "skipped";
  startedAt: string;
  completedAt: string | null;
  recordsUpserted: number;
  error: string | null;
  metadata: Record<string, unknown>;
}

export interface LiveDataStatus {
  providers: Array<{
    name: string;
    configured: boolean;
    capabilities: {
      quotes: boolean;
      news: boolean;
      calendar: boolean;
      corporateActions: boolean;
      snapshot: boolean;
    };
    configurationHint: string;
  }>;
  preferences: LiveDataPreferences;
  mappings: SymbolMapping[];
  latestRuns: ProviderRun[];
  latestData: {
    quoteAsOf: string | null;
    newsPublishedAt: string | null;
    calendarEventAt: string | null;
  };
  cache: {
    entries: number;
    fresh: number;
    staleFallback: number;
    expired: number;
  };
  secretsStoredInDatabase: boolean;
}

export interface LiveDataRefreshResult {
  refreshedAt: string;
  configuredProviderCount: number;
  diagnostics: Array<{
    provider: string;
    capability: string;
    status: "success" | "cached" | "stale_fallback" | "failed" | "skipped";
    records: number;
    message?: string;
    cacheAgeMinutes?: number;
  }>;
  satisfiedCapabilities: {
    quotes: boolean;
    news: boolean;
    calendar: boolean;
    corporateActions: boolean;
  };
  alertEvaluation: null | {
    alertsUpserted: number;
    candidates: number;
  };
}

class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
      // Keep fallback.
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

const key = ["live-data"] as const;

export function useLiveDataStatus() {
  return useQuery({
    queryKey: [...key, "status"],
    queryFn: () => request<LiveDataStatus>("/api/live-data/status"),
  });
}

export function useLiveDataPreferences() {
  return useQuery({
    queryKey: [...key, "preferences"],
    queryFn: () => request<LiveDataPreferences>("/api/live-data/preferences"),
  });
}

export function useUpdateLiveDataPreferences() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<LiveDataPreferences>) =>
      request<LiveDataPreferences>("/api/live-data/preferences", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useSymbolMappings() {
  return useQuery({
    queryKey: [...key, "mappings"],
    queryFn: () => request<SymbolMapping[]>("/api/live-data/mappings"),
  });
}

export function useUpsertSymbolMapping() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      ticker: string;
      exchange?: string;
      provider: string;
      providerSymbol: string;
      isEnabled?: boolean;
    }) =>
      request<SymbolMapping>("/api/live-data/mappings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteSymbolMapping() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      request<SymbolMapping>(`/api/live-data/mappings/${id}`, {
        method: "DELETE",
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useRefreshLiveData() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (force = false) =>
      request<LiveDataRefreshResult>("/api/live-data/refresh", {
        method: "POST",
        body: JSON.stringify({ force }),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ["market-intelligence"] }),
        client.invalidateQueries({ queryKey: ["portfolio"] }),
        client.invalidateQueries({ queryKey: ["alerts"] }),
      ]);
    },
  });
}

export function usePurgeLiveDataCache() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request<{ deleted: number }>("/api/live-data/cache/purge", {
        method: "POST",
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}
