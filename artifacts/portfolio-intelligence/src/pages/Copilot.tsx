import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Brain,
  CheckCircle2,
  CircleHelp,
  Clock,
  Database,
  FileSearch,
  Loader2,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  Scale,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  User,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type CopilotCitation,
  type CopilotMemoryCategory,
  type CopilotMessage,
  type CopilotMode,
  type CopilotStructuredResponse,
  useAskCopilot,
  useCopilotConversation,
  useCopilotConversations,
  useCopilotMemories,
  useCreateMemory,
  useDeleteConversation,
  useDeleteMemory,
  useUpdateMemory,
} from "@/features/copilot/api";

interface ModeOption {
  value: CopilotMode;
  label: string;
  description: string;
  icon: typeof Bot;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "general",
    label: "General",
    description: "Automatically choose the best grounded analysis mode.",
    icon: Sparkles,
  },
  {
    value: "portfolio_review",
    label: "Portfolio review",
    description: "Review allocation, cash, concentration and current risks.",
    icon: ShieldAlert,
  },
  {
    value: "performance_explain",
    label: "Explain performance",
    description: "Explain recorded returns and holding-level contributors.",
    icon: BarChart3,
  },
  {
    value: "company_analysis",
    label: "Company analysis",
    description: "Analyse a company using its saved AlphaDesk workspace.",
    icon: Target,
  },
  {
    value: "thesis_challenge",
    label: "Challenge thesis",
    description: "Pressure-test the bear case, risks and invalidation triggers.",
    icon: Scale,
  },
  {
    value: "company_compare",
    label: "Compare companies",
    description: "Compare two or more saved research workspaces.",
    icon: FileSearch,
  },
  {
    value: "research_gap",
    label: "Research gaps",
    description: "Find missing work before a decision is made.",
    icon: Database,
  },
];

const SUGGESTIONS: Array<{
  label: string;
  mode: CopilotMode;
  question: string;
  tickers?: string;
}> = [
  {
    label: "Morning portfolio review",
    mode: "portfolio_review",
    question:
      "Review my portfolio as it stands today. Highlight concentration, cash, the largest risks and the three decisions that deserve attention.",
  },
  {
    label: "Explain performance",
    mode: "performance_explain",
    question:
      "Explain my recorded portfolio performance. Separate realised P&L, unrealised contributors and anything the current data cannot establish.",
  },
  {
    label: "Challenge a thesis",
    mode: "thesis_challenge",
    question:
      "Challenge the saved investment thesis. Identify weak assumptions, missing evidence and the most important invalidation triggers.",
  },
  {
    label: "Find research gaps",
    mode: "research_gap",
    question:
      "Which portfolio holdings are least decision-ready from a research perspective, and what should I complete first?",
  },
  {
    label: "Compare two holdings",
    mode: "company_compare",
    question:
      "Compare these companies using only saved AlphaDesk research. Focus on conviction, downside, valuation framework and research completeness.",
    tickers: "",
  },
];

function parseTickers(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/).map((item) => item.trim().toUpperCase()).filter(Boolean))].slice(0, 6);
}

function formatTimestamp(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function sourceTone(kind: CopilotCitation["kind"]): string {
  if (kind === "portfolio") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (kind === "research") return "border-violet-500/30 bg-violet-500/10 text-violet-300";
  if (kind === "memory") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function messageResponse(message: CopilotMessage): CopilotStructuredResponse | null {
  return message.responseData && typeof message.responseData === "object"
    ? message.responseData
    : null;
}

export function Copilot() {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [mode, setMode] = useState<CopilotMode>("general");
  const [tickerInput, setTickerInput] = useState("");
  const [draft, setDraft] = useState("");
  const [allowMemory, setAllowMemory] = useState(false);
  const [optimisticQuestion, setOptimisticQuestion] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<"sources" | "memory">("sources");
  const messagesRef = useRef<HTMLDivElement>(null);

  const conversationsQuery = useCopilotConversations();
  const conversationQuery = useCopilotConversation(selectedConversationId);
  const memoriesQuery = useCopilotMemories();
  const askMutation = useAskCopilot();
  const deleteConversationMutation = useDeleteConversation();
  const createMemoryMutation = useCreateMemory();
  const updateMemoryMutation = useUpdateMemory();
  const deleteMemoryMutation = useDeleteMemory();

  const conversations = conversationsQuery.data ?? [];
  const messages = conversationQuery.data?.messages ?? [];
  const currentConversation = conversationQuery.data?.conversation ?? null;
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const latestSources = latestAssistant?.citations?.length
    ? latestAssistant.citations
    : latestAssistant?.contextSnapshot?.sources ?? [];

  useEffect(() => {
    if (currentConversation) {
      setMode(currentConversation.mode);
      setTickerInput(
        [currentConversation.primaryTicker, ...currentConversation.comparisonTickers]
          .filter(Boolean)
          .join(", "),
      );
    }
  }, [currentConversation]);

  useEffect(() => {
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, optimisticQuestion, askMutation.isPending]);

  const selectedMode = useMemo(
    () => MODE_OPTIONS.find((item) => item.value === mode) ?? MODE_OPTIONS[0],
    [mode],
  );

  function startNewConversation() {
    setSelectedConversationId(null);
    setDraft("");
    setTickerInput("");
    setMode("general");
    setOptimisticQuestion(null);
  }

  function submitQuestion(question = draft) {
    const cleaned = question.trim();
    if (!cleaned || askMutation.isPending) return;

    setOptimisticQuestion(cleaned);
    setDraft("");
    askMutation.mutate(
      {
        conversationId: selectedConversationId ?? undefined,
        question: cleaned,
        mode,
        tickers: parseTickers(tickerInput),
        saveMemoryCandidates: allowMemory,
      },
      {
        onSuccess: (result) => {
          setSelectedConversationId(result.conversationId);
          setOptimisticQuestion(null);
        },
        onError: () => setOptimisticQuestion(null),
      },
    );
  }

  function useSuggestion(suggestion: (typeof SUGGESTIONS)[number]) {
    setMode(suggestion.mode);
    if (suggestion.tickers !== undefined) setTickerInput(suggestion.tickers);
    setDraft(suggestion.question);
  }

  async function saveCandidate(
    candidate: CopilotStructuredResponse["memoryCandidates"][number],
  ) {
    await createMemoryMutation.mutateAsync(candidate);
  }

  return (
    <div className="grid min-h-[calc(100vh-6rem)] grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
      <aside className="flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Conversations
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {conversations.length} active
            </p>
          </div>
          <Button size="icon" variant="outline" onClick={startNewConversation} title="New analysis">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {conversationsQuery.isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))
          ) : conversations.length ? (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "group flex items-start gap-2 rounded-lg border p-2 transition-colors",
                  selectedConversationId === conversation.id
                    ? "border-primary/30 bg-primary/10"
                    : "border-transparent hover:bg-secondary/60",
                )}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  <p className="truncate text-sm font-medium">{conversation.title}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    {MODE_OPTIONS.find((item) => item.value === conversation.mode)?.label ?? conversation.mode}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatTimestamp(conversation.updatedAt)}
                  </p>
                </button>
                <button
                  className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  title="Delete conversation"
                  onClick={() => {
                    deleteConversationMutation.mutate(conversation.id, {
                      onSuccess: () => {
                        if (selectedConversationId === conversation.id) startNewConversation();
                      },
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          ) : (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              Your first analysis will appear here.
            </div>
          )}
        </div>
      </aside>

      <main className="flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <header className="space-y-3 border-b bg-secondary/20 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">AlphaDesk Copilot</h1>
                <p className="text-xs text-muted-foreground">
                  Grounded in your Portfolio and Research Engines
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
                <Database className="h-3 w-3" /> Source constrained
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
                <ShieldAlert className="h-3 w-3" /> No invented live data
              </span>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.45fr)]">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Analysis mode
              </span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as CopilotMode)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
              >
                {MODE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">{selectedMode.description}</p>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tickers, optional
              </span>
              <Input
                value={tickerInput}
                onChange={(event) => setTickerInput(event.target.value)}
                placeholder="RELIANCE, ICICIBANK"
                className="h-10 bg-background"
              />
              <p className="text-[11px] text-muted-foreground">Up to six saved holdings or covered companies.</p>
            </label>
          </div>
        </header>

        <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!selectedConversationId && !optimisticQuestion ? (
            <EmptyState onSuggestion={useSuggestion} />
          ) : conversationQuery.isLoading && selectedConversationId ? (
            <div className="mx-auto max-w-4xl space-y-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className={cn("h-20", index % 2 ? "ml-auto w-2/3" : "w-5/6")} />
              ))}
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-6">
              {messages.map((message) => (
                <MessageCard
                  key={message.id}
                  message={message}
                  onSaveCandidate={saveCandidate}
                  savingCandidate={createMemoryMutation.isPending}
                />
              ))}
              {optimisticQuestion && (
                <MessageCard
                  message={{
                    id: -1,
                    conversationId: selectedConversationId ?? -1,
                    role: "user",
                    content: optimisticQuestion,
                    mode,
                    contextSnapshot: null,
                    citations: [],
                    responseData: null,
                    model: null,
                    provider: null,
                    latencyMs: null,
                    createdAt: new Date().toISOString(),
                  }}
                  onSaveCandidate={saveCandidate}
                  savingCandidate={false}
                />
              )}
              {askMutation.isPending && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <Bot className="h-4 w-4 animate-pulse text-primary" />
                  </div>
                  <div className="w-full max-w-2xl space-y-2 rounded-xl border bg-secondary/20 p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Building a source-constrained answer…
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {askMutation.error && (
          <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive sm:mx-6">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{askMutation.error.message}</span>
          </div>
        )}

        <footer className="border-t bg-background p-4">
          <form
            className="mx-auto max-w-4xl space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitQuestion();
            }}
          >
            <div className="relative">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitQuestion();
                  }
                }}
                placeholder="Ask about your portfolio, a saved thesis, research gaps or recorded performance…"
                className="min-h-[92px] resize-none bg-secondary/20 pb-12 pr-14 text-sm"
                maxLength={10_000}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute bottom-2 right-2"
                disabled={!draft.trim() || askMutation.isPending}
              >
                {askMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex flex-col gap-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={allowMemory}
                  onChange={(event) => setAllowMemory(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-input"
                />
                Save only explicit durable preferences or decisions from this message
              </label>
              <span>Enter to send · Shift + Enter for a new line</span>
            </div>
          </form>
        </footer>
      </main>

      <aside className="flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-2 border-b bg-secondary/20 p-1">
          <button
            onClick={() => setRightPanel("sources")}
            className={cn(
              "rounded-md px-3 py-2 text-xs font-medium transition",
              rightPanel === "sources" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            Sources
          </button>
          <button
            onClick={() => setRightPanel("memory")}
            className={cn(
              "rounded-md px-3 py-2 text-xs font-medium transition",
              rightPanel === "memory" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            Memory
          </button>
        </div>

        {rightPanel === "sources" ? (
          <SourcesPanel citations={latestSources} message={latestAssistant ?? null} />
        ) : (
          <MemoryPanel
            memories={memoriesQuery.data ?? []}
            isLoading={memoriesQuery.isLoading}
            onTogglePin={(id, isPinned) => updateMemoryMutation.mutate({ id, isPinned: !isPinned })}
            onDelete={(id) => deleteMemoryMutation.mutate(id)}
          />
        )}
      </aside>
    </div>
  );
}

function EmptyState({
  onSuggestion,
}: {
  onSuggestion: (suggestion: (typeof SUGGESTIONS)[number]) => void;
}) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
        <Brain className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold">Your investment decision copilot</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
        AlphaDesk uses your own transaction ledger, calculated portfolio metrics and saved research. It labels missing information rather than inventing live market facts.
      </p>
      <div className="mt-7 grid w-full gap-3 md:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => {
          const mode = MODE_OPTIONS.find((item) => item.value === suggestion.mode);
          const Icon = mode?.icon ?? Sparkles;
          return (
            <button
              key={suggestion.label}
              className="rounded-xl border bg-secondary/20 p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
              onClick={() => onSuggestion(suggestion)}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4 text-primary" />
                {suggestion.label}
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {suggestion.question}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MessageCard({
  message,
  onSaveCandidate,
  savingCandidate,
}: {
  message: CopilotMessage;
  onSaveCandidate: (candidate: CopilotStructuredResponse["memoryCandidates"][number]) => Promise<void>;
  savingCandidate: boolean;
}) {
  const isUser = message.role === "user";
  const response = messageResponse(message);
  const [savedSubjects, setSavedSubjects] = useState<string[]>([]);

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={cn("min-w-0", isUser ? "max-w-[82%]" : "w-full max-w-3xl")}>
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm border bg-secondary/20",
          )}
        >
          {message.content}
        </div>

        {!isUser && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            {message.provider && (
              <span className="rounded-full border px-2 py-0.5">
                {message.provider === "openai_responses" ? "OpenAI · grounded" : "AlphaDesk offline fallback"}
              </span>
            )}
            {message.model && <span>{message.model}</span>}
            {message.latencyMs !== null && <span>{(message.latencyMs / 1000).toFixed(1)}s</span>}
            {message.createdAt && <span>{formatTimestamp(message.createdAt)}</span>}
          </div>
        )}

        {!isUser && message.citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.citations.map((citation, index) => (
              <span
                key={`${citation.sourceId}-${index}`}
                title={citation.claim ?? citation.label}
                className={cn("rounded-full border px-2 py-1 text-[10px]", sourceTone(citation.kind))}
              >
                [{citation.sourceId}] {citation.label}
              </span>
            ))}
          </div>
        )}

        {!isUser && response && (
          <div className="mt-4 space-y-3">
            <StructuredSection icon={CheckCircle2} title="Key points" items={response.keyPoints} tone="positive" />
            <StructuredSection icon={ShieldAlert} title="Risks" items={response.risks} tone="risk" />
            <StructuredSection icon={CircleHelp} title="Unknowns and data gaps" items={response.unknowns} tone="unknown" />

            {response.memoryCandidates.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <Brain className="h-4 w-4" /> Suggested durable memory
                </div>
                <div className="mt-3 space-y-2">
                  {response.memoryCandidates.map((candidate) => {
                    const saved = savedSubjects.includes(candidate.subject);
                    return (
                      <div key={`${candidate.category}-${candidate.subject}`} className="rounded-lg border bg-background/60 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium">{candidate.subject}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{candidate.content}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saved || savingCandidate}
                            onClick={async () => {
                              await onSaveCandidate(candidate);
                              setSavedSubjects((current) => [...current, candidate.subject]);
                            }}
                          >
                            {saved ? "Saved" : "Save"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {response.suggestedNextQuestions.length > 0 && (
              <div className="rounded-xl border bg-background/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Useful follow-ups
                </p>
                <div className="mt-2 space-y-1.5">
                  {response.suggestedNextQuestions.map((question) => (
                    <p key={question} className="text-xs text-muted-foreground">
                      • {question}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-secondary">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function StructuredSection({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: typeof CheckCircle2;
  title: string;
  items: string[];
  tone: "positive" | "risk" | "unknown";
}) {
  if (!items.length) return null;
  const toneClass =
    tone === "positive"
      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
      : tone === "risk"
        ? "border-amber-500/20 bg-amber-500/5 text-amber-300"
        : "border-blue-500/20 bg-blue-500/5 text-blue-300";
  return (
    <div className={cn("rounded-xl border p-3", toneClass)}>
      <div className="flex items-center gap-2 text-xs font-semibold">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <div className="mt-2 space-y-1.5 text-xs text-foreground/80">
        {items.map((item) => (
          <p key={item}>• {item}</p>
        ))}
      </div>
    </div>
  );
}

function SourcesPanel({
  citations,
  message,
}: {
  citations: CopilotCitation[];
  message: CopilotMessage | null;
}) {
  const context = message?.contextSnapshot;
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="rounded-xl border bg-secondary/20 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Database className="h-4 w-4 text-primary" /> Grounding status
        </div>
        {context ? (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <Metric label="Sources" value={String(context.sourceCount)} />
            <Metric label="Research workspaces" value={String(context.dataQuality.researchCoverageCount)} />
            <Metric
              label="Live market data"
              value={context.dataQuality.liveMarketDataAvailable ? "Available" : "Not connected"}
            />
            <Metric
              label="Price history"
              value={context.dataQuality.priceHistoryAvailable ? "Available" : "Not connected"}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Ask a question to see the exact sources supplied to the answer.
          </p>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {citations.length ? (
          citations.map((citation, index) => (
            <div key={`${citation.sourceId}-${index}`} className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-2">
                <span className={cn("rounded border px-1.5 py-0.5 text-[10px]", sourceTone(citation.kind))}>
                  {citation.sourceId}
                </span>
                {citation.asOf && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" /> {formatTimestamp(citation.asOf)}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs font-medium">{citation.label}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{citation.dataSource}</p>
              {citation.claim && <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{citation.claim}</p>}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">
            No source set selected yet.
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <strong className="text-amber-300">Important:</strong> current news, analyst estimates and live prices are excluded unless a later market-data phase supplies them.
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/60 p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}

function MemoryPanel({
  memories,
  isLoading,
  onTogglePin,
  onDelete,
}: {
  memories: Array<{
    id: number;
    category: CopilotMemoryCategory;
    subject: string;
    content: string;
    confidence: number;
    isPinned: boolean;
    updatedAt: string;
  }>;
  isLoading: boolean;
  onTogglePin: (id: number, isPinned: boolean) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
          <Brain className="h-4 w-4" /> Approved investment memory
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Only explicit, durable preferences, instructions and decisions should be retained. Memories can be pinned or deleted at any time.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)
        ) : memories.length ? (
          memories.map((memory) => (
            <div key={memory.id} className="group rounded-xl border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                    {memory.category}
                  </span>
                  <p className="mt-2 text-xs font-medium">{memory.subject}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title={memory.isPinned ? "Unpin" : "Pin"}
                    onClick={() => onTogglePin(memory.id, memory.isPinned)}
                  >
                    {memory.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Delete memory"
                    onClick={() => onDelete(memory.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{memory.content}</p>
              <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
                <span>{Math.round(memory.confidence * 100)}% confidence</span>
                {memory.isPinned && <span className="text-amber-300">Pinned</span>}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">
            No approved durable memories yet.
          </div>
        )}
      </div>
    </div>
  );
}
