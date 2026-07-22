import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, LoaderCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageLoader({
  label = "Loading workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <LoaderCircle className="h-7 w-7 animate-spin text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function InlineError({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            {message}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-lg text-sm text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
