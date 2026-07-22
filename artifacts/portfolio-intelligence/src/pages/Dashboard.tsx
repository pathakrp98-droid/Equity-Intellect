import type { ComponentType } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  CloudOff,
  Database,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useIntegrationHealth } from "@/features/integration/api";
import {
  useGenerateMorningBrief,
  useLatestMorningBrief,
  useProviderStatus,
  useRefreshMarketIntelligence,
  type MorningBriefAction,
  type MorningBriefRisk,
} from "@/features/intelligence/api";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function relativeTime(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1_440)}d ago`;
}

function priorityClass(priority: "high" | "medium" | "low") {
  return priority === "high"
    ? "border-destructive/30 bg-destructive/5 text-destructive"
    : priority === "medium"
      ? "border-amber-500/30 bg-amber-500/5 text-amber-500"
      : "border-blue-500/30 bg-blue-500/5 text-blue-500";
}

export function Dashboard() {
  const [, navigate] = useLocation();
  const briefQuery = useLatestMorningBrief();
  const providerQuery = useProviderStatus();
  const generateBrief = useGenerateMorningBrief();
  const refreshMarket = useRefreshMarketIntelligence();
  const systemQuery = useIntegrationHealth();
  const brief = briefQuery.data;
  const busy = generateBrief.isPending || refreshMarket.isPending;

  const refreshAndGenerate = async () => {
    if (providerQuery.data?.configured) {
      await refreshMarket.mutateAsync();
    }
    await generateBrief.mutateAsync();
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-4 w-4" /> Daily decision desk
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Morning Brief</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/market-intelligence")}
          >
            <Database className="mr-2 h-4 w-4" /> Data workspace
          </Button>
          <Button disabled={busy} onClick={() => void refreshAndGenerate()}>
            <RefreshCw className={cn("mr-2 h-4 w-4", busy && "animate-spin")} />
            {providerQuery.data?.configured
              ? "Refresh brief"
              : "Regenerate brief"}
          </Button>
        </div>
      </div>

      {systemQuery.data && (
        <button
          type="button"
          onClick={() => navigate("/system-health")}
          className="flex w-full flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary/10 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold",
                systemQuery.data.readiness.band === "ready"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  : systemQuery.data.readiness.band === "setup_required"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-500",
              )}
            >
              {systemQuery.data.readiness.score}
            </div>
            <div>
              <p className="text-sm font-semibold">System readiness</p>
              <p className="text-xs text-muted-foreground">
                {systemQuery.data.readiness.blockers.length > 0
                  ? `${systemQuery.data.readiness.blockers.length} blocker${systemQuery.data.readiness.blockers.length === 1 ? "" : "s"} require review`
                  : `${systemQuery.data.readiness.recommendations.length} recommended setup action${systemQuery.data.readiness.recommendations.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-primary">
            Open system health →
          </span>
        </button>
      )}

      {briefQuery.isLoading ? (
        <DashboardSkeleton />
      ) : !brief ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
            <CloudOff className="h-10 w-10 text-muted-foreground" />
            <div>
              <h2 className="text-xl font-semibold">No brief generated yet</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                AlphaDesk can generate a grounded brief from your portfolio and
                research even before a live market provider is connected.
              </p>
            </div>
            <Button onClick={() => generateBrief.mutate()} disabled={busy}>
              Generate first brief
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-4xl">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border bg-background/80 px-2.5 py-1 font-mono">
                      Generated {relativeTime(brief.generatedAt)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-medium capitalize",
                        brief.marketPulse.tone === "positive"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : brief.marketPulse.tone === "negative"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-500",
                      )}
                    >
                      {brief.marketPulse.tone} market tone
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold leading-tight md:text-3xl">
                    {brief.headline}
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground md:text-base">
                    {brief.summary}
                  </p>
                </div>
                <DataQualityBadge brief={brief} />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Portfolio value"
              value={formatCurrency(brief.portfolioPulse.totalValue)}
              detail={`${brief.portfolioPulse.holdingsCount} holdings`}
              icon={CircleDollarSign}
            />
            <MetricCard
              title="Day P&L"
              value={formatCurrency(brief.portfolioPulse.dailyPnl)}
              detail={formatPct(brief.portfolioPulse.dailyPnlPct)}
              positive={brief.portfolioPulse.dailyPnl >= 0}
              icon={
                brief.portfolioPulse.dailyPnl >= 0 ? TrendingUp : TrendingDown
              }
            />
            <MetricCard
              title="Total return"
              value={formatPct(brief.portfolioPulse.totalReturnPct)}
              detail={formatCurrency(brief.portfolioPulse.totalPnl)}
              positive={brief.portfolioPulse.totalPnl >= 0}
              icon={TrendingUp}
            />
            <MetricCard
              title="Largest position"
              value={brief.portfolioPulse.largestPositionTicker ?? "—"}
              detail={`${brief.portfolioPulse.largestPositionPct.toFixed(1)}% · ${brief.portfolioPulse.concentrationRisk} risk`}
              icon={ShieldAlert}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" /> Priority actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {brief.priorityActions.length === 0 ? (
                  <EmptyLine text="No priority actions were generated." />
                ) : (
                  brief.priorityActions.map((action) => (
                    <ActionRow
                      key={action.id}
                      action={action}
                      onOpen={() =>
                        navigate(
                          action.ticker
                            ? `/research?ticker=${action.ticker}`
                            : "/market-intelligence",
                        )
                      }
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Key risks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {brief.risks.length === 0 ? (
                  <EmptyLine text="No material risks were surfaced." />
                ) : (
                  brief.risks
                    .slice(0, 6)
                    .map((risk) => <RiskRow key={risk.id} risk={risk} />)
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Market pulse</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  {brief.marketPulse.summary}
                </p>
                <div className="space-y-1">
                  {brief.marketPulse.keyMoves.length === 0 ? (
                    <EmptyLine text="No market indicators available." />
                  ) : (
                    brief.marketPulse.keyMoves.map((move) => (
                      <div
                        key={`${move.symbol}-${move.asOf}`}
                        className="flex items-center justify-between border-b border-border/50 py-2.5 last:border-0"
                      >
                        <div>
                          <div className="text-sm font-semibold">
                            {move.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {move.source} · {relativeTime(move.asOf)}
                          </div>
                        </div>
                        <div className="text-right font-mono text-sm">
                          <div>{move.value.toLocaleString("en-IN")}</div>
                          <div
                            className={cn(
                              "text-xs",
                              (move.changePct ?? 0) >= 0
                                ? "text-emerald-500"
                                : "text-destructive",
                            )}
                          >
                            {move.changePct === null
                              ? "—"
                              : formatPct(move.changePct)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4 text-primary" /> Upcoming
                  events
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {brief.upcomingEvents.length === 0 ? (
                  <EmptyLine text="No portfolio-relevant events in the next 14 days." />
                ) : (
                  brief.upcomingEvents.slice(0, 8).map((event) => (
                    <div
                      key={event.id}
                      className="flex gap-3 rounded-lg border bg-secondary/20 p-3"
                    >
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md border bg-background">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">
                          {new Date(event.eventAt).toLocaleString("en-IN", {
                            month: "short",
                          })}
                        </span>
                        <span className="font-mono text-base font-bold">
                          {new Date(event.eventAt).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {event.ticker && (
                            <span className="text-sm font-bold">
                              {event.ticker}
                            </span>
                          )}
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                            {event.impact}
                          </span>
                        </div>
                        <p className="mt-1 text-sm">{event.title}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {event.source}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  positive,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  positive?: boolean;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p
              className={cn(
                "mt-2 font-mono text-2xl font-bold",
                positive === true && "text-emerald-500",
                positive === false && "text-destructive",
              )}
            >
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
          <div className="rounded-lg border bg-secondary/30 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionRow({
  action,
  onOpen,
}: {
  action: MorningBriefAction;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-lg border bg-secondary/15 p-4 text-left transition-colors hover:bg-secondary/40"
    >
      <span
        className={cn(
          "mt-0.5 rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
          priorityClass(action.priority),
        )}
      >
        {action.priority}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {action.ticker && <span className="font-bold">{action.ticker}</span>}
          <span className="font-semibold">{action.title}</span>
        </div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {action.rationale}
        </p>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function RiskRow({ risk }: { risk: MorningBriefRisk }) {
  return (
    <div className="rounded-lg border bg-secondary/15 p-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
            risk.severity === "high"
              ? "bg-destructive/15 text-destructive"
              : risk.severity === "medium"
                ? "bg-amber-500/15 text-amber-500"
                : "bg-blue-500/15 text-blue-500",
          )}
        >
          {risk.severity}
        </span>
        {risk.ticker && (
          <span className="text-xs font-bold">{risk.ticker}</span>
        )}
      </div>
      <p className="mt-2 text-sm font-medium">{risk.title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {risk.detail}
      </p>
    </div>
  );
}

function DataQualityBadge({
  brief,
}: {
  brief: NonNullable<ReturnType<typeof useLatestMorningBrief>["data"]>;
}) {
  const healthy = brief.dataQuality.warnings.length === 0;
  return (
    <div
      className={cn(
        "min-w-56 rounded-xl border p-4",
        healthy
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-amber-500/30 bg-amber-500/5",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {healthy ? (
          <Database className="h-4 w-4 text-emerald-500" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        )}
        Data quality
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Market points</p>
          <p className="font-mono font-bold">
            {brief.dataQuality.marketPointCount}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Portfolio news</p>
          <p className="font-mono font-bold">
            {brief.dataQuality.portfolioNewsCount}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
        Latest market data: {relativeTime(brief.dataQuality.latestMarketAsOf)}
      </p>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-32 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Skeleton className="h-96 w-full rounded-xl xl:col-span-2" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}
