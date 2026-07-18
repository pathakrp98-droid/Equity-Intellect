import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useGetDashboardSummary, useGetDashboardAlerts, useGetOvernightMarkets, useGetIndiaMacro, useGetTopActions, useGetUpcomingCatalysts, useDismissAlert } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatPercent, formatCompactNumber } from '@/lib/formatters';
import { TrendingUp, TrendingDown, ArrowRight, Activity, Globe, DollarSign, BellRing, Target, AlertTriangle, X, Shield, CheckCircle2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const [, navigate] = useLocation();
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: alerts, isLoading: loadingAlerts } = useGetDashboardAlerts();
  const { data: markets, isLoading: loadingMarkets } = useGetOvernightMarkets();
  const { data: macro, isLoading: loadingMacro } = useGetIndiaMacro();
  const { data: actions, isLoading: loadingActions } = useGetTopActions();
  const { data: catalysts, isLoading: loadingCatalysts } = useGetUpcomingCatalysts();

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CIO Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1 font-mono">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {alerts && alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.filter(a => !a.dismissed).map(alert => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Portfolio Value" 
          value={summary?.portfolioValue ? formatCurrency(summary.portfolioValue) : '-'}
          subtitle={`Cash: ${summary?.cashBalance ? formatCurrency(summary.cashBalance) : '-'}`}
          loading={loadingSummary}
          icon={DollarSign}
        />
        <MetricCard 
          title="Daily P&L" 
          value={summary?.dailyPnl ? formatCurrency(Math.abs(summary.dailyPnl)) : '-'}
          subtitle={summary?.dailyPnlPct ? formatPercent(summary.dailyPnlPct) : '-'}
          trend={summary?.dailyPnl && summary.dailyPnl >= 0 ? 'up' : 'down'}
          loading={loadingSummary}
          icon={Activity}
        />
        <MetricCard 
          title="Overall P&L" 
          value={summary?.overallPnl ? formatCurrency(Math.abs(summary.overallPnl)) : '-'}
          subtitle={summary?.overallPnlPct ? formatPercent(summary.overallPnlPct) : '-'}
          trend={summary?.overallPnl && summary.overallPnl >= 0 ? 'up' : 'down'}
          loading={loadingSummary}
          icon={TrendingUp}
        />
        <MetricCard 
          title="Conviction Changes" 
          value={summary?.convictionChanges.length.toString() || '0'}
          subtitle="In last 30 days"
          loading={loadingSummary}
          icon={Target}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Macro & Markets */}
        <div className="space-y-6">
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                Overnight Global Markets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMarkets ? (
                <div className="space-y-2">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="space-y-1">
                  {markets?.map(market => (
                    <div key={market.name} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm font-medium">{market.name}</span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-mono">{market.value.toLocaleString()}</span>
                        <span className={cn("font-mono font-medium", market.change >= 0 ? "text-emerald-500" : "text-destructive")}>
                          {market.change > 0 ? '+' : ''}{market.changePct.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">India Macro Strip</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMacro ? (
                <div className="space-y-2">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {macro?.map(m => (
                    <div key={m.name} className="bg-secondary/50 p-3 rounded-lg border border-border/50">
                      <div className="text-xs text-muted-foreground mb-1">{m.name}</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-semibold font-mono">{m.value}{m.unit}</span>
                        {m.trend === 'up' && <TrendingUp className="w-3 h-3 text-destructive" />}
                        {m.trend === 'down' && <TrendingDown className="w-3 h-3 text-emerald-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Middle Column: Sector Allocation & Catalysts */}
        <div className="space-y-6">
          <Card className="flex flex-col h-[320px]">
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Sector Allocation</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center min-h-0 pb-6">
              {loadingSummary ? (
                <Skeleton className="w-48 h-48 rounded-full" />
              ) : (
                <div className="w-full h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary?.sectorAllocation || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="sector"
                        stroke="none"
                      >
                        {(summary?.sectorAllocation || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Upcoming Catalysts</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCatalysts ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {catalysts?.slice(0,4).map(cat => (
                    <div key={cat.id} className="flex gap-3 items-start">
                      <div className="w-12 h-12 rounded bg-secondary flex flex-col items-center justify-center shrink-0 border border-border">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">{new Date(cat.date).toLocaleString('en-IN', { month: 'short' })}</span>
                        <span className="text-sm font-bold font-mono">{new Date(cat.date).getDate()}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{cat.ticker}</span>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-sm font-medium",
                            cat.impact === 'high' ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                          )}>
                            {cat.impact} impact
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-tight mt-0.5">{cat.event}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Actions */}
        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Actions Today</CardTitle>
              <CardDescription>Generated by conviction models</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 bg-secondary/30 rounded-lg flex items-center justify-between border">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-xs font-bold text-amber-500">71</div>
                  <div>
                    <p className="text-xs font-semibold">Portfolio Health Score</p>
                    <p className="text-[10px] text-amber-500 font-medium">CAUTION</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('/guardrails')}>Details →</Button>
              </div>
              {loadingActions ? (
                <div className="space-y-3">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {actions?.map(action => (
                    <div key={action.id} className="p-3 rounded-lg border border-border bg-secondary/30">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider",
                            action.action === 'buy' || action.action === 'add' ? "bg-emerald-500/20 text-emerald-500" :
                            action.action === 'sell' || action.action === 'trim' ? "bg-destructive/20 text-destructive" :
                            "bg-blue-500/20 text-blue-500"
                          )}>
                            {action.action}
                          </span>
                          <span className="font-bold">{action.ticker}</span>
                        </div>
                        {action.suggestedPrice && (
                          <span className="text-xs font-mono bg-background px-1.5 py-0.5 rounded border border-border">
                            @ ₹{action.suggestedPrice}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{action.rationale}</p>
                      <div className="mt-3 flex justify-end">
                        <GuardianExecuteButton action={action} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, trend, loading, icon: Icon }: any) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-baseline gap-2">
                <h2 className="text-2xl font-bold font-mono tracking-tight">{value}</h2>
                {trend && (
                  <span className={cn("flex items-center text-sm font-medium", trend === 'up' ? "text-emerald-500" : "text-destructive")}>
                    {trend === 'up' ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                  </span>
                )}
              </div>
            )}
            {loading ? (
              <Skeleton className="h-4 w-16 mt-1" />
            ) : (
              <p className="text-xs text-muted-foreground font-mono">{subtitle}</p>
            )}
          </div>
          <div className="p-2 bg-secondary rounded-md text-muted-foreground">
            {Icon && <Icon className="w-5 h-5" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertCard({ alert }: any) {
  const dismissMutation = useDismissAlert();
  const [, navigate] = useLocation();

  return (
    <div className={cn(
      "relative overflow-hidden rounded-lg border p-4 flex gap-4 items-start",
      alert.severity === 'critical' ? "bg-destructive/10 border-destructive/30" : 
      alert.severity === 'high' ? "bg-orange-500/10 border-orange-500/30" : 
      "bg-primary/10 border-primary/30"
    )}>
      <div className={cn(
        "p-2 rounded-full mt-1 shrink-0",
        alert.severity === 'critical' ? "bg-destructive/20 text-destructive" :
        alert.severity === 'high' ? "bg-orange-500/20 text-orange-500" :
        "bg-primary/20 text-primary"
      )}>
        <AlertTriangle className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="font-bold text-sm tracking-tight cursor-pointer hover:text-primary transition-colors"
            onClick={() => navigate(`/research?ticker=${alert.ticker}`)}
          >
            {alert.ticker}
          </span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-background/50 border border-border/50">
            {alert.alertType.replace('_', ' ')}
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <h4 className="font-semibold text-foreground mb-1">{alert.headline}</h4>
        <p className="text-sm text-muted-foreground line-clamp-2">{alert.detail}</p>
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 shrink-0 hover:bg-background/50"
        onClick={() => dismissMutation.mutate({ id: alert.id })}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

function GuardianExecuteButton({ action }: { action: any }) {
  const [, navigate] = useLocation();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs flex items-center gap-1"
        onClick={() => setShowModal(true)}
      >
        <Shield className="w-3 h-3" />
        Execute
      </Button>
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-card border rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Guardian Mode Review</h3>
                <p className="text-xs text-muted-foreground">Pre-execution compliance check</p>
              </div>
            </div>

            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-sm font-medium uppercase text-xs tracking-wider text-muted-foreground mb-1">Proposed Action</p>
              <p className="font-bold">{action.action.toUpperCase()} {action.ticker}</p>
              <p className="text-xs text-muted-foreground mt-1">{action.rationale}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pre-Trade Checklist</p>
              {[
                { label: 'Investment rationale documented', check: true },
                { label: 'Bear case considered', check: false },
                { label: 'Target price set', check: !!action.suggestedPrice },
                { label: 'Invalidation conditions defined', check: false },
                { label: 'Max acceptable loss defined', check: false },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", item.check ? "bg-emerald-500/20 text-emerald-500" : "bg-destructive/20 text-destructive")}>
                    {item.check ? <CheckCircle2 className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  </div>
                  <span className={item.check ? "" : "text-muted-foreground"}>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200">Complete the pre-trade checklist in Research Terminal before executing. Go to Guardrails to configure rules.</p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="outline" size="sm" onClick={() => { setShowModal(false); navigate(`/research?ticker=${action.ticker}`); }}>Open Research</Button>
              <Button size="sm" onClick={() => { setShowModal(false); navigate('/guardrails'); }}>Configure Guardrails</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
