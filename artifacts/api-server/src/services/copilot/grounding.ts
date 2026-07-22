export type CopilotMode =
  | "general"
  | "portfolio_review"
  | "company_analysis"
  | "thesis_challenge"
  | "company_compare"
  | "research_gap"
  | "performance_explain";

export type CopilotMemoryCategory =
  | "preference"
  | "instruction"
  | "portfolio"
  | "thesis"
  | "risk"
  | "research"
  | "decision";

export interface GroundingSource {
  id: string;
  label: string;
  kind: "portfolio" | "holding" | "research" | "memory" | "calculation";
  dataSource: string;
  ticker?: string | null;
  asOf?: string | null;
  payload: unknown;
}

export interface MemoryCandidate {
  category: CopilotMemoryCategory;
  subject: string;
  content: string;
  confidence: number;
}

export interface GeneratedCopilotAnswer {
  answer: string;
  summary: string;
  keyPoints: string[];
  risks: string[];
  unknowns: string[];
  suggestedNextQuestions: string[];
  citations: Array<{ sourceId: string; claim: string }>;
  memoryCandidates: MemoryCandidate[];
}

export interface PortfolioContextPayload {
  portfolio?: {
    name?: string;
    baseCurrency?: string;
    benchmark?: string;
  } | null;
  snapshot?: {
    asOf?: string | Date;
    totalValue?: number;
    marketValue?: number;
    cashBalance?: number;
    costBasis?: number;
    realizedPnl?: number;
    unrealizedPnl?: number;
    dividendIncome?: number;
    netContributions?: number;
    totalPnl?: number;
    totalReturnPct?: number;
    xirrPct?: number | null;
    largestPositionTicker?: string | null;
    largestPositionPct?: number;
    topFiveConcentrationPct?: number;
    concentrationRisk?: string;
    holdingsCount?: number;
    riskFlags?: string[];
  } | null;
  holdings?: Array<{
    ticker: string;
    name?: string | null;
    sector?: string | null;
    quantity?: number;
    averageCost?: number;
    marketPrice?: number;
    marketValue?: number;
    costBasis?: number;
    unrealizedPnl?: number;
    unrealizedPnlPct?: number;
    allocationPct?: number;
    dayChangePct?: number;
    priceSource?: string;
  }>;
  performance?: {
    absoluteReturn?: number;
    xirr?: number;
    attributions?: Array<{
      ticker: string;
      name?: string;
      contribution?: number;
    }>;
    dataQuality?: Record<string, boolean>;
  } | null;
  risk?: {
    concentrationRisk?: string;
    topHoldingsConcentration?: number;
    sectorConcentration?: Array<{ sector: string; weight: number }>;
    riskFlags?: string[];
    dataQuality?: Record<string, boolean>;
  } | null;
}

export interface ResearchContextPayload {
  ticker: string;
  name: string;
  completenessScore?: number;
  completenessBand?: string;
  missing?: string[];
  company?: Record<string, unknown> | null;
  holding?: Record<string, unknown> | null;
  thesis?: {
    summary?: string | null;
    bullCase?: string | null;
    baseCase?: string | null;
    bearCase?: string | null;
    conviction?: string;
    status?: string;
    expectedReturnPct?: number | null;
    maxAcceptableLossPct?: number | null;
    targetPrice?: number | null;
    bullPrice?: number | null;
    basePrice?: number | null;
    bearPrice?: number | null;
    valuationMethodology?: string | null;
    keyAssumptions?: string[];
    nextReviewAt?: string | Date | null;
  } | null;
  risks?: Array<Record<string, unknown>>;
  catalysts?: Array<Record<string, unknown>>;
  invalidationTriggers?: Array<Record<string, unknown>>;
  valuationAssumptions?: Array<Record<string, unknown>>;
  notes?: Array<Record<string, unknown>>;
}

export interface OfflineAnswerInput {
  mode: CopilotMode;
  question: string;
  sources: GroundingSource[];
  portfolio?: PortfolioContextPayload | null;
  research?: ResearchContextPayload[];
}

export function normalizeTicker(value: string): string {
  return value.trim().toUpperCase();
}

export function inferTickers(
  question: string,
  availableTickers: string[],
  explicitTickers: string[] = [],
): string[] {
  const explicit = explicitTickers.map(normalizeTicker).filter(Boolean);
  const upperQuestion = question.toUpperCase();
  const inferred = availableTickers
    .map(normalizeTicker)
    .filter((ticker) => {
      const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`).test(
        upperQuestion,
      );
    });
  return [...new Set([...explicit, ...inferred])].slice(0, 6);
}

export function inferMode(question: string, selected?: CopilotMode): CopilotMode {
  if (selected && selected !== "general") return selected;
  const value = question.toLowerCase();
  if (/compare|versus|\bvs\b|which.*better/.test(value)) return "company_compare";
  if (/challenge|bear case|devil.?s advocate|break.*thesis|invalidate/.test(value)) {
    return "thesis_challenge";
  }
  if (/missing research|research gap|what.*missing|completeness/.test(value)) {
    return "research_gap";
  }
  if (/performance|return|p&l|pnl|xirr|attribution|why.*moved/.test(value)) {
    return "performance_explain";
  }
  if (/portfolio|allocation|concentration|risk|cash buffer/.test(value)) {
    return "portfolio_review";
  }
  if (/thesis|company|stock|holding|valuation/.test(value)) {
    return "company_analysis";
  }
  return "general";
}

export function sanitizeGeneratedAnswer(
  value: Partial<GeneratedCopilotAnswer> | null | undefined,
  sources: GroundingSource[],
): GeneratedCopilotAnswer {
  const knownIds = new Set(sources.map((source) => source.id));
  const allowedMemoryCategories = new Set<CopilotMemoryCategory>([
    "preference",
    "instruction",
    "portfolio",
    "thesis",
    "risk",
    "research",
    "decision",
  ]);
  const asStrings = (items: unknown): string[] =>
    Array.isArray(items)
      ? items.map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
      : [];

  const answer = String(
    value?.answer ?? "I could not produce a grounded answer.",
  )
    .replace(/\[([A-Z]\d+)\]/g, (marker, sourceId: string) =>
      knownIds.has(sourceId) ? marker : "",
    )
    .trim()
    .slice(0, 20_000);

  return {
    answer,
    summary: String(value?.summary ?? "").trim().slice(0, 2_000),
    keyPoints: asStrings(value?.keyPoints),
    risks: asStrings(value?.risks),
    unknowns: asStrings(value?.unknowns),
    suggestedNextQuestions: asStrings(value?.suggestedNextQuestions).slice(0, 5),
    citations: Array.isArray(value?.citations)
      ? value!.citations!
          .filter(
            (item) =>
              item &&
              knownIds.has(String(item.sourceId)) &&
              String(item.claim ?? "").trim(),
          )
          .map((item) => ({
            sourceId: String(item.sourceId),
            claim: String(item.claim).trim(),
          }))
          .slice(0, 20)
      : [],
    memoryCandidates: Array.isArray(value?.memoryCandidates)
      ? value!.memoryCandidates!
          .filter(
            (item) =>
              item &&
              allowedMemoryCategories.has(item.category) &&
              String(item.subject ?? "").trim() &&
              String(item.content ?? "").trim(),
          )
          .map((item) => ({
            category: item.category,
            subject: String(item.subject).trim().slice(0, 160),
            content: String(item.content).trim().slice(0, 2000),
            confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
          }))
          .filter((item) => item.confidence >= 0.7)
          .slice(0, 5)
      : [],
  };
}

function money(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return "not available";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value as number);
}

function pct(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return "not available";
  return `${(value as number).toFixed(2)}%`;
}

function portfolioSourceId(sources: GroundingSource[]): string | null {
  return sources.find((source) => source.kind === "portfolio")?.id ?? null;
}

function researchSourceId(
  sources: GroundingSource[],
  ticker: string,
): string | null {
  return (
    sources.find(
      (source) => source.kind === "research" && source.ticker === ticker,
    )?.id ?? null
  );
}

function citation(sourceId: string | null, claim: string) {
  return sourceId ? [{ sourceId, claim }] : [];
}

function sourceTag(sourceId: string | null): string {
  return sourceId ? ` [${sourceId}]` : "";
}

export function generateOfflineAnswer(
  input: OfflineAnswerInput,
): GeneratedCopilotAnswer {
  const portfolio = input.portfolio ?? null;
  const snapshot = portfolio?.snapshot ?? null;
  const holdings = [...(portfolio?.holdings ?? [])].sort(
    (a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0),
  );
  const research = input.research ?? [];
  const pSource = portfolioSourceId(input.sources);
  const citations: Array<{ sourceId: string; claim: string }> = [];
  const risks: string[] = [];
  const unknowns: string[] = [];
  const keyPoints: string[] = [];
  let answer = "";
  let summary = "";

  if (input.mode === "portfolio_review" || input.mode === "general") {
    if (!snapshot) {
      answer =
        "There is no calculated portfolio snapshot yet. Add transactions and market prices before asking for a portfolio review.";
      unknowns.push("Portfolio snapshot is unavailable.");
    } else {
      const top = holdings.slice(0, 5);
      summary = `Portfolio value ${money(snapshot.totalValue)}, return ${pct(snapshot.totalReturnPct)}, cash ${money(snapshot.cashBalance)}.`;
      answer = [
        `Your portfolio is valued at ${money(snapshot.totalValue)} with total P&L of ${money(snapshot.totalPnl)} and a recorded return of ${pct(snapshot.totalReturnPct)}.${sourceTag(pSource)}`,
        `Cash is ${money(snapshot.cashBalance)} and the largest position is ${snapshot.largestPositionTicker ?? "not identified"} at ${pct(snapshot.largestPositionPct)}.${sourceTag(pSource)}`,
        top.length
          ? `The largest holdings are ${top.map((item) => `${item.ticker} (${pct(item.allocationPct)})`).join(", ")}.${sourceTag(pSource)}`
          : "No active equity holdings are recorded.",
      ].join("\n\n");
      keyPoints.push(
        `Total value: ${money(snapshot.totalValue)}`,
        `Total return: ${pct(snapshot.totalReturnPct)}`,
        `Cash balance: ${money(snapshot.cashBalance)}`,
      );
      if ((snapshot.largestPositionPct ?? 0) > 20) {
        risks.push(
          `${snapshot.largestPositionTicker ?? "The largest position"} represents ${pct(snapshot.largestPositionPct)} of portfolio value.`,
        );
      }
      risks.push(...(snapshot.riskFlags ?? []).slice(0, 5));
      citations.push(
        ...citation(pSource, "Portfolio value, return, cash and concentration metrics."),
      );
    }
  } else if (input.mode === "performance_explain") {
    if (!snapshot) {
      answer = "Performance cannot be explained because no portfolio snapshot exists.";
      unknowns.push("No portfolio snapshot or calculated performance is available.");
    } else {
      const winners = holdings
        .filter((item) => (item.unrealizedPnl ?? 0) > 0)
        .sort((a, b) => (b.unrealizedPnl ?? 0) - (a.unrealizedPnl ?? 0))
        .slice(0, 3);
      const detractors = holdings
        .filter((item) => (item.unrealizedPnl ?? 0) < 0)
        .sort((a, b) => (a.unrealizedPnl ?? 0) - (b.unrealizedPnl ?? 0))
        .slice(0, 3);
      answer = [
        `The recorded total return is ${pct(snapshot.totalReturnPct)} and XIRR is ${pct(snapshot.xirrPct)}.${sourceTag(pSource)}`,
        winners.length
          ? `Largest unrealised contributors: ${winners.map((item) => `${item.ticker} ${money(item.unrealizedPnl)}`).join(", ")}.${sourceTag(pSource)}`
          : "There are no positive unrealised contributors in the current ledger.",
        detractors.length
          ? `Largest unrealised detractors: ${detractors.map((item) => `${item.ticker} ${money(item.unrealizedPnl)}`).join(", ")}.${sourceTag(pSource)}`
          : "There are no negative unrealised detractors in the current ledger.",
      ].join("\n\n");
      summary = `Recorded return ${pct(snapshot.totalReturnPct)}; XIRR ${pct(snapshot.xirrPct)}.`;
      keyPoints.push(...winners.map((item) => `${item.ticker}: ${money(item.unrealizedPnl)}`));
      unknowns.push(
        "Benchmark attribution, factor attribution and time-series risk metrics are unavailable until historical market data is connected.",
      );
      citations.push(...citation(pSource, "Portfolio return and holding-level unrealised P&L."));
    }
  } else if (input.mode === "research_gap") {
    const incomplete = [...research]
      .sort((a, b) => (a.completenessScore ?? 0) - (b.completenessScore ?? 0))
      .slice(0, 8);
    if (!incomplete.length) {
      answer = "No research workspaces were selected or available for a gap review.";
      unknowns.push("Research coverage is unavailable.");
    } else {
      answer = incomplete
        .map((item) => {
          const source = researchSourceId(input.sources, item.ticker);
          citations.push(...citation(source, `${item.ticker} research completeness and missing sections.`));
          return `${item.ticker}: ${item.completenessScore ?? 0}/100 — ${(item.missing ?? []).slice(0, 4).join(", ") || "no missing sections reported"}.${sourceTag(source)}`;
        })
        .join("\n");
      summary = `${incomplete.length} research workspace(s) reviewed for documentation gaps.`;
      keyPoints.push(
        ...incomplete.map(
          (item) => `${item.ticker}: ${item.completenessScore ?? 0}/100`,
        ),
      );
    }
  } else if (input.mode === "company_compare") {
    const selected = research.slice(0, 4);
    if (selected.length < 2) {
      answer = "Select at least two covered companies to run a grounded comparison.";
      unknowns.push("Fewer than two company research workspaces were supplied.");
    } else {
      answer = selected
        .map((item) => {
          const source = researchSourceId(input.sources, item.ticker);
          const thesis = item.thesis;
          citations.push(...citation(source, `${item.ticker} thesis, valuation and research completeness.`));
          return `${item.ticker}: conviction ${thesis?.conviction ?? "not set"}, thesis ${thesis?.status ?? "draft"}, target ${money(thesis?.targetPrice)}, expected return ${pct(thesis?.expectedReturnPct)}, completeness ${item.completenessScore ?? 0}/100.${sourceTag(source)}`;
        })
        .join("\n\n");
      summary = `Compared ${selected.map((item) => item.ticker).join(" and ")} using saved AlphaDesk research only.`;
      unknowns.push(
        "This comparison excludes fresh market news, consensus estimates and live valuation multiples unless they are already saved in AlphaDesk.",
      );
    }
  } else {
    const item = research[0];
    if (!item) {
      answer =
        "Select a covered company or mention a ticker that exists in your portfolio or Research Engine.";
      unknowns.push("No company research context was supplied.");
    } else {
      const source = researchSourceId(input.sources, item.ticker);
      const thesis = item.thesis;
      citations.push(...citation(source, `${item.ticker} saved investment thesis and monitoring framework.`));
      if (input.mode === "thesis_challenge") {
        const missing = item.missing ?? [];
        const invalidations = item.invalidationTriggers ?? [];
        const savedRisks = item.risks ?? [];
        answer = [
          `The saved thesis for ${item.ticker} is ${thesis?.status ?? "draft"} with ${thesis?.conviction ?? "unset"} conviction.${sourceTag(source)}`,
          thesis?.bearCase
            ? `Saved bear case: ${thesis.bearCase}${sourceTag(source)}`
            : `No bear case is documented.${sourceTag(source)}`,
          invalidations.length
            ? `${invalidations.length} invalidation trigger(s) are recorded.${sourceTag(source)}`
            : `No explicit invalidation trigger is recorded.${sourceTag(source)}`,
          savedRisks.length
            ? `${savedRisks.length} material risk(s) are being monitored.${sourceTag(source)}`
            : `No material risks are documented.${sourceTag(source)}`,
          missing.length
            ? `Documentation gaps: ${missing.slice(0, 6).join(", ")}.${sourceTag(source)}`
            : `The completeness framework reports no missing sections.${sourceTag(source)}`,
        ].join("\n\n");
        summary = `${item.ticker} thesis challenged using saved bear case, risks, invalidations and completeness gaps.`;
        risks.push(
          ...savedRisks
            .map((risk) => String(risk.title ?? risk.description ?? ""))
            .filter(Boolean)
            .slice(0, 6),
        );
      } else {
        answer = [
          `${item.ticker} is tracked with ${thesis?.conviction ?? "unset"} conviction and thesis status ${thesis?.status ?? "draft"}.${sourceTag(source)}`,
          thesis?.summary
            ? `${thesis.summary}${sourceTag(source)}`
            : `No core thesis summary is saved.${sourceTag(source)}`,
          `Target price is ${money(thesis?.targetPrice)}, expected return is ${pct(thesis?.expectedReturnPct)}, and maximum acceptable loss is ${pct(thesis?.maxAcceptableLossPct)}.${sourceTag(source)}`,
          `Research completeness is ${item.completenessScore ?? 0}/100.${sourceTag(source)}`,
        ].join("\n\n");
        summary = `${item.ticker} company analysis based on saved AlphaDesk research.`;
      }
    }
  }

  if (!input.sources.length) {
    unknowns.push("No grounded AlphaDesk sources were available for this answer.");
  }

  return sanitizeGeneratedAnswer(
    {
      answer,
      summary,
      keyPoints,
      risks,
      unknowns,
      suggestedNextQuestions: [
        "What evidence would invalidate this conclusion?",
        "Which saved assumptions have not been reviewed recently?",
        "What data is missing before making a decision?",
      ],
      citations,
      memoryCandidates: [],
    },
    input.sources,
  );
}
