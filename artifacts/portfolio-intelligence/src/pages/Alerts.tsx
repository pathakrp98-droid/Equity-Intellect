import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  ExternalLink,
  History,
  ListChecks,
  Play,
  Plus,
  Settings2,
  Trash2,
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
  useAcknowledgeAlert,
  useAlertPreferences,
  useAlertRules,
  useAlertSummary,
  useCreateAlertRule,
  useDeleteAlertRule,
  useDismissInvestmentAlert,
  useEvaluateAlerts,
  useInvestmentAlerts,
  useReopenInvestmentAlert,
  useResolveInvestmentAlert,
  useUpdateAlertPreferences,
  useUpdateAlertRule,
  type AlertPreferences,
  type AlertRuleType,
  type AlertSeverity,
  type InvestmentAlert,
} from "@/features/alerts/api";
import { cn } from "@/lib/utils";

const severityClass: Record<AlertSeverity, string> = {
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-500",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  low: "border-blue-500/40 bg-blue-500/10 text-blue-500",
};

export function Alerts() {
  const { data: summary, isLoading } = useAlertSummary();
  const evaluate = useEvaluateAlerts();

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Price thresholds, thesis changes, upcoming events and provider-health warnings.
          </p>
        </div>
        <Button onClick={() => evaluate.mutate()} disabled={evaluate.isPending}>
          <Play className={cn("mr-2 h-4 w-4", evaluate.isPending && "animate-pulse")} />
          Evaluate alerts
        </Button>
      </div>

      {evaluate.data && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500">
          Evaluation complete: {evaluate.data.alertsUpserted} alerts matched from {evaluate.data.candidates} candidates.
        </div>
      )}
      {evaluate.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {evaluate.error.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <SummaryCard title="Active" value={isLoading ? null : summary?.active ?? 0} />
        <SummaryCard title="Critical" value={isLoading ? null : summary?.critical ?? 0} />
        <SummaryCard title="High" value={isLoading ? null : summary?.high ?? 0} />
        <SummaryCard title="Acknowledged" value={isLoading ? null : summary?.acknowledged ?? 0} />
        <SummaryCard title="Enabled rules" value={isLoading ? null : summary?.enabledRules ?? 0} />
      </div>

      <Tabs defaultValue="active">
        <TabsList className="grid w-full grid-cols-4 md:w-[720px]">
          <TabsTrigger value="active"><BellRing className="mr-2 h-4 w-4" />Active</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-2 h-4 w-4" />History</TabsTrigger>
          <TabsTrigger value="rules"><ListChecks className="mr-2 h-4 w-4" />Rules</TabsTrigger>
          <TabsTrigger value="settings"><Settings2 className="mr-2 h-4 w-4" />Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-5">
          <AlertList status="active" />
        </TabsContent>
        <TabsContent value="history" className="mt-5">
          <AlertHistory />
        </TabsContent>
        <TabsContent value="rules" className="mt-5">
          <AlertRules />
        </TabsContent>
        <TabsContent value="settings" className="mt-5">
          <AlertSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: number | null }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
        {value === null ? <Skeleton className="mt-2 h-8 w-14" /> : <div className="mt-2 text-3xl font-bold">{value}</div>}
      </CardContent>
    </Card>
  );
}

function AlertList({ status }: { status: "active" | "dismissed" | "resolved" | "all" }) {
  const { data, isLoading } = useInvestmentAlerts(status);
  const acknowledge = useAcknowledgeAlert();
  const dismiss = useDismissInvestmentAlert();
  const resolve = useResolveInvestmentAlert();
  const reopen = useReopenInvestmentAlert();

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <BellRing className="mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="font-semibold">No alerts in this view</h3>
          <p className="mt-1 text-sm text-muted-foreground">Refresh live data or create a rule to begin monitoring.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onAcknowledge={() => acknowledge.mutate(alert.id)}
          onDismiss={() => dismiss.mutate(alert.id)}
          onResolve={() => resolve.mutate(alert.id)}
          onReopen={() => reopen.mutate(alert.id)}
        />
      ))}
    </div>
  );
}

function AlertHistory() {
  const [status, setStatus] = useState<"all" | "dismissed" | "resolved">("all");
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All alerts</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AlertList status={status} />
    </div>
  );
}

function AlertCard({
  alert,
  onAcknowledge,
  onDismiss,
  onResolve,
  onReopen,
}: {
  alert: InvestmentAlert;
  onAcknowledge: () => void;
  onDismiss: () => void;
  onResolve: () => void;
  onReopen: () => void;
}) {
  const inactive = Boolean(alert.dismissedAt || alert.resolvedAt);
  return (
    <Card className={cn("overflow-hidden border-l-4", severityClass[alert.severity])}>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="rounded-full border bg-background p-2">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {alert.ticker && <span className="text-lg font-bold">{alert.ticker}</span>}
              <Badge variant="outline" className={severityClass[alert.severity]}>{alert.severity}</Badge>
              <Badge variant="secondary" className="capitalize">{alert.alertType.replaceAll("_", " ")}</Badge>
              {alert.acknowledgedAt && !inactive && <Badge variant="outline">Acknowledged</Badge>}
              <span className="ml-auto text-xs text-muted-foreground">{new Date(alert.triggeredAt).toLocaleString("en-IN")}</span>
            </div>
            <div>
              <h3 className="font-semibold">{alert.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{alert.detail}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Source: {alert.source}</span>
              {alert.sourceUrl && (
                <a href={alert.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  Open source <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:w-44 lg:flex-col">
            {inactive ? (
              <Button variant="outline" size="sm" onClick={onReopen}>Reopen</Button>
            ) : (
              <>
                {!alert.acknowledgedAt && <Button variant="outline" size="sm" onClick={onAcknowledge}><CheckCircle2 className="mr-2 h-3 w-3" />Acknowledge</Button>}
                <Button variant="outline" size="sm" onClick={onResolve}>Resolve</Button>
                <Button variant="ghost" size="sm" onClick={onDismiss}>Dismiss</Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ruleTypeOptions: Array<{ value: AlertRuleType; label: string }> = [
  { value: "price_above", label: "Price above" },
  { value: "price_below", label: "Price below" },
  { value: "day_change_above", label: "Daily change above" },
  { value: "day_change_below", label: "Daily change below" },
  { value: "thesis_status", label: "Thesis status" },
  { value: "thesis_review_due", label: "Thesis review due" },
  { value: "news_keyword", label: "News keyword" },
  { value: "earnings_upcoming", label: "Earnings upcoming" },
  { value: "corporate_action_upcoming", label: "Corporate action upcoming" },
];

function AlertRules() {
  const { data: rules, isLoading } = useAlertRules();
  const create = useCreateAlertRule();
  const update = useUpdateAlertRule();
  const remove = useDeleteAlertRule();
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [ruleType, setRuleType] = useState<AlertRuleType>("price_above");
  const [severity, setSeverity] = useState<AlertSeverity>("medium");
  const [threshold, setThreshold] = useState("");
  const [textValue, setTextValue] = useState("");
  const [lookaheadDays, setLookaheadDays] = useState("7");

  const priceRule = ["price_above", "price_below", "day_change_above", "day_change_below"].includes(ruleType);
  const keywordRule = ruleType === "news_keyword" || ruleType === "thesis_status";
  const calendarRule = ruleType === "earnings_upcoming" || ruleType === "corporate_action_upcoming" || ruleType === "thesis_review_due";

  const submit = () => {
    create.mutate(
      {
        name,
        ticker: ticker || null,
        ruleType,
        severity,
        threshold: priceRule ? Number(threshold) : null,
        textValue: keywordRule ? textValue : null,
        lookaheadDays: calendarRule ? Number(lookaheadDays) : null,
      },
      {
        onSuccess: () => {
          setName("");
          setTicker("");
          setThreshold("");
          setTextValue("");
        },
      },
    );
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4" />Create alert rule</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Input placeholder="Rule name" value={name} onChange={(event) => setName(event.target.value)} className="xl:col-span-2" />
            <Input placeholder="Ticker (optional)" value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} />
            <Select value={ruleType} onValueChange={(value) => setRuleType(value as AlertRuleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ruleTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={severity} onValueChange={(value) => setSeverity(value as AlertSeverity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={submit} disabled={!name || create.isPending}>Create rule</Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {priceRule && <Input type="number" placeholder={ruleType.includes("change") ? "Threshold %" : "Threshold price"} value={threshold} onChange={(event) => setThreshold(event.target.value)} />}
            {keywordRule && <Input placeholder={ruleType === "thesis_status" ? "Status, e.g. weakening" : "Keyword"} value={textValue} onChange={(event) => setTextValue(event.target.value)} />}
            {calendarRule && <Input type="number" placeholder="Look-ahead days" value={lookaheadDays} onChange={(event) => setLookaheadDays(event.target.value)} />}
          </div>
          {create.error && <p className="text-sm text-destructive">{create.error.message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Saved rules</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-60 w-full" /> : rules?.length ? (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center">
                  <Switch checked={rule.isEnabled} onCheckedChange={(checked) => update.mutate({ id: rule.id, data: { isEnabled: checked } })} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{rule.name}</span>
                      {rule.ticker && <Badge variant="outline">{rule.ticker}</Badge>}
                      <Badge variant="secondary" className="capitalize">{rule.ruleType.replaceAll("_", " ")}</Badge>
                      <Badge variant="outline" className={severityClass[rule.severity]}>{rule.severity}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {rule.threshold !== null && <span>Threshold: {rule.threshold}</span>}
                      {rule.textValue && <span>Value: {rule.textValue}</span>}
                      {rule.lookaheadDays !== null && <span>Window: {rule.lookaheadDays} days</span>}
                      <span><Clock3 className="mr-1 inline h-3 w-3" />Cooldown: {rule.cooldownMinutes} min</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate(rule.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          ) : <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No custom alert rules yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function AlertSettings() {
  const { data, isLoading } = useAlertPreferences();
  const update = useUpdateAlertPreferences();
  const [form, setForm] = useState<Partial<AlertPreferences>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Alert evaluation preferences</CardTitle></CardHeader>
      <CardContent className="max-w-4xl space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SettingToggle label="Portfolio only" detail="Suppress alerts for tickers outside the active portfolio." checked={Boolean(form.portfolioOnly)} onChange={(checked) => setForm((current) => ({ ...current, portfolioOnly: checked }))} />
          <SettingToggle label="Price alerts" detail="Evaluate user-created quote and daily-change rules." checked={Boolean(form.enablePriceAlerts)} onChange={(checked) => setForm((current) => ({ ...current, enablePriceAlerts: checked }))} />
          <SettingToggle label="Thesis alerts" detail="Surface weakening, broken, overdue and invalidated theses." checked={Boolean(form.enableThesisAlerts)} onChange={(checked) => setForm((current) => ({ ...current, enableThesisAlerts: checked }))} />
          <SettingToggle label="News alerts" detail="Surface high-relevance negative news and keyword matches." checked={Boolean(form.enableNewsAlerts)} onChange={(checked) => setForm((current) => ({ ...current, enableNewsAlerts: checked }))} />
          <SettingToggle label="Calendar alerts" detail="Warn about earnings, dividends and corporate actions." checked={Boolean(form.enableCalendarAlerts)} onChange={(checked) => setForm((current) => ({ ...current, enableCalendarAlerts: checked }))} />
          <SettingToggle label="Data-quality alerts" detail="Warn when portfolio prices are missing or stale." checked={Boolean(form.enableDataQualityAlerts)} onChange={(checked) => setForm((current) => ({ ...current, enableDataQualityAlerts: checked }))} />
          <SettingToggle label="Provider-failure alerts" detail="Surface failed live-data refresh runs." checked={Boolean(form.enableProviderFailureAlerts)} onChange={(checked) => setForm((current) => ({ ...current, enableProviderFailureAlerts: checked }))} />
          <SettingToggle label="In-app notifications" detail="Keep alert records visible inside AlphaDesk." checked={Boolean(form.inAppNotifications)} onChange={(checked) => setForm((current) => ({ ...current, inAppNotifications: checked }))} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Minimum severity</Label>
            <Select value={form.severityThreshold ?? "low"} onValueChange={(value) => setForm((current) => ({ ...current, severityThreshold: value as AlertSeverity }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical only</SelectItem>
                <SelectItem value="high">High and critical</SelectItem>
                <SelectItem value="medium">Medium and above</SelectItem>
                <SelectItem value="low">All alerts</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Quiet hours start</Label><Input type="time" value={form.quietHoursStart ?? ""} onChange={(event) => setForm((current) => ({ ...current, quietHoursStart: event.target.value || null }))} /></div>
          <div className="space-y-2"><Label>Quiet hours end</Label><Input type="time" value={form.quietHoursEnd ?? ""} onChange={(event) => setForm((current) => ({ ...current, quietHoursEnd: event.target.value || null }))} /></div>
        </div>
        <p className="text-xs text-muted-foreground">
          Quiet hours are stored for future delivery channels. Phase 7 creates in-app alerts only; it does not send email, SMS or push notifications.
        </p>
        {update.error && <p className="text-sm text-destructive">{update.error.message}</p>}
        <Button onClick={() => update.mutate(form)} disabled={update.isPending}>Save alert settings</Button>
      </CardContent>
    </Card>
  );
}

function SettingToggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div><Label>{label}</Label><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
