import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  FileText,
  Loader2,
  Pin,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateCatalyst,
  useCreateInvalidation,
  useCreateResearchCompany,
  useCreateResearchNote,
  useCreateRisk,
  useCreateValuationAssumption,
  useDeleteCatalyst,
  useDeleteInvalidation,
  useDeleteResearchNote,
  useDeleteRisk,
  useDeleteValuationAssumption,
  useResearchCompanies,
  useResearchWorkspace,
  useSaveThesis,
  useUpdateResearchCompany,
  type CatalystInput,
  type InvalidationInput,
  type InvestmentThesis,
  type NoteInput,
  type ResearchCompanySummary,
  type ResearchConviction,
  type ResearchImpact,
  type ResearchNoteCategory,
  type ResearchProbability,
  type ResearchScenario,
  type ResearchWorkspace,
  type RiskInput,
  type ThesisInput,
  type ThesisStatus,
  type ValuationAssumptionInput,
} from "@/features/research/api";
import { cn } from "@/lib/utils";

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function money(value: number | null | undefined) {
  return value === null || value === undefined
    ? "—"
    : moneyFormatter.format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function inputDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-secondary">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          value >= 75
            ? "bg-emerald-500"
            : value >= 50
              ? "bg-primary"
              : value >= 25
                ? "bg-amber-500"
                : "bg-destructive",
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function StatusPill({
  value,
  kind = "status",
}: {
  value: string;
  kind?: "status" | "conviction" | "impact";
}) {
  const classes =
    value === "intact" ||
    value === "high" ||
    value === "complete" ||
    value === "resolved"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
      : value === "weakening" ||
          value === "medium" ||
          value === "monitoring" ||
          value === "developing"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
        : value === "broken" || value === "triggered"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-border bg-secondary/50 text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        classes,
      )}
      data-kind={kind}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

function SectionHeader({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg border bg-secondary/40 p-2">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Research() {
  const [search, setSearch] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(
    () =>
      new URLSearchParams(window.location.search)
        .get("ticker")
        ?.toUpperCase() ?? null,
  );
  const [showAdd, setShowAdd] = useState(false);
  const companies = useResearchCompanies(search);

  useEffect(() => {
    if (!selectedTicker && companies.data?.length) {
      setSelectedTicker(companies.data[0].ticker);
    }
  }, [companies.data, selectedTicker]);

  function selectTicker(ticker: string) {
    setSelectedTicker(ticker);
    const url = new URL(window.location.href);
    url.searchParams.set("ticker", ticker);
    window.history.replaceState({}, "", url);
  }

  if (companies.isError) {
    return (
      <Card className="max-w-2xl border-amber-500/30 bg-amber-500/5">
        <CardContent className="space-y-3 p-8">
          <AlertTriangle className="h-9 w-9 text-amber-500" />
          <h1 className="text-2xl font-semibold">Research Engine</h1>
          <p className="text-sm text-muted-foreground">
            {errorMessage(companies.error)}
          </p>
        </CardContent>
      </Card>
    );
  }

  const selected =
    companies.data?.find((company) => company.ticker === selectedTicker) ??
    null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> AlphaDesk Phase 2
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Research Engine</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn every holding and watchlist idea into a documented, reviewable
            investment thesis.
          </p>
        </div>
        <Button onClick={() => setShowAdd((value) => !value)}>
          <Plus className="mr-2 h-4 w-4" /> Add company
        </Button>
      </div>

      {showAdd ? (
        <AddCompanyCard
          onCreated={(ticker) => {
            setShowAdd(false);
            selectTicker(ticker);
          }}
          onCancel={() => setShowAdd(false)}
        />
      ) : null}

      <div className="grid min-h-[680px] gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-secondary/20 p-4">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
              Coverage universe
            </CardTitle>
            <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-[25%] text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search ticker, company or sector"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[720px] space-y-1 overflow-y-auto p-2">
            {companies.isLoading
              ? Array.from({ length: 7 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 w-full" />
                ))
              : companies.data?.map((company) => (
                  <CompanyListItem
                    key={company.ticker}
                    company={company}
                    selected={company.ticker === selectedTicker}
                    onClick={() => selectTicker(company.ticker)}
                  />
                ))}
            {!companies.isLoading && companies.data?.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No matching companies. Add a company or import holdings in the
                Portfolio Engine.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="min-w-0">
          {!selectedTicker ? (
            <Card className="flex min-h-[680px] items-center justify-center">
              <CardContent className="text-center">
                <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
                <h2 className="mt-4 text-lg font-semibold">Choose a company</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Select a holding or add a coverage company to start research.
                </p>
              </CardContent>
            </Card>
          ) : selected && !selected.isCovered ? (
            <StartCoverage
              company={selected}
              onStarted={() => selectTicker(selected.ticker)}
            />
          ) : (
            <CompanyWorkspace ticker={selectedTicker} />
          )}
        </div>
      </div>
    </div>
  );
}

function CompanyListItem({
  company,
  selected,
  onClick,
}: {
  company: ResearchCompanySummary;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-primary/40 bg-primary/10"
          : "border-transparent hover:border-border hover:bg-secondary/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold">{company.ticker}</span>
            {company.isHolding ? (
              <BriefcaseBusiness
                className="h-3.5 w-3.5 text-primary"
                aria-label="Portfolio holding"
              />
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {company.name}
          </p>
        </div>
        <StatusPill value={company.conviction} kind="conviction" />
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <StatusPill value={company.thesisStatus} />
        <span>{company.completenessScore}% complete</span>
      </div>
      <div className="mt-2">
        <ProgressBar value={company.completenessScore} />
      </div>
      {!company.isCovered ? (
        <p className="mt-2 text-[11px] font-medium text-amber-500">
          Holding not yet covered
        </p>
      ) : null}
    </button>
  );
}

function AddCompanyCard({
  onCreated,
  onCancel,
}: {
  onCreated: (ticker: string) => void;
  onCancel: () => void;
}) {
  const create = useCreateResearchCompany();
  const [form, setForm] = useState({
    ticker: "",
    name: "",
    sector: "",
    industry: "",
    exchange: "NSE",
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(form, {
      onSuccess: (workspace) => onCreated(workspace.company.ticker),
    });
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-5">
        <form className="space-y-4" onSubmit={submit}>
          <SectionHeader
            icon={<Plus className="h-4 w-4 text-primary" />}
            title="Add coverage company"
            description="When the ticker already exists in your portfolio, AlphaDesk automatically links the holding context."
          />
          <div className="grid gap-3 md:grid-cols-5">
            <Field label="Ticker">
              <Input
                required
                placeholder="RELIANCE"
                value={form.ticker}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ticker: event.target.value.toUpperCase(),
                  }))
                }
              />
            </Field>
            <Field label="Company name">
              <Input
                placeholder="Reliance Industries"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Sector">
              <Input
                placeholder="Energy"
                value={form.sector}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sector: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Industry">
              <Input
                placeholder="Diversified"
                value={form.industry}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    industry: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Exchange">
              <Input
                value={form.exchange}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    exchange: event.target.value.toUpperCase(),
                  }))
                }
              />
            </Field>
          </div>
          {create.isError ? (
            <p className="text-sm text-destructive">
              {errorMessage(create.error)}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Start coverage
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StartCoverage({
  company,
  onStarted,
}: {
  company: ResearchCompanySummary;
  onStarted: () => void;
}) {
  const create = useCreateResearchCompany();
  return (
    <Card className="flex min-h-[680px] items-center justify-center border-amber-500/30 bg-amber-500/5">
      <CardContent className="max-w-lg p-8 text-center">
        <BriefcaseBusiness className="mx-auto h-12 w-12 text-amber-500" />
        <h2 className="mt-4 text-2xl font-semibold">
          Start coverage for {company.ticker}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This portfolio holding is not yet connected to a research record.
          Starting coverage will preserve its ticker, company name, sector and
          current portfolio context.
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
          <Metric label="Position" value={money(company.marketValue)} />
          <Metric
            label="Allocation"
            value={`${company.allocationPct.toFixed(1)}%`}
          />
          <Metric
            label="Quantity"
            value={company.quantity.toLocaleString("en-IN")}
          />
        </div>
        {create.isError ? (
          <p className="mt-4 text-sm text-destructive">
            {errorMessage(create.error)}
          </p>
        ) : null}
        <Button
          className="mt-6"
          disabled={create.isPending}
          onClick={() =>
            create.mutate(
              {
                ticker: company.ticker,
                name: company.name,
                exchange: company.exchange,
                sector: company.sector,
                currentPrice: company.currentPrice,
                previousClose: company.previousClose,
              },
              { onSuccess: onStarted },
            )
          }
        >
          {create.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <BookOpen className="mr-2 h-4 w-4" />
          )}
          Create research workspace
        </Button>
      </CardContent>
    </Card>
  );
}

function CompanyWorkspace({ ticker }: { ticker: string }) {
  const workspace = useResearchWorkspace(ticker);
  if (workspace.isLoading) {
    return <Skeleton className="min-h-[680px] w-full" />;
  }
  if (workspace.isError || !workspace.data) {
    return (
      <Card className="min-h-[680px]">
        <CardContent className="p-8 text-center text-sm text-destructive">
          {errorMessage(workspace.error)}
        </CardContent>
      </Card>
    );
  }

  const data = workspace.data;
  const price = data.holding?.marketPrice ?? data.company.currentPrice;
  const basePrice = data.thesis?.basePrice ?? data.thesis?.targetPrice;
  const upside =
    price && basePrice ? ((basePrice - price) / price) * 100 : null;

  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-secondary/15 p-5 lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-3xl font-bold">{data.company.ticker}</h2>
              <span className="rounded-md border bg-secondary/50 px-2 py-1 text-xs">
                {data.company.exchange}
              </span>
              {data.holding ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary">
                  <BriefcaseBusiness className="h-3 w-3" /> Portfolio holding
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-lg text-muted-foreground">
              {data.company.name}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {[data.company.sector, data.company.industry]
                .filter(Boolean)
                .join(" · ") || "Sector not classified"}
            </p>
          </div>
          <div className="grid min-w-[320px] grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Price" value={money(price)} />
            <Metric label="Base value" value={money(basePrice)} />
            <Metric
              label="Upside"
              value={
                upside === null
                  ? "—"
                  : `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%`
              }
              tone={upside !== null && upside >= 0 ? "positive" : "negative"}
            />
            <Metric
              label="Completeness"
              value={`${data.completeness.score}%`}
            />
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Research completeness
              </span>
              <span className="font-medium capitalize">
                {data.completeness.band.replaceAll("_", " ")}
              </span>
            </div>
            <ProgressBar value={data.completeness.score} />
          </div>
          <div className="flex items-center gap-2">
            <StatusPill
              value={data.thesis?.conviction ?? "watch"}
              kind="conviction"
            />
            <StatusPill value={data.thesis?.status ?? "draft"} />
          </div>
        </div>
      </div>

      <Tabs defaultValue="thesis" className="w-full">
        <div className="overflow-x-auto border-b px-4">
          <TabsList className="h-12 min-w-[720px] justify-start bg-transparent">
            <TabsTrigger value="thesis">Thesis</TabsTrigger>
            <TabsTrigger value="notes">
              Research notes ({data.notes.length})
            </TabsTrigger>
            <TabsTrigger value="valuation">Valuation</TabsTrigger>
            <TabsTrigger value="risks">Catalysts & risks</TabsTrigger>
            <TabsTrigger value="review">Review readiness</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="thesis" className="m-0 p-5 lg:p-6">
          <ThesisEditor data={data} />
        </TabsContent>
        <TabsContent value="notes" className="m-0 p-5 lg:p-6">
          <NotesPanel data={data} />
        </TabsContent>
        <TabsContent value="valuation" className="m-0 p-5 lg:p-6">
          <ValuationPanel data={data} />
        </TabsContent>
        <TabsContent value="risks" className="m-0 p-5 lg:p-6">
          <CatalystsRisksPanel data={data} />
        </TabsContent>
        <TabsContent value="review" className="m-0 p-5 lg:p-6">
          <ReviewPanel data={data} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate font-mono text-sm font-semibold",
          tone === "positive" && "text-emerald-500",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

interface ThesisFormState {
  summary: string;
  bullCase: string;
  baseCase: string;
  bearCase: string;
  conviction: ResearchConviction;
  status: ThesisStatus;
  moatRating: string;
  managementRating: string;
  investmentHorizon: string;
  expectedReturnPct: string;
  maxAcceptableLossPct: string;
  targetPrice: string;
  bullPrice: string;
  basePrice: string;
  bearPrice: string;
  valuationMethodology: string;
  keyAssumptions: string;
  lastReviewedAt: string;
  nextReviewAt: string;
}

function thesisForm(thesis: InvestmentThesis | null): ThesisFormState {
  return {
    summary: thesis?.summary ?? "",
    bullCase: thesis?.bullCase ?? "",
    baseCase: thesis?.baseCase ?? "",
    bearCase: thesis?.bearCase ?? "",
    conviction: thesis?.conviction ?? "medium",
    status: thesis?.status ?? "draft",
    moatRating: thesis?.moatRating ?? "",
    managementRating: thesis?.managementRating ?? "",
    investmentHorizon: thesis?.investmentHorizon ?? "",
    expectedReturnPct: thesis?.expectedReturnPct?.toString() ?? "",
    maxAcceptableLossPct: thesis?.maxAcceptableLossPct?.toString() ?? "",
    targetPrice: thesis?.targetPrice?.toString() ?? "",
    bullPrice: thesis?.bullPrice?.toString() ?? "",
    basePrice: thesis?.basePrice?.toString() ?? "",
    bearPrice: thesis?.bearPrice?.toString() ?? "",
    valuationMethodology: thesis?.valuationMethodology ?? "",
    keyAssumptions: thesis?.keyAssumptions.join("\n") ?? "",
    lastReviewedAt: inputDate(thesis?.lastReviewedAt),
    nextReviewAt: inputDate(thesis?.nextReviewAt),
  };
}

function ThesisEditor({ data }: { data: ResearchWorkspace }) {
  const [form, setForm] = useState<ThesisFormState>(() =>
    thesisForm(data.thesis),
  );
  const save = useSaveThesis(data.company.ticker);
  useEffect(() => setForm(thesisForm(data.thesis)), [data.thesis]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const payload: ThesisInput = {
      summary: form.summary,
      bullCase: form.bullCase,
      baseCase: form.baseCase,
      bearCase: form.bearCase,
      conviction: form.conviction,
      status: form.status,
      moatRating: form.moatRating,
      managementRating: form.managementRating,
      investmentHorizon: form.investmentHorizon,
      expectedReturnPct: numberOrNull(form.expectedReturnPct),
      maxAcceptableLossPct: numberOrNull(form.maxAcceptableLossPct),
      targetPrice: numberOrNull(form.targetPrice),
      bullPrice: numberOrNull(form.bullPrice),
      basePrice: numberOrNull(form.basePrice),
      bearPrice: numberOrNull(form.bearPrice),
      valuationMethodology: form.valuationMethodology,
      keyAssumptions: form.keyAssumptions
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      lastReviewedAt: form.lastReviewedAt || null,
      nextReviewAt: form.nextReviewAt || null,
    };
    save.mutate(payload);
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      <SectionHeader
        icon={<Target className="h-4 w-4 text-primary" />}
        title="Investment thesis"
        description="Write the decision logic in a form that can be challenged, reviewed and eventually compared with the outcome."
        action={
          <Button disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save thesis
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Conviction">
          <NativeSelect
            value={form.conviction}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                conviction: value as ResearchConviction,
              }))
            }
          >
            {(["high", "medium", "low", "watch"] as const).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Thesis status">
          <NativeSelect
            value={form.status}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                status: value as ThesisStatus,
              }))
            }
          >
            {(
              [
                "draft",
                "intact",
                "monitoring",
                "weakening",
                "broken",
                "closed",
              ] as const
            ).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Investment horizon">
          <Input
            value={form.investmentHorizon}
            placeholder="3–5 years"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                investmentHorizon: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Next review">
          <Input
            type="date"
            value={form.nextReviewAt}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                nextReviewAt: event.target.value,
              }))
            }
          />
        </Field>
      </div>

      <Field
        label="Core thesis"
        hint="State what the market is missing, the earnings or cash-flow driver, and why the gap should close."
      >
        <Textarea
          className="min-h-32"
          value={form.summary}
          onChange={(event) =>
            setForm((current) => ({ ...current, summary: event.target.value }))
          }
        />
      </Field>

      <div className="grid gap-4 xl:grid-cols-3">
        <ScenarioEditor
          title="Bull case"
          tone="positive"
          value={form.bullCase}
          onChange={(value) =>
            setForm((current) => ({ ...current, bullCase: value }))
          }
        />
        <ScenarioEditor
          title="Base case"
          tone="neutral"
          value={form.baseCase}
          onChange={(value) =>
            setForm((current) => ({ ...current, baseCase: value }))
          }
        />
        <ScenarioEditor
          title="Bear case"
          tone="negative"
          value={form.bearCase}
          onChange={(value) =>
            setForm((current) => ({ ...current, bearCase: value }))
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Moat rating">
          <Input
            placeholder="Wide / Narrow / None"
            value={form.moatRating}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                moatRating: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Management rating">
          <Input
            placeholder="Excellent / Good / Average"
            value={form.managementRating}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                managementRating: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Expected return %">
          <Input
            type="number"
            step="any"
            value={form.expectedReturnPct}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                expectedReturnPct: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Maximum acceptable loss %">
          <Input
            type="number"
            step="any"
            value={form.maxAcceptableLossPct}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                maxAcceptableLossPct: event.target.value,
              }))
            }
          />
        </Field>
      </div>

      <Field
        label="Key assumptions"
        hint="Enter one falsifiable assumption per line."
      >
        <Textarea
          className="min-h-36 font-mono text-sm"
          value={form.keyAssumptions}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              keyAssumptions: event.target.value,
            }))
          }
        />
      </Field>
      {save.isError ? (
        <p className="text-sm text-destructive">{errorMessage(save.error)}</p>
      ) : null}
      {save.isSuccess ? (
        <p className="text-sm text-emerald-500">
          Thesis saved and completeness recalculated.
        </p>
      ) : null}
    </form>
  );
}

function ScenarioEditor({
  title,
  tone,
  value,
  onChange,
}: {
  title: string;
  tone: "positive" | "neutral" | "negative";
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        tone === "positive"
          ? "border-emerald-500/25 bg-emerald-500/5"
          : tone === "negative"
            ? "border-destructive/25 bg-destructive/5"
            : "bg-secondary/20",
      )}
    >
      <Label
        className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          tone === "positive"
            ? "text-emerald-500"
            : tone === "negative"
              ? "text-destructive"
              : "text-primary",
        )}
      >
        {title}
      </Label>
      <Textarea
        className="mt-3 min-h-36 bg-background/80"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function NotesPanel({ data }: { data: ResearchWorkspace }) {
  const create = useCreateResearchNote(data.company.ticker);
  const remove = useDeleteResearchNote(data.company.ticker);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NoteInput>({
    title: "",
    category: "general",
    content: "",
    sourceLabel: "",
    sourceUrl: "",
    eventDate: "",
    isPinned: false,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(form, {
      onSuccess: () => {
        setForm({
          title: "",
          category: "general",
          content: "",
          sourceLabel: "",
          sourceUrl: "",
          eventDate: "",
          isPinned: false,
        });
        setShowForm(false);
      },
    });
  }

  const grouped = useMemo(() => {
    return [...data.notes].sort(
      (a, b) => Number(b.isPinned) - Number(a.isPinned),
    );
  }, [data.notes]);

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={<FileText className="h-4 w-4 text-primary" />}
        title="Research evidence"
        description="Capture facts, interpretation and sources separately from the core thesis."
        action={
          <Button onClick={() => setShowForm((value) => !value)}>
            <Plus className="mr-2 h-4 w-4" /> Add note
          </Button>
        }
      />
      {showForm ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <form className="space-y-4" onSubmit={submit}>
              <div className="grid gap-3 md:grid-cols-[1fr_180px_160px]">
                <Field label="Title">
                  <Input
                    required
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Category">
                  <NativeSelect
                    value={form.category ?? "general"}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        category: value as ResearchNoteCategory,
                      }))
                    }
                  >
                    {(
                      [
                        "general",
                        "thesis",
                        "financials",
                        "valuation",
                        "management",
                        "industry",
                        "earnings",
                        "risk",
                        "catalyst",
                      ] as const
                    ).map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Event date">
                  <Input
                    type="date"
                    value={form.eventDate ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        eventDate: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
              <Field label="Note">
                <Textarea
                  required
                  className="min-h-32"
                  value={form.content}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      content: event.target.value,
                    }))
                  }
                />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Source label">
                  <Input
                    placeholder="Q1 FY27 earnings call"
                    value={form.sourceLabel ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        sourceLabel: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Source URL">
                  <Input
                    type="url"
                    placeholder="https://…"
                    value={form.sourceUrl ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        sourceUrl: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isPinned: event.target.checked,
                    }))
                  }
                />{" "}
                Pin this note
              </label>
              {create.isError ? (
                <p className="text-sm text-destructive">
                  {errorMessage(create.error)}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button disabled={create.isPending}>Save note</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-2">
        {grouped.map((note) => (
          <Card
            key={note.id}
            className={cn(note.isPinned && "border-primary/30")}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {note.isPinned ? (
                      <Pin className="h-3.5 w-3.5 text-primary" />
                    ) : null}
                    <StatusPill value={note.category} />
                  </div>
                  <h4 className="mt-2 font-semibold">{note.title}</h4>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove.mutate(note.id)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {note.content}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-[11px] text-muted-foreground">
                <span>
                  {note.eventDate
                    ? formatDate(note.eventDate)
                    : formatDate(note.createdAt)}
                </span>
                {note.sourceUrl ? (
                  <a
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    href={note.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {note.sourceLabel || "Open source"}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : note.sourceLabel ? (
                  <span>{note.sourceLabel}</span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {data.notes.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No research notes"
          description="Add sourced evidence, earnings observations and management commentary."
        />
      ) : null}
    </div>
  );
}

function ValuationPanel({ data }: { data: ResearchWorkspace }) {
  const saveThesis = useSaveThesis(data.company.ticker);
  const create = useCreateValuationAssumption(data.company.ticker);
  const remove = useDeleteValuationAssumption(data.company.ticker);
  const [prices, setPrices] = useState({
    bullPrice: data.thesis?.bullPrice?.toString() ?? "",
    basePrice: data.thesis?.basePrice?.toString() ?? "",
    bearPrice: data.thesis?.bearPrice?.toString() ?? "",
    targetPrice: data.thesis?.targetPrice?.toString() ?? "",
    valuationMethodology: data.thesis?.valuationMethodology ?? "",
  });
  const [form, setForm] = useState<ValuationAssumptionInput>({
    label: "",
    value: "",
    unit: "",
    scenario: "common",
    notes: "",
  });
  useEffect(
    () =>
      setPrices({
        bullPrice: data.thesis?.bullPrice?.toString() ?? "",
        basePrice: data.thesis?.basePrice?.toString() ?? "",
        bearPrice: data.thesis?.bearPrice?.toString() ?? "",
        targetPrice: data.thesis?.targetPrice?.toString() ?? "",
        valuationMethodology: data.thesis?.valuationMethodology ?? "",
      }),
    [data.thesis],
  );

  function saveValuation(event: FormEvent) {
    event.preventDefault();
    saveThesis.mutate({
      bullPrice: numberOrNull(prices.bullPrice),
      basePrice: numberOrNull(prices.basePrice),
      bearPrice: numberOrNull(prices.bearPrice),
      targetPrice: numberOrNull(prices.targetPrice),
      valuationMethodology: prices.valuationMethodology,
    });
  }

  function addAssumption(event: FormEvent) {
    event.preventDefault();
    create.mutate(form, {
      onSuccess: () =>
        setForm({
          label: "",
          value: "",
          unit: "",
          scenario: "common",
          notes: "",
        }),
    });
  }

  const price = data.holding?.marketPrice ?? data.company.currentPrice;
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<TrendingUp className="h-4 w-4 text-primary" />}
        title="Valuation framework"
        description="Keep valuation conclusions and their underlying assumptions explicit and independently editable."
      />
      <form
        className="space-y-4 rounded-xl border bg-secondary/15 p-4"
        onSubmit={saveValuation}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Current price">
            <Input disabled value={price?.toString() ?? ""} />
          </Field>
          <Field label="Bear value">
            <Input
              type="number"
              step="any"
              value={prices.bearPrice}
              onChange={(event) =>
                setPrices((current) => ({
                  ...current,
                  bearPrice: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Base value">
            <Input
              type="number"
              step="any"
              value={prices.basePrice}
              onChange={(event) =>
                setPrices((current) => ({
                  ...current,
                  basePrice: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Bull value">
            <Input
              type="number"
              step="any"
              value={prices.bullPrice}
              onChange={(event) =>
                setPrices((current) => ({
                  ...current,
                  bullPrice: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Action target">
            <Input
              type="number"
              step="any"
              value={prices.targetPrice}
              onChange={(event) =>
                setPrices((current) => ({
                  ...current,
                  targetPrice: event.target.value,
                }))
              }
            />
          </Field>
        </div>
        <Field label="Methodology">
          <Textarea
            className="min-h-24"
            placeholder="DCF, EV/EBITDA, P/E, SOTP or another framework, including the forecast period and reference multiple."
            value={prices.valuationMethodology}
            onChange={(event) =>
              setPrices((current) => ({
                ...current,
                valuationMethodology: event.target.value,
              }))
            }
          />
        </Field>
        <div className="flex justify-end">
          <Button disabled={saveThesis.isPending}>
            <Save className="mr-2 h-4 w-4" /> Save valuation
          </Button>
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add assumption</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={addAssumption}>
              <Field label="Assumption">
                <Input
                  required
                  placeholder="Revenue CAGR"
                  value={form.label}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Value">
                  <Input
                    required
                    placeholder="14"
                    value={form.value}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        value: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Unit">
                  <Input
                    placeholder="%"
                    value={form.unit ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        unit: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
              <Field label="Scenario">
                <NativeSelect
                  value={form.scenario ?? "common"}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      scenario: value as ResearchScenario,
                    }))
                  }
                >
                  {(["common", "bull", "base", "bear"] as const).map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </NativeSelect>
              </Field>
              <Field label="Notes">
                <Textarea
                  value={form.notes ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </Field>
              <Button className="w-full" disabled={create.isPending}>
                <Plus className="mr-2 h-4 w-4" /> Add assumption
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assumption register</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.valuationAssumptions.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.label}</span>
                    <StatusPill value={item.scenario} />
                  </div>
                  <p className="mt-1 font-mono text-sm text-primary">
                    {item.value}
                    {item.unit ? ` ${item.unit}` : ""}
                  </p>
                  {item.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.notes}
                    </p>
                  ) : null}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove.mutate(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {data.valuationAssumptions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No assumptions documented.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CatalystsRisksPanel({ data }: { data: ResearchWorkspace }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-2">
        <CatalystSection data={data} />
        <RiskSection data={data} />
      </div>
      <InvalidationSection data={data} />
    </div>
  );
}

function CatalystSection({ data }: { data: ResearchWorkspace }) {
  const create = useCreateCatalyst(data.company.ticker);
  const remove = useDeleteCatalyst(data.company.ticker);
  const [form, setForm] = useState<CatalystInput>({
    title: "",
    description: "",
    expectedDate: "",
    impact: "medium",
    probability: "medium",
    status: "active",
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(form, {
      onSuccess: () =>
        setForm({
          title: "",
          description: "",
          expectedDate: "",
          impact: "medium",
          probability: "medium",
          status: "active",
        }),
    });
  }
  return (
    <Card>
      <CardHeader>
        <SectionHeader
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          title="Catalysts"
          description="Events that can accelerate value realization."
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-3 rounded-lg border bg-secondary/15 p-3"
          onSubmit={submit}
        >
          <Field label="New catalyst">
            <Input
              required
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={form.description ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Date">
              <Input
                type="date"
                value={form.expectedDate ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expectedDate: event.target.value,
                  }))
                }
              />
            </Field>
            <EnumField
              label="Impact"
              value={form.impact ?? "medium"}
              values={["high", "medium", "low"]}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  impact: value as ResearchImpact,
                }))
              }
            />
            <EnumField
              label="Probability"
              value={form.probability ?? "medium"}
              values={["high", "medium", "low"]}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  probability: value as ResearchProbability,
                }))
              }
            />
          </div>
          <Button className="w-full" size="sm" disabled={create.isPending}>
            <Plus className="mr-2 h-3.5 w-3.5" /> Add catalyst
          </Button>
        </form>
        {data.catalysts.map((item) => (
          <ResearchItem
            key={item.id}
            title={item.title}
            description={item.description}
            meta={
              <>
                <StatusPill value={item.impact} kind="impact" />
                <span>{formatDate(item.expectedDate)}</span>
              </>
            }
            onDelete={() => remove.mutate(item.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function RiskSection({ data }: { data: ResearchWorkspace }) {
  const create = useCreateRisk(data.company.ticker);
  const remove = useDeleteRisk(data.company.ticker);
  const [form, setForm] = useState<RiskInput>({
    title: "",
    description: "",
    severity: "medium",
    probability: "medium",
    mitigation: "",
    status: "active",
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(form, {
      onSuccess: () =>
        setForm({
          title: "",
          description: "",
          severity: "medium",
          probability: "medium",
          mitigation: "",
          status: "active",
        }),
    });
  }
  return (
    <Card>
      <CardHeader>
        <SectionHeader
          icon={<ShieldAlert className="h-4 w-4 text-destructive" />}
          title="Material risks"
          description="Risks should describe the mechanism of loss, not generic disclaimers."
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-3 rounded-lg border bg-secondary/15 p-3"
          onSubmit={submit}
        >
          <Field label="New risk">
            <Input
              required
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={form.description ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <EnumField
              label="Severity"
              value={form.severity ?? "medium"}
              values={["high", "medium", "low"]}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  severity: value as ResearchImpact,
                }))
              }
            />
            <EnumField
              label="Probability"
              value={form.probability ?? "medium"}
              values={["high", "medium", "low"]}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  probability: value as ResearchProbability,
                }))
              }
            />
          </div>
          <Field label="Mitigation or monitoring plan">
            <Input
              value={form.mitigation ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  mitigation: event.target.value,
                }))
              }
            />
          </Field>
          <Button className="w-full" size="sm" disabled={create.isPending}>
            <Plus className="mr-2 h-3.5 w-3.5" /> Add risk
          </Button>
        </form>
        {data.risks.map((item) => (
          <ResearchItem
            key={item.id}
            title={item.title}
            description={item.description}
            meta={
              <>
                <StatusPill value={item.severity} kind="impact" />
                <span>{item.probability} probability</span>
              </>
            }
            footer={
              item.mitigation ? `Monitoring: ${item.mitigation}` : undefined
            }
            onDelete={() => remove.mutate(item.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function InvalidationSection({ data }: { data: ResearchWorkspace }) {
  const create = useCreateInvalidation(data.company.ticker);
  const remove = useDeleteInvalidation(data.company.ticker);
  const [form, setForm] = useState<InvalidationInput>({
    trigger: "",
    description: "",
    severity: "high",
    metricName: "",
    operator: "",
    threshold: null,
    unit: "",
    currentValue: null,
    status: "monitoring",
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(form, {
      onSuccess: () =>
        setForm({
          trigger: "",
          description: "",
          severity: "high",
          metricName: "",
          operator: "",
          threshold: null,
          unit: "",
          currentValue: null,
          status: "monitoring",
        }),
    });
  }
  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <SectionHeader
          icon={<CircleAlert className="h-4 w-4 text-destructive" />}
          title="Thesis invalidation triggers"
          description="Define what evidence would prove the thesis wrong before emotion or price action takes over."
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-3 rounded-lg border bg-secondary/15 p-4 lg:grid-cols-[1.4fr_1fr_110px_110px_90px_auto] lg:items-end"
          onSubmit={submit}
        >
          <Field label="Trigger">
            <Input
              required
              placeholder="EBITDA margin below 12% for two quarters"
              value={form.trigger}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  trigger: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Metric">
            <Input
              placeholder="EBITDA margin"
              value={form.metricName ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  metricName: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Operator">
            <Input
              placeholder="<"
              value={form.operator ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  operator: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Threshold">
            <Input
              type="number"
              step="any"
              value={form.threshold ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  threshold: numberOrNull(event.target.value),
                }))
              }
            />
          </Field>
          <Field label="Unit">
            <Input
              placeholder="%"
              value={form.unit ?? ""}
              onChange={(event) =>
                setForm((current) => ({ ...current, unit: event.target.value }))
              }
            />
          </Field>
          <Button disabled={create.isPending}>
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </form>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.invalidationTriggers.map((item) => (
            <div
              key={item.id}
              className={cn(
                "rounded-lg border p-4",
                item.status === "triggered" &&
                  "border-destructive/40 bg-destructive/5",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusPill value={item.severity} kind="impact" />
                    <StatusPill value={item.status} />
                  </div>
                  <h4 className="mt-2 font-semibold">{item.trigger}</h4>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove.mutate(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {item.description ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
              {item.metricName ? (
                <p className="mt-3 rounded bg-secondary/50 px-2 py-1 font-mono text-xs">
                  {item.metricName} {item.operator} {item.threshold}
                  {item.unit}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EnumField({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <NativeSelect value={value} onChange={onChange}>
        {values.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </NativeSelect>
    </Field>
  );
}

function ResearchItem({
  title,
  description,
  meta,
  footer,
  onDelete,
}: {
  title: string;
  description?: string | null;
  meta: ReactNode;
  footer?: string;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium">{title}</h4>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            {meta}
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {description ? (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {footer ? (
        <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
          {footer}
        </p>
      ) : null}
    </div>
  );
}

function ReviewPanel({ data }: { data: ResearchWorkspace }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
        title="Decision readiness"
        description="Completeness is not an investment recommendation. It measures whether the decision record is sufficiently explicit to review."
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Research checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.completeness.sections.map((section) => (
              <div key={section.key} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {section.complete ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <CircleAlert className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-sm font-medium">{section.label}</span>
                  </div>
                  <span className="font-mono text-xs">
                    {Math.round(section.score)}/{section.maxScore}
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar
                    value={(section.score / section.maxScore) * 100}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current record</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ReviewRow
                label="Thesis version"
                value={String(data.thesis?.version ?? 0)}
              />
              <ReviewRow
                label="Last reviewed"
                value={formatDate(data.thesis?.lastReviewedAt)}
              />
              <ReviewRow
                label="Next review"
                value={formatDate(data.thesis?.nextReviewAt)}
              />
              <ReviewRow
                label="Research notes"
                value={String(data.notes.length)}
              />
              <ReviewRow
                label="Catalysts"
                value={String(data.catalysts.length)}
              />
              <ReviewRow label="Risks" value={String(data.risks.length)} />
              <ReviewRow
                label="Invalidation triggers"
                value={String(data.invalidationTriggers.length)}
              />
            </CardContent>
          </Card>
          <Card className="border-amber-500/25 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="text-base">Highest-priority gaps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.completeness.missing.slice(0, 6).map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>{item}</span>
                </div>
              ))}
              {data.completeness.missing.length === 0 ? (
                <p className="text-sm text-emerald-500">
                  The research record is structurally complete. Continue
                  challenging the assumptions and evidence.
                </p>
              ) : null}
            </CardContent>
          </Card>
          <CompanyProfileEditor data={data} />
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function CompanyProfileEditor({ data }: { data: ResearchWorkspace }) {
  const update = useUpdateResearchCompany(data.company.ticker);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: data.company.name,
    sector: data.company.sector ?? "",
    industry: data.company.industry ?? "",
    description: data.company.description ?? "",
    website: data.company.website ?? "",
  });
  useEffect(
    () =>
      setForm({
        name: data.company.name,
        sector: data.company.sector ?? "",
        industry: data.company.industry ?? "",
        description: data.company.description ?? "",
        website: data.company.website ?? "",
      }),
    [data.company],
  );
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Company profile</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? "Close" : "Edit"}
        </Button>
      </CardHeader>
      <CardContent>
        {editing ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate(form, { onSuccess: () => setEditing(false) });
            }}
          >
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Sector">
                <Input
                  value={form.sector}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sector: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Industry">
                <Input
                  value={form.industry}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      industry: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Website">
              <Input
                value={form.website}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    website: event.target.value,
                  }))
                }
              />
            </Field>
            <Button className="w-full" disabled={update.isPending}>
              Save profile
            </Button>
          </form>
        ) : (
          <div className="space-y-2 text-sm">
            <p>{data.company.description || "No company description added."}</p>
            {data.company.website ? (
              <a
                className="inline-flex items-center gap-1 text-primary"
                href={data.company.website}
                target="_blank"
                rel="noreferrer"
              >
                Company website <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
      <div className="mx-auto w-fit">{icon}</div>
      <h3 className="mt-3 font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm">{description}</p>
    </div>
  );
}
