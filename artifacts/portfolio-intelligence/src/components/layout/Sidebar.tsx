import React from "react";
import {
  Bell,
  BookOpenCheck,
  Bot,
  ChevronLeft,
  ChevronRight,
  DatabaseZap,
  Globe2,
  HeartPulse,
  LayoutDashboard,
  LineChart,
  PieChart,
  Settings as SettingsIcon,
  Shield,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";

import { AuthBanner } from "@/components/auth/AuthBanner";
import { useAlertSummary } from "@/features/alerts/api";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Morning Brief", icon: LayoutDashboard },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/research", label: "Research Terminal", icon: LineChart },
  { href: "/market-intelligence", label: "Market Intelligence", icon: Globe2 },
  { href: "/copilot", label: "AI Copilot", icon: Bot },
  { href: "/alerts", label: "Alerts", icon: Bell, badge: true },
  { href: "/live-data", label: "Live Data", icon: DatabaseZap },
  { href: "/guardrails", label: "Guardrails", icon: Shield },
  { href: "/journal", label: "Decision Journal", icon: BookOpenCheck },
  { href: "/system-health", label: "System Health", icon: HeartPulse },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  closeMobile,
}: {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  closeMobile: () => void;
}) {
  const [location] = useLocation();
  const { data: alertSummary } = useAlertSummary();

  const content = (
    <>
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        {!collapsed ? (
          <span className="flex items-center gap-2 font-mono text-lg font-bold tracking-tight text-primary">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-black text-primary-foreground">
              AI
            </span>
            AlphaDesk AI
          </span>
        ) : (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded bg-primary text-sm font-black text-primary-foreground">
            AI
          </div>
        )}
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-secondary md:hidden"
          onClick={closeMobile}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon
                className={cn("h-5 w-5 shrink-0", isActive && "text-primary")}
              />
              {!collapsed && <span>{item.label}</span>}
              {item.badge && (alertSummary?.active ?? 0) > 0 && (
                <span
                  className={cn(
                    "absolute flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground",
                    collapsed
                      ? "right-1 top-1 h-4 w-4"
                      : "right-3 top-1/2 h-5 min-w-5 -translate-y-1/2 px-1.5",
                  )}
                >
                  {(alertSummary?.active ?? 0) > 99
                    ? "99+"
                    : alertSummary?.active}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border pt-2">
        {!collapsed && <AuthBanner />}
        <div className="hidden p-2 md:block">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={closeMobile}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[60] flex w-72 flex-col border-r border-border bg-card transition-transform duration-300 md:z-50 md:flex",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
          collapsed ? "md:w-16" : "md:w-64",
        )}
      >
        {content}
      </aside>
    </>
  );
}
