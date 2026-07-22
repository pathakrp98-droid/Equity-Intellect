import React, { useEffect, useState } from "react";
import { DatabaseZap, Menu, WifiOff } from "lucide-react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";

export function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        closeMobile={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-1 flex-col transition-[margin] duration-300",
          collapsed ? "md:ml-16" : "md:ml-64",
        )}
      >
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link
            href="/"
            className="flex items-center gap-2 font-mono font-bold text-primary"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-black text-primary-foreground">
              AI
            </span>
            AlphaDesk
          </Link>
          <Link href="/system-health" aria-label="System health">
            <DatabaseZap className="h-5 w-5 text-muted-foreground" />
          </Link>
        </header>

        {!online ? (
          <div className="sticky top-14 z-30 flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs font-medium text-amber-500 md:top-0">
            <WifiOff className="h-4 w-4 shrink-0" /> Offline — cached screens
            remain visible, but refreshes and saves will fail.
          </div>
        ) : (
          <div className="sticky top-14 z-30 flex items-center justify-center gap-2 border-b border-blue-500/20 bg-blue-500/10 px-3 py-2 text-center text-[11px] font-medium text-blue-400 backdrop-blur md:top-0 md:text-xs">
            <DatabaseZap className="hidden h-4 w-4 shrink-0 sm:block" />
            <span>
              Facts are used only when imported or supplied by a configured
              provider. Check freshness before acting.
            </span>
            <Link
              href="/system-health"
              className="hidden whitespace-nowrap underline underline-offset-2 hover:text-blue-300 sm:inline"
            >
              System status
            </Link>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
