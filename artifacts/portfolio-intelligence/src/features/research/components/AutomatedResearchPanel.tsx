import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import type {
  CoverageState,
  EvidenceStrength,
} from "@workspace/research-contracts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  useCurrentAutomatedResearch,
  useRequestAutomatedResearchRefresh,
  useResearchAutomationRun,
  type AutomatedResearchCoverage,
  type AutomatedResearchSnapshot,
} from "../automationApi";
import {
  displayAutomationState,
  evidenceLinkCopy,
  safeEvidenceUrl,
  statusCopy,
} from "../automationViewModel";
import { IdentityCorrectionCard } from "./IdentityCorrectionCard";
import { ResearchClaimBadge } from "./ResearchClaimBadge";
import { ResearchEvidenceList } from "./ResearchEvidenceList";
import { ResearchStatusBadge } from "./ResearchStatusBadge";

const SECTION_COPY = [
  ["whatYouOwn", "What you own"],
  ["investmentCase", "Investment case"],
  ["whatChanged", "What changed"],
  ["risks", "Key risks"],
  ["catalysts", "Upcoming catalysts"],
  ["assessment", "Valuation or fund assessment"],
  ["watchNext", "What to watch next"],
] as const;

const TERMINAL_STATES = new Set([
  "succeeded",
  "partial",
  "failed",
  "dead_letter",
  "cancelled",
  "skipped",
]);

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function strengthCopy(strength: EvidenceStrength) {
  if (strength === "strong") return "Strong evidence";
  if (strength === "moderate") return "Moderate evidence";
  return "Limited evidence";
}

function effectiveState(row: AutomatedResearchCoverage): CoverageState {
  return row.automationState ?? "queued";
}

function EmptyAutomationState({
  state,
  error,
}: {
  state: CoverageState;
  error?: string;
}) {
  const copy = statusCopy(state);
  return (
    <Card
      className={cn(
        "border-dashed",
        state === "failed" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <CardContent className="mx-auto max-w-xl space-y-4 p-8 text-center sm:p-12">
        {state === "running" || state === "queued" ? (
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
        ) : (
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        )}
        <div>
          <h2 className="text-xl font-semibold">{copy.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {error || copy.description}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          You can leave this page. Research runs separately and your portfolio
          remains available.
        </p>
      </CardContent>
    </Card>
  );
}

function SnapshotView({ snapshot }: { snapshot: AutomatedResearchSnapshot }) {
  const sourceById = new Map(
    snapshot.sources.map((source) => [source.citationKey, source]),
  );
  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {strengthCopy(snapshot.evidenceStrength)}
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {snapshot.payload.evidenceStrengthReason}
              </p>
            </div>
            <span className="w-fit rounded-full border bg-background px-2.5 py-1 text-xs font-semibold">
              Version {snapshot.version}
            </span>
          </div>
          {(snapshot.quality.gaps?.length ?? 0) > 0 ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-xs font-semibold text-amber-500">
                Evidence gaps
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {snapshot.quality.gaps?.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {SECTION_COPY.map(([section, title]) => {
        const claims = snapshot.payload.claims.filter(
          (claim) => claim.section === section,
        );
        return (
          <Card key={section}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {claims.map((claim) => (
                <div
                  key={claim.id}
                  className="rounded-lg border bg-secondary/15 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <ResearchClaimBadge kind={claim.kind} />
                    <p className="text-sm leading-6">{claim.text}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                    {claim.evidenceIds.map((id) => {
                      const source = sourceById.get(id);
                      if (!source) return null;
                      const href = safeEvidenceUrl(source.url);
                      const copy = evidenceLinkCopy(source);
                      return href ? (
                        <a
                          key={id}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={copy.accessibleLabel}
                          className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-[11px] text-primary hover:underline"
                        >
                          {copy.publisher}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span
                          key={id}
                          className="rounded-full border bg-background px-2 py-1 text-[11px] text-muted-foreground"
                        >
                          {copy.publisher}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
              {section === "assessment" && snapshot.payload.numericTarget ? (
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                  <ResearchClaimBadge kind="ai_judgement" />
                  <p className="mt-2 text-sm">
                    Evidence-backed AI valuation reference: ₹
                    {snapshot.payload.numericTarget.toLocaleString("en-IN")}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      {snapshot.payload.unknowns.length > 0 ? (
        <Card className="border-amber-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Open questions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {snapshot.payload.unknowns.map((unknown) => (
                <li key={unknown}>{unknown}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" /> Evidence and sources
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sources are stored with this read-only snapshot so older research
            can always be reviewed.
          </p>
        </CardHeader>
        <CardContent>
          <ResearchEvidenceList sources={snapshot.sources} />
        </CardContent>
      </Card>
    </div>
  );
}

export function AutomatedResearchPanel({
  coverage,
  onIdentityCorrected,
}: {
  coverage: AutomatedResearchCoverage;
  onIdentityCorrected?: (ticker: string) => void;
}) {
  const queryClient = useQueryClient();
  const hasAutomatedCompany = coverage.id !== null && coverage.isHolding;
  const current = useCurrentAutomatedResearch(
    hasAutomatedCompany ? coverage.ticker : null,
  );
  const refresh = useRequestAutomatedResearchRefresh(coverage.ticker);
  const activeJob = current.data?.recentJobs.find((job) =>
    ["queued", "running"].includes(job.status),
  );
  const jobId = refresh.data?.jobId ?? activeJob?.id ?? null;
  const run = useResearchAutomationRun(jobId);

  useEffect(() => {
    if (run.data && TERMINAL_STATES.has(run.data.status)) {
      void current.refetch();
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["research-engine", "automation", "coverage"],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "research-engine",
            "automation",
            "history",
            coverage.ticker,
          ],
        }),
        queryClient.invalidateQueries({ queryKey: ["guardian"] }),
        queryClient.invalidateQueries({ queryKey: ["market-intelligence"] }),
        queryClient.invalidateQueries({ queryKey: ["integration", "health"] }),
      ]);
    }
  }, [coverage.ticker, current.refetch, queryClient, run.data]);

  if (!coverage.isHolding) {
    return (
      <Card>
        <CardContent className="mx-auto max-w-xl space-y-3 p-8 text-center sm:p-12">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Your research company</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Automatic evidence reviews follow active portfolio holdings. Use the
            Your research tab for this watchlist company.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hasAutomatedCompany || current.isLoading) {
    return !hasAutomatedCompany ? (
      <EmptyAutomationState state="queued" />
    ) : (
      <Skeleton className="min-h-72 w-full" />
    );
  }

  const baseState = effectiveState(coverage);
  if (current.data?.company.identityStatus === "needs_identity") {
    return (
      <IdentityCorrectionCard
        company={current.data.company}
        onCorrected={onIdentityCorrected}
      />
    );
  }

  const snapshot = current.data?.latestSnapshot ?? null;
  const state = displayAutomationState({
    coverageState: baseState,
    runStatus: run.data?.status ?? null,
    snapshot,
  });
  if (!snapshot) {
    return (
      <EmptyAutomationState
        state={state}
        error={
          current.isError && state === "failed"
            ? current.error.message
            : (current.data?.recentJobs[0]?.errorMessage ?? undefined)
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-xl font-bold">{coverage.ticker}</h2>
                <ResearchStatusBadge state={state} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {coverage.name}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Updated {formatDate(snapshot.publishedAt)} · Current until{" "}
                {formatDate(snapshot.validUntil)}
              </p>
              {state === "failed" ? (
                <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  The latest update failed. This previous successful snapshot is
                  still available.
                </p>
              ) : null}
            </div>
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              disabled={refresh.isPending || state === "running"}
              onClick={() => refresh.mutate()}
            >
              {refresh.isPending || state === "running" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh research
            </Button>
          </div>
          {refresh.isError ? (
            <p className="mt-3 text-sm text-destructive">
              {refresh.error.message}
            </p>
          ) : null}
          {refresh.isSuccess ? (
            <p className="mt-3 text-sm text-primary">
              Update queued. You can leave this page while AlphaDesk works.
            </p>
          ) : null}
        </CardContent>
      </Card>
      <SnapshotView snapshot={snapshot} />
    </div>
  );
}
