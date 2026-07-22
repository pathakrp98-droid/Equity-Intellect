import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type DecisionType =
  "buy" | "add" | "sell" | "trim" | "hold" | "review" | "avoid";
export type DecisionStatus = "planned" | "executed" | "cancelled" | "closed";
export type EmotionalState =
  | "confident"
  | "calm"
  | "neutral"
  | "uncertain"
  | "anxious"
  | "fearful"
  | "greedy"
  | "frustrated";
export type DecisionOutcome = "pending" | "win" | "loss" | "mixed" | "unknown";
export type ReviewAction =
  "no_change" | "hold" | "add" | "trim" | "exit" | "research_more";

export interface SourceReference {
  id: string;
  label: string;
  url?: string | null;
  publishedAt?: string | null;
}

export interface DecisionQuality {
  total: number;
  band: "weak" | "developing" | "disciplined" | "excellent";
  documentation: number;
  quantification: number;
  evidenceBalance: number;
  reviewPlan: number;
  processIntegrity: number;
  learning: number;
  missing: string[];
}

export interface JournalEntry {
  id: number;
  userId: string;
  portfolioId: number | null;
  researchCompanyId: number | null;
  transactionId: number | null;
  guardianCheckId: string | null;
  ticker: string;
  name: string | null;
  decisionType: DecisionType;
  status: DecisionStatus;
  decisionDate: string;
  executionPrice: number | null;
  quantity: number | null;
  thesisSummary: string | null;
  rationale: string;
  expectedReturnPct: number | null;
  expectedDownsidePct: number | null;
  targetPrice: number | null;
  bearPrice: number | null;
  investmentHorizon: string | null;
  emotionalState: EmotionalState;
  confidenceScore: number;
  evidenceQuality: string;
  keyFactors: string[];
  contraryEvidence: string[];
  sourceReferences: SourceReference[];
  nextReviewAt: string | null;
  outcome: DecisionOutcome;
  actualReturnPct: number | null;
  outcomeNotes: string | null;
  lessonsLearned: string | null;
  isArchived: boolean;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  quality: DecisionQuality;
  reviewCount?: number;
  overdueReviewCount?: number;
  latestReview?: JournalReview | null;
  reviews?: JournalReview[];
}

export interface JournalReview {
  id: number;
  entryId: number;
  userId: string;
  reviewType: "scheduled" | "earnings" | "event" | "thesis_break" | "manual";
  status: "due" | "completed" | "skipped";
  scheduledFor: string;
  completedAt: string | null;
  currentPrice: number | null;
  returnSinceDecisionPct: number | null;
  thesisStatusBefore: string | null;
  thesisStatusAfter: string | null;
  convictionBefore: string | null;
  convictionAfter: string | null;
  whatChanged: string | null;
  evidenceFor: string | null;
  evidenceAgainst: string | null;
  actionAfterReview: ReviewAction;
  reviewQualityScore: number | null;
  notes: string | null;
  ticker?: string;
  name?: string | null;
  decisionType?: DecisionType;
  executionPrice?: number | null;
  decisionDate?: string;
  overdue?: boolean;
}

export interface JournalEntryInput {
  portfolioId?: number | null;
  researchCompanyId?: number | null;
  transactionId?: number | null;
  guardianCheckId?: string | null;
  ticker: string;
  name?: string | null;
  decisionType: DecisionType;
  status?: DecisionStatus;
  decisionDate?: string;
  executionPrice?: number | null;
  quantity?: number | null;
  thesisSummary?: string | null;
  rationale: string;
  expectedReturnPct?: number | null;
  expectedDownsidePct?: number | null;
  targetPrice?: number | null;
  bearPrice?: number | null;
  investmentHorizon?: string | null;
  emotionalState?: EmotionalState;
  confidenceScore?: number;
  evidenceQuality?: "high" | "medium" | "low";
  keyFactors?: string[];
  contraryEvidence?: string[];
  sourceReferences?: SourceReference[];
  nextReviewAt?: string | null;
  outcome?: DecisionOutcome;
  actualReturnPct?: number | null;
  outcomeNotes?: string | null;
  lessonsLearned?: string | null;
}

export interface ReviewInput {
  reviewType?: JournalReview["reviewType"];
  scheduledFor?: string;
  currentPrice?: number | null;
  thesisStatusBefore?: string | null;
  thesisStatusAfter?: string | null;
  convictionBefore?: string | null;
  convictionAfter?: string | null;
  whatChanged?: string | null;
  evidenceFor?: string | null;
  evidenceAgainst?: string | null;
  actionAfterReview?: ReviewAction;
  notes?: string | null;
  nextReviewAt?: string | null;
  outcome?: DecisionOutcome;
  outcomeNotes?: string | null;
  lessonsLearned?: string | null;
}

export interface JournalAnalytics {
  totalDecisions: number;
  openDecisions: number;
  completedOutcomes: number;
  winRatePct: number;
  averageActualReturnPct: number;
  averageDecisionQuality: number;
  reviewCompletionPct: number;
  overdueReviewCount: number;
  averageReviewQuality: number;
  lessonsCapturedPct: number;
  overallScore: number;
  components: {
    documentationScore: number;
    evidenceBalanceScore: number;
    reviewDisciplineScore: number;
    outcomeLearningScore: number;
  };
  qualityBands: Record<DecisionQuality["band"], number>;
  topProcessGaps: Array<{ gap: string; count: number }>;
  emotionalPatterns: Array<{
    emotion: string;
    count: number;
    winRatePct: number;
    averageReturnPct: number | null;
  }>;
  generatedAt: string;
}

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
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
      // Keep the HTTP fallback.
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

const key = ["decision-journal"] as const;

export function useJournalEntries(filters?: {
  ticker?: string;
  outcome?: string;
  status?: string;
  archived?: boolean;
}) {
  const params = new URLSearchParams();
  if (filters?.ticker) params.set("ticker", filters.ticker);
  if (filters?.outcome) params.set("outcome", filters.outcome);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.archived) params.set("archived", "true");
  return useQuery({
    queryKey: [...key, "entries", filters ?? {}],
    queryFn: () =>
      request<JournalEntry[]>(
        `/api/journal/entries${params.size ? `?${params}` : ""}`,
      ),
  });
}

export function useJournalEntry(id?: number | null) {
  return useQuery({
    queryKey: [...key, "entry", id],
    enabled: !!id,
    queryFn: () => request<JournalEntry>(`/api/journal/entries/${id}`),
  });
}

export function useCreateJournalEntry() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: JournalEntryInput) =>
      request<JournalEntry>("/api/journal/entries", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useCreateJournalFromGuardian() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (checkId: string) =>
      request<JournalEntry>("/api/journal/entries/from-guardian", {
        method: "POST",
        body: JSON.stringify({ checkId }),
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useUpdateJournalEntry() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: Partial<JournalEntryInput>;
    }) =>
      request<JournalEntry>(`/api/journal/entries/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useArchiveJournalEntry() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived = true }: { id: number; archived?: boolean }) =>
      request<JournalEntry>(`/api/journal/entries/${id}/archive`, {
        method: "POST",
        body: JSON.stringify({ archived }),
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useJournalReviews(status?: string) {
  return useQuery({
    queryKey: [...key, "reviews", status ?? "all"],
    queryFn: () =>
      request<JournalReview[]>(
        `/api/journal/reviews${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      ),
  });
}

export function useScheduleJournalReview() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, input }: { entryId: number; input: ReviewInput }) =>
      request<JournalReview>(`/api/journal/entries/${entryId}/reviews`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useCompleteJournalReview() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      reviewId,
      input,
    }: {
      reviewId: number;
      input: ReviewInput;
    }) =>
      request<JournalReview>(`/api/journal/reviews/${reviewId}/complete`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useSkipJournalReview() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, notes }: { reviewId: number; notes?: string }) =>
      request<JournalReview>(`/api/journal/reviews/${reviewId}/skip`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useJournalAnalytics(snapshot = false) {
  return useQuery({
    queryKey: [...key, "analytics", snapshot],
    queryFn: () =>
      request<JournalAnalytics>(
        `/api/journal/analytics${snapshot ? "?snapshot=true" : ""}`,
      ),
  });
}
