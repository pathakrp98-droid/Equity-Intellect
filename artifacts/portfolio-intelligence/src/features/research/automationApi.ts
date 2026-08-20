import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AutomatedResearchSnapshotPayload,
  AutomationStatus,
  AutomationTrigger,
  CoverageState,
  EvidenceStrength,
  IdentityStatus,
  SecurityType,
} from "@workspace/research-contracts";

import type { ResearchCompanySummary } from "./api";

export interface AutomatedResearchCoverage extends ResearchCompanySummary {
  identityStatus: IdentityStatus | null;
  automationState: CoverageState | null;
}

export interface AutomatedResearchCompany {
  id: number;
  ticker: string;
  name: string;
  exchange: string;
  isin: string | null;
  securityType: SecurityType;
  identityStatus: IdentityStatus;
  identityConfidence: number;
  automationEnabled: boolean;
}

export interface AutomatedResearchJob {
  id: number;
  companyId: number;
  trigger: AutomationTrigger;
  status: AutomationStatus;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomatedResearchSource {
  citationKey: string;
  authority: string;
  sourceType: string;
  title: string;
  publisher: string | null;
  url: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  evidenceSummary: string;
}

export interface AutomatedResearchQuality {
  strength?: EvidenceStrength;
  reasons?: string[];
  gaps?: string[];
}

export interface AutomatedResearchChangeSet {
  material?: boolean;
  headline?: string;
  addedRiskIds?: string[];
  resolvedRiskIds?: string[];
  changedStatementIds?: string[];
  evidenceStrengthChanged?: boolean;
}

export interface AutomatedResearchSnapshot {
  id: number;
  version: number;
  trigger: AutomationTrigger;
  securityType: SecurityType;
  payload: AutomatedResearchSnapshotPayload;
  quality: AutomatedResearchQuality;
  changeSet: AutomatedResearchChangeSet;
  evidenceStrength: EvidenceStrength;
  freshAt: string;
  validUntil: string;
  publishedAt: string;
  sources: AutomatedResearchSource[];
}

export interface AutomatedResearchWorkspace {
  company: AutomatedResearchCompany;
  latestSnapshot: AutomatedResearchSnapshot | null;
  recentJobs: AutomatedResearchJob[];
}

export interface ResearchIdentityCorrectionInput {
  ticker: string;
  exchange: string;
  isin: string | null;
  name: string;
  securityType: Exclude<SecurityType, "unknown">;
}

export class ResearchAutomationApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ResearchAutomationApiError";
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
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // A proxy may return non-JSON content; keep the HTTP fallback.
    }
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ResearchAutomationApiError(
      message,
      response.status,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    );
  }
  return (await response.json()) as T;
}

const automationKey = ["research-engine", "automation"] as const;
const companyKey = (ticker: string) =>
  [...automationKey, "company", ticker] as const;
const historyKey = (ticker: string) =>
  [...automationKey, "history", ticker] as const;

function matchesSearch(row: AutomatedResearchCoverage, search: string) {
  const needle = search.trim().toLocaleLowerCase();
  return (
    !needle ||
    [row.ticker, row.name, row.sector, row.industry]
      .filter(Boolean)
      .some((value) => value?.toLocaleLowerCase().includes(needle))
  );
}

export function useAutomatedResearchCoverage(search = "") {
  return useQuery({
    queryKey: [...automationKey, "coverage"],
    queryFn: async () => {
      const result = await request<{ coverage: AutomatedResearchCoverage[] }>(
        "/api/research/automation/coverage",
      );
      return result.coverage;
    },
    select: (coverage) => coverage.filter((row) => matchesSearch(row, search)),
    refetchInterval: (query) =>
      query.state.data?.some(
        (row) =>
          row.isHolding &&
          (row.id === null ||
            row.automationState === "queued" ||
            row.automationState === "running"),
      )
        ? 3_000
        : false,
    retry: (attempt, error) =>
      !(error instanceof ResearchAutomationApiError && error.status === 401) &&
      attempt < 2,
  });
}

export function useCurrentAutomatedResearch(ticker: string | null) {
  return useQuery({
    queryKey: companyKey(ticker ?? ""),
    queryFn: async () => {
      const result = await request<{ company: AutomatedResearchWorkspace }>(
        `/api/research/automation/companies/${encodeURIComponent(ticker ?? "")}`,
      );
      return result.company;
    },
    enabled: Boolean(ticker),
    retry: (attempt, error) =>
      !(
        error instanceof ResearchAutomationApiError &&
        [401, 404].includes(error.status)
      ) && attempt < 2,
  });
}

export function useAutomatedResearchHistory(ticker: string | null) {
  return useQuery({
    queryKey: historyKey(ticker ?? ""),
    queryFn: async () => {
      const result = await request<{ history: AutomatedResearchSnapshot[] }>(
        `/api/research/automation/companies/${encodeURIComponent(ticker ?? "")}/history`,
      );
      return result.history;
    },
    enabled: Boolean(ticker),
  });
}

async function invalidateResearchConsumers(
  client: ReturnType<typeof useQueryClient>,
  ticker: string,
) {
  await Promise.all([
    client.invalidateQueries({ queryKey: automationKey }),
    client.invalidateQueries({ queryKey: companyKey(ticker) }),
    client.invalidateQueries({ queryKey: historyKey(ticker) }),
    client.invalidateQueries({ queryKey: ["research-engine"] }),
    client.invalidateQueries({ queryKey: ["guardian"] }),
    client.invalidateQueries({ queryKey: ["market-intelligence"] }),
    client.invalidateQueries({ queryKey: ["integration", "health"] }),
  ]);
}

export function useRequestAutomatedResearchRefresh(ticker: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await request<{
        job: { jobId: number; created: boolean };
      }>(
        `/api/research/automation/companies/${encodeURIComponent(ticker)}/refresh`,
        { method: "POST" },
      );
      return result.job;
    },
    onSuccess: async () => invalidateResearchConsumers(client, ticker),
  });
}

const TERMINAL_JOB_STATES = new Set<AutomationStatus>([
  "succeeded",
  "partial",
  "failed",
  "dead_letter",
  "cancelled",
  "skipped",
]);

export function useResearchAutomationRun(runId: number | null) {
  return useQuery({
    queryKey: [...automationKey, "job", runId ?? 0],
    queryFn: async () => {
      const result = await request<{ job: AutomatedResearchJob }>(
        `/api/research/automation/jobs/${runId ?? 0}`,
      );
      return result.job;
    },
    enabled: runId !== null,
    refetchInterval: (query) => {
      const job = query.state.data;
      return job && TERMINAL_JOB_STATES.has(job.status) ? false : 3_000;
    },
  });
}

export function useCorrectResearchIdentity(ticker: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: ResearchIdentityCorrectionInput) => {
      const result = await request<{ company: AutomatedResearchCompany }>(
        `/api/research/automation/companies/${encodeURIComponent(ticker)}/identity`,
        { method: "PATCH", body: JSON.stringify(input) },
      );
      return result.company;
    },
    onSuccess: async () => invalidateResearchConsumers(client, ticker),
  });
}
