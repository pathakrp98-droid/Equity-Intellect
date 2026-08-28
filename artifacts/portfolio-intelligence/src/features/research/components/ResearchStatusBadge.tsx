import {
  Archive,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Fingerprint,
  Loader2,
  XCircle,
} from "lucide-react";

import type { CoverageState } from "@workspace/research-contracts";

import { cn } from "@/lib/utils";

import { statusCopy } from "../automationViewModel";

const ICONS = {
  queued: Clock3,
  running: Loader2,
  current: CheckCircle2,
  limited: CircleAlert,
  stale: Clock3,
  failed: XCircle,
  needs_identity: Fingerprint,
  archived: Archive,
} satisfies Record<CoverageState, typeof Clock3>;

const TONES = {
  neutral: "border-border bg-secondary/60 text-muted-foreground",
  positive: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function ResearchStatusBadge({
  state,
  className,
}: {
  state: CoverageState;
  className?: string;
}) {
  const copy = statusCopy(state);
  const Icon = ICONS[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        TONES[copy.tone],
        className,
      )}
      title={copy.description}
    >
      <Icon
        className={cn("h-3.5 w-3.5", state === "running" && "animate-spin")}
        aria-hidden="true"
      />
      {copy.title}
    </span>
  );
}
