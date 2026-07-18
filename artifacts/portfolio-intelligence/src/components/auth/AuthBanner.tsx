import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, User, Shield, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function AuthBanner() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground animate-pulse">
        <div className="w-4 h-4 rounded-full bg-muted" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="px-3 py-2 border border-primary/20 rounded-lg bg-primary/5 mx-1 mb-2">
        <p className="text-[10px] text-muted-foreground mb-2 leading-tight">Sign in to save watchlist, guardrail settings, and audit trail</p>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
          onClick={login}
        >
          <LogIn className="w-3 h-3 mr-1.5" />
          Sign in
        </Button>
      </div>
    );
  }

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("") || user?.email?.[0]?.toUpperCase() || "U";
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "User";

  return (
    <div className="relative mx-1 mb-2">
      <button
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors",
          open ? "bg-secondary border-border" : "border-transparent hover:bg-secondary/50"
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
          {user?.profileImageUrl ? (
            <img src={user.profileImageUrl} className="w-full h-full rounded-full object-cover" alt="" />
          ) : (
            <span className="text-[10px] font-semibold text-primary">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate text-foreground">{displayName}</p>
          <p className="text-[10px] text-emerald-500 font-medium">● Active session</p>
        </div>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border rounded-lg shadow-xl p-2 z-50">
          <div className="px-2 py-1 mb-1">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="text-xs font-medium truncate">{user?.email}</p>
          </div>
          <div className="border-t my-1" />
          <button
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            onClick={() => { setOpen(false); logout(); }}
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
