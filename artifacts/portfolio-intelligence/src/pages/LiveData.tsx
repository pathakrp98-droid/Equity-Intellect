import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudCog,
  Database,
  RefreshCw,
  ServerCog,
  Trash2,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useDeleteSymbolMapping,
  useLiveDataPreferences,
  useLiveDataStatus,
  usePurgeLiveDataCache,
  useRefreshLiveData,
  useSymbolMappings,
  useUpdateLiveDataPreferences,
  useUpsertSymbolMapping,
  type LiveDataPreferences,
} from "@/features/liveData/api";
import { cn } from "@/lib/utils";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-IN") : "Not available";
}

export function LiveData() {
  const { data: status, isLoading } = useLiveDataStatus();
  const refresh = useRefreshLiveData();
  const purge = usePurgeLiveDataCache();
  const diagnostics = refresh.data?.diagnostics ?? [];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Data</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Provider health, quote synchronization, symbol mappings and stale-data fallbacks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => purge.mutate()}
            disabled={purge.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Purge expired cache
          </Button>
          <Button
            variant="outline"
            onClick={() => refresh.mutate(true)}
            disabled={refresh.isPending}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", refresh.isPending && "animate-spin")} />
            Force refresh
          </Button>
          <Button onClick={() => refresh.mutate(false)} disabled={refresh.isPending}>
            <CloudCog className={cn("mr-2 h-4 w-4", refresh.isPending && "animate-pulse")} />
            Refresh data
          </Button>
        </div>
      </div>

      {refresh.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {refresh.error.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Configured providers"
          value={isLoading ? null : String(status?.providers.filter((provider) => provider.configured).length ?? 0)}
          subtitle={`${status?.providers.length ?? 0} adapters installed`}
        />
        <MetricCard
          title="Latest quote"
          value={isLoading ? null : formatDate(status?.latestData.quoteAsOf ?? null)}
          subtitle="Portfolio quote source"
        />
        <MetricCard
          title="Cache health"
          value={isLoading ? null : `${status?.cache.fresh ?? 0} fresh`}
          subtitle={`${status?.cache.staleFallback ?? 0} fallback · ${status?.cache.expired ?? 0} expired`}
        />
        <MetricCard
          title="Stored secrets"
          value={isLoading ? null : status?.secretsStoredInDatabase ? "Yes" : "No"}
          subtitle="Credentials remain in environment variables"
        />
      </div>

      <Tabs defaultValue="providers">
        <TabsList className="grid w-full grid-cols-3 md:w-[560px]">
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="mappings">Symbol mappings</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="mt-5 space-y-5">
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {status?.providers.map((provider) => (
                <Card key={provider.name}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ServerCog className="h-4 w-4" /> {provider.name}
                      </CardTitle>
                      <Badge variant={provider.configured ? "default" : "secondary"}>
                        {provider.configured ? "Configured" : "Not configured"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(provider.capabilities)
                        .filter(([, enabled]) => enabled)
                        .map(([capability]) => (
                          <Badge key={capability} variant="outline" className="capitalize">
                            {capability.replace(/([A-Z])/g, " $1")}
                          </Badge>
                        ))}
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {provider.configurationHint}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      Latest run: {formatDate(status.latestRuns.find((run) => run.provider === provider.name)?.startedAt ?? null)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {diagnostics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Latest refresh diagnostics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {diagnostics.map((item, index) => (
                  <div
                    key={`${item.provider}-${item.capability}-${index}`}
                    className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center"
                  >
                    {item.status === "success" || item.status === "cached" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : item.status === "stale_fallback" ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {item.provider} · {item.capability}
                      </div>
                      {item.message && (
                        <div className="truncate text-xs text-muted-foreground">{item.message}</div>
                      )}
                    </div>
                    <Badge variant="outline">{item.status.replace("_", " ")}</Badge>
                    <span className="text-xs text-muted-foreground">{item.records} records</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mappings" className="mt-5">
          <SymbolMappings />
        </TabsContent>

        <TabsContent value="preferences" className="mt-5">
          <LiveDataPreferencesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ title, value, subtitle }: { title: string; value: string | null; subtitle: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Database className="h-4 w-4 text-muted-foreground" />
        </div>
        {value === null ? <Skeleton className="h-7 w-32" /> : <div className="text-xl font-bold">{value}</div>}
        <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
      </CardContent>
    </Card>
  );
}

function SymbolMappings() {
  const { data: mappings, isLoading } = useSymbolMappings();
  const upsert = useUpsertSymbolMapping();
  const remove = useDeleteSymbolMapping();
  const [ticker, setTicker] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [provider, setProvider] = useState("alpha-vantage");
  const [providerSymbol, setProviderSymbol] = useState("");

  const submit = () => {
    upsert.mutate(
      { ticker, exchange, provider, providerSymbol },
      {
        onSuccess: () => {
          setTicker("");
          setProviderSymbol("");
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Provider symbol mappings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Input placeholder="Ticker" value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} />
          <Input placeholder="Exchange" value={exchange} onChange={(event) => setExchange(event.target.value.toUpperCase())} />
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alpha-vantage">alpha-vantage</SelectItem>
              <SelectItem value="normalized-http">normalized-http</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Provider symbol" value={providerSymbol} onChange={(event) => setProviderSymbol(event.target.value)} />
          <Button onClick={submit} disabled={!ticker || !providerSymbol || upsert.isPending}>Save mapping</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Example: portfolio ticker <strong>INFY</strong> can map to the exact symbol required by your provider. No API keys are stored here.
        </p>
        {upsert.error && <p className="text-sm text-destructive">{upsert.error.message}</p>}
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : mappings?.length ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Exchange</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Provider symbol</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="px-4 py-3 font-bold">{mapping.ticker}</td>
                    <td className="px-4 py-3">{mapping.exchange}</td>
                    <td className="px-4 py-3">{mapping.provider}</td>
                    <td className="px-4 py-3 font-mono">{mapping.providerSymbol}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => remove.mutate(mapping.id)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            No explicit mappings. Provider requests will use the portfolio ticker by default.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LiveDataPreferencesPanel() {
  const { data, isLoading } = useLiveDataPreferences();
  const update = useUpdateLiveDataPreferences();
  const [form, setForm] = useState<Partial<LiveDataPreferences>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const providerPriority = useMemo(
    () => form.providerPriority ?? ["normalized-http", "alpha-vantage"],
    [form.providerPriority],
  );

  if (isLoading || !data) return <Skeleton className="h-80 w-full" />;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Refresh and fallback policy</CardTitle></CardHeader>
      <CardContent className="max-w-4xl space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ToggleRow
            label="Synchronize portfolio prices"
            detail="Imported equity quotes update Phase 1 portfolio valuations."
            checked={Boolean(form.autoSyncPortfolio)}
            onCheckedChange={(checked) => setForm((current) => ({ ...current, autoSyncPortfolio: checked }))}
          />
          <ToggleRow
            label="Evaluate alerts after refresh"
            detail="Run the Phase 7 alert engine after a provider refresh."
            checked={Boolean(form.autoEvaluateAlerts)}
            onCheckedChange={(checked) => setForm((current) => ({ ...current, autoEvaluateAlerts: checked }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <NumberField label="Quote TTL (minutes)" value={form.quoteTtlMinutes ?? 15} onChange={(value) => setForm((current) => ({ ...current, quoteTtlMinutes: value }))} />
          <NumberField label="News TTL (minutes)" value={form.newsTtlMinutes ?? 60} onChange={(value) => setForm((current) => ({ ...current, newsTtlMinutes: value }))} />
          <NumberField label="Calendar TTL" value={form.calendarTtlMinutes ?? 360} onChange={(value) => setForm((current) => ({ ...current, calendarTtlMinutes: value }))} />
          <NumberField label="Stale fallback" value={form.staleIfErrorMinutes ?? 1440} onChange={(value) => setForm((current) => ({ ...current, staleIfErrorMinutes: value }))} />
          <NumberField label="Max symbols" value={form.maxSymbolsPerRefresh ?? 25} onChange={(value) => setForm((current) => ({ ...current, maxSymbolsPerRefresh: value }))} />
        </div>
        <div className="space-y-2">
          <Label>Provider priority</Label>
          <Select
            value={providerPriority[0] ?? "normalized-http"}
            onValueChange={(first) => {
              const second = first === "normalized-http" ? "alpha-vantage" : "normalized-http";
              setForm((current) => ({ ...current, providerPriority: [first, second] }));
            }}
          >
            <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normalized-http">Normalized HTTP first</SelectItem>
              <SelectItem value="alpha-vantage">Alpha Vantage first</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {update.error && <p className="text-sm text-destructive">{update.error.message}</p>}
        <Button onClick={() => update.mutate(form)} disabled={update.isPending}>Save live-data preferences</Button>
      </CardContent>
    </Card>
  );
}

function ToggleRow({ label, detail, checked, onCheckedChange }: { label: string; detail: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div><Label>{label}</Label><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}
