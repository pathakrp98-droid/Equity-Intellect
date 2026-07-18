import { useState } from 'react';
import { useGetHoldings, useGetWatchlist, useGetBrokerSnapshots, useGetRiskDashboard, useGetPositionSizing, useGetPerformance, useGetRecommendationHistory, useRemoveFromWatchlist } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { AlertCircle, ArrowDownIcon, ArrowUpIcon, TrendingUp, ShieldAlert, Target, Info, CheckCircle2, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function Portfolio() {
  return (
    <div className="space-y-6 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portfolio Manager</h1>
        <p className="text-muted-foreground text-sm mt-1">Institutional position sizing, risk, and attribution.</p>
      </div>

      <Tabs defaultValue="holdings" className="w-full flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-7 h-auto p-1 bg-secondary rounded-lg">
          <TabsTrigger value="holdings" className="text-xs sm:text-sm py-2">Holdings</TabsTrigger>
          <TabsTrigger value="watchlist" className="text-xs sm:text-sm py-2">Watchlist</TabsTrigger>
          <TabsTrigger value="sizing" className="text-xs sm:text-sm py-2">Sizing</TabsTrigger>
          <TabsTrigger value="risk" className="text-xs sm:text-sm py-2">Risk</TabsTrigger>
          <TabsTrigger value="performance" className="text-xs sm:text-sm py-2">Attribution</TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm py-2">History</TabsTrigger>
          <TabsTrigger value="brokers" className="text-xs sm:text-sm py-2">Brokers</TabsTrigger>
        </TabsList>

        <div className="mt-6 flex-1 bg-card rounded-xl border shadow-sm overflow-hidden">
          <TabsContent value="holdings" className="m-0 h-full p-0 data-[state=active]:flex flex-col">
            <HoldingsTable />
          </TabsContent>
          
          <TabsContent value="watchlist" className="m-0 p-6">
            <WatchlistTable />
          </TabsContent>
          
          <TabsContent value="sizing" className="m-0 p-6">
            <PositionSizingTab />
          </TabsContent>
          
          <TabsContent value="risk" className="m-0 p-6">
            <RiskTab />
          </TabsContent>
          
          <TabsContent value="performance" className="m-0 p-6">
            <PerformanceTab />
          </TabsContent>
          
          <TabsContent value="history" className="m-0 p-6">
            <HistoryTab />
          </TabsContent>
          
          <TabsContent value="brokers" className="m-0 p-6">
            <BrokersTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function HoldingsTable() {
  const { data: holdings, isLoading } = useGetHoldings();
  const [, navigate] = useLocation();

  if (isLoading) return <div className="p-6 space-y-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  return (
    <div className="overflow-auto w-full flex-1">
      <table className="w-full text-sm text-left min-w-[1200px]">
        <thead className="text-xs text-muted-foreground bg-secondary/50 sticky top-0 z-10 backdrop-blur-md">
          <tr>
            <th className="px-4 py-3 font-semibold w-[200px]">Asset</th>
            <th className="px-4 py-3 font-semibold text-right">Qty</th>
            <th className="px-4 py-3 font-semibold text-right">Avg Price</th>
            <th className="px-4 py-3 font-semibold text-right">LTP</th>
            <th className="px-4 py-3 font-semibold text-right">Value</th>
            <th className="px-4 py-3 font-semibold text-right">P&L</th>
            <th className="px-4 py-3 font-semibold text-right">1D Change</th>
            <th className="px-4 py-3 font-semibold text-center w-[100px]">Alloc</th>
            <th className="px-4 py-3 font-semibold text-center w-[120px]">Conviction</th>
            <th className="px-4 py-3 font-semibold text-center w-[120px]">Thesis</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {holdings?.map((h) => (
            <tr key={h.ticker} className="cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => navigate(`/research?ticker=${h.ticker}`)}>
              <td className="px-4 py-3">
                <div className="font-bold text-foreground">{h.ticker}</div>
                <div className="text-xs text-muted-foreground truncate">{h.name}</div>
              </td>
              <td className="px-4 py-3 text-right font-mono">{h.quantity.toLocaleString()}</td>
              <td className="px-4 py-3 text-right font-mono">₹{h.avgBuyPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="px-4 py-3 text-right font-mono font-medium">₹{h.ltp.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(h.currentValue)}</td>
              <td className="px-4 py-3 text-right font-mono">
                <div className={cn(h.pnl >= 0 ? "text-emerald-500" : "text-destructive")}>
                  {h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl)}
                </div>
                <div className={cn("text-xs", h.pnlPct >= 0 ? "text-emerald-500/70" : "text-destructive/70")}>
                  {h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono">
                <div className={cn("inline-flex items-center gap-1", h.dayChange >= 0 ? "text-emerald-500" : "text-destructive")}>
                  {h.dayChange >= 0 ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
                  {h.dayChangePct.toFixed(2)}%
                </div>
              </td>
              <td className="px-4 py-3 text-center font-mono">
                <div className="w-full bg-secondary rounded-full h-1.5 mb-1 overflow-hidden">
                  <div className="bg-primary h-1.5 rounded-full" style={{ width: `${h.allocationPct}%` }} />
                </div>
                <span className="text-xs">{h.allocationPct.toFixed(1)}%</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  "text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-sm",
                  h.conviction === 'high' ? "bg-primary/20 text-primary border border-primary/30" :
                  h.conviction === 'medium' ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" :
                  "bg-slate-500/20 text-slate-400 border border-slate-500/30"
                )}>
                  {h.conviction}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  "text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-sm inline-flex items-center gap-1",
                  h.thesisStatus === 'intact' ? "text-emerald-500" :
                  h.thesisStatus === 'weakening' ? "text-amber-500" :
                  h.thesisStatus === 'broken' ? "text-destructive" :
                  "text-blue-500"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full",
                    h.thesisStatus === 'intact' ? "bg-emerald-500" :
                    h.thesisStatus === 'weakening' ? "bg-amber-500" :
                    h.thesisStatus === 'broken' ? "bg-destructive" :
                    "bg-blue-500"
                  )} />
                  {h.thesisStatus}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WatchlistTable() {
  const { data: watchlist, isLoading } = useGetWatchlist();
  const removeMutation = useRemoveFromWatchlist();
  const [, navigate] = useLocation();
  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="overflow-auto border rounded-lg">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-muted-foreground bg-secondary/50">
          <tr>
            <th className="px-4 py-3 font-semibold">Asset</th>
            <th className="px-4 py-3 font-semibold">Sector</th>
            <th className="px-4 py-3 font-semibold text-right">LTP</th>
            <th className="px-4 py-3 font-semibold text-right">Target Entry</th>
            <th className="px-4 py-3 font-semibold text-right">Distance to Entry</th>
            <th className="px-4 py-3 font-semibold text-center">Conviction</th>
            <th className="px-4 py-3 font-semibold">Notes</th>
            <th className="px-4 py-3 font-semibold text-center w-[60px]"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {watchlist?.map(w => {
            const distance = w.targetEntryPrice ? ((w.ltp - w.targetEntryPrice) / w.targetEntryPrice * 100) : null;
            return (
              <tr key={w.ticker} className="cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => navigate(`/research?ticker=${w.ticker}`)}>
                <td className="px-4 py-3">
                  <div className="font-bold">{w.ticker}</div>
                  <div className="text-xs text-muted-foreground">{w.name}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{w.sector}</td>
                <td className="px-4 py-3 text-right font-mono">₹{w.ltp.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">{w.targetEntryPrice ? `₹${w.targetEntryPrice.toLocaleString()}` : '-'}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {distance !== null ? (
                    <span className={distance <= 0 ? "text-emerald-500 font-bold" : "text-amber-500"}>
                      {distance > 0 ? '+' : ''}{distance.toFixed(1)}%
                    </span>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn(
                    "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm",
                    w.conviction === 'high' ? "bg-primary/20 text-primary" :
                    w.conviction === 'medium' ? "bg-amber-500/20 text-amber-500" :
                    "bg-slate-500/20 text-slate-400"
                  )}>
                    {w.conviction}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{w.notes}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                    onClick={e => { e.stopPropagation(); removeMutation.mutate({ ticker: w.ticker }); }}
                    title="Remove from watchlist"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  );
}

function RiskTab() {
  const { data: risk, isLoading } = useGetRiskDashboard();
  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-secondary/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-background rounded-full border">
              <ShieldAlert className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Concentration Risk</p>
              <p className="text-xl font-bold uppercase tracking-wider">{risk?.concentrationRisk}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-secondary/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-background rounded-full border">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Top 5 Concentration</p>
              <p className="text-xl font-bold font-mono">{risk?.topHoldingsConcentration}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-secondary/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-background rounded-full border">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Value at Risk (99%)</p>
              <p className="text-xl font-bold font-mono text-destructive">-{formatCurrency(risk?.var99 || 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sector Concentration</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={risk?.sectorConcentration} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => `${v}%`} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="sector" type="category" width={100} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  formatter={(value: number) => [`${value}%`, 'Weight']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                />
                <Bar dataKey="weight" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Stress Test Scenarios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {risk?.stressTests.map((test, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{test.scenario}</span>
                    <span className="font-mono text-destructive font-bold">{test.portfolioImpactPct}%</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-destructive h-full rounded-full" 
                      style={{ width: `${Math.min(Math.abs(test.portfolioImpactPct) * 2, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{test.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PerformanceTab() {
  const { data: perf, isLoading } = useGetPerformance();
  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'XIRR', value: `${perf?.xirr.toFixed(1)}%`, highlight: true },
          { label: 'Alpha vs Nifty', value: `${perf?.alpha > 0 ? '+' : ''}${perf?.alpha.toFixed(1)}%`, highlight: perf?.alpha && perf.alpha > 0 },
          { label: 'Sharpe Ratio', value: perf?.sharpeRatio.toFixed(2), highlight: false },
          { label: 'Max Drawdown', value: `${perf?.maxDrawdown.toFixed(1)}%`, highlight: false, danger: true },
        ].map((m, i) => (
          <div key={i} className="border rounded-lg p-4 bg-secondary/20 text-center space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{m.label}</p>
            <p className={cn(
              "text-2xl font-bold font-mono",
              m.highlight && "text-primary",
              m.danger && "text-destructive"
            )}>{m.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Monthly Return Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-1 overflow-x-auto">
            {perf?.monthlyReturns.map((mr, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground mb-1">{mr.month}</span>
                <div 
                  className={cn("w-full aspect-square rounded flex items-center justify-center text-xs font-mono font-bold text-white shadow-inner")}
                  style={{
                    backgroundColor: mr.portfolioReturn >= 0 
                      ? `rgba(16, 185, 129, ${Math.max(0.2, Math.min(mr.portfolioReturn / 10, 1))})` 
                      : `rgba(239, 68, 68, ${Math.max(0.2, Math.min(Math.abs(mr.portfolioReturn) / 10, 1))})`
                  }}
                >
                  {mr.portfolioReturn.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PositionSizingTab() {
  const { data: sizing, isLoading } = useGetPositionSizing();
  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sizing?.map(pos => (
          <Card key={pos.ticker} className="overflow-hidden">
            <div className={cn(
              "h-1 w-full",
              pos.suggestedAction === 'add' ? "bg-primary" : 
              pos.suggestedAction === 'trim' ? "bg-amber-500" : "bg-muted"
            )} />
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{pos.ticker}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{pos.name}</p>
                </div>
                <span className={cn(
                  "text-xs font-bold uppercase px-2 py-1 rounded",
                  pos.suggestedAction === 'add' ? "bg-primary/20 text-primary" :
                  pos.suggestedAction === 'trim' ? "bg-amber-500/20 text-amber-500" :
                  "bg-secondary text-muted-foreground"
                )}>
                  {pos.suggestedAction}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Current vs Ideal Weight</span>
                  <span className="font-mono">{pos.currentWeight.toFixed(1)}% / {pos.idealWeight.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden relative">
                  <div className="bg-primary/30 h-full absolute left-0" style={{ width: `${pos.idealWeight}%` }} />
                  <div className={cn("h-full absolute left-0 rounded-r-full", pos.currentWeight > pos.idealWeight ? "bg-amber-500" : "bg-primary")} 
                       style={{ width: `${pos.currentWeight}%` }} />
                </div>
              </div>

              {pos.stagedEntryLevels.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Staged Entry Levels</h4>
                  {pos.stagedEntryLevels.map((level, i) => (
                    <div key={i} className="flex justify-between items-center text-sm p-2 bg-secondary/50 rounded border border-border/50">
                      <span className="font-mono font-medium">₹{level.price}</span>
                      <span className="text-xs">{level.notes}</span>
                      <span className="font-mono text-primary">+{level.quantityPct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function HistoryTab() {
  const { data: history, isLoading } = useGetRecommendationHistory();
  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="relative border-l border-border/50 ml-4 space-y-8 py-4">
      {history?.map(rec => (
        <div key={rec.id} className="relative pl-6">
          <div className={cn(
            "absolute -left-3.5 top-0 w-7 h-7 rounded-full border-4 border-card flex items-center justify-center text-white",
            rec.action === 'buy' || rec.action === 'add' ? "bg-emerald-500" :
            rec.action === 'sell' || rec.action === 'trim' ? "bg-destructive" :
            "bg-blue-500"
          )}>
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
          
          <div className="bg-secondary/30 border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold">{rec.ticker}</span>
                <span className="text-xs text-muted-foreground">{new Date(rec.date).toLocaleDateString()}</span>
                <span className={cn(
                  "text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded",
                  rec.action === 'buy' || rec.action === 'add' ? "bg-emerald-500/20 text-emerald-500" :
                  rec.action === 'sell' || rec.action === 'trim' ? "bg-destructive/20 text-destructive" :
                  "bg-blue-500/20 text-blue-500"
                )}>{rec.action}</span>
              </div>
              <span className="font-mono font-medium">₹{rec.price}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{rec.rationale}</p>
            
            {rec.outcome !== 'pending' && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                <CheckCircle2 className={cn("w-4 h-4", rec.outcome === 'successful' ? "text-emerald-500" : "text-amber-500")} />
                <span className="text-xs font-medium uppercase tracking-wider">{rec.outcome}</span>
                {rec.returnSinceRecommendation && (
                  <span className={cn("text-xs font-mono ml-auto", rec.returnSinceRecommendation >= 0 ? "text-emerald-500" : "text-destructive")}>
                    {rec.returnSinceRecommendation >= 0 ? '+' : ''}{rec.returnSinceRecommendation.toFixed(1)}% Return
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function BrokersTab() {
  const { data: brokers, isLoading } = useGetBrokerSnapshots();
  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {brokers?.map(broker => (
        <Card key={broker.accountId}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                {broker.broker}
                <span className="text-xs font-normal text-muted-foreground font-mono">({broker.accountId})</span>
              </CardTitle>
              <div className={cn(
                "w-2.5 h-2.5 rounded-full",
                broker.status === 'synced' ? "bg-emerald-500" :
                broker.status === 'stale' ? "bg-amber-500" : "bg-destructive"
              )} title={broker.status} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-muted-foreground">Total Value</span>
                <span className="font-mono font-medium">{formatCurrency(broker.totalValue)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-muted-foreground">Cash Balance</span>
                <span className="font-mono font-medium">{formatCurrency(broker.cashBalance)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-muted-foreground">Holdings Count</span>
                <span className="font-mono font-medium">{broker.holdingsCount}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-muted-foreground">Last Synced: {new Date(broker.lastSynced).toLocaleString()}</span>
                {broker.discrepancies && broker.discrepancies > 0 && (
                  <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded font-medium">
                    {broker.discrepancies} Discrepancies
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
