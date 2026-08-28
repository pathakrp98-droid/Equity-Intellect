import type {
  AutomationStatus,
  CoverageState,
  EvidenceStrength,
  StatementKind,
} from "@workspace/research-contracts";

export type StatusTone = "neutral" | "positive" | "warning" | "danger";

export interface StatusCopy {
  title: string;
  description: string;
  tone: StatusTone;
}

const STATUS_COPY: Record<CoverageState, StatusCopy> = {
  queued: {
    title: "Preparing research",
    description: "AlphaDesk has queued the first evidence review.",
    tone: "neutral",
  },
  running: {
    title: "Updating research",
    description: "AlphaDesk is checking current evidence now.",
    tone: "neutral",
  },
  current: {
    title: "Current",
    description: "The latest evidence review is still current.",
    tone: "positive",
  },
  limited: {
    title: "Limited evidence",
    description: "Use this research cautiously and review the evidence gaps.",
    tone: "warning",
  },
  stale: {
    title: "Research needs refreshing",
    description:
      "The last successful review is older than its freshness window.",
    tone: "warning",
  },
  failed: {
    title: "Research update failed",
    description:
      "The previous successful research remains available while AlphaDesk retries.",
    tone: "danger",
  },
  needs_identity: {
    title: "Needs identity",
    description:
      "Confirm the security before AlphaDesk gathers evidence for it.",
    tone: "warning",
  },
  archived: {
    title: "No longer in portfolio",
    description:
      "Research history is preserved, but automatic updates are paused.",
    tone: "neutral",
  },
};

export function statusCopy(state: CoverageState): StatusCopy {
  return STATUS_COPY[state];
}

const CLAIM_KIND_COPY: Record<
  StatementKind,
  { label: string; description: string }
> = {
  fact: {
    label: "Fact",
    description: "A statement taken from the cited evidence.",
  },
  calculation: {
    label: "Calculation",
    description: "A calculation based on the cited evidence.",
  },
  ai_judgement: {
    label: "AI judgement",
    description: "AlphaDesk's interpretation of the cited evidence.",
  },
};

export function claimKindCopy(kind: StatementKind) {
  return CLAIM_KIND_COPY[kind];
}

function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}

export function evidenceLinkCopy(source: {
  publisher: string | null;
  publishedAt: string | null;
  retrievedAt: string;
}) {
  const publisher = source.publisher?.trim() || "Source";
  if (source.publishedAt) {
    const date = displayDate(source.publishedAt);
    return {
      publisher,
      date,
      accessibleLabel: `${publisher}, published ${date}`,
    };
  }
  const date = displayDate(source.retrievedAt);
  return {
    publisher,
    date: `Retrieved ${date}`,
    accessibleLabel: `${publisher}, retrieved ${date}`,
  };
}

export function safeEvidenceUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

const REVIEW_PRIORITY: Record<CoverageState, number> = {
  failed: 0,
  needs_identity: 0,
  stale: 1,
  limited: 1,
  queued: 2,
  running: 2,
  current: 3,
  archived: 4,
};

export function sortCoverageForReview<
  T extends {
    automationState: CoverageState | null;
    allocationPct: number;
    ticker: string;
  },
>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => {
    const priority =
      (left.automationState ? REVIEW_PRIORITY[left.automationState] : 2) -
      (right.automationState ? REVIEW_PRIORITY[right.automationState] : 2);
    return (
      priority ||
      right.allocationPct - left.allocationPct ||
      left.ticker.localeCompare(right.ticker)
    );
  });
}

export function displayAutomationState(input: {
  coverageState: CoverageState;
  runStatus: AutomationStatus | null;
  snapshot: {
    evidenceStrength: EvidenceStrength;
    validUntil: string;
  } | null;
  now?: string | Date;
}): CoverageState {
  if (input.runStatus === "queued" || input.runStatus === "running") {
    return input.runStatus;
  }
  if (
    input.runStatus === "partial" ||
    input.runStatus === "failed" ||
    input.runStatus === "dead_letter"
  ) {
    return "failed";
  }
  const snapshot = input.snapshot;
  const shouldUseSnapshot =
    snapshot &&
    (input.runStatus === "succeeded" ||
      input.coverageState === "queued" ||
      input.coverageState === "running");
  if (!shouldUseSnapshot) return input.coverageState;
  const now = new Date(input.now ?? Date.now()).getTime();
  if (new Date(snapshot.validUntil).getTime() <= now) return "stale";
  return snapshot.evidenceStrength === "limited" ? "limited" : "current";
}
