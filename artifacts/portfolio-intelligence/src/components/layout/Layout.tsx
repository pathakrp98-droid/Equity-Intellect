import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TriangleAlert } from 'lucide-react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

export function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      
      <div 
        className={cn(
          "flex-1 flex flex-col transition-all duration-300 min-h-screen overflow-hidden",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center gap-2 text-amber-500 text-xs font-medium sticky top-0 z-40 backdrop-blur-md">
          <TriangleAlert className="w-4 h-4" />
          <span>Demo Data — All holdings, prices, and research data are simulated.</span>
          <Link href="/settings" className="underline underline-offset-2 hover:text-amber-400">Import Holdings</Link>
        </div>
        
        <main className="flex-1 overflow-x-hidden p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
