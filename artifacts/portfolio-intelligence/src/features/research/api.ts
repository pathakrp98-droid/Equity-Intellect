import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type ResearchConviction = "high" | "medium" | "low" | "watch";
export type ThesisStatus =
  "draft" | "intact" | "monitoring" | "weakening" | "broken" | "closed";
export type ResearchImpact = "high" | "medium" | "low";
export type ResearchProbability = "high" | "medium" | "low";
export type ResearchItemStatus =
  "active" | "monitoring" | "triggered" | "resolved" | "archived";
export type ResearchScenario = "common" | "bull" | "base" | "bear";
export type ResearchNoteCategory =
  | "thesis"
  | "financials"
  | "valuation"
  | "management"
  | "industry"
  | "earnings"
  | "risk"
  | "catalyst"
  | "general";

export interface ResearchCompanySummary {
  id: number | null;
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string | null;
  currentPrice: number | null;
  previousClose: number | null;
  marketCap: number | null;
  pe: number | null;
  conviction: ResearchConviction;
  thesisStatus: ThesisStatus;
  completenessScore: number;
  completenessBand: string;
  lastUpdated: string | null;
  isHolding: boolean;
  isCovered: boolean;
  quantity: number;
  marketValue: number;
  allocationPct: number;
  isArchived: boolean;
}

export interface ResearchCompany {
  id: number;
  userId: string;
  ticker: string;
  name: string;
  exchange: string;
  sector: string | null;
  industry: string | null;
  description: string | null;
  website: string | null;
  marketCap: number | null;
  currentPrice: number | null;
  previousClose: number | null;
  pe: number | null;
  dataSource: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HoldingContext {
  portfolioId: number;
  portfolioName: string;
  ticker: string;
  name: string | null;
  exchange: string;
  sector: string | null;
  quantity: number;
  averageCost: number;
  marketPrice: number;
  previousClose: number | null;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  allocationPct: number;
}

export interface InvestmentThesis {
  id: number;
  companyId: number;
  summary: string | null;
  bullCase: string | null;
  baseCase: string | null;
  bearCase: string | null;
  conviction: ResearchConviction;
  status: ThesisStatus;
  moatRating: string | null;
  managementRating: string | null;
  investmentHorizon: string | null;
  expectedReturnPct: number | null;
  maxAcceptableLossPct: number | null;
  targetPrice: number | null;
  bullPrice: number | null;
  basePrice: number | null;
  bearPrice: number | null;
  valuationMethodology: string | null;
  keyAssumptions: string[];
  version: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchNote {
  id: number;
  companyId: number;
  title: string;
  category: ResearchNoteCategory;
  content: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  eventDate: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchCatalyst {
  id: number;
  companyId: number;
  title: string;
  description: string | null;
  expectedDate: string | null;
  impact: ResearchImpact;
  probability: ResearchProbability;
  status: ResearchItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchRisk {
  id: number;
  companyId: number;
  title: string;
  description: string | null;
  severity: ResearchImpact;
  probability: ResearchProbability;
  mitigation: string | null;
  status: ResearchItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchInvalidationTrigger {
  id: number;
  companyId: number;
  trigger: string;
  description: string | null;
  severity: ResearchImpact;
  metricName: string | null;
  operator: string | null;
  threshold: number | null;
  unit: string | null;
  currentValue: number | null;
  status: ResearchItemStatus;
  triggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchValuationAssumption {
  id: number;
  companyId: number;
  label: string;
  value: string;
  unit: string | null;
  scenario: ResearchScenario;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompletenessResult {
  score: number;
  band: "empty" | "early" | "developing" | "decision_ready" | "complete";
  sections: Array<{
    key: string;
    label: string;
    score: number;
    maxScore: number;
    complete: boolean;
  }>;
  missing: string[];
}

export interface ResearchWorkspace {
  company: ResearchCompany;
  holding: HoldingContext | null;
  thesis: InvestmentThesis | null;
  notes: ResearchNote[];
  catalysts: ResearchCatalyst[];
  risks: ResearchRisk[];
  invalidationTriggers: ResearchInvalidationTrigger[];
  valuationAssumptions: ResearchValuationAssumption[];
  completeness: CompletenessResult;
}

export interface CompanyInput {
  ticker: string;
  name?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  description?: string;
  website?: string;
  marketCap?: number | null;
  currentPrice?: number | null;
  previousClose?: number | null;
  pe?: number | null;
}

export interface ThesisInput {
  summary?: string | null;
  bullCase?: string | null;
  baseCase?: string | null;
  bearCase?: string | null;
  conviction?: ResearchConviction;
  status?: ThesisStatus;
  moatRating?: string | null;
  managementRating?: string | null;
  investmentHorizon?: string | null;
  expectedReturnPct?: number | null;
  maxAcceptableLossPct?: number | null;
  targetPrice?: number | null;
  bullPrice?: number | null;
  basePrice?: number | null;
  bearPrice?: number | null;
  valuationMethodology?: string | null;
  keyAssumptions?: string[];
  lastReviewedAt?: string | null;
  nextReviewAt?: string | null;
}

export interface NoteInput {
  title: string;
  category?: ResearchNoteCategory;
  content: string;
  sourceLabel?: string;
  sourceUrl?: string;
  eventDate?: string | null;
  isPinned?: boolean;
}

export interface CatalystInput {
  title: string;
  description?: string;
  expectedDate?: string | null;
  impact?: ResearchImpact;
  probability?: ResearchProbability;
  status?: ResearchItemStatus;
}

export interface RiskInput {
  title: string;
  description?: string;
  severity?: ResearchImpact;
  probability?: ResearchProbability;
  mitigation?: string;
  status?: ResearchItemStatus;
}

export interface InvalidationInput {
  trigger: string;
  description?: string;
  severity?: ResearchImpact;
  metricName?: string;
  operator?: string;
  threshold?: number | null;
  unit?: string;
  currentValue?: number | null;
  status?: ResearchItemStatus;
  triggeredAt?: string | null;
}

export interface ValuationAssumptionInput {
  label: string;
  value: string;
  unit?: string;
  scenario?: ResearchScenario;
  notes?: string;
  sortOrder?: number;
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
      // Keep the HTTP fallback when a proxy returns non-JSON content.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const researchKey = ["research-engine"] as const;
const workspaceKey = (ticker: string) =>
  ["research-engine", "workspace", ticker] as const;

function useRefreshResearch(ticker?: string) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: researchKey }),
      ...(ticker
        ? [queryClient.invalidateQueries({ queryKey: workspaceKey(ticker) })]
        : []),
      queryClient.invalidateQueries({ queryKey: ["portfolio-engine"] }),
      queryClient.invalidateQueries({ queryKey: ["getHoldings"] }),
    ]);
  };
}

export function useResearchCompanies(query = "") {
  return useQuery({
    queryKey: [...researchKey, "companies", query],
    queryFn: () =>
      apiRequest<ResearchCompanySummary[]>(
        `/api/research/companies${query ? `?query=${encodeURIComponent(query)}` : ""}`,
      ),
    retry: (attempt, error) =>
      !(error instanceof ApiError && error.status === 401) && attempt < 2,
  });
}

export function useResearchWorkspace(ticker: string | null) {
  return useQuery({
    queryKey: workspaceKey(ticker ?? ""),
    queryFn: () =>
      apiRequest<ResearchWorkspace>(
        `/api/research/companies/${encodeURIComponent(ticker ?? "")}`,
      ),
    enabled: Boolean(ticker),
  });
}

export function useCreateResearchCompany() {
  const refresh = useRefreshResearch();
  return useMutation({
    mutationFn: (payload: CompanyInput) =>
      apiRequest<ResearchWorkspace>("/api/research/companies", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: refresh,
  });
}

export function useUpdateResearchCompany(ticker: string) {
  const refresh = useRefreshResearch(ticker);
  return useMutation({
    mutationFn: (
      payload: Partial<Omit<CompanyInput, "ticker">> & { isArchived?: boolean },
    ) =>
      apiRequest<ResearchCompany>(
        `/api/research/companies/${encodeURIComponent(ticker)}`,
        { method: "PATCH", body: JSON.stringify(payload) },
      ),
    onSuccess: refresh,
  });
}

export function useSaveThesis(ticker: string) {
  const refresh = useRefreshResearch(ticker);
  return useMutation({
    mutationFn: (payload: ThesisInput) =>
      apiRequest<InvestmentThesis>(
        `/api/research/companies/${encodeURIComponent(ticker)}/thesis`,
        { method: "PUT", body: JSON.stringify(payload) },
      ),
    onSuccess: refresh,
  });
}

function useCreateChildMutation<TInput, TOutput>(
  segment: string,
  ticker: string,
) {
  const refresh = useRefreshResearch(ticker);
  return useMutation({
    mutationFn: (payload: TInput) =>
      apiRequest<TOutput>(
        `/api/research/companies/${encodeURIComponent(ticker)}/${segment}`,
        { method: "POST", body: JSON.stringify(payload) },
      ),
    onSuccess: refresh,
  });
}

function useUpdateChildMutation<TInput, TOutput>(
  segment: string,
  ticker: string,
) {
  const refresh = useRefreshResearch(ticker);
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<TInput> }) =>
      apiRequest<TOutput>(`/api/research/${segment}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: refresh,
  });
}

function useDeleteChildMutation(segment: string, ticker: string) {
  const refresh = useRefreshResearch(ticker);
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest<{ id: number }>(`/api/research/${segment}/${id}`, {
        method: "DELETE",
      }),
    onSuccess: refresh,
  });
}

export function useCreateResearchNote(ticker: string) {
  return useCreateChildMutation<NoteInput, ResearchNote>("notes", ticker);
}
export function useUpdateResearchNote(ticker: string) {
  return useUpdateChildMutation<NoteInput, ResearchNote>("notes", ticker);
}
export function useDeleteResearchNote(ticker: string) {
  return useDeleteChildMutation("notes", ticker);
}

export function useCreateCatalyst(ticker: string) {
  return useCreateChildMutation<CatalystInput, ResearchCatalyst>(
    "catalysts",
    ticker,
  );
}
export function useUpdateCatalyst(ticker: string) {
  return useUpdateChildMutation<CatalystInput, ResearchCatalyst>(
    "catalysts",
    ticker,
  );
}
export function useDeleteCatalyst(ticker: string) {
  return useDeleteChildMutation("catalysts", ticker);
}

export function useCreateRisk(ticker: string) {
  return useCreateChildMutation<RiskInput, ResearchRisk>("risks", ticker);
}
export function useUpdateRisk(ticker: string) {
  return useUpdateChildMutation<RiskInput, ResearchRisk>("risks", ticker);
}
export function useDeleteRisk(ticker: string) {
  return useDeleteChildMutation("risks", ticker);
}

export function useCreateInvalidation(ticker: string) {
  return useCreateChildMutation<InvalidationInput, ResearchInvalidationTrigger>(
    "invalidation-triggers",
    ticker,
  );
}
export function useUpdateInvalidation(ticker: string) {
  return useUpdateChildMutation<InvalidationInput, ResearchInvalidationTrigger>(
    "invalidation-triggers",
    ticker,
  );
}
export function useDeleteInvalidation(ticker: string) {
  return useDeleteChildMutation("invalidation-triggers", ticker);
}

export function useCreateValuationAssumption(ticker: string) {
  return useCreateChildMutation<
    ValuationAssumptionInput,
    ResearchValuationAssumption
  >("valuation-assumptions", ticker);
}
export function useUpdateValuationAssumption(ticker: string) {
  return useUpdateChildMutation<
    ValuationAssumptionInput,
    ResearchValuationAssumption
  >("valuation-assumptions", ticker);
}
export function useDeleteValuationAssumption(ticker: string) {
  return useDeleteChildMutation("valuation-assumptions", ticker);
}
