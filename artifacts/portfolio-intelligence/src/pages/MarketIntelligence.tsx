import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ComponentType,
} from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CloudDownload,
  Database,
  ExternalLink,
  FileJson,
  RefreshCw,
  Rss,
  Settings2,
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
  useGenerateMorningBrief,
  useImportMarketIntelligence,
  useMarketCalendar,
  useMarketNews,
  useMarketPreferences,
  useMarketSnapshot,
  useProviderStatus,
  useRefreshMarketIntelligence,
  useUpdateMarketPreferences,
  type MarketDataPoint,
  type MarketPreferences,
} from "@/features/intelligence/api";

const BOOLEAN_PREFERENCE_OPTIONS: Array<
  [
    | "includeGlobalMarkets"
    | "includeMacro"
    | "includePortfolioNews"
    | "includeUpcomingEvents",
    string,
  ]
> = [
  ["includeGlobalMarkets", "Include global markets"],
  ["includeMacro", "Include macro indicators"],
  ["includePortfolioNews", "Include portfolio news"],
  ["includeUpcomingEvents", "Include upcoming events"],
];

const SAMPLE_IMPORT = {
  provider: "manual-research",
  fetchedAt: new Date().toISOString(),
  points: [
    {
      kind: "index",
      symbol: "NIFTY50",
      name: "Nifty 50",
      value: 0,
      change: 0,
      changePct: 0,
      unit: "points",
      region: "India",
      source: "Replace with source name",
      asOf: new Date().toISOString(),
    },
    {
      kind: "equity",
      symbol: "RELIANCE",
      name: "Reliance Industries",
      value: 0,
      change: 0,
      changePct: 0,
      unit: "INR",
      region: "India",
      source: "Replace with verified quote source",
      asOf: new Date().toISOString(),
      metadata: { previousClose: 0 },
    },
  ],
  news: [
    {
      ticker: "RELIANCE",
      headline: "Replace with verified portfolio-relevant headline",
      summary: "Add a concise factual summary.",
      source: "Replace with source name",
      sourceUrl: "https://example.com/source",
      publishedAt: new Date().toISOString(),
      sentiment: "neutral",
    },
  ],
  events: [
    {
      ticker: "RELIANCE",
      companyName: "Reliance Industries",
      eventType: "earnings",
      title: "Quarterly results",
      eventAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      impact: "high",
      source: "Company calendar",
    },
  ],
};

function relativeTime(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1_440)}d ago`;
}

function formatPoint(point: MarketDataPoint): string {
  const suffix = point.unit ? ` ${point.unit}` : "";
  return `${point.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`;
}

export function MarketIntelligence() {
  const snapshotQuery = useMarketSnapshot();
  const newsQuery = useMarketNews(true, 14, 100);
  const calendarQuery = useMarketCalendar(true, 60);
  const providerQuery = useProviderStatus();
  const refresh = useRefreshMarketIntelligence();
  const generateBrief = useGenerateMorningBrief();
  const importMutation = useImportMarketIntelligence();
  const preferencesQuery = useMarketPreferences();
  const updatePreferences = useUpdateMarketPreferences();
  const [importJson, setImportJson] = useState(
    JSON.stringify(SAMPLE_IMPORT, null, 2),
  );
  const [preferences, setPreferences] = useState<MarketPreferences | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (preferencesQuery.data) setPreferences(preferencesQuery.data);
  }, [preferencesQuery.data]);

  const groupedPoints = useMemo(() => {
    const groups = new Map<string, MarketDataPoint[]>();
    for (const point of snapshotQuery.data ?? []) {
      const rows = groups.get(point.kind) ?? [];
      rows.push(point);
      groups.set(point.kind, rows);
    }
    return [...groups.entries()];
  }, [snapshotQuery.data]);

  const refreshAndBrief = async () => {
    await refresh.mutateAsync();
    await generateBrief.mutateAsync();
  };

  const importData = async () => {
    setImportError(null);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(importJson) as Record<string, unknown>;
    } catch {
      setImportError("The import text is not valid JSON.");
      return;
    }
    try {
      await importMutation.mutateAsync(payload);
      await generateBrief.mutateAsync();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed");
    }
  };

  const savePreferences = async () => {
    if (!preferences) return;
    await updatePreferences.mutateAsync(preferences);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Market Intelligence
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Normalized market snapshots, portfolio news, events and provider
            freshness.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={generateBrief.isPending}
            onClick={() => generateBrief.mutate()}
          >
            Generate brief
          </Button>
          <Button
            disabled={!providerQuery.data?.configured || refresh.isPending}
            onClick={() => void refreshAndBrief()}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", refresh.isPending && "animate-spin")}
            />
            Refresh provider
          </Button>
        </div>
      </div>

      <ProviderStrip
        configured={providerQuery.data?.configured ?? false}
        provider={providerQuery.data?.provider ?? "—"}
        status={providerQuery.data?.latestRun?.status ?? "never run"}
        latestMarket={providerQuery.data?.latestData.marketAsOf ?? null}
        latestNews={providerQuery.data?.latestData.newsPublishedAt ?? null}
      />

      <Tabs defaultValue="snapshot" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 md:grid-cols-5">
          <TabsTrigger value="snapshot">Snapshot</TabsTrigger>
          <TabsTrigger value="news">Portfolio News</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="snapshot" className="mt-6 space-y-6">
          {snapshotQuery.isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : groupedPoints.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No market snapshot available"
              detail="Connect a normalized provider or import verified market points in the Import tab."
            />
          ) : (
            groupedPoints.map(([kind, points]) => (
              <Card key={kind}>
                <CardHeader>
                  <CardTitle className="text-base capitalize">
                    {kind.replaceAll("_", " ")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {points.map((point) => (
                    <div
                      key={point.id}
                      className="rounded-lg border bg-secondary/15 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{point.name}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {point.source} · {relativeTime(point.asOf)}
                          </p>
                        </div>
                        {point.changePct !== null && (
                          <span
                            className={cn(
                              "flex items-center text-xs font-mono font-bold",
                              point.changePct >= 0
                                ? "text-emerald-500"
                                : "text-destructive",
                            )}
                          >
                            {point.changePct >= 0 ? (
                              <TrendingUp className="mr-1 h-3 w-3" />
                            ) : (
                              <TrendingDown className="mr-1 h-3 w-3" />
                            )}
                            {point.changePct >= 0 ? "+" : ""}
                            {point.changePct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                      <p className="mt-4 font-mono text-2xl font-bold">
                        {formatPoint(point)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="news" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Rss className="h-4 w-4 text-primary" /> Portfolio-relevant
                news
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {newsQuery.isLoading ? (
                [1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} className="h-24 w-full" />
                ))
              ) : newsQuery.data?.length ? (
                newsQuery.data.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-lg border bg-secondary/10 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.ticker && (
                            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                              {item.ticker}
                            </span>
                          )}
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                              item.sentiment === "positive"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : item.sentiment === "negative"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-amber-500/10 text-amber-500",
                            )}
                          >
                            {item.sentiment}
                          </span>
                        </div>
                        <h3 className="mt-2 font-semibold leading-6">
                          {item.headline}
                        </h3>
                        {item.summary && (
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {item.summary}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {item.source} · {relativeTime(item.publishedAt)}
                        </p>
                      </div>
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center text-xs font-medium text-primary hover:underline"
                        >
                          Open source <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  icon={Rss}
                  title="No portfolio news in the current feed"
                  detail="Import verified news or connect a provider. AlphaDesk will not invent headlines to fill this space."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-primary" /> Portfolio
                calendar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {calendarQuery.isLoading ? (
                [1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-24 w-full" />
                ))
              ) : calendarQuery.data?.length ? (
                calendarQuery.data.map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-col gap-3 rounded-lg border bg-secondary/10 p-4 md:flex-row md:items-center"
                  >
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border bg-background">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">
                        {new Date(event.eventAt).toLocaleString("en-IN", {
                          month: "short",
                        })}
                      </span>
                      <span className="font-mono text-xl font-bold">
                        {new Date(event.eventAt).getDate()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {event.ticker && (
                          <span className="font-bold">{event.ticker}</span>
                        )}
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                          {event.eventType.replaceAll("_", " ")}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                            event.impact === "critical" || event.impact === "high"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-amber-500/10 text-amber-500",
                          )}
                        >
                          {event.impact}
                        </span>
                      </div>
                      <p className="mt-1 font-semibold">{event.title}</p>
                      {event.description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {event.source}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title="No upcoming portfolio events"
                  detail="Import an earnings or corporate-action calendar to activate event-driven brief actions."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="mt-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileJson className="h-4 w-4 text-primary" /> Import
                  normalized JSON
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  Import verified data using the AlphaDesk normalized contract.
                  Duplicate records are upserted using source and external ID;
                  portfolio relevance is assigned from current holdings.
                </p>
                <Textarea
                  value={importJson}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                    setImportJson(event.target.value)
                  }
                  className="min-h-[420px] font-mono text-xs"
                  spellCheck={false}
                />
                {importError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {importError}
                  </div>
                )}
                {importMutation.data && (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-500">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    Imported {importMutation.data.total} records: {importMutation.data.points} points, {importMutation.data.news} news items and {importMutation.data.events} events. Synced {importMutation.data.equityPricesSynced} holding prices.
                  </div>
                )}
                <Button
                  onClick={() => void importData()}
                  disabled={importMutation.isPending || generateBrief.isPending}
                >
                  <CloudDownload className="mr-2 h-4 w-4" /> Import and rebuild
                  brief
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Provider contract</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <InfoRow
                  label="Configured"
                  value={providerQuery.data?.configured ? "Yes" : "No"}
                />
                <InfoRow
                  label="Provider"
                  value={providerQuery.data?.provider ?? "—"}
                />
                <InfoRow
                  label="Contract"
                  value={providerQuery.data?.normalizedContract ?? "—"}
                />
                <InfoRow
                  label="URL environment"
                  value={
                    providerQuery.data?.requiredEnvironment.url ??
                    "MARKET_INTELLIGENCE_URL"
                  }
                />
                <InfoRow
                  label="API key"
                  value={
                    providerQuery.data?.requiredEnvironment.apiKey ??
                    "Optional"
                  }
                />
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-muted-foreground">
                  Provider credentials stay server-side. Never include them in
                  this JSON or commit them to the repository.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="mt-6">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4 text-primary" /> Brief settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {preferencesQuery.isLoading || !preferences ? (
                <Skeleton className="h-80 w-full" />
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <LabeledInput
                      label="Timezone"
                      value={preferences.timezone}
                      onChange={(value) =>
                        setPreferences({ ...preferences, timezone: value })
                      }
                    />
                    <LabeledInput
                      label="Brief hour (0–23)"
                      type="number"
                      value={String(preferences.briefHour)}
                      onChange={(value) =>
                        setPreferences({
                          ...preferences,
                          briefHour: Number(value),
                        })
                      }
                    />
                    <LabeledInput
                      label="Market stale after minutes"
                      type="number"
                      value={String(preferences.staleMarketMinutes)}
                      onChange={(value) =>
                        setPreferences({
                          ...preferences,
                          staleMarketMinutes: Number(value),
                        })
                      }
                    />
                    <LabeledInput
                      label="News stale after hours"
                      type="number"
                      value={String(preferences.staleNewsHours)}
                      onChange={(value) =>
                        setPreferences({
                          ...preferences,
                          staleNewsHours: Number(value),
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {BOOLEAN_PREFERENCE_OPTIONS.map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-3 rounded-lg border bg-secondary/10 p-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(
                            preferences[key],
                          )}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setPreferences({
                              ...preferences,
                              [key]: event.target.checked,
                            })
                          }
                          className="h-4 w-4"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <Button
                    onClick={() => void savePreferences()}
                    disabled={updatePreferences.isPending}
                  >
                    Save preferences
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProviderStrip({
  configured,
  provider,
  status,
  latestMarket,
  latestNews,
}: {
  configured: boolean;
  provider: string;
  status: string;
  latestMarket: string | null;
  latestNews: string | null;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 rounded-xl border p-4 text-sm md:grid-cols-5",
        configured
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-amber-500/30 bg-amber-500/5",
      )}
    >
      <InfoRow label="Connection" value={configured ? "Configured" : "Manual only"} />
      <InfoRow label="Provider" value={provider} />
      <InfoRow label="Last run" value={status} />
      <InfoRow label="Market freshness" value={relativeTime(latestMarket)} />
      <InfoRow label="News freshness" value={relativeTime(latestNews)} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium">{value}</p>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <Input
        type={type}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
      />
    </label>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
      <Icon className="h-9 w-9 text-muted-foreground" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}
