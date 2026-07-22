import { useQuery } from "@tanstack/react-query";

export type IntegrationModuleStatus =
  "ready" | "attention" | "blocked" | "optional";

export interface IntegrationModuleResult {
  key: string;
  name: string;
  status: IntegrationModuleStatus;
  score: number;
  maxScore: number;
  summary: string;
  metrics: Array<{ label: string; value: string | number }>;
  href: string;
}

export interface IntegrationHealth {
  checkedAt: string;
  databaseReady: boolean;
  readiness: {
    score: number;
    band: "ready" | "nearly_ready" | "setup_required";
    modules: IntegrationModuleResult[];
    blockers: string[];
    recommendations: string[];
  };
  environment: {
    environment: string;
    corsAllowListConfigured: boolean;
    openAiConfigured: boolean;
    configuredLiveDataProviders: string[];
    normalizedHttpProviderConfigured: boolean;
    alphaVantageConfigured: boolean;
    buildVersion: string;
  };
}

class IntegrationApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Keep status fallback.
    }
    throw new IntegrationApiError(message, response.status);
  }
  return (await response.json()) as T;
}

export function useIntegrationHealth() {
  return useQuery({
    queryKey: ["integration", "health"],
    queryFn: () => request<IntegrationHealth>("/api/integration/health"),
    staleTime: 60_000,
    retry: (attempt, error) =>
      !(error instanceof IntegrationApiError && error.status === 401) &&
      attempt < 2,
  });
}
