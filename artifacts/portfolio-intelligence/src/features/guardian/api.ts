import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type GuardianDecision =
  | "approve"
  | "approve_with_warnings"
  | "require_evidence"
  | "reject";
export type GuardianSeverity = "low" | "medium" | "high" | "critical";

export interface GuardianSettings {
  portfolioLimits: {
    maxStockConcentrationPct: number;
    maxSectorConcentrationPct: number;
    maxSmallCapExposurePct: number;
    minCashBufferPct: number;
    maxCorrelatedPositions: number;
    maxWeeklyNewPositions: number;
    maxPortfolioDrawdownPct: number;
  };
  preTradeRequirements: {
    requireRationale: boolean;
    requireInvestmentHorizon: boolean;
    requireBearCase: boolean;
    requireTargetPrice: boolean;
    requireThesisInvalidation: boolean;
    requireMaxAcceptableLoss: boolean;
    requireExitConditions: boolean;
    minResearchCompletenessScore: number;
  };
  biasChecks: Record<string, boolean>;
  stressTests: Record<string, boolean>;
  guardianMode: {
    enabled: boolean;
    allowOverrideWithRationale: boolean;
    requireAuditLog: boolean;
  };
}

export interface GuardianRuleResult {
  ruleId: string;
  ruleName: string;
  currentValue?: number | null;
  projectedValue?: number | null;
  threshold?: number | null;
  message: string;
  severity: "blocking" | "warning";
}

export interface GuardianBiasFlag {
  bias: string;
  detected: boolean;
  description: string;
  severity: "warning" | "info";
}

export interface GuardianStressResult {
  scenario: string;
  portfolioImpactPct: number;
  portfolioImpactAmount: number;
  positionImpactPct: number;
  positionImpactAmount: number;
  severity: GuardianSeverity;
  methodology: string;
}

export interface GuardianCheckResponse {
  checkId: string;
  expiresAt: string;
  decision: GuardianDecision;
  severity: GuardianSeverity;
  summary: string;
  hardRuleBreaches: GuardianRuleResult[];
  softRuleWarnings: GuardianRuleResult[];
  preTradeFailures: Array<{ field: string; message: string }>;
  biasFlags: GuardianBiasFlag[];
  stressTestResults: GuardianStressResult[];
  passedChecks: string[];
  researchCompletenessScore: number;
  projected: {
    tradeNotional: number;
    cashBalance: number;
    cashBufferPct: number;
    stockAllocationPct: number;
    sectorAllocationPct: number;
    quantity: number;
  };
  requiresOverride: boolean;
  canOverride: boolean;
}

export interface GuardianProposalInput {
  action: "buy" | "add" | "sell" | "trim" | "exit" | "hold" | "review";
  ticker: string;
  name?: string;
  quantity?: number | null;
  price?: number | null;
  fees?: number | null;
  rationale?: string;
  investmentHorizon?: string;
  bearCase?: string;
  targetPrice?: number | null;
  thesisInvalidation?: string;
  maxAcceptableLossPct?: number | null;
  exitConditions?: string;
  evidenceQuality?: "high" | "medium" | "low";
  citedSourceIds?: string[];
}


export interface GuardianHoldingContext {
  ticker: string;
  name: string;
  sector: string;
  quantity: number;
  averageCost: number;
  marketPrice: number;
  marketValue: number;
  allocationPct: number;
  unrealizedPnlPct: number;
}

export interface GuardianHealth {
  score: number;
  band: "healthy" | "watch" | "caution" | "high_risk" | "critical";
  components: Array<{
    key: string;
    name: string;
    score: number;
    maxScore: number;
    status: "ok" | "warning" | "breach";
    description: string;
  }>;
  topRisks: string[];
  dataQuality: {
    priceCoveragePct: number;
    researchCoveragePct: number;
    generatedAt: string;
  };
  portfolio: {
    totalValue: number;
    cashBalance: number;
    cashBufferPct: number;
    largestPositionPct: number;
    topFiveConcentrationPct: number;
    holdingsCount: number;
    sectorAllocation: Array<{
      sector: string;
      value: number;
      allocationPct: number;
    }>;
    weeklyNewPositions: number;
    weeklyPortfolioChanges: number;
  };
}

export interface GuardianContext {
  generatedAt: string;
  portfolio: {
    totalValue: number;
    cashBalance: number;
    cashBufferPct: number;
    holdings: GuardianHoldingContext[];
    sectorAllocation: Array<{
      sector: string;
      value: number;
      allocationPct: number;
    }>;
    weeklyNewPositions: number;
    weeklyPortfolioChanges: number;
  };
  holding: GuardianHoldingContext | null;
  research: null | {
    ticker: string;
    isCovered: boolean;
    completenessScore: number;
    thesisStatus: string;
    conviction: string;
    targetPrice: number | null;
    bearPrice: number | null;
    maxAcceptableLossPct: number | null;
    investmentHorizon: string | null;
    invalidationCount: number;
    riskCount: number;
    sourceCount: number;
    lastReviewedAt: string | null;
  };
  market: null | {
    priceChange5dPct: number | null;
    highSeverityNewsCount: number;
    negativeNewsCount: number;
    latestNewsAt: string | null;
    priceAsOf: string | null;
  };
}

export interface GuardianPacket {
  id: number;
  checkId: string;
  ticker: string;
  action: string;
  input: GuardianProposalInput;
  contextSnapshot: GuardianContext;
  result: Omit<GuardianCheckResponse, "checkId" | "expiresAt">;
  status: string;
  overrideRationale: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
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
      // Preserve the HTTP fallback message.
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

const key = ["guardian"] as const;

export function useGuardianHealth() {
  return useQuery({
    queryKey: [...key, "health"],
    queryFn: () => request<GuardianHealth>("/api/guardrails/portfolio-health"),
  });
}

export function useGuardianContext(ticker?: string) {
  return useQuery({
    queryKey: [...key, "context", ticker ?? "portfolio"],
    queryFn: () =>
      request<GuardianContext>(
        `/api/guardrails/context${ticker ? `?ticker=${encodeURIComponent(ticker)}` : ""}`,
      ),
  });
}

export function useGuardianSettings() {
  return useQuery({
    queryKey: [...key, "settings"],
    queryFn: () =>
      request<{ settings: GuardianSettings; isDefault: boolean }>(
        "/api/guardrails/settings",
      ),
  });
}

export function useUpdateGuardianSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<GuardianSettings>) =>
      request<{ settings: GuardianSettings; isDefault: boolean }>(
        "/api/guardrails/settings",
        { method: "PUT", body: JSON.stringify(settings) },
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: key });
    },
  });
}

export function useGuardianCheck() {
  return useMutation({
    mutationFn: (input: GuardianProposalInput) =>
      request<GuardianCheckResponse>("/api/guardrails/check", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export function useExecuteGuardianDecision() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      checkId: string;
      userConfirmed: boolean;
      overrideRationale?: string;
    }) =>
      request<{
        success: boolean;
        checkId: string;
        isOverride: boolean;
        message: string;
      }>("/api/guardrails/execute", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: key });
    },
  });
}

export function useCancelGuardianDecision() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (checkId: string) =>
      request<{ success: boolean }>("/api/guardrails/cancel", {
        method: "POST",
        body: JSON.stringify({ checkId }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: key });
    },
  });
}

export function useGuardianPackets(limit = 100) {
  return useQuery({
    queryKey: [...key, "packets", limit],
    queryFn: () =>
      request<{ entries: GuardianPacket[]; isDemo: false }>(
        `/api/guardrails/decision-packets?limit=${limit}`,
      ),
  });
}

export function useGuardianAudit(limit = 100) {
  return useQuery({
    queryKey: [...key, "audit", limit],
    queryFn: () =>
      request<{
        entries: Array<{
          id: number;
          checkId: string | null;
          ticker: string;
          name: string | null;
          action: string;
          guardianDecision: string;
          severity: string | null;
          breachedRules?: string[];
          biasFlags?: string[];
          preTradeFailures?: string[];
          researchCompletenessScore?: number;
          isOverride: boolean;
          overrideRationale: string | null;
          finalAction: string | null;
          createdAt: string;
        }>;
        isDemo: false;
      }>(`/api/guardrails/audit-trail?limit=${limit}`),
  });
}
