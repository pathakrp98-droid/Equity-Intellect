import { Bot, Calculator, FileCheck2 } from "lucide-react";

import type { StatementKind } from "@workspace/research-contracts";

import { cn } from "@/lib/utils";

import { claimKindCopy } from "../automationViewModel";

const ICONS = {
  fact: FileCheck2,
  calculation: Calculator,
  ai_judgement: Bot,
} satisfies Record<StatementKind, typeof Bot>;

export function ResearchClaimBadge({
  kind,
  className,
}: {
  kind: StatementKind;
  className?: string;
}) {
  const copy = claimKindCopy(kind);
  const Icon = ICONS[kind];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        kind === "ai_judgement"
          ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
          : "border-border bg-secondary/60 text-muted-foreground",
        className,
      )}
      title={copy.description}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {copy.label}
    </span>
  );
}
