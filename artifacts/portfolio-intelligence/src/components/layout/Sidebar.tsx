import React from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  PieChart, 
  LineChart, 
  Globe2, 
  Bot, 
  Bell, 
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  TriangleAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGetDashboardAlerts } from '@workspace/api-client-react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portfolio', label: 'Portfolio', icon: PieChart },
  { href: '/research', label: 'Research Terminal', icon: LineChart },
  { href: '/market', label: 'Market Intelligence', icon: Globe2 },
  { href: '/copilot', label: 'AI Copilot', icon: Bot },
  { href: '/alerts', label: 'Alerts', icon: Bell, badge: true },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (c: boolean) => void }) {
  const [location] = useLocation();
  const { data: alerts } = useGetDashboardAlerts();
  
  const unreadAlerts = alerts?.filter(a => !a.dismissed).length || 0;

  return (
    <aside 
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight font-mono text-primary flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded text-primary-foreground flex items-center justify-center text-xs font-black">PI</div>
            Terminal
          </span>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-primary rounded text-primary-foreground flex items-center justify-center text-sm font-black mx-auto">PI</div>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative group",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
              {!collapsed && <span>{item.label}</span>}
              
              {item.badge && unreadAlerts > 0 && (
                <span className={cn(
                  "absolute flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full",
                  collapsed ? "top-1 right-1 w-4 h-4" : "right-3 top-1/2 -translate-y-1/2 px-1.5 min-w-[1.25rem] h-5"
                )}>
                  {unreadAlerts > 99 ? '99+' : unreadAlerts}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
    </aside>
  );
}
