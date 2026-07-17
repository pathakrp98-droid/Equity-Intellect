import { useState } from 'react';
import { useGetAlerts, useDismissAlert, useGetAlertSettings, useUpdateAlertSettings } from '@workspace/api-client-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, BellRing, Settings2, ExternalLink, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function Alerts() {
  return (
    <div className="space-y-6 h-full flex flex-col max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alerts Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time thesis invalidation and market event monitoring.</p>
      </div>

      <Tabs defaultValue="active" className="w-full flex-1 flex flex-col">
        <TabsList className="w-full justify-start h-auto p-1 bg-secondary rounded-lg">
          <TabsTrigger value="active" className="text-sm py-2 px-6 flex gap-2 items-center">
            <BellRing className="w-4 h-4" /> Active Alerts
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-sm py-2 px-6 flex gap-2 items-center">
            <Settings2 className="w-4 h-4" /> Alert Configuration
          </TabsTrigger>
        </TabsList>

        <div className="mt-6 flex-1 bg-card rounded-xl border shadow-sm overflow-hidden">
          <TabsContent value="active" className="m-0 h-full p-6 flex flex-col">
            <ActiveAlertsList />
          </TabsContent>
          <TabsContent value="settings" className="m-0 p-6">
            <AlertSettingsView />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function ActiveAlertsList() {
  const { data: alerts, isLoading } = useGetAlerts();
  const dismissAlert = useDismissAlert();
  const [filter, setFilter] = useState<string>('all');

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  const activeAlerts = alerts?.filter(a => !a.dismissed && (filter === 'all' || a.severity === filter)) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Recent Alerts ({activeAlerts.length})</h3>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <Filter className="w-3 h-3 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical Only</SelectItem>
            <SelectItem value="high">High & Above</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {activeAlerts.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
            <BellRing className="w-8 h-8 text-muted-foreground opacity-50" />
          </div>
          <h3 className="text-lg font-medium text-foreground">No active alerts</h3>
          <p className="text-muted-foreground text-sm max-w-sm mt-1">Your portfolio is currently clear of any monitored severe events.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeAlerts.map(alert => (
            <div key={alert.id} className={cn(
              "relative overflow-hidden rounded-lg border p-5 flex gap-5 items-start bg-secondary/10 hover:bg-secondary/20 transition-colors",
              alert.severity === 'critical' ? "border-l-4 border-l-destructive" :
              alert.severity === 'high' ? "border-l-4 border-l-orange-500" :
              "border-l-4 border-l-primary"
            )}>
              <div className={cn(
                "p-2 rounded-full mt-1 shrink-0 bg-background border",
                alert.severity === 'critical' ? "text-destructive border-destructive/20" :
                alert.severity === 'high' ? "text-orange-500 border-orange-500/20" :
                "text-primary border-primary/20"
              )}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-bold text-lg tracking-tight">{alert.ticker}</span>
                  <span className={cn(
                    "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border",
                    alert.severity === 'critical' ? "bg-destructive/10 text-destructive border-destructive/20" :
                    alert.severity === 'high' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                    "bg-primary/10 text-primary border-primary/20"
                  )}>
                    {alert.severity}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-background text-muted-foreground">
                    {alert.alertType.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto font-mono">
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>
                <h4 className="font-semibold text-foreground text-base mb-2">{alert.headline}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{alert.detail}</p>
                <div className="flex items-center gap-4 mt-4">
                  <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded border">Source: {alert.source}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs ml-auto hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => dismissAlert.mutate({ id: alert.id })}
                  >
                    Dismiss Alert
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ALERT_CATEGORIES = [
  { id: 'promoter_selling', label: 'Promoter Selling', desc: 'Any open market sale by promoters' },
  { id: 'pledge_increase', label: 'Pledge Increase', desc: 'Promoter pledging shares increases >2%' },
  { id: 'auditor_resignation', label: 'Auditor Resignation', desc: 'Statutory auditor resigns mid-term' },
  { id: 'management_exit', label: 'Key Mgmt Exit', desc: 'CEO, CFO, or MD resigns' },
  { id: 'rating_downgrade', label: 'Credit Rating Downgrade', desc: 'Long-term debt rating cut' },
  { id: 'regulatory_investigation', label: 'Regulatory Probe', desc: 'SEBI/CBI/ED investigation announced' },
  { id: 'fraud_allegation', label: 'Fraud Allegation', desc: 'Whistleblower or short-seller report' },
  { id: 'earnings_cut', label: 'Severe Earnings Miss', desc: 'PAT misses estimates by >15%' },
  { id: 'margin_deterioration', label: 'Margin Collapse', desc: 'EBITDA margin falls >300bps YoY' },
  { id: 'dilution', label: 'Equity Dilution', desc: 'QIP or preferential allotment announced' },
];

function AlertSettingsView() {
  const { data: settings, isLoading } = useGetAlertSettings();
  const updateSettings = useUpdateAlertSettings();

  if (isLoading || !settings) return <div className="space-y-4"><Skeleton className="h-64 w-full" /></div>;

  const handleToggleType = (typeId: string, checked: boolean) => {
    const current = new Set(settings.enabledAlertTypes);
    if (checked) current.add(typeId);
    else current.delete(typeId);
    updateSettings.mutate({ data: { enabledAlertTypes: Array.from(current) } });
  };

  return (
    <div className="max-w-3xl space-y-8 pb-10">
      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2">Delivery Methods</h3>
        <div className="grid gap-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/10">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive critical alerts via email immediately.</p>
            </div>
            <Switch 
              checked={settings.emailNotifications} 
              onCheckedChange={(checked) => updateSettings.mutate({ data: { emailNotifications: checked } })} 
            />
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/10">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive browser/app push notifications.</p>
            </div>
            <Switch 
              checked={settings.pushNotifications} 
              onCheckedChange={(checked) => updateSettings.mutate({ data: { pushNotifications: checked } })} 
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end border-b pb-2">
          <h3 className="text-lg font-semibold">Alert Scopes</h3>
          <Select 
            value={settings.severityThreshold} 
            onValueChange={(val: any) => updateSettings.mutate({ data: { severityThreshold: val } })}
          >
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Minimum Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical Only</SelectItem>
              <SelectItem value="high">High & Critical</SelectItem>
              <SelectItem value="medium">Medium & Above</SelectItem>
              <SelectItem value="low">All Alerts</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center justify-between p-4 border rounded-lg bg-primary/5 border-primary/20">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold text-primary">Portfolio Only</Label>
            <p className="text-sm text-muted-foreground">If disabled, triggers alerts for watchlist stocks as well.</p>
          </div>
          <Switch 
            checked={settings.portfolioOnly} 
            onCheckedChange={(checked) => updateSettings.mutate({ data: { portfolioOnly: checked } })} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {ALERT_CATEGORIES.map(cat => (
            <div key={cat.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-secondary/10 transition-colors">
              <Switch 
                id={`alert-${cat.id}`}
                checked={settings.enabledAlertTypes.includes(cat.id)}
                onCheckedChange={(checked) => handleToggleType(cat.id, checked)}
                className="mt-0.5"
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor={`alert-${cat.id}`} className="font-semibold text-sm cursor-pointer">{cat.label}</Label>
                <p className="text-xs text-muted-foreground">{cat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
