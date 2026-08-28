import { BriefcaseBusiness, Search } from "lucide-react";

import type { CoverageState } from "@workspace/research-contracts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { AutomatedResearchCoverage } from "../automationApi";
import { sortCoverageForReview } from "../automationViewModel";
import { ResearchStatusBadge } from "./ResearchStatusBadge";

function effectiveState(row: AutomatedResearchCoverage): CoverageState | null {
  return row.automationState ?? (row.isHolding ? "queued" : null);
}

export function ResearchCoverageList({
  coverage,
  isLoading,
  search,
  onSearch,
  selectedTicker,
  onSelect,
}: {
  coverage: AutomatedResearchCoverage[] | undefined;
  isLoading: boolean;
  search: string;
  onSearch: (value: string) => void;
  selectedTicker: string | null;
  onSelect: (ticker: string) => void;
}) {
  const rows = sortCoverageForReview(coverage ?? []);
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-secondary/20 p-4">
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
          Your investments
        </CardTitle>
        <div className="relative pt-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-[25%] text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search ticker, company or sector"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="max-h-[720px] space-y-2 overflow-y-auto p-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))
          : rows.map((row) => {
              const state = effectiveState(row);
              return (
                <button
                  type="button"
                  key={row.ticker}
                  onClick={() => onSelect(row.ticker)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    selectedTicker === row.ticker
                      ? "border-primary/40 bg-primary/10"
                      : "border-transparent hover:border-border hover:bg-secondary/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{row.ticker}</span>
                        {row.isHolding ? (
                          <BriefcaseBusiness
                            className="h-3.5 w-3.5 text-primary"
                            aria-label="Portfolio holding"
                          />
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.name}
                      </p>
                    </div>
                    {row.isHolding ? (
                      <span className="text-xs font-semibold">
                        {row.allocationPct.toFixed(1)}%
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3">
                    {state ? (
                      <ResearchStatusBadge state={state} />
                    ) : (
                      <span className="inline-flex rounded-full border bg-secondary/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        Your research
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
        {!isLoading && rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No matching investments. Portfolio holdings appear here
            automatically.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
