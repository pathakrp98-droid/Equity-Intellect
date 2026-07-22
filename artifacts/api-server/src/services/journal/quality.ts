export interface DecisionQualityInput {
  rationale?: string | null;
  thesisSummary?: string | null;
  expectedReturnPct?: number | null;
  expectedDownsidePct?: number | null;
  targetPrice?: number | null;
  bearPrice?: number | null;
  investmentHorizon?: string | null;
  confidenceScore?: number | null;
  evidenceQuality?: string | null;
  keyFactors?: string[] | null;
  contraryEvidence?: string[] | null;
  sourceReferences?: Array<{
    id?: string;
    label?: string;
    url?: string | null;
  }> | null;
  nextReviewAt?: string | Date | null;
  guardianCheckId?: string | null;
  researchCompanyId?: number | null;
  lessonsLearned?: string | null;
  outcomeNotes?: string | null;
  outcome?: string | null;
}

export interface DecisionQualityBreakdown {
  total: number;
  band: "weak" | "developing" | "disciplined" | "excellent";
  documentation: number;
  quantification: number;
  evidenceBalance: number;
  reviewPlan: number;
  processIntegrity: number;
  learning: number;
  missing: string[];
}

function hasText(value: string | null | undefined, minimum: number): boolean {
  return typeof value === "string" && value.trim().length >= minimum;
}

function finite(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateDecisionQuality(
  input: DecisionQualityInput,
): DecisionQualityBreakdown {
  const missing: string[] = [];

  let documentation = 0;
  if (hasText(input.rationale, 40)) documentation += 10;
  else missing.push("Detailed rationale");
  if (hasText(input.thesisSummary, 25)) documentation += 5;
  else missing.push("Thesis summary");
  if (hasText(input.investmentHorizon, 3)) documentation += 5;
  else missing.push("Investment horizon");

  let quantification = 0;
  if (finite(input.expectedReturnPct)) quantification += 5;
  else missing.push("Expected return");
  if (finite(input.expectedDownsidePct)) quantification += 5;
  else missing.push("Expected downside");
  if (finite(input.targetPrice)) quantification += 5;
  else missing.push("Target price");
  if (finite(input.bearPrice)) quantification += 5;
  else missing.push("Bear price");

  let evidenceBalance = 0;
  const keyFactors = input.keyFactors?.filter((item) => item.trim()) ?? [];
  const contrary = input.contraryEvidence?.filter((item) => item.trim()) ?? [];
  const sources =
    input.sourceReferences?.filter((item) => item.label?.trim()) ?? [];
  if (keyFactors.length >= 2) evidenceBalance += 7;
  else missing.push("At least two supporting factors");
  if (contrary.length >= 1) evidenceBalance += 7;
  else missing.push("Contrary evidence");
  if (sources.length >= 1) evidenceBalance += 6;
  else missing.push("Cited source");

  let reviewPlan = 0;
  if (input.nextReviewAt) reviewPlan += 10;
  else missing.push("Next review date");
  if (
    typeof input.confidenceScore === "number" &&
    input.confidenceScore >= 1 &&
    input.confidenceScore <= 5
  ) {
    reviewPlan += 5;
  } else {
    missing.push("Confidence score");
  }

  let processIntegrity = 0;
  if (input.guardianCheckId) processIntegrity += 8;
  else missing.push("Guardian review link");
  if (input.researchCompanyId) processIntegrity += 7;
  else missing.push("Research workspace link");

  let learning = 0;
  if (input.outcome && input.outcome !== "pending") {
    if (hasText(input.outcomeNotes, 20)) learning += 5;
    else missing.push("Outcome explanation");
    if (hasText(input.lessonsLearned, 20)) learning += 5;
    else missing.push("Lessons learned");
  } else {
    learning = 5;
  }

  const total = Math.round(
    clamp(
      documentation +
        quantification +
        evidenceBalance +
        reviewPlan +
        processIntegrity +
        learning,
    ),
  );
  const band =
    total >= 85
      ? "excellent"
      : total >= 70
        ? "disciplined"
        : total >= 50
          ? "developing"
          : "weak";

  return {
    total,
    band,
    documentation,
    quantification,
    evidenceBalance,
    reviewPlan,
    processIntegrity,
    learning,
    missing,
  };
}

export interface ReviewQualityInput {
  whatChanged?: string | null;
  evidenceFor?: string | null;
  evidenceAgainst?: string | null;
  thesisStatusAfter?: string | null;
  convictionAfter?: string | null;
  actionAfterReview?: string | null;
  notes?: string | null;
}

export function calculateReviewQuality(input: ReviewQualityInput): number {
  let score = 0;
  if (hasText(input.whatChanged, 20)) score += 25;
  if (hasText(input.evidenceFor, 15)) score += 20;
  if (hasText(input.evidenceAgainst, 15)) score += 20;
  if (hasText(input.thesisStatusAfter, 3)) score += 10;
  if (hasText(input.convictionAfter, 3)) score += 10;
  if (input.actionAfterReview && input.actionAfterReview !== "no_change")
    score += 10;
  else if (input.actionAfterReview === "no_change") score += 5;
  if (hasText(input.notes, 10)) score += 5;
  return clamp(score);
}

export interface AnalyticsEntry {
  qualityScore: number;
  emotionalState: string;
  outcome: string;
  actualReturnPct?: number | null;
  lessonsLearned?: string | null;
  decisionType: string;
}

export interface AnalyticsReview {
  status: string;
  scheduledFor: string | Date;
  completedAt?: string | Date | null;
  reviewQualityScore?: number | null;
}

export function summarizeDecisionAnalytics(
  entries: AnalyticsEntry[],
  reviews: AnalyticsReview[],
  now = new Date(),
) {
  const completedOutcomes = entries.filter(
    (entry) => entry.outcome !== "pending",
  );
  const wins = completedOutcomes.filter((entry) => entry.outcome === "win");
  const returns = completedOutcomes
    .map((entry) => entry.actualReturnPct)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
  const completedReviews = reviews.filter(
    (review) => review.status === "completed",
  );
  const overdueReviews = reviews.filter(
    (review) =>
      review.status === "due" &&
      new Date(review.scheduledFor).getTime() < now.getTime(),
  );
  const emotional = new Map<
    string,
    { count: number; wins: number; returns: number[] }
  >();
  for (const entry of entries) {
    const bucket = emotional.get(entry.emotionalState) ?? {
      count: 0,
      wins: 0,
      returns: [],
    };
    bucket.count += 1;
    if (entry.outcome === "win") bucket.wins += 1;
    if (typeof entry.actualReturnPct === "number")
      bucket.returns.push(entry.actualReturnPct);
    emotional.set(entry.emotionalState, bucket);
  }

  const emotionalPatterns = [...emotional.entries()]
    .map(([emotion, value]) => ({
      emotion,
      count: value.count,
      winRatePct: value.count ? (value.wins / value.count) * 100 : 0,
      averageReturnPct: value.returns.length
        ? value.returns.reduce((sum, item) => sum + item, 0) /
          value.returns.length
        : null,
    }))
    .sort((a, b) => b.count - a.count);

  const average = (values: number[]) =>
    values.length
      ? values.reduce((sum, item) => sum + item, 0) / values.length
      : 0;

  return {
    totalDecisions: entries.length,
    openDecisions: entries.filter((entry) => entry.outcome === "pending")
      .length,
    completedOutcomes: completedOutcomes.length,
    winRatePct: completedOutcomes.length
      ? (wins.length / completedOutcomes.length) * 100
      : 0,
    averageActualReturnPct: average(returns),
    averageDecisionQuality: average(entries.map((entry) => entry.qualityScore)),
    reviewCompletionPct: reviews.length
      ? (completedReviews.length / reviews.length) * 100
      : 0,
    overdueReviewCount: overdueReviews.length,
    averageReviewQuality: average(
      completedReviews
        .map((review) => review.reviewQualityScore)
        .filter((value): value is number => typeof value === "number"),
    ),
    lessonsCapturedPct: completedOutcomes.length
      ? (completedOutcomes.filter((entry) => hasText(entry.lessonsLearned, 20))
          .length /
          completedOutcomes.length) *
        100
      : 0,
    emotionalPatterns,
  };
}
