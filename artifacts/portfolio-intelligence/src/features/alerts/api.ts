import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

export interface InvestmentAlert {
  id: number;
  ruleId: number | null;
  ticker: string | null;
  alertType: AlertRuleType;
  severity: AlertSeverity;
  title: string;
  detail: string;
  source: string;
  sourceUrl: string | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
  dismissedAt: string | null;
  resolvedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface AlertRule {
  id: number;
  name: string;
  ticker: string | null;
  ruleType: AlertRuleType;
  severity: AlertSeverity;
  threshold: number | null;
  textValue: string | null;
  lookaheadDays: number | null;
  cooldownMinutes: number;
  isEnabled: boolean;
  config: Record<string, unknown>;
  lastEvaluatedAt: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertPreferences {
  id: number;
  severityThreshold: AlertSeverity;
  portfolioOnly: boolean;
  enablePriceAlerts: boolean;
  enableThesisAlerts: boolean;
  enableNewsAlerts: boolean;
  enableCalendarAlerts: boolean;
  enableDataQualityAlerts: boolean;
  enableProviderFailureAlerts: boolean;
  inAppNotifications: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  updatedAt: string;
}

export interface CreateAlertRuleInput {
  name: string;
  ticker?: string | null;
  ruleType: AlertRuleType;
  severity?: AlertSeverity;
  threshold?: number | null;
  textValue?: string | null;
  lookaheadDays?: number | null;
  cooldownMinutes?: number;
  isEnabled?: boolean;
  config?: Record<string, unknown>;
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
    throw new Error(message);
  }
  return (await response.json()) as T;
}

const key = ["alerts"] as const;

export function useInvestmentAlerts(
  status: "active" | "acknowledged" | "dismissed" | "resolved" | "all" = "active",
) {
  return useQuery({
    queryKey: [...key, "list", status],
    queryFn: () =>
      request<InvestmentAlert[]>(`/api/alerts?status=${status}&limit=300`),
  });
}

export function useAlertSummary() {
  return useQuery({
    queryKey: [...key, "summary"],
    queryFn: () =>
      request<{
        active: number;
        critical: number;
        high: number;
        acknowledged: number;
        enabledRules: number;
        latestTriggeredAt: string | null;
      }>("/api/alerts/summary"),
  });
}

export function useAlertRules() {
  return useQuery({
    queryKey: [...key, "rules"],
    queryFn: () => request<AlertRule[]>("/api/alerts/rules"),
  });
}

export function useCreateAlertRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAlertRuleInput) =>
      request<AlertRule>("/api/alerts/rules", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useUpdateAlertRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateAlertRuleInput> }) =>
      request<AlertRule>(`/api/alerts/rules/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteAlertRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      request<AlertRule>(`/api/alerts/rules/${id}`, { method: "DELETE" }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useAlertPreferences() {
  return useQuery({
    queryKey: [...key, "preferences"],
    queryFn: () => request<AlertPreferences>("/api/alerts/settings"),
  });
}

export function useUpdateAlertPreferences() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AlertPreferences>) =>
      request<AlertPreferences>("/api/alerts/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useEvaluateAlerts() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request<{ alertsUpserted: number; candidates: number }>(
        "/api/alerts/evaluate",
        { method: "POST" },
      ),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

function stateMutation(path: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      request<InvestmentAlert>(`/api/alerts/${id}/${path}`, {
        method: "POST",
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useAcknowledgeAlert() {
  return stateMutation("acknowledge");
}

export function useDismissInvestmentAlert() {
  return stateMutation("dismiss");
}

export function useReopenInvestmentAlert() {
  return stateMutation("reopen");
}

export function useResolveInvestmentAlert() {
  return stateMutation("resolve");
}
