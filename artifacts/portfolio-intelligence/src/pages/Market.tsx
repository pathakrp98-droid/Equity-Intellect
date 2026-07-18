import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useGetVolumeScanner, 
  useGetPromoterActivity, 
  useGetBulkBlockDeals, 
  useGetSectorRotation,
  useGetEarningsCalendar,
  useGetBrokerageActions
} from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Activity, BarChart2, Building2 } from 'lucide-react';

export function Market() {
  return (
    <div className="space-y-6 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Market Intelligence</h1>
        <p className="text-muted-foreground text-sm mt-1">Flows, deals, and structural market signals.</p>
      </div>

      <Tabs defaultValue="scanner" className="w-full flex-1 flex flex-col">
        <TabsList className="w-full justify-start h-auto p-1 bg-secondary rounded-lg overflow-x-auto">
          <TabsTrigger value="scanner" className="text-sm py-2 px-4">Volume Scanner</TabsTrigger>
          <TabsTrigger value="promoter" className="text-sm py-2 px-4">Promoter Action</TabsTrigger>
          <TabsTrigger value="deals" className="text-sm py-2 px-4">Bulk/Block Deals</TabsTrigger>
          <TabsTrigger value="rotation" className="text-sm py-2 px-4">Sector Rotation</TabsTrigger>
          <TabsTrigger value="earnings" className="text-sm py-2 px-4">Earnings Calendar</TabsTrigger>
          <TabsTrigger value="brokerage" className="text-sm py-2 px-4">Brokerage Upgrades</TabsTrigger>
        </TabsList>

        <div className="mt-6 flex-1 bg-card rounded-xl border shadow-sm overflow-hidden">
          <TabsContent value="scanner" className="m-0 h-full p-0 flex flex-col">
            <VolumeScanner />
          </TabsContent>
          <TabsContent value="promoter" className="m-0 h-full p-0 flex flex-col">
            <PromoterActivity />
          </TabsContent>
          <TabsContent value="deals" className="m-0 p-6">
            <BulkBlockDeals />
          </TabsContent>
          <TabsContent value="rotation" className="m-0 p-6">
            <SectorRotation />
          </TabsContent>
          <TabsContent value="earnings" className="m-0 p-6">
            <EarningsCalendar />
          </TabsContent>
          <TabsContent value="brokerage" className="m-0 p-6">
            <BrokerageActions />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function VolumeScanner() {
  const { data, isLoading } = useGetVolumeScanner({ query: { queryKey: ['volumeScanner'] } });
  
  if (isLoading) return <div className="p-6"><Skeleton className="h-[500px] w-full" /></div>;

  return (
    <div className="overflow-auto w-full flex-1">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-muted-foreground bg-secondary/50 sticky top-0">
          <tr>
            <th className="px-6 py-4 font-semibold">Ticker</th>
            <th className="px-6 py-4 font-semibold text-right">LTP</th>
            <th className="px-6 py-4 font-semibold text-right">Day %</th>
            <th className="px-6 py-4 font-semibold text-right">Volume Ratio</th>
            <th className="px-6 py-4 font-semibold text-right">Delivery %</th>
            <th className="px-6 py-4 font-semibold text-center">Signal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {data?.map((row) => (
            <tr key={row.ticker} className="hover:bg-muted/30">
              <td className="px-6 py-4 font-bold">{row.ticker}</td>
              <td className="px-6 py-4 text-right font-mono">₹{row.ltp.toLocaleString()}</td>
              <td className={cn("px-6 py-4 text-right font-mono", row.dayChangePct >= 0 ? "text-emerald-500" : "text-destructive")}>{row.dayChangePct >= 0 ? '+' : ''}{row.dayChangePct.toFixed(2)}%</td>
              <td className="px-6 py-4 text-right font-mono font-bold text-primary">{row.volumeRatio}x</td>
              <td className="px-6 py-4 text-right font-mono">{row.deliveryPct}%</td>
              <td className="px-6 py-4 text-center">
                <span className={cn(
                  "text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-sm",
                  row.signal === 'accumulation' ? "bg-emerald-500/20 text-emerald-500" :
                  row.signal === 'distribution' ? "bg-destructive/20 text-destructive" :
                  "bg-primary/20 text-primary"
                )}>
                  {row.signal.replace('_', ' ')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PromoterActivity() {
  const { data, isLoading } = useGetPromoterActivity();
  if (isLoading) return <div className="p-6"><Skeleton className="h-[500px] w-full" /></div>;

  return (
    <div className="overflow-auto w-full flex-1">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-muted-foreground bg-secondary/50 sticky top-0">
          <tr>
            <th className="px-6 py-4 font-semibold">Company</th>
            <th className="px-6 py-4 font-semibold text-right">Promoter Holding</th>
            <th className="px-6 py-4 font-semibold text-right">Change</th>
            <th className="px-6 py-4 font-semibold text-right">Pledged</th>
            <th className="px-6 py-4 font-semibold text-center">Action</th>
            <th className="px-6 py-4 font-semibold">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {data?.map((row) => (
            <tr key={row.id} className="hover:bg-muted/30">
              <td className="px-6 py-4">
                <div className="font-bold">{row.ticker}</div>
                <div className="text-xs text-muted-foreground">{row.name}</div>
              </td>
              <td className="px-6 py-4 text-right font-mono">{row.promoterHoldingPct}%</td>
              <td className="px-6 py-4 text-right font-mono">
                {row.changeInHolding !== 0 && (
                  <span className={row.changeInHolding > 0 ? "text-emerald-500" : "text-destructive"}>
                    {row.changeInHolding > 0 ? '+' : ''}{row.changeInHolding}%
                  </span>
                )}
                {row.changeInHolding === 0 && "-"}
              </td>
              <td className="px-6 py-4 text-right font-mono">
                {row.pledgedPct}%
                {row.pledgeChange > 0 && <span className="text-destructive ml-1">↑</span>}
              </td>
              <td className="px-6 py-4 text-center">
                <span className={cn(
                  "text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-sm",
                  row.category.includes('buying') || row.category.includes('decrease') ? "bg-emerald-500/20 text-emerald-500" :
                  row.category.includes('selling') || row.category.includes('increase') ? "bg-destructive/20 text-destructive" :
                  "bg-secondary text-muted-foreground"
                )}>
                  {row.category.replace('_', ' ')}
                </span>
              </td>
              <td className="px-6 py-4 text-xs text-muted-foreground">{new Date(row.filingDate).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BulkBlockDeals() {
  const { data, isLoading } = useGetBulkBlockDeals();
  if (isLoading) return <Skeleton className="h-[500px] w-full" />;

  return (
    <div className="grid grid-cols-1 gap-4">
      {data?.map(deal => (
        <div key={deal.id} className="border rounded-lg p-4 bg-secondary/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg border",
              deal.side === 'buy' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
            )}>
              {deal.side === 'buy' ? 'B' : 'S'}
            </div>
            <div>
              <div className="font-bold text-lg">{deal.ticker}</div>
              <div className="text-sm text-muted-foreground">{deal.client}</div>
            </div>
          </div>
          
          <div className="flex gap-8 text-right">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Quantity</p>
              <p className="font-mono font-bold">{deal.quantity.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Price</p>
              <p className="font-mono font-bold">₹{deal.price.toLocaleString()}</p>
            </div>
            <div className="w-32">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Value</p>
              <p className="font-mono font-bold text-primary">₹{(deal.value / 10000000).toFixed(2)} Cr</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SectorRotation() {
  const { data, isLoading } = useGetSectorRotation();
  if (isLoading) return <Skeleton className="h-[500px] w-full" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {data?.map(sector => (
        <Card key={sector.sector} className="bg-secondary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex justify-between items-center">
              {sector.sector}
              <Activity className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2 bg-background border rounded">
                <span className="text-[10px] text-muted-foreground uppercase block mb-1">1W</span>
                <span className={cn("font-mono text-sm font-bold", sector.weekReturn >= 0 ? "text-emerald-500" : "text-destructive")}>
                  {sector.weekReturn > 0 ? '+' : ''}{sector.weekReturn}%
                </span>
              </div>
              <div className="text-center p-2 bg-background border rounded">
                <span className="text-[10px] text-muted-foreground uppercase block mb-1">1M</span>
                <span className={cn("font-mono text-sm font-bold", sector.monthReturn >= 0 ? "text-emerald-500" : "text-destructive")}>
                  {sector.monthReturn > 0 ? '+' : ''}{sector.monthReturn}%
                </span>
              </div>
              <div className="text-center p-2 bg-background border rounded">
                <span className="text-[10px] text-muted-foreground uppercase block mb-1">3M</span>
                <span className={cn("font-mono text-sm font-bold", sector.quarterReturn >= 0 ? "text-emerald-500" : "text-destructive")}>
                  {sector.quarterReturn > 0 ? '+' : ''}{sector.quarterReturn}%
                </span>
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="text-muted-foreground">Top Gainers:</span>
              <span className="font-medium truncate">{sector.topGainers.join(', ')}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EarningsCalendar() {
  const { data, isLoading } = useGetEarningsCalendar();
  if (isLoading) return <Skeleton className="h-[500px] w-full" />;

  return (
    <div className="space-y-4">
      {data?.map(event => (
        <div key={event.id} className={cn(
          "flex items-center gap-6 p-4 rounded-lg border",
          event.isInPortfolio ? "bg-primary/5 border-primary/30" : "bg-secondary/10"
        )}>
          <div className="w-16 h-16 bg-background border rounded flex flex-col items-center justify-center shrink-0">
            <span className="text-xs text-muted-foreground uppercase font-bold">{new Date(event.date).toLocaleString('en-IN', {month: 'short'})}</span>
            <span className="text-xl font-bold font-mono">{new Date(event.date).getDate()}</span>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-lg">{event.ticker}</span>
              {event.isInPortfolio && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">In Portfolio</span>}
            </div>
            <p className="text-sm text-muted-foreground">{event.name} • {event.sector}</p>
          </div>
          
          <div className="text-right flex gap-8">
            {event.estimatedEps && (
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">Est EPS</p>
                <p className="font-mono font-bold">₹{event.estimatedEps}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1">Quarter</p>
              <p className="font-medium">{event.quarter}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BrokerageActions() {
  const { data, isLoading } = useGetBrokerageActions();
  if (isLoading) return <Skeleton className="h-[500px] w-full" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {data?.map(action => (
        <Card key={action.id}>
          <CardHeader className="pb-3 border-b bg-secondary/10">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">{action.ticker}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{action.broker}</p>
              </div>
              <span className={cn(
                "text-xs font-bold uppercase tracking-wider px-2 py-1 rounded",
                action.action === 'upgrade' || action.action === 'initiate' ? "bg-emerald-500/20 text-emerald-500" :
                action.action === 'downgrade' ? "bg-destructive/20 text-destructive" :
                "bg-blue-500/20 text-blue-500"
              )}>
                {action.action}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex justify-between items-center bg-background border p-3 rounded-lg">
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Target Price</span>
                <span className="text-lg font-bold font-mono">₹{action.targetPrice}</span>
              </div>
              {action.previousTarget && (
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block mb-1">Previous</span>
                  <span className="text-sm font-mono strike-through text-muted-foreground">₹{action.previousTarget}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground italic">"{action.rationale}"</p>
            <div className="text-xs text-muted-foreground pt-2 border-t flex justify-between">
              <span>{action.analyst}</span>
              <span>{new Date(action.date).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
