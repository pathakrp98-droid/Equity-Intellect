export interface CompletenessCompany {
  name?: string | null;
  sector?: string | null;
  description?: string | null;
}

export interface CompletenessThesis {
  summary?: string | null;
  bullCase?: string | null;
  baseCase?: string | null;
  bearCase?: string | null;
  conviction?: string | null;
  status?: string | null;
  valuationMethodology?: string | null;
  bullPrice?: number | null;
  basePrice?: number | null;
  bearPrice?: number | null;
  keyAssumptions?: string[] | null;
  nextReviewAt?: Date | string | null;
}

export interface ResearchCompletenessInput {
  company: CompletenessCompany;
  thesis?: CompletenessThesis | null;
  noteCount?: number;
  catalystCount?: number;
  riskCount?: number;
  invalidationCount?: number;
  valuationAssumptionCount?: number;
}

export interface ResearchCompletenessResult {
  score: number;
  band: "empty" | "early" | "developing" | "decision_ready" | "complete";
  sections: Array<{
    key: string;
    label: string;
    score: number;
    maxScore: number;
    complete: boolean;
  }>;
  missing: string[];
}

function hasText(value: unknown, minimum = 1): boolean {
  return typeof value === "string" && value.trim().length >= minimum;
}

export function calculateResearchCompleteness(
  input: ResearchCompletenessInput,
): ResearchCompletenessResult {
  const thesis = input.thesis;
  const sections: ResearchCompletenessResult["sections"] = [];
  const missing: string[] = [];

  function section(
    key: string,
    label: string,
    score: number,
    maxScore: number,
    missingLabel?: string,
  ) {
    const bounded = Math.max(0, Math.min(maxScore, score));
    sections.push({
      key,
      label,
      score: bounded,
      maxScore,
      complete: bounded >= maxScore,
    });
    if (bounded < maxScore && missingLabel) missing.push(missingLabel);
  }

  let profileScore = 0;
  if (hasText(input.company.name)) profileScore += 3;
  if (hasText(input.company.sector)) profileScore += 3;
  if (hasText(input.company.description, 30)) profileScore += 4;
  section(
    "profile",
    "Company profile",
    profileScore,
    10,
    "Complete the company profile",
  );

  section(
    "summary",
    "Core thesis",
    hasText(thesis?.summary, 50) ? 15 : hasText(thesis?.summary, 10) ? 8 : 0,
    15,
    "Write a clear core investment thesis",
  );

  const scenarioCount = [
    thesis?.bullCase,
    thesis?.baseCase,
    thesis?.bearCase,
  ].filter((value) => hasText(value, 30)).length;
  section(
    "scenarios",
    "Bull, base and bear cases",
    scenarioCount * 5,
    15,
    "Complete bull, base and bear cases",
  );

  let decisionScore = 0;
  if (thesis?.conviction && thesis.conviction !== "watch") decisionScore += 2;
  if (thesis?.status && thesis.status !== "draft") decisionScore += 2;
  if (thesis?.nextReviewAt) decisionScore += 1;
  section(
    "decision",
    "Decision framing",
    decisionScore,
    5,
    "Set conviction, thesis status and next review date",
  );

  let valuationScore = 0;
  if (hasText(thesis?.valuationMethodology, 10)) valuationScore += 5;
  if (typeof thesis?.basePrice === "number" && thesis.basePrice > 0)
    valuationScore += 4;
  if (typeof thesis?.bullPrice === "number" && thesis.bullPrice > 0)
    valuationScore += 3;
  if (typeof thesis?.bearPrice === "number" && thesis.bearPrice > 0)
    valuationScore += 3;
  section(
    "valuation",
    "Valuation framework",
    valuationScore,
    15,
    "Add valuation methodology and scenario prices",
  );

  const assumptionCount = Math.max(
    thesis?.keyAssumptions?.filter((item) => hasText(item)).length ?? 0,
    input.valuationAssumptionCount ?? 0,
  );
  section(
    "assumptions",
    "Key assumptions",
    Math.min(10, assumptionCount * 2),
    10,
    "Document at least five key assumptions",
  );

  section(
    "risks",
    "Risks",
    Math.min(8, (input.riskCount ?? 0) * 2),
    8,
    "Document at least four material risks",
  );

  section(
    "catalysts",
    "Catalysts",
    Math.min(8, (input.catalystCount ?? 0) * 2.67),
    8,
    "Document at least three catalysts",
  );

  section(
    "invalidation",
    "Invalidation triggers",
    Math.min(9, (input.invalidationCount ?? 0) * 3),
    9,
    "Define at least three thesis invalidation triggers",
  );

  section(
    "notes",
    "Research evidence",
    Math.min(5, (input.noteCount ?? 0) * 1.25),
    5,
    "Add at least four sourced research notes",
  );

  const score = Math.round(
    sections.reduce((total, item) => total + item.score, 0),
  );
  const band =
    score >= 90
      ? "complete"
      : score >= 75
        ? "decision_ready"
        : score >= 50
          ? "developing"
          : score > 0
            ? "early"
            : "empty";

  return { score, band, sections, missing };
}
