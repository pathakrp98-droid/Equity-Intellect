import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type CopilotMode =
  | "general"
  | "portfolio_review"
  | "company_analysis"
  | "thesis_challenge"
  | "company_compare"
  | "research_gap"
  | "performance_explain";

export type CopilotMemoryCategory =
  | "preference"
  | "instruction"
  | "portfolio"
  | "thesis"
  | "risk"
  | "research"
  | "decision";

export interface CopilotConversation {
  id: number;
  userId: string;
  title: string;
  mode: CopilotMode;
  primaryTicker: string | null;
  comparisonTickers: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CopilotCitation {
  sourceId: string;
  label: string;
  kind: "portfolio" | "holding" | "research" | "memory" | "calculation";
  ticker?: string | null;
  asOf?: string | null;
  dataSource: string;
  claim?: string | null;
}

export interface CopilotContextSnapshot {
  generatedAt: string;
  mode: CopilotMode;
  tickers: string[];
  sourceCount: number;
  dataQuality: {
    liveMarketDataAvailable: boolean;
    priceHistoryAvailable: boolean;
    benchmarkHistoryAvailable: boolean;
    researchCoverageCount: number;
  };
  sources: CopilotCitation[];
}

export interface CopilotMessage {
  id: number;
  conversationId: number;
  role: "user" | "assistant" | "system";
  content: string;
  mode: CopilotMode;
  contextSnapshot: CopilotContextSnapshot | null;
  citations: CopilotCitation[];
  responseData: CopilotStructuredResponse | null;
  model: string | null;
  provider: string | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface CopilotMemory {
  id: number;
  category: CopilotMemoryCategory;
  subject: string;
  content: string;
  confidence: number;
  sourceConversationId: number | null;
  sourceMessageId: number | null;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CopilotStructuredResponse {
  answer: string;
  summary: string;
  keyPoints: string[];
  risks: string[];
  unknowns: string[];
  suggestedNextQuestions: string[];
  citations: Array<{ sourceId: string; claim: string }>;
  memoryCandidates: Array<{
    category: CopilotMemoryCategory;
    subject: string;
    content: string;
    confidence: number;
  }>;
}

export interface AskCopilotPayload {
  conversationId?: number;
  question: string;
  mode?: CopilotMode;
  tickers?: string[];
  saveMemoryCandidates?: boolean;
}

export interface AskCopilotResponse {
  conversationId: number;
  userMessage: CopilotMessage;
  assistantMessage: CopilotMessage;
  response: CopilotStructuredResponse;
  citations: CopilotCitation[];
  context: CopilotContextSnapshot;
  provider: {
    name: string;
    model: string;
    latencyMs: number;
    fallbackReason: string | null;
  };
  savedMemories: CopilotMemory[];
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

export function useCopilotConversations() {
  return useQuery({
    queryKey: ["copilot", "conversations"],
    queryFn: () => apiRequest<CopilotConversation[]>("/api/copilot/conversations"),
  });
}

export function useCopilotConversation(id: number | null) {
  return useQuery({
    queryKey: ["copilot", "conversation", id],
    queryFn: () =>
      apiRequest<{ conversation: CopilotConversation; messages: CopilotMessage[] }>(
        `/api/copilot/conversations/${id}`,
      ),
    enabled: id !== null,
  });
}

export function useAskCopilot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AskCopilotPayload) =>
      apiRequest<AskCopilotResponse>("/api/copilot/ask", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["copilot", "conversations"] }),
        queryClient.invalidateQueries({
          queryKey: ["copilot", "conversation", data.conversationId],
        }),
        queryClient.invalidateQueries({ queryKey: ["copilot", "memories"] }),
      ]);
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      title?: string;
      mode?: CopilotMode;
      primaryTicker?: string;
      comparisonTickers?: string[];
    }) =>
      apiRequest<CopilotConversation>("/api/copilot/conversations", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["copilot", "conversations"] }),
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest<{ id: number }>(`/api/copilot/conversations/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["copilot", "conversations"] }),
  });
}

export function useCopilotMemories() {
  return useQuery({
    queryKey: ["copilot", "memories"],
    queryFn: () => apiRequest<CopilotMemory[]>("/api/copilot/memories"),
  });
}

export function useCreateMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      category: CopilotMemoryCategory;
      subject: string;
      content: string;
      confidence?: number;
      isPinned?: boolean;
    }) =>
      apiRequest<CopilotMemory>("/api/copilot/memories", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["copilot", "memories"] }),
  });
}

export function useUpdateMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<CopilotMemory> & { id: number }) =>
      apiRequest<CopilotMemory>(`/api/copilot/memories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["copilot", "memories"] }),
  });
}

export function useDeleteMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest<{ id: number }>(`/api/copilot/memories/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["copilot", "memories"] }),
  });
}
