import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  BookOpen,
  Brain,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Link2,
  Plus,
  RefreshCw,
  Save,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type DecisionOutcome,
  type DecisionType,
  type EmotionalState,
  type JournalEntry,
  type JournalEntryInput,
  type JournalReview,
  type ReviewAction,
  useArchiveJournalEntry,
  useCompleteJournalReview,
  useCreateJournalEntry,
  useCreateJournalFromGuardian,
  useJournalAnalytics,
  useJournalEntries,
  useJournalEntry,
  useJournalReviews,
  useScheduleJournalReview,
  useSkipJournalReview,
  useUpdateJournalEntry,
} from "@/features/journal/api";

const DECISION_TYPES: DecisionType[] = [
  "buy",
  "add",
  "sell",
  "trim",
  "hold",
  "review",
  "avoid",
];
const EMOTIONS: EmotionalState[] = [
  "confident",
  "calm",
  "neutral",
  "uncertain",
  "anxious",
  "fearful",
  "greedy",
  "frustrated",
];
const OUTCOMES: DecisionOutcome[] = [
  "pending",
  "win",
  "loss",
  "mixed",
  "unknown",
];
const REVIEW_ACTIONS: ReviewAction[] = [
  "no_change",
  "hold",
  "add",
  "trim",
  "exit",
  "research_more",
];

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function date(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateTimeLocal(value?: string | null) {
  const item = value ? new Date(value) : new Date();
  const shifted = new Date(item.getTime() - item.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function listFromText(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function QualityBadge({ entry }: { entry: JournalEntry }) {
  return (
    <span
      className={cn(
        "rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        entry.quality.band === "excellent"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
          : entry.quality.band === "disciplined"
            ? "border-primary/30 bg-primary/10 text-primary"
            : entry.quality.band === "developing"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
              : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {entry.quality.total}/100
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: DecisionOutcome }) {
  return (
    <span
      className={cn(
        "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        outcome === "win"
          ? "bg-emerald-500/15 text-emerald-500"
          : outcome === "loss"
            ? "bg-destructive/15 text-destructive"
            : outcome === "mixed"
              ? "bg-amber-500/15 text-amber-500"
              : "bg-secondary text-muted-foreground",
      )}
    >
      {outcome}
    </span>
  );
}

interface EntryFormState {
  ticker: string;
  name: string;
  decisionType: DecisionType;
  status: "planned" | "executed";
  decisionDate: string;
  executionPrice: string;
  quantity: string;
  thesisSummary: string;
  rationale: string;
  expectedReturnPct: string;
  expectedDownsidePct: string;
  targetPrice: string;
  bearPrice: string;
  investmentHorizon: string;
  emotionalState: EmotionalState;
  confidenceScore: string;
  evidenceQuality: "high" | "medium" | "low";
  keyFactors: string;
  contraryEvidence: string;
  nextReviewAt: string;
  portfolioId: string;
  researchCompanyId: string;
  transactionId: string;
  guardianCheckId: string;
}

function emptyEntryForm(): EntryFormState {
  const nextReview = new Date(Date.now() + 90 * 86_400_000);
  return {
    ticker: "",
    name: "",
    decisionType: "buy",
    status: "planned",
    decisionDate: dateTimeLocal(),
    executionPrice: "",
    quantity: "",
    thesisSummary: "",
    rationale: "",
    expectedReturnPct: "",
    expectedDownsidePct: "",
    targetPrice: "",
    bearPrice: "",
    investmentHorizon: "24 months",
    emotionalState: "neutral",
    confidenceScore: "3",
    evidenceQuality: "medium",
    keyFactors: "",
    contraryEvidence: "",
    nextReviewAt: dateTimeLocal(nextReview.toISOString()),
    portfolioId: "",
    researchCompanyId: "",
    transactionId: "",
    guardianCheckId: "",
  };
}

export function Journal() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tickerFilter, setTickerFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const entriesQuery = useJournalEntries({
    ticker: tickerFilter || undefined,
    outcome: outcomeFilter || undefined,
  });
  const analyticsQuery = useJournalAnalytics();
  const selectedQuery = useJournalEntry(selectedId);

  const selected = selectedQuery.data ?? null;
  const entries = entriesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-[1700px] space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Decision Journal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record decisions before outcomes are known, review them on schedule,
            and improve the process—not merely the result.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate((value) => !value)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New decision
        </Button>
      </div>

      <SummaryStrip
        analytics={analyticsQuery.data}
        loading={analyticsQuery.isLoading}
      />

      {showCreate && (
        <CreateDecisionForm
          onCreated={(entry) => {
            setShowCreate(false);
            setSelectedId(entry.id);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <Tabs defaultValue="decisions" className="space-y-5">
        <TabsList className="grid h-auto w-full max-w-2xl grid-cols-3 bg-secondary p-1">
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
          <TabsTrigger value="reviews">Review Queue</TabsTrigger>
          <TabsTrigger value="analytics">Process Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="decisions" className="m-0">
          <div className="grid min-h-[620px] grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-secondary/20 pb-4">
                <CardTitle className="text-base">Decision history</CardTitle>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Input
                    value={tickerFilter}
                    onChange={(event) =>
                      setTickerFilter(event.target.value.toUpperCase())
                    }
                    placeholder="Ticker"
                    className="h-9"
                  />
                  <select
                    value={outcomeFilter}
                    onChange={(event) => setOutcomeFilter(event.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">All outcomes</option>
                    {OUTCOMES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </CardHeader>
              <CardContent className="max-h-[690px] space-y-2 overflow-y-auto p-2">
                {entriesQuery.isLoading ? (
                  Array.from({ length: 7 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 w-full" />
                  ))
                ) : entries.length ? (
                  entries.map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      onClick={() => setSelectedId(entry.id)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors",
                        selectedId === entry.id
                          ? "border-primary/40 bg-primary/10"
                          : "border-transparent hover:border-border hover:bg-secondary/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{entry.ticker}</span>
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">
                              {entry.decisionType}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {entry.rationale}
                          </p>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex gap-2">
                          <QualityBadge entry={entry} />
                          <OutcomeBadge outcome={entry.outcome} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {date(entry.decisionDate)}
                        </span>
                      </div>
                      {!!entry.overdueReviewCount && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-amber-500">
                          <Clock3 className="h-3 w-3" />{" "}
                          {entry.overdueReviewCount} overdue review
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center text-muted-foreground">
                    <BookOpen className="mb-3 h-9 w-9 opacity-40" />
                    <p className="text-sm font-medium text-foreground">
                      No decisions recorded
                    </p>
                    <p className="mt-1 text-xs">
                      Capture the rationale before you act so hindsight cannot
                      rewrite it.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              {selectedId ? (
                selectedQuery.isLoading ? (
                  <div className="space-y-4 p-6">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : selected ? (
                  <DecisionDetail entry={selected} />
                ) : (
                  <EmptyDetail />
                )
              ) : (
                <EmptyDetail />
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="m-0">
          <ReviewQueue />
        </TabsContent>

        <TabsContent value="analytics" className="m-0">
          <AnalyticsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryStrip({
  analytics,
  loading,
}: {
  analytics: ReturnType<typeof useJournalAnalytics>["data"];
  loading: boolean;
}) {
  const cards = [
    {
      label: "Process score",
      value: analytics ? `${analytics.overallScore}/100` : "—",
      icon: Brain,
    },
    {
      label: "Decision quality",
      value: analytics
        ? `${analytics.averageDecisionQuality.toFixed(0)}/100`
        : "—",
      icon: ClipboardCheck,
    },
    {
      label: "Review completion",
      value: analytics ? `${analytics.reviewCompletionPct.toFixed(0)}%` : "—",
      icon: CalendarClock,
    },
    {
      label: "Outcome win rate",
      value: analytics?.completedOutcomes
        ? `${analytics.winRatePct.toFixed(0)}%`
        : "—",
      icon: Target,
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {item.label}
              </p>
              {loading ? (
                <Skeleton className="mt-2 h-8 w-20" />
              ) : (
                <p className="mt-2 font-mono text-2xl font-bold">
                  {item.value}
                </p>
              )}
            </div>
            <div className="rounded-full border bg-secondary/50 p-3">
              <item.icon className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CreateDecisionForm({
  onCreated,
  onCancel,
}: {
  onCreated: (entry: JournalEntry) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EntryFormState>(emptyEntryForm);
  const mutation = useCreateJournalEntry();
  const guardianMutation = useCreateJournalFromGuardian();
  const set = <K extends keyof EntryFormState>(
    key: K,
    value: EntryFormState[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const submit = () => {
    const input: JournalEntryInput = {
      ticker: form.ticker,
      name: form.name || null,
      decisionType: form.decisionType,
      status: form.status,
      decisionDate: new Date(form.decisionDate).toISOString(),
      executionPrice: numberOrNull(form.executionPrice),
      quantity: numberOrNull(form.quantity),
      thesisSummary: form.thesisSummary || null,
      rationale: form.rationale,
      expectedReturnPct: numberOrNull(form.expectedReturnPct),
      expectedDownsidePct: numberOrNull(form.expectedDownsidePct),
      targetPrice: numberOrNull(form.targetPrice),
      bearPrice: numberOrNull(form.bearPrice),
      investmentHorizon: form.investmentHorizon || null,
      emotionalState: form.emotionalState,
      confidenceScore: Number(form.confidenceScore),
      evidenceQuality: form.evidenceQuality,
      keyFactors: listFromText(form.keyFactors),
      contraryEvidence: listFromText(form.contraryEvidence),
      nextReviewAt: form.nextReviewAt
        ? new Date(form.nextReviewAt).toISOString()
        : null,
      portfolioId: numberOrNull(form.portfolioId),
      researchCompanyId: numberOrNull(form.researchCompanyId),
      transactionId: numberOrNull(form.transactionId),
      guardianCheckId: form.guardianCheckId || null,
    };
    mutation.mutate(input, { onSuccess: onCreated });
  };

  const importGuardian = () => {
    guardianMutation.mutate(form.guardianCheckId, { onSuccess: onCreated });
  };

  const error =
    mutation.error instanceof Error
      ? mutation.error.message
      : guardianMutation.error instanceof Error
        ? guardianMutation.error.message
        : null;

  return (
    <Card className="border-primary/30">
      <CardHeader className="border-b bg-primary/5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" /> Capture decision
            before outcome
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="Ticker *">
            <Input
              value={form.ticker}
              onChange={(e) => set("ticker", e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Company">
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Decision">
            <select
              value={form.decisionType}
              onChange={(e) =>
                set("decisionType", e.target.value as DecisionType)
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {DECISION_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) =>
                set("status", e.target.value as "planned" | "executed")
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="planned">planned</option>
              <option value="executed">executed</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Field label="Thesis summary">
            <Textarea
              value={form.thesisSummary}
              onChange={(e) => set("thesisSummary", e.target.value)}
              placeholder="The core reason this asset should create value..."
            />
          </Field>
          <Field label="Decision rationale *">
            <Textarea
              value={form.rationale}
              onChange={(e) => set("rationale", e.target.value)}
              placeholder="Why now? What changed? What evidence supports this action?"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
          <Field label="Price">
            <Input
              type="number"
              value={form.executionPrice}
              onChange={(e) => set("executionPrice", e.target.value)}
            />
          </Field>
          <Field label="Quantity">
            <Input
              type="number"
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
            />
          </Field>
          <Field label="Expected return %">
            <Input
              type="number"
              value={form.expectedReturnPct}
              onChange={(e) => set("expectedReturnPct", e.target.value)}
            />
          </Field>
          <Field label="Downside %">
            <Input
              type="number"
              value={form.expectedDownsidePct}
              onChange={(e) => set("expectedDownsidePct", e.target.value)}
            />
          </Field>
          <Field label="Target price">
            <Input
              type="number"
              value={form.targetPrice}
              onChange={(e) => set("targetPrice", e.target.value)}
            />
          </Field>
          <Field label="Bear price">
            <Input
              type="number"
              value={form.bearPrice}
              onChange={(e) => set("bearPrice", e.target.value)}
            />
          </Field>
          <Field label="Confidence 1–5">
            <Input
              type="number"
              min="1"
              max="5"
              value={form.confidenceScore}
              onChange={(e) => set("confidenceScore", e.target.value)}
            />
          </Field>
          <Field label="Evidence quality">
            <select
              value={form.evidenceQuality}
              onChange={(e) =>
                set(
                  "evidenceQuality",
                  e.target.value as "high" | "medium" | "low",
                )
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Field label="Supporting factors (one per line)">
            <Textarea
              value={form.keyFactors}
              onChange={(e) => set("keyFactors", e.target.value)}
              placeholder="Order book growth&#10;Margin expansion"
            />
          </Field>
          <Field label="Contrary evidence (one per line)">
            <Textarea
              value={form.contraryEvidence}
              onChange={(e) => set("contraryEvidence", e.target.value)}
              placeholder="Customer concentration&#10;Valuation risk"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Field label="Decision date">
            <Input
              type="datetime-local"
              value={form.decisionDate}
              onChange={(e) => set("decisionDate", e.target.value)}
            />
          </Field>
          <Field label="Next review">
            <Input
              type="datetime-local"
              value={form.nextReviewAt}
              onChange={(e) => set("nextReviewAt", e.target.value)}
            />
          </Field>
          <Field label="Horizon">
            <Input
              value={form.investmentHorizon}
              onChange={(e) => set("investmentHorizon", e.target.value)}
            />
          </Field>
          <Field label="Emotional state">
            <select
              value={form.emotionalState}
              onChange={(e) =>
                set("emotionalState", e.target.value as EmotionalState)
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {EMOTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Transaction ID">
            <Input
              value={form.transactionId}
              onChange={(e) => set("transactionId", e.target.value)}
            />
          </Field>
          <Field label="Research company ID">
            <Input
              value={form.researchCompanyId}
              onChange={(e) => set("researchCompanyId", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <Field label="Guardian check ID">
            <Input
              value={form.guardianCheckId}
              onChange={(e) => set("guardianCheckId", e.target.value)}
              placeholder="Optional: import an existing Guardian packet"
            />
          </Field>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={importGuardian}
              disabled={!form.guardianCheckId || guardianMutation.isPending}
              className="gap-2"
            >
              <Link2 className="h-4 w-4" /> Import Guardian decision
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              mutation.isPending ||
              !form.ticker ||
              form.rationale.trim().length < 20
            }
            className="gap-2"
          >
            <Save className="h-4 w-4" /> Save decision
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function EmptyDetail() {
  return (
    <div className="flex min-h-[620px] flex-col items-center justify-center px-8 text-center text-muted-foreground">
      <ClipboardCheck className="mb-4 h-12 w-12 opacity-30" />
      <p className="font-medium text-foreground">Select a decision</p>
      <p className="mt-1 max-w-md text-sm">
        The original rationale, evidence, emotional state, reviews and outcome
        will appear here.
      </p>
    </div>
  );
}

function DecisionDetail({ entry }: { entry: JournalEntry }) {
  const updateMutation = useUpdateJournalEntry();
  const archiveMutation = useArchiveJournalEntry();
  const scheduleMutation = useScheduleJournalReview();
  const [outcome, setOutcome] = useState<DecisionOutcome>(entry.outcome);
  const [actualReturn, setActualReturn] = useState(
    entry.actualReturnPct?.toString() ?? "",
  );
  const [outcomeNotes, setOutcomeNotes] = useState(entry.outcomeNotes ?? "");
  const [lessons, setLessons] = useState(entry.lessonsLearned ?? "");
  const [nextReview, setNextReview] = useState(
    dateTimeLocal(entry.nextReviewAt),
  );

  const saveOutcome = () => {
    updateMutation.mutate({
      id: entry.id,
      input: {
        ticker: entry.ticker,
        decisionType: entry.decisionType,
        rationale: entry.rationale,
        outcome,
        actualReturnPct: numberOrNull(actualReturn),
        outcomeNotes,
        lessonsLearned: lessons,
        status: outcome === "pending" ? entry.status : "closed",
      },
    });
  };

  const schedule = () => {
    scheduleMutation.mutate({
      entryId: entry.id,
      input: {
        reviewType: "scheduled",
        scheduledFor: new Date(nextReview).toISOString(),
      },
    });
  };

  return (
    <div className="max-h-[760px] overflow-y-auto">
      <div className="sticky top-0 z-10 border-b bg-card/95 p-6 backdrop-blur">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-3xl font-bold">{entry.ticker}</h2>
              <span className="rounded bg-primary/15 px-2 py-1 text-xs font-bold uppercase text-primary">
                {entry.decisionType}
              </span>
              <OutcomeBadge outcome={entry.outcome} />
              <QualityBadge entry={entry} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {entry.name || "Company name not recorded"} ·{" "}
              {date(entry.decisionDate)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => archiveMutation.mutate({ id: entry.id })}
            className="gap-2"
          >
            <Archive className="h-4 w-4" /> Archive
          </Button>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <MiniMetric label="Price" value={money(entry.executionPrice)} />
          <MiniMetric
            label="Quantity"
            value={entry.quantity?.toLocaleString("en-IN") ?? "—"}
          />
          <MiniMetric label="Target" value={money(entry.targetPrice)} />
          <MiniMetric label="Bear" value={money(entry.bearPrice)} />
          <MiniMetric
            label="Expected"
            value={percent(entry.expectedReturnPct)}
            positive
          />
          <MiniMetric
            label="Downside"
            value={percent(entry.expectedDownsidePct)}
            negative
          />
          <MiniMetric label="Confidence" value={`${entry.confidenceScore}/5`} />
          <MiniMetric label="Emotion" value={entry.emotionalState} />
        </div>

        <Section title="Original thesis and rationale">
          {entry.thesisSummary && (
            <p className="mb-4 rounded-lg border bg-secondary/20 p-4 text-sm">
              {entry.thesisSummary}
            </p>
          )}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {entry.rationale}
          </p>
        </Section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section title="Supporting evidence">
            <List
              items={entry.keyFactors}
              empty="No supporting factors documented."
              positive
            />
          </Section>
          <Section title="Contrary evidence">
            <List
              items={entry.contraryEvidence}
              empty="No contrary evidence documented."
            />
          </Section>
        </div>

        <Section title="Process quality">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <QualityComponent
              label="Documentation"
              value={entry.quality.documentation}
              max={20}
            />
            <QualityComponent
              label="Quantification"
              value={entry.quality.quantification}
              max={20}
            />
            <QualityComponent
              label="Evidence balance"
              value={entry.quality.evidenceBalance}
              max={20}
            />
            <QualityComponent
              label="Review plan"
              value={entry.quality.reviewPlan}
              max={15}
            />
            <QualityComponent
              label="Integrity links"
              value={entry.quality.processIntegrity}
              max={15}
            />
            <QualityComponent
              label="Learning"
              value={entry.quality.learning}
              max={10}
            />
          </div>
          {entry.quality.missing.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs font-semibold text-amber-500">
                Process gaps
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {entry.quality.missing.join(" · ")}
              </p>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {entry.guardianCheckId && (
              <span className="rounded border px-2 py-1">
                Guardian: {entry.guardianCheckId}
              </span>
            )}
            {entry.transactionId && (
              <span className="rounded border px-2 py-1">
                Transaction #{entry.transactionId}
              </span>
            )}
            {entry.researchCompanyId && (
              <span className="rounded border px-2 py-1">
                Research #{entry.researchCompanyId}
              </span>
            )}
          </div>
        </Section>

        <Section title="Review schedule">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <Field label="Next review">
              <Input
                type="datetime-local"
                value={nextReview}
                onChange={(e) => setNextReview(e.target.value)}
              />
            </Field>
            <Button
              variant="outline"
              onClick={schedule}
              disabled={scheduleMutation.isPending}
              className="gap-2"
            >
              <CalendarClock className="h-4 w-4" /> Schedule review
            </Button>
            <span className="pb-2 text-xs text-muted-foreground">
              {entry.reviewCount ?? entry.reviews?.length ?? 0} reviews recorded
            </span>
          </div>
        </Section>

        <Section title="Outcome and lessons">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Outcome">
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as DecisionOutcome)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {OUTCOMES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Actual return %">
              <Input
                type="number"
                value={actualReturn}
                onChange={(e) => setActualReturn(e.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <Button
                onClick={saveOutcome}
                disabled={updateMutation.isPending}
                className="w-full gap-2"
              >
                <Save className="h-4 w-4" /> Save outcome
              </Button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="What actually happened?">
              <Textarea
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
              />
            </Field>
            <Field label="Lessons learned">
              <Textarea
                value={lessons}
                onChange={(e) => setLessons(e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {entry.reviews && entry.reviews.length > 0 && (
          <Section title="Review history">
            <div className="space-y-3">
              {entry.reviews.map((review) => (
                <ReviewHistoryCard key={review.id} review={review} />
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-secondary/20 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate font-mono text-sm font-bold",
          positive && "text-emerald-500",
          negative && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function List({
  items,
  empty,
  positive,
}: {
  items: string[];
  empty: string;
  positive?: boolean;
}) {
  return items.length ? (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className="flex gap-2 text-sm text-muted-foreground"
        >
          <span
            className={cn(
              "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
              positive ? "bg-emerald-500" : "bg-amber-500",
            )}
          />
          {item}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">{empty}</p>
  );
}

function QualityComponent({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = (value / max) * 100;
  return (
    <div className="rounded-lg bg-secondary/30 p-3">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span>
          {value}/{max}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
        <div
          className={cn(
            "h-full rounded-full",
            pct >= 80
              ? "bg-emerald-500"
              : pct >= 50
                ? "bg-amber-500"
                : "bg-destructive",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ReviewHistoryCard({ review }: { review: JournalReview }) {
  return (
    <div className="rounded-lg border bg-secondary/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium capitalize">
            {review.reviewType.replace("_", " ")}
          </span>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
              review.status === "completed"
                ? "bg-emerald-500/15 text-emerald-500"
                : review.status === "due"
                  ? "bg-amber-500/15 text-amber-500"
                  : "bg-secondary text-muted-foreground",
            )}
          >
            {review.status}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {date(review.scheduledFor)}
        </span>
      </div>
      {review.whatChanged && (
        <p className="mt-3 text-sm text-muted-foreground">
          {review.whatChanged}
        </p>
      )}
      {review.returnSinceDecisionPct !== null && (
        <p
          className={cn(
            "mt-2 font-mono text-sm font-bold",
            review.returnSinceDecisionPct >= 0
              ? "text-emerald-500"
              : "text-destructive",
          )}
        >
          {percent(review.returnSinceDecisionPct)} since decision
        </p>
      )}
    </div>
  );
}

function ReviewQueue() {
  const [status, setStatus] = useState("due");
  const reviewsQuery = useJournalReviews(status || undefined);
  const [activeReview, setActiveReview] = useState<JournalReview | null>(null);
  const reviews = reviewsQuery.data ?? [];
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
      <Card>
        <CardHeader className="border-b bg-secondary/20">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Review queue</CardTitle>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="due">Due</option>
              <option value="completed">Completed</option>
              <option value="skipped">Skipped</option>
              <option value="">All</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {reviewsQuery.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))
          ) : reviews.length ? (
            reviews.map((review) => (
              <button
                key={review.id}
                type="button"
                onClick={() => setActiveReview(review)}
                className={cn(
                  "w-full rounded-lg border p-4 text-left transition-colors hover:bg-secondary/30",
                  activeReview?.id === review.id &&
                    "border-primary/40 bg-primary/5",
                  review.overdue && "border-amber-500/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{review.ticker}</span>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">
                        {review.reviewType.replace("_", " ")}
                      </span>
                      {review.overdue && (
                        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Original {review.decisionType} decision ·{" "}
                      {date(review.decisionDate)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Due {date(review.scheduledFor)}
                  </span>
                </div>
                {review.status === "completed" && (
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span>
                      Action:{" "}
                      <strong>
                        {review.actionAfterReview.replace("_", " ")}
                      </strong>
                    </span>
                    <span>
                      Quality:{" "}
                      <strong>{review.reviewQualityScore ?? 0}/100</strong>
                    </span>
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center text-center text-muted-foreground">
              <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500/50" />
              <p className="font-medium text-foreground">Queue is clear</p>
              <p className="mt-1 text-sm">No reviews match this filter.</p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        {activeReview ? (
          <CompleteReviewForm
            review={activeReview}
            onDone={() => setActiveReview(null)}
          />
        ) : (
          <div className="flex min-h-[520px] flex-col items-center justify-center px-8 text-center text-muted-foreground">
            <RefreshCw className="mb-4 h-10 w-10 opacity-30" />
            <p className="font-medium text-foreground">Select a review</p>
            <p className="mt-1 text-sm">
              Compare the original thesis with current evidence before choosing
              the next action.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

function CompleteReviewForm({
  review,
  onDone,
}: {
  review: JournalReview;
  onDone: () => void;
}) {
  const complete = useCompleteJournalReview();
  const skip = useSkipJournalReview();
  const [currentPrice, setCurrentPrice] = useState("");
  const [whatChanged, setWhatChanged] = useState("");
  const [evidenceFor, setEvidenceFor] = useState("");
  const [evidenceAgainst, setEvidenceAgainst] = useState("");
  const [thesisStatusAfter, setThesisStatusAfter] = useState("monitoring");
  const [convictionAfter, setConvictionAfter] = useState("medium");
  const [action, setAction] = useState<ReviewAction>("no_change");
  const [notes, setNotes] = useState("");
  const [nextReview, setNextReview] = useState(
    dateTimeLocal(new Date(Date.now() + 90 * 86_400_000).toISOString()),
  );
  const submit = () =>
    complete.mutate(
      {
        reviewId: review.id,
        input: {
          currentPrice: numberOrNull(currentPrice),
          whatChanged,
          evidenceFor,
          evidenceAgainst,
          thesisStatusAfter,
          convictionAfter,
          actionAfterReview: action,
          notes,
          nextReviewAt:
            action === "exit" ? null : new Date(nextReview).toISOString(),
        },
      },
      { onSuccess: onDone },
    );
  const error =
    complete.error instanceof Error
      ? complete.error.message
      : skip.error instanceof Error
        ? skip.error.message
        : null;
  return (
    <div className="max-h-[760px] overflow-y-auto">
      <div className="border-b bg-secondary/20 p-5">
        <h3 className="font-semibold">Review {review.ticker}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Due {date(review.scheduledFor)} · Original {review.decisionType} at{" "}
          {money(review.executionPrice)}
        </p>
      </div>
      <div className="space-y-4 p-5">
        <Field label="Current price">
          <Input
            type="number"
            value={currentPrice}
            onChange={(e) => setCurrentPrice(e.target.value)}
          />
        </Field>
        <Field label="What changed since the decision?">
          <Textarea
            value={whatChanged}
            onChange={(e) => setWhatChanged(e.target.value)}
          />
        </Field>
        <Field label="Evidence supporting the thesis">
          <Textarea
            value={evidenceFor}
            onChange={(e) => setEvidenceFor(e.target.value)}
          />
        </Field>
        <Field label="Evidence against the thesis">
          <Textarea
            value={evidenceAgainst}
            onChange={(e) => setEvidenceAgainst(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Thesis status">
            <select
              value={thesisStatusAfter}
              onChange={(e) => setThesisStatusAfter(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="intact">intact</option>
              <option value="monitoring">monitoring</option>
              <option value="weakening">weakening</option>
              <option value="broken">broken</option>
              <option value="closed">closed</option>
            </select>
          </Field>
          <Field label="Conviction">
            <select
              value={convictionAfter}
              onChange={(e) => setConvictionAfter(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
              <option value="watch">watch</option>
            </select>
          </Field>
        </div>
        <Field label="Action after review">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as ReviewAction)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {REVIEW_ACTIONS.map((item) => (
              <option key={item} value={item}>
                {item.replace("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        {action !== "exit" && (
          <Field label="Next review">
            <Input
              type="datetime-local"
              value={nextReview}
              onChange={(e) => setNextReview(e.target.value)}
            />
          </Field>
        )}
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-between border-t pt-4">
          <Button
            variant="ghost"
            onClick={() =>
              skip.mutate(
                { reviewId: review.id, notes: "Skipped from review queue" },
                { onSuccess: onDone },
              )
            }
          >
            Skip review
          </Button>
          <Button
            onClick={submit}
            disabled={complete.isPending || whatChanged.trim().length < 20}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" /> Complete review
          </Button>
        </div>
      </div>
    </div>
  );
}

function AnalyticsPanel() {
  const query = useJournalAnalytics(true);
  const data = query.data;
  if (query.isLoading)
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    );
  if (!data)
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Analytics unavailable.
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AnalyticsMetric
          label="Overall process"
          value={`${data.overallScore}/100`}
          icon={Brain}
        />
        <AnalyticsMetric
          label="Decisions"
          value={data.totalDecisions.toString()}
          icon={BookOpen}
        />
        <AnalyticsMetric
          label="Win rate"
          value={
            data.completedOutcomes ? `${data.winRatePct.toFixed(0)}%` : "—"
          }
          icon={TrendingUp}
        />
        <AnalyticsMetric
          label="Average return"
          value={
            data.completedOutcomes ? percent(data.averageActualReturnPct) : "—"
          }
          icon={BarChart3}
        />
        <AnalyticsMetric
          label="Overdue reviews"
          value={data.overdueReviewCount.toString()}
          icon={CalendarClock}
          warning={data.overdueReviewCount > 0}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Process components</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScoreRow
              label="Average decision quality"
              value={data.averageDecisionQuality}
            />
            <ScoreRow
              label="Documentation"
              value={data.components.documentationScore}
            />
            <ScoreRow
              label="Evidence balance"
              value={data.components.evidenceBalanceScore}
            />
            <ScoreRow
              label="Review discipline"
              value={data.components.reviewDisciplineScore}
            />
            <ScoreRow
              label="Outcome learning"
              value={data.components.outcomeLearningScore}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quality distribution</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {Object.entries(data.qualityBands).map(([band, count]) => (
              <div key={band} className="rounded-lg border bg-secondary/20 p-4">
                <p className="text-xs capitalize text-muted-foreground">
                  {band}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold">{count}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top process gaps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topProcessGaps.length ? (
              data.topProcessGaps.map((item) => (
                <div
                  key={item.gap}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="text-sm">{item.gap}</span>
                  <span className="rounded bg-amber-500/15 px-2 py-1 font-mono text-xs font-bold text-amber-500">
                    {item.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No recurring process gaps detected.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Emotional-state patterns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.emotionalPatterns.length ? (
              data.emotionalPatterns.map((item) => (
                <div
                  key={item.emotion}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-lg border p-3"
                >
                  <span className="text-sm capitalize">{item.emotion}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.count} decisions
                  </span>
                  <span className="font-mono text-xs font-bold">
                    {item.averageReturnPct === null
                      ? "—"
                      : percent(item.averageReturnPct)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Add decisions to identify emotional patterns.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AnalyticsMetric({
  label,
  value,
  icon: Icon,
  warning,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  warning?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-2 font-mono text-2xl font-bold",
              warning && "text-amber-500",
            )}
          >
            {value}
          </p>
        </div>
        <div className="rounded-full border bg-secondary/50 p-3">
          <Icon
            className={cn("h-5 w-5 text-primary", warning && "text-amber-500")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  const rounded = Math.round(value);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-bold">{rounded}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full",
            rounded >= 80
              ? "bg-emerald-500"
              : rounded >= 60
                ? "bg-amber-500"
                : "bg-destructive",
          )}
          style={{ width: `${Math.min(100, rounded)}%` }}
        />
      </div>
    </div>
  );
}
