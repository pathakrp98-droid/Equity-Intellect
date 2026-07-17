import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useImportZerodha, useImportHdfc, useGetBrokerSnapshots } from '@workspace/api-client-react';
import { Upload, FileUp, Database, AlertCircle, CheckCircle2, Server } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function Settings() {
  const { data: brokers } = useGetBrokerSnapshots();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage data sources, API integrations, and system preferences.</p>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-amber-500 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Demo Mode Active
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-500/80 mb-4">
            You are currently viewing simulated portfolio data. To view your actual portfolio analytics, please import your holdings from your broker.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileUp className="w-4 h-4 text-primary" />
              Zerodha Import
            </CardTitle>
            <CardDescription>Upload your holding statement CSV from Console</CardDescription>
          </CardHeader>
          <CardContent>
            <ImportForm broker="Zerodha" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileUp className="w-4 h-4 text-primary" />
              HDFC Securities Import
            </CardTitle>
            <CardDescription>Upload your holding statement CSV from InvestRight</CardDescription>
          </CardHeader>
          <CardContent>
            <ImportForm broker="HDFC" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            Connected Data Sources
          </CardTitle>
          <CardDescription>Market data and fundamental research APIs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <DataSourceRow name="NSE Real-time Feed" status="connected" lastSync="Live" type="Price Data" />
            <DataSourceRow name="BSE Corporate Announcements" status="connected" lastSync="2 mins ago" type="Filings" />
            <DataSourceRow name="Fundamental DB (Capitaline)" status="connected" lastSync="12 hrs ago" type="Financials" />
            <DataSourceRow name="F&O Positioning Data" status="connected" lastSync="Live" type="Derivatives" />
            <DataSourceRow name="Brokerage Research Feed" status="connected" lastSync="1 hr ago" type="Analyst Notes" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ImportForm({ broker }: { broker: 'Zerodha' | 'HDFC' }) {
  const { toast } = useToast();
  const importZerodha = useImportZerodha();
  const importHdfc = useImportHdfc();
  const [file, setFile] = useState<File | null>(null);

  const isPending = broker === 'Zerodha' ? importZerodha.isPending : importHdfc.isPending;

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    // Simulate reading file to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const mutation = broker === 'Zerodha' ? importZerodha : importHdfc;
      
      mutation.mutate(
        { data: { csvContent: content, broker } },
        {
          onSuccess: (res) => {
            if (res.success) {
              toast({ title: "Import Successful", description: `Imported ${res.imported} holdings. ${res.skipped} skipped.` });
              setFile(null);
            } else {
              toast({ title: "Import Failed", description: res.errors[0], variant: "destructive" });
            }
          },
          onError: () => {
            toast({ title: "Import Failed", description: "Network error during import.", variant: "destructive" });
          }
        }
      );
    };
    reader.readAsDataURL(file);
  };

  return (
    <form onSubmit={handleImport} className="space-y-4">
      <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center bg-secondary/10 hover:bg-secondary/30 transition-colors cursor-pointer relative">
        <input 
          type="file" 
          accept=".csv"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <Upload className="w-8 h-8 text-muted-foreground mb-3" />
        {file ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium">Click or drag CSV file</p>
            <p className="text-xs text-muted-foreground">Format: {broker} Holdings Statement</p>
          </div>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={!file || isPending}>
        {isPending ? 'Importing...' : 'Process Statement'}
      </Button>
    </form>
  );
}

function DataSourceRow({ name, status, lastSync, type }: any) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-secondary/5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded bg-background border flex items-center justify-center">
          <Server className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold text-sm">{name}</p>
          <p className="text-xs text-muted-foreground">{type}</p>
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center justify-end gap-1.5 mb-1">
          <div className={cn("w-2 h-2 rounded-full", status === 'connected' ? "bg-emerald-500" : "bg-destructive")} />
          <span className="text-xs uppercase font-bold tracking-wider">{status}</span>
        </div>
        <p className="text-xs text-muted-foreground font-mono">Sync: {lastSync}</p>
      </div>
    </div>
  );
}
