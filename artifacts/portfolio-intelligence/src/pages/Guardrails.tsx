import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  FileCheck2,
  Gauge,
  History,
  LockKeyhole,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  SlidersHorizontal,
  TestTube2,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useCancelGuardianDecision,
  useExecuteGuardianDecision,
  useGuardianAudit,
  useGuardianCheck,
  useGuardianContext,
  useGuardianHealth,
  useGuardianPackets,
  useGuardianSettings,
  useUpdateGuardianSettings,
  type GuardianCheckResponse,
  type GuardianProposalInput,
  type GuardianSettings,
} from "@/features/guardian/api";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

const blankProposal: GuardianProposalInput = {
  action: "buy",
  ticker: "",
  quantity: null,
  price: null,
  fees: 0,
  rationale: "",
  investmentHorizon: "",
  bearCase: "",
  targetPrice: null,
  thesisInvalidation: "",
  maxAcceptableLossPct: null,
  exitConditions: "",
  evidenceQuality: "medium",
  citedSourceIds: [],
};

function decisionStyle(decision: string) {
  if (decision === "approve") {
    return {
      icon: ShieldCheck,
      label: "Approved",
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
    };
  }
  if (decision === "approve_with_warnings") {
    return {
      icon: ShieldAlert,
      label: "Approved with warnings",
      className: "border-amber-500/40 bg-amber-500/10 text-amber-500",
    };
  }
  if (decision === "require_evidence") {
    return {
      icon: FileCheck2,
      label: "Evidence required",
      className: "border-blue-500/40 bg-blue-500/10 text-blue-500",
    };
  }
  return {
    icon: ShieldX,
    label: "Blocked",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  };
}

function healthBandClass(band?: string) {
  if (band === "healthy") return "text-emerald-500";
  if (band === "watch") return "text-blue-500";
  if (band === "caution") return "text-amber-500";
  return "text-destructive";
}

function statusClass(status: string) {
  if (status === "ok") return "bg-emerald-500";
  if (status === "warning") return "bg-amber-500";
  return "bg-destructive";
}

function asNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function Guardrails() {
  const [tab, setTab] = useState("overview");
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Guardian Mode</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre-trade policy, behavioural checks, stress testing and an immutable decision trail.
          </p>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
          Guardian records decisions. It never places a brokerage order.
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 md:grid-cols-5">
          <TabsTrigger value="overview"><Gauge className="mr-2 h-4 w-4" />Health</TabsTrigger>
          <TabsTrigger value="pretrade"><LockKeyhole className="mr-2 h-4 w-4" />Pre-trade</TabsTrigger>
          <TabsTrigger value="stress"><TestTube2 className="mr-2 h-4 w-4" />Stress</TabsTrigger>
          <TabsTrigger value="audit"><History className="mr-2 h-4 w-4" />Audit</TabsTrigger>
          <TabsTrigger value="policy"><SlidersHorizontal className="mr-2 h-4 w-4" />Policy</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6"><HealthView onStartCheck={() => setTab("pretrade")} /></TabsContent>
        <TabsContent value="pretrade" className="mt-6"><PreTradeView /></TabsContent>
        <TabsContent value="stress" className="mt-6"><StressView /></TabsContent>
        <TabsContent value="audit" className="mt-6"><AuditView /></TabsContent>
        <TabsContent value="policy" className="mt-6"><PolicyView /></TabsContent>
      </Tabs>
    </div>
  );
}

function HealthView({ onStartCheck }: { onStartCheck: () => void }) {
  const health = useGuardianHealth();
  if (health.isLoading) {
    return <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-36" />)}</div>;
  }
  if (!health.data) return <ErrorCard message={health.error instanceof Error ? health.error.message : "Portfolio health is unavailable."} />;
  const data = health.data;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-1">
          <CardContent className="flex h-full flex-col items-center justify-center p-6 text-center">
            <div className={cn("text-6xl font-black font-mono", healthBandClass(data.band))}>{data.score}</div>
            <div className="mt-1 text-sm font-semibold uppercase tracking-widest">{data.band.replace("_", " ")}</div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${data.score}%` }} />
            </div>
          </CardContent>
        </Card>
        <Metric title="Portfolio value" value={currency.format(data.portfolio.totalValue)} subtitle={`${data.portfolio.holdingsCount} holdings`} />
        <Metric title="Cash buffer" value={`${number.format(data.portfolio.cashBufferPct)}%`} subtitle={currency.format(data.portfolio.cashBalance)} warn={data.portfolio.cashBufferPct < 5} />
        <Metric title="Largest position" value={`${number.format(data.portfolio.largestPositionPct)}%`} subtitle={`Top five: ${number.format(data.portfolio.topFiveConcentrationPct)}%`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Health components</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {data.components.map((component) => (
              <div key={component.key}>
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", statusClass(component.status))} /><span className="font-medium">{component.name}</span></div>
                    <p className="mt-1 text-xs text-muted-foreground">{component.description}</p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-bold">{component.score}/{component.maxScore}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className={cn("h-full rounded-full", statusClass(component.status))} style={{ width: `${(component.score / component.maxScore) * 100}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-500" />Top risks</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.topRisks.length ? data.topRisks.map((risk, index) => <div key={index} className="rounded-lg border bg-secondary/20 p-3 text-sm">{risk}</div>) : <p className="text-sm text-muted-foreground">No material policy risks detected.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Data readiness</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Readiness label="Explicit market-price coverage" value={data.dataQuality.priceCoveragePct} />
              <Readiness label="Research coverage" value={data.dataQuality.researchCoveragePct} />
              <Button className="w-full" onClick={onStartCheck}>Start a pre-trade check</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ title, value, subtitle, warn = false }: { title: string; value: string; subtitle: string; warn?: boolean }) {
  return <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">{title}</p><p className={cn("mt-2 text-2xl font-bold font-mono", warn && "text-amber-500")}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></CardContent></Card>;
}

function Readiness({ label, value }: { label: string; value: number }) {
  return <div><div className="mb-1 flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-mono">{number.format(value)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className={cn("h-full", value >= 90 ? "bg-emerald-500" : value >= 70 ? "bg-amber-500" : "bg-destructive")} style={{ width: `${Math.min(100, value)}%` }} /></div></div>;
}

function PreTradeView() {
  const [proposal, setProposal] = useState<GuardianProposalInput>(blankProposal);
  const [result, setResult] = useState<GuardianCheckResponse | null>(null);
  const [overrideRationale, setOverrideRationale] = useState("");
  const context = useGuardianContext(proposal.ticker || undefined);
  const check = useGuardianCheck();
  const execute = useExecuteGuardianDecision();
  const cancel = useCancelGuardianDecision();
  const holdings = context.data?.portfolio.holdings ?? [];

  useEffect(() => {
    const holding = context.data?.holding;
    const research = context.data?.research;
    if (!proposal.ticker) return;
    setProposal((current) => ({
      ...current,
      name: holding?.name ?? current.name,
      price: current.price ?? holding?.marketPrice ?? null,
      targetPrice: current.targetPrice ?? research?.targetPrice ?? null,
      investmentHorizon: current.investmentHorizon || research?.investmentHorizon || "",
      maxAcceptableLossPct: current.maxAcceptableLossPct ?? research?.maxAcceptableLossPct ?? null,
      citedSourceIds: research?.isCovered ? [`research:${proposal.ticker}`] : [],
    }));
  }, [proposal.ticker, context.data?.holding, context.data?.research]);

  const submit = () => {
    setResult(null);
    check.mutate(proposal, { onSuccess: setResult });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
      <Card>
        <CardHeader><CardTitle className="text-base">Decision packet</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Action"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={proposal.action} onChange={(event) => setProposal({ ...proposal, action: event.target.value as GuardianProposalInput["action"] })}>{["buy", "add", "sell", "trim", "exit", "hold", "review"].map((action) => <option key={action} value={action}>{action.toUpperCase()}</option>)}</select></Field>
            <Field label="Ticker"><Input list="guardian-tickers" value={proposal.ticker} onChange={(event) => { setResult(null); setProposal({ ...blankProposal, action: proposal.action, ticker: event.target.value.toUpperCase() }); }} placeholder="RELIANCE" /><datalist id="guardian-tickers">{holdings.map((item) => <option key={item.ticker} value={item.ticker}>{item.name}</option>)}</datalist></Field>
            <Field label="Evidence quality"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={proposal.evidenceQuality} onChange={(event) => setProposal({ ...proposal, evidenceQuality: event.target.value as "high" | "medium" | "low" })}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <NumericField label="Quantity" value={proposal.quantity} onChange={(value) => setProposal({ ...proposal, quantity: value })} />
            <NumericField label="Price" value={proposal.price} onChange={(value) => setProposal({ ...proposal, price: value })} />
            <NumericField label="Fees" value={proposal.fees} onChange={(value) => setProposal({ ...proposal, fees: value })} />
            <NumericField label="Target price" value={proposal.targetPrice} onChange={(value) => setProposal({ ...proposal, targetPrice: value })} />
          </div>
          <Field label="Investment rationale"><Textarea value={proposal.rationale} onChange={(event) => setProposal({ ...proposal, rationale: event.target.value })} placeholder="What changed, why now, and which quantified evidence supports the action?" className="min-h-24" /></Field>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Investment horizon"><Input value={proposal.investmentHorizon} onChange={(event) => setProposal({ ...proposal, investmentHorizon: event.target.value })} placeholder="3 years" /></Field>
            <NumericField label="Maximum acceptable loss (%)" value={proposal.maxAcceptableLossPct} onChange={(value) => setProposal({ ...proposal, maxAcceptableLossPct: value })} />
          </div>
          <Field label="Bear case"><Textarea value={proposal.bearCase} onChange={(event) => setProposal({ ...proposal, bearCase: event.target.value })} placeholder="What could go wrong, and how would it show up in measurable results?" /></Field>
          <Field label="Thesis invalidation"><Textarea value={proposal.thesisInvalidation} onChange={(event) => setProposal({ ...proposal, thesisInvalidation: event.target.value })} placeholder="Specific conditions that would prove the thesis wrong." /></Field>
          <Field label="Exit conditions"><Textarea value={proposal.exitConditions} onChange={(event) => setProposal({ ...proposal, exitConditions: event.target.value })} placeholder="Target, time, thesis and risk-based exit rules." /></Field>
          {context.data?.research && <div className="grid gap-3 rounded-lg border bg-secondary/20 p-4 text-sm sm:grid-cols-4"><ContextItem label="Research" value={`${context.data.research.completenessScore}/100`} /><ContextItem label="Thesis" value={context.data.research.thesisStatus} /><ContextItem label="Conviction" value={context.data.research.conviction} /><ContextItem label="5D move" value={context.data.market?.priceChange5dPct == null ? "Unavailable" : `${number.format(context.data.market.priceChange5dPct)}%`} /></div>}
          <Button onClick={submit} disabled={check.isPending || !proposal.ticker} className="w-full">{check.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}Run Guardian check</Button>
          {check.error && <ErrorInline message={check.error.message} />}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {result ? <DecisionResult result={result} overrideRationale={overrideRationale} setOverrideRationale={setOverrideRationale} onExecute={() => execute.mutate({ checkId: result.checkId, userConfirmed: true, overrideRationale: result.requiresOverride ? overrideRationale : undefined })} onCancel={() => cancel.mutate(result.checkId, { onSuccess: () => setResult(null) })} executing={execute.isPending} cancelling={cancel.isPending} executionMessage={execute.data?.message} error={execute.error?.message || cancel.error?.message} /> : <Card><CardContent className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center text-muted-foreground"><Shield className="mb-4 h-12 w-12 opacity-30" /><p className="font-medium text-foreground">No decision packet yet</p><p className="mt-2 max-w-sm text-sm">Complete the proposal and run Guardian. The review uses current Portfolio, Research and Market Intelligence records.</p></CardContent></Card>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="space-y-2"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>{children}</label>; }
function NumericField({ label, value, onChange }: { label: string; value?: number | null; onChange: (value: number | null) => void }) { return <Field label={label}><Input inputMode="decimal" value={value ?? ""} onChange={(event) => onChange(asNumber(event.target.value))} /></Field>; }
function ContextItem({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-semibold capitalize">{value}</p></div>; }

function DecisionResult({ result, overrideRationale, setOverrideRationale, onExecute, onCancel, executing, cancelling, executionMessage, error }: { result: GuardianCheckResponse; overrideRationale: string; setOverrideRationale: (value: string) => void; onExecute: () => void; onCancel: () => void; executing: boolean; cancelling: boolean; executionMessage?: string; error?: string }) {
  const style = decisionStyle(result.decision);
  const Icon = style.icon;
  return <>
    <Card className={cn("border-2", style.className)}><CardContent className="p-6"><div className="flex items-start gap-4"><Icon className="mt-1 h-9 w-9 shrink-0" /><div><Badge variant="outline" className={style.className}>{style.label}</Badge><h2 className="mt-3 text-xl font-bold">{result.summary}</h2><p className="mt-2 text-xs opacity-80">Valid until {new Date(result.expiresAt).toLocaleTimeString("en-IN")}</p></div></div></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Projected portfolio state</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><MetricMini label="Trade notional" value={currency.format(result.projected.tradeNotional)} /><MetricMini label="Cash after action" value={currency.format(result.projected.cashBalance)} /><MetricMini label="Stock allocation" value={`${number.format(result.projected.stockAllocationPct)}%`} /><MetricMini label="Sector allocation" value={`${number.format(result.projected.sectorAllocationPct)}%`} /></CardContent></Card>
    {(result.hardRuleBreaches.length > 0 || result.softRuleWarnings.length > 0 || result.preTradeFailures.length > 0) && <Card><CardHeader><CardTitle className="text-base">Policy findings</CardTitle></CardHeader><CardContent className="space-y-3">{result.hardRuleBreaches.map((item) => <Finding key={item.ruleId} tone="bad" title={item.ruleName} detail={item.message} />)}{result.preTradeFailures.map((item) => <Finding key={item.field} tone="info" title={item.field} detail={item.message} />)}{result.softRuleWarnings.map((item) => <Finding key={item.ruleId} tone="warn" title={item.ruleName} detail={item.message} />)}</CardContent></Card>}
    {result.biasFlags.some((item) => item.detected) && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4" />Behavioural flags</CardTitle></CardHeader><CardContent className="space-y-3">{result.biasFlags.filter((item) => item.detected).map((item) => <Finding key={item.bias} tone="warn" title={item.bias} detail={item.description} />)}</CardContent></Card>}
    {result.requiresOverride && result.canOverride && <Card className="border-destructive/30"><CardHeader><CardTitle className="text-base text-destructive">Override rationale</CardTitle></CardHeader><CardContent><Textarea value={overrideRationale} onChange={(event) => setOverrideRationale(event.target.value)} placeholder="Explain the exceptional evidence, risk accepted and compensating action. Minimum 30 characters." /></CardContent></Card>}
    <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={onCancel} disabled={cancelling}>{cancelling ? "Cancelling…" : "Cancel"}</Button><Button className="flex-1" onClick={onExecute} disabled={executing || result.decision === "require_evidence" || (result.requiresOverride && overrideRationale.trim().length < 30)}>{executing ? "Logging…" : result.requiresOverride ? "Override and log" : "Confirm and log"}</Button></div>
    {executionMessage && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500">{executionMessage}</div>}{error && <ErrorInline message={error} />}
  </>;
}

function MetricMini({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-mono font-bold">{value}</p></div>; }
function Finding({ tone, title, detail }: { tone: "bad" | "warn" | "info"; title: string; detail: string }) { const Icon = tone === "bad" ? XCircle : tone === "warn" ? AlertTriangle : FileCheck2; return <div className={cn("flex gap-3 rounded-lg border p-3", tone === "bad" ? "border-destructive/30 bg-destructive/5" : tone === "warn" ? "border-amber-500/30 bg-amber-500/5" : "border-blue-500/30 bg-blue-500/5")}><Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-500" : "text-blue-500")} /><div><p className="text-sm font-semibold capitalize">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div></div>; }

function StressView() {
  const packets = useGuardianPackets(20);
  const latest = packets.data?.entries.find((packet) => packet.result?.stressTestResults?.length);
  if (packets.isLoading) return <Skeleton className="h-96" />;
  if (!latest) return <Card><CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><TestTube2 className="mb-4 h-10 w-10 text-muted-foreground" /><p className="font-medium">No stress-test run yet</p><p className="mt-2 text-sm text-muted-foreground">Run a buy or add proposal in Pre-trade. Guardian will retain the scenario results with the decision packet.</p></CardContent></Card>;
  return <div className="space-y-6"><Card><CardHeader><CardTitle className="text-base">Latest scenario set — {latest.ticker}</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{latest.result.stressTestResults.map((item) => <div key={item.scenario} className="rounded-xl border bg-secondary/10 p-4"><div className="flex items-start justify-between gap-3"><p className="font-semibold">{item.scenario}</p><Badge variant="outline" className={cn(item.severity === "critical" || item.severity === "high" ? "text-destructive" : item.severity === "medium" ? "text-amber-500" : "text-emerald-500")}>{item.severity}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3"><MetricMini label="Portfolio" value={`${number.format(item.portfolioImpactPct)}%`} /><MetricMini label="Position" value={`${number.format(item.positionImpactPct)}%`} /></div><p className="mt-3 text-xs text-muted-foreground">{item.methodology}</p></div>)}</CardContent></Card><div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-400">These are transparent deterministic sensitivity scenarios—not forecasts, VaR estimates or live derivatives models.</div></div>;
}

function AuditView() {
  const packets = useGuardianPackets(100);
  const audit = useGuardianAudit(100);
  const rows = packets.data?.entries ?? [];
  if (packets.isLoading || audit.isLoading) return <Skeleton className="h-[500px]" />;
  return <div className="space-y-6"><div className="grid gap-4 md:grid-cols-4"><Metric title="Decision packets" value={String(rows.length)} subtitle="Latest 100" /><Metric title="Executed" value={String(rows.filter((item) => item.status === "executed").length)} subtitle="Normal confirmations" /><Metric title="Overrides" value={String(rows.filter((item) => item.status === "overridden").length)} subtitle="Blocked actions overridden" warn={rows.some((item) => item.status === "overridden")} /><Metric title="Cancelled" value={String(rows.filter((item) => item.status === "cancelled").length)} subtitle="User stopped action" /></div><Card><CardHeader><CardTitle className="text-base">Immutable decision packets</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-y bg-secondary/30 text-xs text-muted-foreground"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Ticker</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Decision</th><th className="px-4 py-3">Research</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Findings</th></tr></thead><tbody className="divide-y">{rows.map((packet) => { const style = decisionStyle(packet.result.decision); return <tr key={packet.id} className="hover:bg-secondary/20"><td className="px-4 py-3 text-xs text-muted-foreground">{new Date(packet.createdAt).toLocaleString("en-IN")}</td><td className="px-4 py-3 font-bold">{packet.ticker}</td><td className="px-4 py-3 uppercase">{packet.action}</td><td className="px-4 py-3"><Badge variant="outline" className={style.className}>{style.label}</Badge></td><td className="px-4 py-3 font-mono">{packet.result.researchCompletenessScore}/100</td><td className="px-4 py-3 capitalize">{packet.status.replace("_", " ")}</td><td className="px-4 py-3 text-xs text-muted-foreground">{packet.result.hardRuleBreaches.length} hard · {packet.result.softRuleWarnings.length} warning · {packet.result.biasFlags.filter((item) => item.detected).length} bias</td></tr>; })}</tbody></table></CardContent></Card></div>;
}

function PolicyView() {
  const settingsQuery = useGuardianSettings();
  const update = useUpdateGuardianSettings();
  const [settings, setSettings] = useState<GuardianSettings | null>(null);
  useEffect(() => { if (settingsQuery.data?.settings) setSettings(settingsQuery.data.settings); }, [settingsQuery.data?.settings]);
  if (settingsQuery.isLoading || !settings) return <Skeleton className="h-[500px]" />;
  const setLimit = (key: keyof GuardianSettings["portfolioLimits"], value: number | null) => setSettings({ ...settings, portfolioLimits: { ...settings.portfolioLimits, [key]: value ?? 0 } });
  const setRequirement = (key: keyof GuardianSettings["preTradeRequirements"], value: boolean | number) => setSettings({ ...settings, preTradeRequirements: { ...settings.preTradeRequirements, [key]: value } });
  return <div className="space-y-6"><div className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Portfolio limits</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><PolicyNumber label="Maximum stock concentration (%)" value={settings.portfolioLimits.maxStockConcentrationPct} onChange={(value) => setLimit("maxStockConcentrationPct", value)} /><PolicyNumber label="Maximum sector concentration (%)" value={settings.portfolioLimits.maxSectorConcentrationPct} onChange={(value) => setLimit("maxSectorConcentrationPct", value)} /><PolicyNumber label="Minimum cash buffer (%)" value={settings.portfolioLimits.minCashBufferPct} onChange={(value) => setLimit("minCashBufferPct", value)} /><PolicyNumber label="Maximum small-cap exposure (%)" value={settings.portfolioLimits.maxSmallCapExposurePct} onChange={(value) => setLimit("maxSmallCapExposurePct", value)} /><PolicyNumber label="Maximum correlated positions" value={settings.portfolioLimits.maxCorrelatedPositions} onChange={(value) => setLimit("maxCorrelatedPositions", value)} /><PolicyNumber label="Maximum weekly new positions" value={settings.portfolioLimits.maxWeeklyNewPositions} onChange={(value) => setLimit("maxWeeklyNewPositions", value)} /><PolicyNumber label="Maximum portfolio drawdown (%)" value={settings.portfolioLimits.maxPortfolioDrawdownPct} onChange={(value) => setLimit("maxPortfolioDrawdownPct", value)} /></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Evidence requirements</CardTitle></CardHeader><CardContent className="space-y-3">{([ ["requireRationale", "Investment rationale"], ["requireInvestmentHorizon", "Investment horizon"], ["requireBearCase", "Bear case"], ["requireTargetPrice", "Target price"], ["requireThesisInvalidation", "Thesis invalidation"], ["requireMaxAcceptableLoss", "Maximum acceptable loss"], ["requireExitConditions", "Exit conditions"] ] as const).map(([key, label]) => <PolicyToggle key={key} label={label} enabled={settings.preTradeRequirements[key]} onToggle={() => setRequirement(key, !settings.preTradeRequirements[key])} />)}<PolicyNumber label="Minimum research completeness" value={settings.preTradeRequirements.minResearchCompletenessScore} onChange={(value) => setRequirement("minResearchCompletenessScore", value ?? 0)} /></CardContent></Card></div><Card><CardHeader><CardTitle className="text-base">Guardian controls</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><PolicyToggle label="Guardian Mode enabled" enabled={settings.guardianMode.enabled} onToggle={() => setSettings({ ...settings, guardianMode: { ...settings.guardianMode, enabled: !settings.guardianMode.enabled } })} /><PolicyToggle label="Allow reasoned overrides" enabled={settings.guardianMode.allowOverrideWithRationale} onToggle={() => setSettings({ ...settings, guardianMode: { ...settings.guardianMode, allowOverrideWithRationale: !settings.guardianMode.allowOverrideWithRationale } })} /><PolicyToggle label="Require audit logging" enabled={settings.guardianMode.requireAuditLog} onToggle={() => setSettings({ ...settings, guardianMode: { ...settings.guardianMode, requireAuditLog: !settings.guardianMode.requireAuditLog } })} /></CardContent></Card><Button onClick={() => update.mutate(settings)} disabled={update.isPending}>{update.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Guardian policy</Button>{update.isSuccess && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500">Policy saved.</div>}{update.error && <ErrorInline message={update.error.message} />}</div>;
}

function PolicyNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number | null) => void }) { return <NumericField label={label} value={value} onChange={onChange} />; }
function PolicyToggle({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) { return <button type="button" onClick={onToggle} className="flex w-full items-center justify-between rounded-lg border bg-secondary/10 p-3 text-left"><span className="text-sm font-medium">{label}</span><span className={cn("relative h-6 w-11 rounded-full transition-colors", enabled ? "bg-emerald-500" : "bg-secondary")}><span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition-transform", enabled ? "translate-x-6" : "translate-x-1")} /></span></button>; }

function ErrorInline({ message }: { message: string }) { return <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</div>; }
function ErrorCard({ message }: { message: string }) { return <Card><CardContent className="flex min-h-60 flex-col items-center justify-center p-8 text-center"><ShieldX className="mb-4 h-10 w-10 text-destructive" /><p className="font-semibold">Guardian could not load</p><p className="mt-2 text-sm text-muted-foreground">{message}</p></CardContent></Card>; }
