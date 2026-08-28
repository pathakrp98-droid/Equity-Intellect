import { CalendarClock, GitCompareArrows } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import type { AutomatedResearchSnapshot } from "../automationApi";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function HistoryItems({ history }: { history: AutomatedResearchSnapshot[] }) {
  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Research history will appear after the first successful evidence
          review.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {history.map((snapshot) => (
        <Card key={snapshot.id}>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold">Version {snapshot.version}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {formatDate(snapshot.publishedAt)}
                </p>
              </div>
              <span className="w-fit rounded-full border bg-secondary/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {snapshot.trigger.replaceAll("_", " ")}
              </span>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-secondary/30 p-3 text-sm">
              <GitCompareArrows className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                {snapshot.changeSet.headline ??
                  (snapshot.version === 1
                    ? "Initial automated research snapshot created."
                    : "No change summary was recorded.")}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ResearchHistoryPanel({
  history,
  isLoading,
}: {
  history: AutomatedResearchSnapshot[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  const snapshots = history ?? [];
  return (
    <>
      <details className="rounded-lg border p-4 md:hidden">
        <summary className="cursor-pointer text-sm font-semibold">
          View snapshot history ({snapshots.length})
        </summary>
        <div className="mt-4">
          <HistoryItems history={snapshots} />
        </div>
      </details>
      <div className="hidden md:block">
        <HistoryItems history={snapshots} />
      </div>
    </>
  );
}
