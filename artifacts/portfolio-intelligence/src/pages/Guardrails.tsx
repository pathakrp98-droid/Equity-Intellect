import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, CheckCircle2,
  XCircle, Clock, BarChart3, Brain, FileText, ChevronDown, ChevronRight,
  Download, Settings2, Eye, EyeOff
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Limit {
  id: string;
  name: string;
  current: string;
  currentNum: number;
  limit: number;
  unit: string;
  type: 'HARD' | 'SOFT';
  status: 'ok' | 'warn' | 'breach';
  detail: string;
}

interface AuditRow {
  id: string;
  timestamp: string;
  ticker: string;
  action: string;
  decision: 'APPROVED' | 'APPROVED_WARNINGS' | 'REJECTED' | 'REQUIRE_EVIDENCE';
  breachedRules: string[];
  researchScore: number;
  override: boolean;
  overrideRationale?: string;
  overrideTime?: string;
  finalAction: string;
}

interface BiasFlag {
  date: string;
  ticker: string;
  action: string;
  bias: string;
  overridden: boolean;
}

// ─── Static Data ─────────────────────────────────────────────────────────────

const INITIAL_LIMITS: Limit[] = [
  { id: 'stock_conc', name: 'Max Stock Concentration', current: '15.2% (INFY)', currentNum: 15.2, limit: 20, unit: '%', type: 'HARD', status: 'ok', detail: 'Largest single position' },
  { id: 'sector_conc', name: 'Max Sector Concentration', current: '30.1% (Banking)', currentNum: 30.1, limit: 35, unit: '%', type: 'HARD', status: 'ok', detail: 'Largest sector weight' },
  { id: 'smallcap', name: 'Max Small-Cap Exposure', current: '4.8%', currentNum: 4.8, limit: 20, unit: '%', type: 'SOFT', status: 'ok', detail: 'Small-cap total weight' },
  { id: 'cash', name: 'Min Cash Buffer', current: '2.6%', currentNum: 2.6, limit: 5, unit: '%', type: 'SOFT', status: 'warn', detail: 'Liquid cash ratio' },
  { id: 'corr', name: 'Max Correlated Positions', current: '3 (tech cluster)', currentNum: 3, limit: 4, unit: '', type: 'SOFT', status: 'ok', detail: 'Correlated stock count' },
  { id: 'new_pos', name: 'Max Weekly New Positions', current: '0 this week', currentNum: 0, limit: 2, unit: '', type: 'HARD', status: 'ok', detail: 'New entries this week' },
  { id: 'drawdown', name: 'Max Portfolio Drawdown', current: '-2.4% MTD', currentNum: 2.4, limit: 15, unit: '%', type: 'HARD', status: 'ok', detail: 'MTD drawdown' },
  { id: 'research', name: 'Min Research Score', current: 'avg 68/100', currentNum: 68, limit: 70, unit: '/100', type: 'SOFT', status: 'warn', detail: 'Average research score' },
];

const GUARDIAN_DECISIONS = [
  { ticker: 'INFY', action: 'ADD', decision: 'APPROVED', date: '2026-07-10', override: false },
  { ticker: 'BAJFINANCE', action: 'TRIM', decision: 'APPROVED WITH WARNINGS', date: '2026-07-08', override: false },
  { ticker: 'ASIANPAINT', action: 'HOLD', decision: 'REQUIRE EVIDENCE', date: '2026-07-05', override: false, note: 'cancelled' },
  { ticker: 'ZOMATO', action: 'BUY', decision: 'REJECTED', date: '2026-07-01', override: true },
  { ticker: 'DMART', action: 'ADD', decision: 'APPROVED', date: '2026-06-28', override: false },
];

const AUDIT_DATA: AuditRow[] = [
  { id: '1', timestamp: '2026-07-10 14:32', ticker: 'INFY', action: 'ADD', decision: 'APPROVED', breachedRules: [], researchScore: 82, override: false, finalAction: 'Executed' },
  { id: '2', timestamp: '2026-07-08 10:15', ticker: 'BAJFINANCE', action: 'TRIM', decision: 'APPROVED_WARNINGS', breachedRules: ['Min Research Score (soft)'], researchScore: 65, override: false, finalAction: 'Executed with acknowledgment' },
  { id: '3', timestamp: '2026-07-05 09:47', ticker: 'ASIANPAINT', action: 'HOLD', decision: 'REQUIRE_EVIDENCE', breachedRules: ['Bear case not updated in 45 days'], researchScore: 58, override: false, finalAction: 'Cancelled by user' },
  { id: '4', timestamp: '2026-07-01 16:22', ticker: 'ZOMATO', action: 'BUY', decision: 'REJECTED', breachedRules: ['Max Stock Concentration (hard)', 'Min Research Score (soft)'], researchScore: 44, override: true, overrideRationale: 'Strong conviction on platform monetization cycle. Willing to accept elevated risk given 3-year horizon. Will monitor quarterly.', overrideTime: '2026-07-01 16:45', finalAction: 'Executed (override)' },
  { id: '5', timestamp: '2026-06-28 11:05', ticker: 'DMART', action: 'ADD', decision: 'APPROVED', breachedRules: [], researchScore: 79, override: false, finalAction: 'Executed' },
  { id: '6', timestamp: '2026-06-20 13:30', ticker: 'HDFCBANK', action: 'BUY', decision: 'APPROVED_WARNINGS', breachedRules: ['Max Sector Concentration (soft warning)'], researchScore: 71, override: false, finalAction: 'Executed with acknowledgment' },
  { id: '7', timestamp: '2026-06-15 09:00', ticker: 'RELIANCE', action: 'TRIM', decision: 'APPROVED', breachedRules: [], researchScore: 88, override: false, finalAction: 'Executed' },
  { id: '8', timestamp: '2026-06-10 15:45', ticker: 'PAYTM', action: 'BUY', decision: 'REJECTED', breachedRules: ['Min Research Score (hard enforcement)', 'Thesis invalidation detected'], researchScore: 31, override: true, overrideRationale: 'Post-RBI license restoration — fundamentally changed picture. Research score will be updated once Q1 results published. Taking small starter position.', overrideTime: '2026-06-10 16:10', finalAction: 'Executed (override)' },
  { id: '9', timestamp: '2026-06-05 10:20', ticker: 'TCS', action: 'ADD', decision: 'APPROVED', breachedRules: [], researchScore: 91, override: false, finalAction: 'Executed' },
  { id: '10', timestamp: '2026-05-28 14:00', ticker: 'IRCTC', action: 'SELL', decision: 'REQUIRE_EVIDENCE', breachedRules: ['Exit conditions not documented'], researchScore: 60, override: false, finalAction: 'Executed after evidence provided' },
];

const BIASES = [
  { id: 'recency', name: 'Recency Bias', desc: 'Overweighting recent events (last 3 months) over long-term thesis', detected: 'Action taken within 48h of a major price move or news event' },
  { id: 'confirmation', name: 'Confirmation Bias', desc: 'Seeking only information that supports existing thesis', detected: 'Research terminal visited but no bear case updated in 30+ days' },
  { id: 'anchoring', name: 'Anchoring', desc: 'Over-relying on purchase price or analyst target as reference', detected: 'Target price matches round number with no DCF/PE methodology noted' },
  { id: 'overconfidence', name: 'Overconfidence', desc: 'Overstating ability to predict outcomes', detected: "Rationale uses words: 'certain', 'definitely', 'will', 'guaranteed'" },
  { id: 'narrative', name: 'Narrative Bias', desc: 'Compelling story substituting for quantitative analysis', detected: 'Rationale is qualitative-only with no valuation reference' },
  { id: 'fomo', name: 'FOMO (Fear of Missing Out)', desc: 'Chasing recent price moves without fresh evidence', detected: 'Buy action after >10% move in 5 days without updated thesis' },
  { id: 'revenge', name: 'Revenge Trading', desc: 'Attempting to recover losses through aggressive action', detected: 'Buy action on same stock sold at a loss within 30 days' },
  { id: 'panic', name: 'Panic Selling', desc: 'Selling based on short-term fear rather than thesis change', detected: 'Sell action with rationale containing emotional language' },
  { id: 'overtrade', name: 'Overtrading', desc: 'Excessive transaction frequency eroding returns', detected: 'More than 3 portfolio changes in a single week' },
  { id: 'averaging', name: 'Unjustified Averaging Down', desc: 'Adding to a losing position without new evidence', detected: 'Add/buy action when position is down >15% and no thesis update' },
];

const BIAS_FLAGS: BiasFlag[] = [
  { date: '2026-07-01', ticker: 'ZOMATO', action: 'BUY', bias: 'FOMO', overridden: true },
  { date: '2026-06-20', ticker: 'HDFCBANK', action: 'BUY', bias: 'Recency Bias', overridden: false },
  { date: '2026-06-10', ticker: 'PAYTM', action: 'BUY', bias: 'Confirmation Bias', overridden: true },
  { date: '2026-05-28', ticker: 'IRCTC', action: 'SELL', bias: 'Panic Selling', overridden: false },
  { date: '2026-05-15', ticker: 'BAJFINANCE', action: 'ADD', bias: 'Anchoring', overridden: false },
];

const STRESS_SCENARIOS = [
  { scenario: 'Market Correction (-20%)', impact: '-₹96.4L (-20.0%)', numericPct: -20.0, severity: 'HIGH' },
  { scenario: 'Recession (-35%)', impact: '-₹168.7L (-35.0%)', numericPct: -35.0, severity: 'CRITICAL' },
  { scenario: 'Rate Hike +100bps', impact: '-₹38.6L (-8.0%)', numericPct: -8.0, severity: 'MEDIUM', note: 'Banking/NBFC sector hit' },
  { scenario: 'Crude Oil +30%', impact: '-₹14.5L (-3.0%)', numericPct: -3.0, severity: 'LOW', note: 'Net positive for energy' },
  { scenario: 'INR -10%', impact: '+₹21.8L (+4.5%)', numericPct: 4.5, severity: 'LOW', note: 'IT sector tailwind' },
  { scenario: 'Bajaj Finance Bear Case', impact: '-₹22.4L (-4.6%)', numericPct: -4.6, severity: 'MEDIUM' },
];

const PRE_TRADE_ITEMS = [
  { id: 'rationale', label: 'Investment Rationale', desc: 'Why now, what changed', required: true },
  { id: 'horizon', label: 'Investment Horizon', desc: 'Short/medium/long term, specific timeline', required: true },
  { id: 'bear', label: 'Bear Case', desc: 'What could go wrong, quantified', required: true },
  { id: 'cases', label: 'Base & Bull Cases', desc: 'Expected and optimistic scenarios', required: true },
  { id: 'target', label: 'Target Price with Methodology', desc: 'DCF, PE, or other methodology', required: true },
  { id: 'invalidation', label: 'Thesis Invalidation Conditions', desc: 'When the thesis is wrong', required: true },
  { id: 'max_loss', label: 'Maximum Acceptable Loss %', desc: 'Pre-defined stop-loss logic', required: true },
  { id: 'exit', label: 'Exit Conditions', desc: 'When and how to exit', required: true },
  { id: 'why_not_hold', label: 'Why not hold current position?', desc: 'Opportunity cost rationale (for new buys)', required: true },
  { id: 'evidence_quality', label: 'Evidence Quality Rating', desc: 'Self-assessed: high/medium/low confidence', required: false },
  { id: 'sources', label: 'Cited Sources', desc: 'News, filings, broker reports used', required: false },
];

// ─── Helper Components ────────────────────────────────────────────────────────

function ProgressBar({ pct, status }: { pct: number; status: 'ok' | 'warn' | 'breach' }) {
  const barColor = status === 'breach' ? 'bg-destructive' : status === 'warn' ? 'bg-amber-500' : 'bg-emerald-500';
  const capped = Math.min(pct, 100);
  return (
    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${capped}%` }} />
    </div>
  );
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none',
        enabled ? 'bg-emerald-500' : 'bg-secondary'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform',
          enabled ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  if (decision === 'APPROVED' || decision === 'APPROVED ✓') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
  }
  if (decision === 'APPROVED_WARNINGS' || decision === 'APPROVED WITH WARNINGS') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20"><AlertTriangle className="w-3 h-3" /> Warnings</span>;
  }
  if (decision === 'REJECTED') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-destructive/10 text-destructive border-destructive/20"><XCircle className="w-3 h-3" /> Rejected</span>;
  }
  if (decision === 'REQUIRE_EVIDENCE' || decision === 'REQUIRE EVIDENCE') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/20"><Clock className="w-3 h-3" /> Evidence</span>;
  }
  return <span className="text-xs text-muted-foreground">{decision}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    CRITICAL: 'bg-destructive/10 text-destructive border-destructive/20',
    HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    LOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };
  return (
    <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border', map[severity] || 'bg-secondary text-muted-foreground border-border')}>
      {severity}
    </span>
  );
}

// ─── Tab 1: Overview ──────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="space-y-6 p-6">
      {/* Health Score */}
      <div className="rounded-xl border bg-card shadow-sm p-6">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" /> Portfolio Health Score
        </h2>
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Circular Score */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="w-28 h-28 rounded-full border-4 border-amber-500 flex flex-col items-center justify-center bg-amber-500/5">
              <span className="text-3xl font-black text-amber-400">71</span>
              <span className="text-[10px] text-muted-foreground">/100</span>
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">CAUTION</span>
          </div>

          {/* Component bars */}
          <div className="flex-1 space-y-4 w-full">
            {[
              { label: 'Thesis Integrity', score: 16, max: 20, note: '2 positions weakening, 0 broken' },
              { label: 'Conviction Distribution', score: 14, max: 20, note: 'High 7, Medium 3, Low 2 — concentration in high-conviction' },
              { label: 'Concentration Risk', score: 15, max: 20, note: 'Max position 15.2%. Sector max 30.1%' },
              { label: 'Alert Severity', score: 10, max: 20, note: '3 active alerts (2 high severity)' },
              { label: 'Diversification', score: 16, max: 20, note: '5 sectors, 12 stocks, Tech+Finance dominant' },
            ].map(c => {
              const pct = (c.score / c.max) * 100;
              const barColor = pct >= 85 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-destructive';
              return (
                <div key={c.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{c.label}</span>
                    <span className="text-muted-foreground font-mono text-xs">{c.score}/{c.max}</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{c.note}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top risks */}
        <div className="mt-6 pt-5 border-t">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Top Risks Detected</h3>
          <div className="space-y-2">
            {[
              'Bajaj Finance NIM compression — thesis assumption under pressure',
              'Asian Paints margin deterioration — competition from Birla Opus',
              'HDFC Bank promoter pledge — monitor for escalation',
            ].map((risk, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <span className="text-foreground/80">{risk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Guardian Mode Summary */}
      <div className="rounded-xl border bg-card shadow-sm p-6">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Guardian Mode Summary
        </h2>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Actions Reviewed', value: '4', color: 'text-foreground' },
            { label: 'Blocked', value: '1', color: 'text-destructive' },
            { label: 'Override with Rationale', value: '1', color: 'text-amber-400' },
            { label: 'Approved', value: '2', color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-secondary/40 border border-border p-3 text-center">
              <div className={cn('text-2xl font-black', s.color)}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-4">Last 30 days</p>

        {/* Recent decisions table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left pb-2 font-medium">Ticker</th>
                <th className="text-left pb-2 font-medium">Action</th>
                <th className="text-left pb-2 font-medium">Decision</th>
                <th className="text-left pb-2 font-medium">Date</th>
                <th className="text-left pb-2 font-medium">Override?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {GUARDIAN_DECISIONS.map((row, i) => (
                <tr key={i} className="hover:bg-secondary/20 transition-colors">
                  <td className="py-2.5 font-bold text-foreground">{row.ticker}</td>
                  <td className="py-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-secondary px-2 py-0.5 rounded border border-border">{row.action}</span>
                  </td>
                  <td className="py-2.5"><DecisionBadge decision={row.decision} /></td>
                  <td className="py-2.5 text-xs text-muted-foreground font-mono">{row.date}</td>
                  <td className="py-2.5">
                    {row.override ? (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">YES (override)</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{(row as any).note ? `No (${(row as any).note})` : 'No'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stress Test */}
      <div className="rounded-xl border bg-card shadow-sm p-6">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Pre-Trade Stress Test Preview
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left pb-2 font-medium">Scenario</th>
                <th className="text-right pb-2 font-medium">Portfolio Impact</th>
                <th className="text-center pb-2 font-medium">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {STRESS_SCENARIOS.map((s, i) => {
                const isPositive = s.numericPct > 0;
                const impactColor = isPositive
                  ? 'text-emerald-400'
                  : s.severity === 'CRITICAL' || s.severity === 'HIGH'
                  ? 'text-destructive'
                  : s.severity === 'MEDIUM'
                  ? 'text-amber-400'
                  : 'text-foreground';
                return (
                  <tr key={i} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-2.5 font-medium">
                      {s.scenario}
                      {s.note && <span className="text-xs text-muted-foreground ml-2">({s.note})</span>}
                    </td>
                    <td className={cn('py-2.5 text-right font-mono font-bold', impactColor)}>{s.impact}</td>
                    <td className="py-2.5 text-center"><SeverityBadge severity={s.severity} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Portfolio Limits ──────────────────────────────────────────────────

function LimitsTab() {
  const [limits, setLimits] = useState<Limit[]>(INITIAL_LIMITS);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState<string>('');

  const startEdit = (l: Limit) => {
    setEditing(l.id);
    setEditVal(String(l.limit));
  };

  const saveEdit = (id: string) => {
    const num = parseFloat(editVal);
    if (!isNaN(num)) {
      setLimits(prev => prev.map(l => {
        if (l.id !== id) return l;
        // recalculate status
        const ratio = l.id === 'cash' || l.id === 'research'
          ? l.currentNum / num
          : l.currentNum / num;
        let status: 'ok' | 'warn' | 'breach';
        if (l.id === 'cash') {
          status = l.currentNum < num * 0.8 ? 'breach' : l.currentNum < num ? 'warn' : 'ok';
        } else if (l.id === 'research') {
          status = l.currentNum < num * 0.95 ? 'breach' : l.currentNum < num ? 'warn' : 'ok';
        } else {
          status = ratio > 1 ? 'breach' : ratio > 0.8 ? 'warn' : 'ok';
        }
        return { ...l, limit: num, status };
      }));
    }
    setEditing(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {limits.map(l => {
          const isReverse = l.id === 'cash' || l.id === 'research';
          const pct = isReverse
            ? (l.currentNum / l.limit) * 100
            : (l.currentNum / l.limit) * 100;
          const displayPct = isReverse ? (100 - pct + 100 * (pct / 100)) : pct; // just use raw ratio for bar
          const barPct = Math.min((l.currentNum / l.limit) * 100, 110);

          return (
            <div key={l.id} className={cn(
              'rounded-xl border bg-card shadow-sm p-4 space-y-3',
              l.status === 'breach' ? 'border-destructive/30' :
              l.status === 'warn' ? 'border-amber-500/30' : 'border-border'
            )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{l.name}</span>
                    <span className={cn(
                      'text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border',
                      l.type === 'HARD'
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : 'bg-primary/10 text-primary border-primary/20'
                    )}>{l.type} RULE</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{l.detail}</p>
                </div>
                <div className={cn(
                  'shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border',
                  l.status === 'ok' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                  l.status === 'warn' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                  'text-destructive bg-destructive/10 border-destructive/20'
                )}>
                  {l.status === 'ok' ? <><CheckCircle2 className="w-3 h-3" /> OK</> :
                   l.status === 'warn' ? <><AlertTriangle className="w-3 h-3" /> WARNING</> :
                   <><XCircle className="w-3 h-3" /> BREACH</>}
                </div>
              </div>

              <ProgressBar
                pct={isReverse ? (l.currentNum / l.limit) * 100 : barPct}
                status={l.status}
              />

              <div className="flex items-center justify-between text-xs">
                <span>
                  <span className="text-muted-foreground">Current: </span>
                  <span className="font-semibold text-foreground">{l.current}</span>
                </span>
                <div className="flex items-center gap-2">
                  {editing === l.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        className="w-16 text-xs bg-secondary border border-border rounded px-1.5 py-0.5 text-foreground"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(l.id); if (e.key === 'Escape') setEditing(null); }}
                        autoFocus
                      />
                      <Button size="sm" variant="outline" className="h-5 text-[10px] px-1.5" onClick={() => saveEdit(l.id)}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={() => setEditing(null)}>✕</Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-muted-foreground">Limit: <span className="font-semibold text-foreground">{l.limit}{l.unit}</span></span>
                      <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 text-muted-foreground" onClick={() => startEdit(l)}>
                        <Settings2 className="w-2.5 h-2.5 mr-0.5" /> Edit
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-200/80 leading-relaxed">
            <span className="font-semibold text-amber-400">Hard Rules</span> cannot be bypassed.{' '}
            <span className="font-semibold text-amber-400">Soft Rules</span> generate warnings and require acknowledgment.
            Override of any rule requires written rationale and creates an audit entry.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Pre-Trade Rules ───────────────────────────────────────────────────

function PreTradeTab() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(PRE_TRADE_ITEMS.map(i => [i.id, true]))
  );

  const flip = (id: string) => setToggles(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="p-6 space-y-6">
      {/* Required Pre-Trade Evidence */}
      <div className="rounded-xl border bg-card shadow-sm p-5">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Required Pre-Trade Evidence
        </h2>
        <div className="space-y-2">
          {PRE_TRADE_ITEMS.map(item => (
            <div key={item.id} className={cn(
              'flex items-center justify-between p-3 rounded-lg border hover:bg-secondary/20 transition-colors',
              toggles[item.id] ? 'border-border bg-secondary/10' : 'border-border/40 opacity-60'
            )}>
              <div className="flex items-center gap-3">
                <Toggle enabled={toggles[item.id]} onToggle={() => flip(item.id)} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{item.label}</span>
                    <span className={cn(
                      'text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border',
                      item.required
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : 'bg-secondary text-muted-foreground border-border'
                    )}>
                      {item.required ? 'REQUIRED' : 'OPTIONAL'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hallucination Protections */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 shadow-sm p-5">
        <h2 className="font-semibold text-sm text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400" /> AI Data Integrity Checks — Hallucination Protections
        </h2>
        <div className="space-y-2.5">
          {[
            'Unverifiable data is always labeled [UNKNOWN] — never fabricated',
            'AI Copilot will never invent analyst ratings, filings, news, or corporate actions',
            'All AI responses are clearly separated into [VERIFIED DATA] and [INFERENCE]',
            'Sources are always cited — if a source cannot be named, the claim is withdrawn',
            'Confidence level is always stated: High / Medium / Low / Speculative',
            'Any figure that cannot be verified from in-app data is flagged as unconfirmed',
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <span className="text-foreground/80">{rule}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Bias & Psychology ─────────────────────────────────────────────────

function BiasTab() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(BIASES.map(b => [b.id, true]))
  );

  const flip = (id: string) => setEnabled(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
          <Brain className="w-4 h-4" /> Cognitive Bias Checks
        </h2>
        <p className="text-xs text-muted-foreground mb-4">Guardian Mode monitors all trade actions against these psychological patterns in real time.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BIASES.map(bias => (
            <div key={bias.id} className={cn(
              'rounded-xl border bg-card shadow-sm p-4 space-y-2 transition-opacity',
              !enabled[bias.id] && 'opacity-50'
            )}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-semibold text-sm">{bias.name}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{bias.desc}</p>
                </div>
                <Toggle enabled={enabled[bias.id]} onToggle={() => flip(bias.id)} />
              </div>
              <div className="pt-2 border-t border-border/40">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Detected when: </span>
                <span className="text-xs text-foreground/70">{bias.detected}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Bias Flags */}
      <div className="rounded-xl border bg-card shadow-sm p-5">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Recent Bias Flags (Last 30 Days)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left pb-2 font-medium">Date</th>
                <th className="text-left pb-2 font-medium">Ticker</th>
                <th className="text-left pb-2 font-medium">Action</th>
                <th className="text-left pb-2 font-medium">Bias Detected</th>
                <th className="text-left pb-2 font-medium">Overridden?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {BIAS_FLAGS.map((f, i) => (
                <tr key={i} className="hover:bg-secondary/20 transition-colors">
                  <td className="py-2.5 text-xs font-mono text-muted-foreground">{f.date}</td>
                  <td className="py-2.5 font-bold">{f.ticker}</td>
                  <td className="py-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-secondary px-2 py-0.5 rounded border border-border">{f.action}</span>
                  </td>
                  <td className="py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">{f.bias}</span>
                  </td>
                  <td className="py-2.5">
                    {f.overridden
                      ? <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">YES</span>
                      : <span className="text-xs text-muted-foreground">No — heeded</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 5: Audit Trail ───────────────────────────────────────────────────────

function AuditTab() {
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [tickerFilter, setTickerFilter] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filtered = AUDIT_DATA.filter(row => {
    const matchTicker = tickerFilter === '' || row.ticker.toLowerCase().includes(tickerFilter.toLowerCase());
    const matchDecision =
      decisionFilter === 'all' ||
      (decisionFilter === 'approved' && row.decision === 'APPROVED') ||
      (decisionFilter === 'warnings' && row.decision === 'APPROVED_WARNINGS') ||
      (decisionFilter === 'rejected' && row.decision === 'REJECTED') ||
      (decisionFilter === 'overridden' && row.override);
    return matchTicker && matchDecision;
  });

  return (
    <div className="p-6 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1.5 flex-wrap">
          {[
            { val: 'all', label: 'All' },
            { val: 'approved', label: 'Approved' },
            { val: 'warnings', label: 'Warnings' },
            { val: 'rejected', label: 'Rejected' },
            { val: 'overridden', label: 'Overridden' },
          ].map(f => (
            <button
              key={f.val}
              onClick={() => setDecisionFilter(f.val)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors',
                decisionFilter === f.val
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary text-muted-foreground border-border hover:bg-secondary/80'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          placeholder="Filter by ticker..."
          value={tickerFilter}
          onChange={e => setTickerFilter(e.target.value)}
          className="ml-auto text-xs bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-40"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30 text-[11px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left p-3 font-medium">Timestamp</th>
                <th className="text-left p-3 font-medium">Ticker</th>
                <th className="text-left p-3 font-medium">Action</th>
                <th className="text-left p-3 font-medium">Decision</th>
                <th className="text-left p-3 font-medium">Breached Rules</th>
                <th className="text-center p-3 font-medium">Score</th>
                <th className="text-center p-3 font-medium">Override</th>
                <th className="text-left p-3 font-medium">Final Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map(row => (
                <>
                  <tr
                    key={row.id}
                    onClick={() => row.override && setExpandedRow(expandedRow === row.id ? null : row.id)}
                    className={cn(
                      'hover:bg-secondary/20 transition-colors',
                      row.override && 'cursor-pointer',
                      expandedRow === row.id && 'bg-secondary/30'
                    )}
                  >
                    <td className="p-3 text-xs font-mono text-muted-foreground whitespace-nowrap">{row.timestamp}</td>
                    <td className="p-3 font-bold">{row.ticker}</td>
                    <td className="p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-secondary px-2 py-0.5 rounded border border-border">{row.action}</span>
                    </td>
                    <td className="p-3"><DecisionBadge decision={row.decision} /></td>
                    <td className="p-3">
                      {row.breachedRules.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          {row.breachedRules.map((r, i) => (
                            <span key={i} className="block text-[10px] text-destructive/80">{r}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className={cn(
                        'text-xs font-bold font-mono',
                        row.researchScore >= 70 ? 'text-emerald-400' :
                        row.researchScore >= 50 ? 'text-amber-400' : 'text-destructive'
                      )}>{row.researchScore}</span>
                    </td>
                    <td className="p-3 text-center">
                      {row.override ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">YES</span>
                          {expandedRow === row.id ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{row.finalAction}</td>
                  </tr>
                  {row.override && expandedRow === row.id && (
                    <tr key={`${row.id}-expand`} className="bg-amber-500/5 border-t border-amber-500/20">
                      <td colSpan={8} className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                            <ShieldX className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Override Details</span>
                            <span className="text-xs text-muted-foreground font-mono ml-2">{row.overrideTime}</span>
                          </div>
                          <p className="text-sm text-foreground/80 leading-relaxed border-l-2 border-amber-500/40 pl-3">"{row.overrideRationale}"</p>
                          {row.breachedRules.length > 0 && (
                            <div className="mt-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hard/Soft Rules Overridden: </span>
                              <span className="text-xs text-destructive">{row.breachedRules.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">No audit records match the current filters.</div>
        )}
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <Download className="w-3.5 h-3.5" /> Export Audit Trail (CSV)
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Guardrails() {
  const [guardianActive, setGuardianActive] = useState(true);

  return (
    <div className="space-y-6 h-full flex flex-col max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Guardian Mode & Guardrails</h1>
            <span className={cn(
              'text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border',
              guardianActive
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            )}>
              {guardianActive ? '● ACTIVE' : '⏸ PAUSED'}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">Institutional risk controls and decision discipline framework</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-2 border',
            guardianActive
              ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
              : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
          )}
          onClick={() => setGuardianActive(v => !v)}
        >
          {guardianActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {guardianActive ? 'Pause Guardian Mode' : 'Resume Guardian Mode'}
        </Button>
      </div>

      {/* Paused Banner */}
      {!guardianActive && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Guardian Mode is Paused</p>
            <p className="text-xs text-amber-200/70">All pre-trade checks and guardrails are temporarily disabled. Resume to restore institutional risk controls.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full flex-1 flex flex-col">
        <TabsList className="w-full justify-start h-auto p-1 bg-secondary rounded-lg flex-wrap">
          <TabsTrigger value="overview" className="text-xs sm:text-sm py-2 px-4 flex gap-2 items-center">
            <Shield className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="limits" className="text-xs sm:text-sm py-2 px-4 flex gap-2 items-center">
            <ShieldAlert className="w-3.5 h-3.5" /> Portfolio Limits
          </TabsTrigger>
          <TabsTrigger value="pretrade" className="text-xs sm:text-sm py-2 px-4 flex gap-2 items-center">
            <FileText className="w-3.5 h-3.5" /> Pre-Trade Rules
          </TabsTrigger>
          <TabsTrigger value="bias" className="text-xs sm:text-sm py-2 px-4 flex gap-2 items-center">
            <Brain className="w-3.5 h-3.5" /> Bias & Psychology
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs sm:text-sm py-2 px-4 flex gap-2 items-center">
            <FileText className="w-3.5 h-3.5" /> Audit Trail
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 flex-1 bg-card rounded-xl border shadow-sm overflow-auto">
          <TabsContent value="overview" className="m-0">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="limits" className="m-0">
            <LimitsTab />
          </TabsContent>
          <TabsContent value="pretrade" className="m-0">
            <PreTradeTab />
          </TabsContent>
          <TabsContent value="bias" className="m-0">
            <BiasTab />
          </TabsContent>
          <TabsContent value="audit" className="m-0">
            <AuditTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
