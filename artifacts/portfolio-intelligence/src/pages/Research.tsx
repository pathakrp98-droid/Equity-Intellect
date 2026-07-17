import { useState, useMemo } from 'react';
import { useGetResearchCompanies, useGetCompanyDetail } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, SlidersHorizontal, ArrowUpRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function Research() {
  const { data: companies, isLoading: loadingList } = useGetResearchCompanies();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredCompanies = useMemo(() => {
    if (!companies) return [];
    return companies.filter(c => 
      c.ticker.toLowerCase().includes(search.toLowerCase()) || 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.sector.toLowerCase().includes(search.toLowerCase())
    );
  }, [companies, search]);

  // Select first company by default when loaded
  if (!selectedTicker && filteredCompanies.length > 0) {
    setSelectedTicker(filteredCompanies[0].ticker);
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-6 overflow-hidden">
      {/* Left Panel: List */}
      <div className="w-80 flex flex-col border rounded-xl bg-card overflow-hidden shrink-0">
        <div className="p-4 border-b space-y-3 bg-secondary/20">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Coverage Universe</h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search ticker, name, sector..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 bg-background"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingList ? (
            Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
          ) : (
            filteredCompanies.map(c => (
              <button
                key={c.ticker}
                onClick={() => setSelectedTicker(c.ticker)}
                className={cn(
                  "w-full text-left px-3 py-3 rounded-lg transition-all",
                  selectedTicker === c.ticker 
                    ? "bg-primary/10 border border-primary/20 shadow-sm" 
                    : "hover:bg-secondary/50 border border-transparent"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={cn("font-bold", selectedTicker === c.ticker ? "text-primary" : "")}>
                    {c.ticker}
                  </span>
                  <span className={cn(
                    "text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm",
                    c.conviction === 'high' ? "bg-primary/20 text-primary" :
                    c.conviction === 'medium' ? "bg-amber-500/20 text-amber-500" :
                    "bg-slate-500/20 text-slate-400"
                  )}>
                    {c.conviction}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{c.name}</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className={cn("w-1.5 h-1.5 rounded-full",
                    c.thesisStatus === 'intact' ? "bg-emerald-500" :
                    c.thesisStatus === 'weakening' ? "bg-amber-500" :
                    c.thesisStatus === 'broken' ? "bg-destructive" :
                    "bg-blue-500"
                  )} />
                  <span className="text-[10px] text-muted-foreground uppercase">{c.thesisStatus}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Detail */}
      <div className="flex-1 bg-card border rounded-xl overflow-hidden flex flex-col">
        {selectedTicker ? (
          <CompanyDetailView ticker={selectedTicker} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a company to view research
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyDetailView({ ticker }: { ticker: string }) {
  const { data: detail, isLoading } = useGetCompanyDetail(ticker, { 
    query: { enabled: !!ticker, queryKey: ['companyDetail', ticker] } 
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-8">
        <Skeleton className="h-24 w-2/3" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b bg-secondary/10 sticky top-0 z-10 backdrop-blur-xl">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold">{detail.ticker}</h1>
              <span className="px-2 py-1 rounded bg-secondary text-xs font-mono border border-border">
                {detail.sector}
              </span>
            </div>
            <p className="text-lg text-muted-foreground">{detail.name}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-mono font-bold">₹{detail.ltp.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            <p className="text-sm text-muted-foreground mt-1">Mkt Cap: ₹{(detail.marketCap / 1000).toFixed(1)}k Cr</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Thesis & Valuation Row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="border rounded-lg p-5 bg-card shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg">Investment Thesis</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-secondary/30 p-3 rounded">
                <span className="text-xs text-muted-foreground uppercase block mb-1">Moat Rating</span>
                <span className="font-semibold text-sm capitalize">{detail.thesis.moatRating}</span>
              </div>
              <div className="bg-secondary/30 p-3 rounded">
                <span className="text-xs text-muted-foreground uppercase block mb-1">Mgmt Quality</span>
                <span className="font-semibold text-sm capitalize">{detail.thesis.managementRating}</span>
              </div>
            </div>

            <Tabs defaultValue="base" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="bull" className="data-[state=active]:text-emerald-500">Bull</TabsTrigger>
                <TabsTrigger value="base" className="data-[state=active]:text-primary">Base</TabsTrigger>
                <TabsTrigger value="bear" className="data-[state=active]:text-destructive">Bear</TabsTrigger>
              </TabsList>
              <div className="mt-4 text-sm leading-relaxed text-muted-foreground bg-secondary/10 p-4 rounded-lg min-h-[100px]">
                <TabsContent value="bull">{detail.thesis.bullCase}</TabsContent>
                <TabsContent value="base">{detail.thesis.baseCase}</TabsContent>
                <TabsContent value="bear">{detail.thesis.bearCase}</TabsContent>
              </div>
            </Tabs>
          </div>

          <div className="border rounded-lg p-5 bg-card shadow-sm">
            <h3 className="font-semibold text-lg mb-4">Valuation Framework</h3>
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{detail.valuation.methodology}</span>
                <span className="text-2xl font-mono font-bold text-primary">₹{detail.valuation.base.toLocaleString()}</span>
              </div>

              {/* Valuation Bar */}
              <div className="relative pt-6 pb-8">
                <div className="w-full h-2 bg-secondary rounded-full relative">
                  {/* Current Price Marker */}
                  <div 
                    className="absolute w-3 h-3 rounded-full bg-white border-2 border-primary top-1/2 -translate-y-1/2 z-10 -ml-1.5"
                    style={{ left: `${Math.max(0, Math.min(100, (detail.ltp - detail.valuation.bear) / (detail.valuation.bull - detail.valuation.bear) * 100))}%` }}
                  >
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-mono whitespace-nowrap">LTP ₹{detail.ltp}</div>
                  </div>
                  
                  {/* Bear Marker */}
                  <div className="absolute w-1 h-3 bg-destructive top-1/2 -translate-y-1/2 left-0">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-mono text-destructive">₹{detail.valuation.bear}</div>
                  </div>
                  
                  {/* Bull Marker */}
                  <div className="absolute w-1 h-3 bg-emerald-500 top-1/2 -translate-y-1/2 right-0">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-mono text-emerald-500">₹{detail.valuation.bull}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-emerald-500/20 bg-emerald-500/5 p-3 rounded text-center">
                  <span className="block text-xs text-muted-foreground mb-1">Upside to Base</span>
                  <span className="font-mono font-bold text-emerald-500">+{((detail.valuation.base - detail.ltp) / detail.ltp * 100).toFixed(1)}%</span>
                </div>
                <div className="border border-destructive/20 bg-destructive/5 p-3 rounded text-center">
                  <span className="block text-xs text-muted-foreground mb-1">Downside to Bear</span>
                  <span className="font-mono font-bold text-destructive">{((detail.valuation.bear - detail.ltp) / detail.ltp * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quality Flags & Triggers */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Earnings Quality Flags</h3>
            {detail.earningsQualityFlags.map(flag => (
              <div key={flag.id} className={cn(
                "p-3 rounded-lg border flex gap-3",
                flag.severity === 'red' ? "bg-destructive/10 border-destructive/30" :
                flag.severity === 'amber' ? "bg-amber-500/10 border-amber-500/30" :
                "bg-emerald-500/10 border-emerald-500/30"
              )}>
                <AlertTriangle className={cn("w-5 h-5 shrink-0", 
                  flag.severity === 'red' ? "text-destructive" :
                  flag.severity === 'amber' ? "text-amber-500" :
                  "text-emerald-500"
                )} />
                <div>
                  <h4 className="font-semibold text-sm">{flag.flag}</h4>
                  <p className="text-xs mt-1 opacity-80">{flag.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Invalidation Triggers</h3>
            <div className="space-y-2">
              {detail.invalidationTriggers.map(trigger => (
                <div key={trigger.id} className={cn(
                  "p-3 rounded-lg border flex items-start gap-3",
                  trigger.triggered ? "bg-destructive/10 border-destructive" : "bg-secondary/30"
                )}>
                  <div className={cn("w-4 h-4 rounded mt-0.5 border flex items-center justify-center shrink-0", 
                    trigger.triggered ? "bg-destructive border-destructive" : "border-muted-foreground"
                  )}>
                    {trigger.triggered && <div className="w-2 h-2 bg-white rounded-sm" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={cn("font-semibold text-sm", trigger.triggered && "text-destructive")}>{trigger.trigger}</h4>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-background border">{trigger.severity}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{trigger.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Management Commentary Timeline */}
        <div>
          <h3 className="font-semibold text-lg mb-4">Management Commentary</h3>
          <div className="border-l-2 border-border ml-3 space-y-6">
            {detail.managementCommentary.map(comment => (
              <div key={comment.id} className="relative pl-6">
                <div className={cn("absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 border-card",
                  comment.sentiment === 'positive' ? "bg-emerald-500" :
                  comment.sentiment === 'negative' || comment.sentiment === 'concerning' ? "bg-destructive" :
                  "bg-blue-500"
                )} />
                <div className="bg-secondary/20 border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground font-mono">
                    <span className="font-bold text-foreground">{comment.quarter}</span>
                    <span>•</span>
                    <span>{comment.speaker}</span>
                  </div>
                  <p className="text-sm italic text-foreground/90 border-l-2 border-primary/30 pl-3 py-1">"{comment.comment}"</p>
                  <div className="flex gap-2 mt-3">
                    {comment.tags.map(tag => (
                      <span key={tag} className="text-[10px] bg-background border px-1.5 py-0.5 rounded text-muted-foreground uppercase">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
      </div>
    </div>
  );
}

function Target({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  )
}
