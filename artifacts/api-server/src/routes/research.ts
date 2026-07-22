import { db, decisionJournalTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { Router, type Request, type Response } from "express";

import {
  researchService,
  type CatalystInput,
  type CreateResearchCompanyInput,
  type InvalidationInput,
  type NoteInput,
  type ResearchConviction,
  type ResearchImpact,
  type ResearchItemStatus,
  type ResearchNoteCategory,
  type ResearchProbability,
  type ResearchScenario,
  type RiskInput,
  type SaveThesisInput,
  type ThesisStatus,
  type UpdateResearchCompanyInput,
  type ValuationAssumptionInput,
} from "../services/research/researchService";

const router = Router();

type AuthenticatedHandler = (
  req: Request,
  res: Response,
  userId: string,
) => Promise<void>;

function authenticated(handler: AuthenticatedHandler) {
  return async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Sign in to use the research engine" });
      return;
    }
    try {
      await handler(req, res, req.user.id);
    } catch (error) {
      sendError(res, error);
    }
  };
}

function sendError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = /not found/i.test(message)
    ? 404
    : /required|invalid|unsupported|must|contains/i.test(message)
      ? 400
      : 500;
  res.status(status).json({ error: message });
}

function body(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}

function requiredText(value: unknown, field: string): string {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${field} is required`);
  return result;
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return String(value).trim() || null;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const result = Number(value);
  if (!Number.isFinite(result))
    throw new Error(`Invalid number: ${String(value)}`);
  return result;
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid boolean: ${String(value)}`);
}

function optionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const result = new Date(String(value));
  if (Number.isNaN(result.getTime()))
    throw new Error(`Invalid date: ${String(value)}`);
  return result;
}

function positiveId(value: unknown): number {
  const result = Number(value);
  if (!Number.isInteger(result) || result <= 0)
    throw new Error("id must be a positive integer");
  return result;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined) return undefined;
  const result = String(value) as T;
  if (!allowed.includes(result)) {
    throw new Error(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return result;
}

const CONVICTIONS = ["high", "medium", "low", "watch"] as const;
const THESIS_STATUSES = [
  "draft",
  "intact",
  "monitoring",
  "weakening",
  "broken",
  "closed",
] as const;
const IMPACTS = ["high", "medium", "low"] as const;
const PROBABILITIES = ["high", "medium", "low"] as const;
const ITEM_STATUSES = [
  "active",
  "monitoring",
  "triggered",
  "resolved",
  "archived",
] as const;
const NOTE_CATEGORIES = [
  "thesis",
  "financials",
  "valuation",
  "management",
  "industry",
  "earnings",
  "risk",
  "catalyst",
  "general",
] as const;
const SCENARIOS = ["common", "bull", "base", "bear"] as const;

function parseCompanyInput(
  raw: Record<string, unknown>,
): CreateResearchCompanyInput {
  return {
    ticker: requiredText(raw.ticker, "ticker"),
    name: optionalText(raw.name),
    exchange: optionalText(raw.exchange),
    sector: optionalText(raw.sector),
    industry: optionalText(raw.industry),
    description: optionalText(raw.description),
    website: optionalText(raw.website),
    marketCap: optionalNumber(raw.marketCap),
    currentPrice: optionalNumber(raw.currentPrice),
    previousClose: optionalNumber(raw.previousClose),
    pe: optionalNumber(raw.pe),
  };
}

function parseCompanyPatch(
  raw: Record<string, unknown>,
): UpdateResearchCompanyInput {
  return {
    name: optionalText(raw.name),
    exchange: optionalText(raw.exchange),
    sector: optionalText(raw.sector),
    industry: optionalText(raw.industry),
    description: optionalText(raw.description),
    website: optionalText(raw.website),
    marketCap: optionalNumber(raw.marketCap),
    currentPrice: optionalNumber(raw.currentPrice),
    previousClose: optionalNumber(raw.previousClose),
    pe: optionalNumber(raw.pe),
    isArchived: optionalBoolean(raw.isArchived),
  };
}

function parseThesis(raw: Record<string, unknown>): SaveThesisInput {
  const keyAssumptions =
    raw.keyAssumptions === undefined
      ? undefined
      : Array.isArray(raw.keyAssumptions)
        ? raw.keyAssumptions
            .map((value) => String(value).trim())
            .filter(Boolean)
        : String(raw.keyAssumptions)
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean);
  return {
    summary: optionalText(raw.summary),
    bullCase: optionalText(raw.bullCase),
    baseCase: optionalText(raw.baseCase),
    bearCase: optionalText(raw.bearCase),
    conviction: enumValue(raw.conviction, CONVICTIONS, "conviction") as
      ResearchConviction | undefined,
    status: enumValue(raw.status, THESIS_STATUSES, "status") as
      ThesisStatus | undefined,
    moatRating: optionalText(raw.moatRating),
    managementRating: optionalText(raw.managementRating),
    investmentHorizon: optionalText(raw.investmentHorizon),
    expectedReturnPct: optionalNumber(raw.expectedReturnPct),
    maxAcceptableLossPct: optionalNumber(raw.maxAcceptableLossPct),
    targetPrice: optionalNumber(raw.targetPrice),
    bullPrice: optionalNumber(raw.bullPrice),
    basePrice: optionalNumber(raw.basePrice),
    bearPrice: optionalNumber(raw.bearPrice),
    valuationMethodology: optionalText(raw.valuationMethodology),
    keyAssumptions,
    lastReviewedAt: optionalDate(raw.lastReviewedAt),
    nextReviewAt: optionalDate(raw.nextReviewAt),
  };
}

function parseNote(
  raw: Record<string, unknown>,
  partial = false,
): Partial<NoteInput> {
  return {
    ...(partial && raw.title === undefined
      ? {}
      : { title: requiredText(raw.title, "title") }),
    ...(partial && raw.content === undefined
      ? {}
      : { content: requiredText(raw.content, "content") }),
    category: enumValue(raw.category, NOTE_CATEGORIES, "category") as
      ResearchNoteCategory | undefined,
    sourceLabel: optionalText(raw.sourceLabel),
    sourceUrl: optionalText(raw.sourceUrl),
    eventDate: optionalDate(raw.eventDate),
    isPinned: optionalBoolean(raw.isPinned),
  };
}

function parseCatalyst(
  raw: Record<string, unknown>,
  partial = false,
): Partial<CatalystInput> {
  return {
    ...(partial && raw.title === undefined
      ? {}
      : { title: requiredText(raw.title, "title") }),
    description: optionalText(raw.description),
    expectedDate: optionalDate(raw.expectedDate),
    impact: enumValue(raw.impact, IMPACTS, "impact") as
      ResearchImpact | undefined,
    probability: enumValue(raw.probability, PROBABILITIES, "probability") as
      ResearchProbability | undefined,
    status: enumValue(raw.status, ITEM_STATUSES, "status") as
      ResearchItemStatus | undefined,
  };
}

function parseRisk(
  raw: Record<string, unknown>,
  partial = false,
): Partial<RiskInput> {
  return {
    ...(partial && raw.title === undefined
      ? {}
      : { title: requiredText(raw.title, "title") }),
    description: optionalText(raw.description),
    severity: enumValue(raw.severity, IMPACTS, "severity") as
      ResearchImpact | undefined,
    probability: enumValue(raw.probability, PROBABILITIES, "probability") as
      ResearchProbability | undefined,
    mitigation: optionalText(raw.mitigation),
    status: enumValue(raw.status, ITEM_STATUSES, "status") as
      ResearchItemStatus | undefined,
  };
}

function parseInvalidation(
  raw: Record<string, unknown>,
  partial = false,
): Partial<InvalidationInput> {
  return {
    ...(partial && raw.trigger === undefined
      ? {}
      : { trigger: requiredText(raw.trigger, "trigger") }),
    description: optionalText(raw.description),
    severity: enumValue(raw.severity, IMPACTS, "severity") as
      ResearchImpact | undefined,
    metricName: optionalText(raw.metricName),
    operator: optionalText(raw.operator),
    threshold: optionalNumber(raw.threshold),
    unit: optionalText(raw.unit),
    currentValue: optionalNumber(raw.currentValue),
    status: enumValue(raw.status, ITEM_STATUSES, "status") as
      ResearchItemStatus | undefined,
    triggeredAt: optionalDate(raw.triggeredAt),
  };
}

function parseAssumption(
  raw: Record<string, unknown>,
  partial = false,
): Partial<ValuationAssumptionInput> {
  return {
    ...(partial && raw.label === undefined
      ? {}
      : { label: requiredText(raw.label, "label") }),
    ...(partial && raw.value === undefined
      ? {}
      : { value: requiredText(raw.value, "value") }),
    unit: optionalText(raw.unit),
    scenario: enumValue(raw.scenario, SCENARIOS, "scenario") as
      ResearchScenario | undefined,
    notes: optionalText(raw.notes),
    sortOrder:
      raw.sortOrder === undefined
        ? undefined
        : Number(optionalNumber(raw.sortOrder) ?? 0),
  };
}

router.get(
  "/companies",
  authenticated(async (req, res, userId) => {
    res.json(
      await researchService.listCompanies(userId, {
        query:
          typeof req.query.query === "string" ? req.query.query : undefined,
        status:
          typeof req.query.status === "string" ? req.query.status : undefined,
        conviction:
          typeof req.query.conviction === "string"
            ? req.query.conviction
            : undefined,
        holdingsOnly: req.query.holdingsOnly === "true",
        archived: req.query.archived === "true",
      }),
    );
  }),
);

router.post(
  "/companies",
  authenticated(async (req, res, userId) => {
    res
      .status(201)
      .json(
        await researchService.createCompany(
          userId,
          parseCompanyInput(body(req)),
        ),
      );
  }),
);

router.get(
  "/companies/:ticker",
  authenticated(async (req, res, userId) => {
    res.json(await researchService.getWorkspace(userId, req.params.ticker));
  }),
);

router.patch(
  "/companies/:ticker",
  authenticated(async (req, res, userId) => {
    res.json(
      await researchService.updateCompany(
        userId,
        req.params.ticker,
        parseCompanyPatch(body(req)),
      ),
    );
  }),
);

router.put(
  "/companies/:ticker/thesis",
  authenticated(async (req, res, userId) => {
    res.json(
      await researchService.saveThesis(
        userId,
        req.params.ticker,
        parseThesis(body(req)),
      ),
    );
  }),
);

router.post(
  "/companies/:ticker/notes",
  authenticated(async (req, res, userId) => {
    res
      .status(201)
      .json(
        await researchService.createNote(
          userId,
          req.params.ticker,
          parseNote(body(req)) as NoteInput,
        ),
      );
  }),
);

router.patch(
  "/notes/:id",
  authenticated(async (req, res, userId) => {
    res.json(
      await researchService.updateNote(
        userId,
        positiveId(req.params.id),
        parseNote(body(req), true),
      ),
    );
  }),
);

router.delete(
  "/notes/:id",
  authenticated(async (req, res, userId) => {
    res.json(
      await researchService.deleteNote(userId, positiveId(req.params.id)),
    );
  }),
);

router.post(
  "/companies/:ticker/catalysts",
  authenticated(async (req, res, userId) => {
    res
      .status(201)
      .json(
        await researchService.createCatalyst(
          userId,
          req.params.ticker,
          parseCatalyst(body(req)) as CatalystInput,
        ),
      );
  }),
);

router.patch(
  "/catalysts/:id",
  authenticated(async (req, res, userId) => {
    res.json(
      await researchService.updateCatalyst(
        userId,
        positiveId(req.params.id),
        parseCatalyst(body(req), true),
      ),
    );
  }),
);

router.delete(
  "/catalysts/:id",
  authenticated(async (req, res, userId) => {
    res.json(
      await researchService.deleteCatalyst(userId, positiveId(req.params.id)),
    );
  }),
);

router.post(
  "/companies/:ticker/risks",
  authenticated(async (req, res, userId) => {
    res
      .status(201)
      .json(
        await researchService.createRisk(
          userId,
          req.params.ticker,
          parseRisk(body(req)) as RiskInput,
        ),
      );
  }),
);

router.patch(
  "/risks/:id",
  authenticated(async (req, res, userId) => {
    res.json(
      await researchService.updateRisk(
        userId,
        positiveId(req.params.id),
        parseRisk(body(req), true),
      ),
    );
  }),
);

router.delete(
  "/risks/:id",
  authenticated(async (req, res, userId) => {
    res.json(
      await researchService.deleteRisk(userId, positiveId(req.params.id)),
    );
  }),
);

router.post(
  "/companies/:ticker/invalidation-triggers",
  authenticated(async (req, res, userId) => {
    res
      .status(201)
      .json(
        await researchService.createInvalidation(
          userId,
          req.params.ticker,
          parseInvalidation(body(req)) as InvalidationInput,
        ),
      );
  }),
);

router.patch(
  "/invalidation-triggers/:id",
  authenticated(async (req, res, userId) => {
    res.json(
      await researchService.updateInvalidation(
        userId,
        positiveId(req.params.id),
        parseInvalidation(body(req), true),
      ),
    );
  }),
);

router.delete(
  "/invalidation-triggers/:id",
  authenticated(async (req, res, userId) => {
    res.json(
      await researchService.deleteInvalidation(
        userId,
        positiveId(req.params.id),
      ),
    );
  }),
);

router.post(
  "/companies/:ticker/valuation-assumptions",
  authenticated(async (req, res, userId) => {
    res
      .status(201)
      .json(
        await researchService.createValuationAssumption(
          userId,
          req.params.ticker,
          parseAssumption(body(req)) as ValuationAssumptionInput,
        ),
      );
  }),
);

router.patch(
  "/valuation-assumptions/:id",
  authenticated(async (req, res, userId) => {
    res.json(
      await researchService.updateValuationAssumption(
        userId,
        positiveId(req.params.id),
        parseAssumption(body(req), true),
      ),
    );
  }),
);

router.delete(
  "/valuation-assumptions/:id",
  authenticated(async (req, res, userId) => {
    res.json(
      await researchService.deleteValuationAssumption(
        userId,
        positiveId(req.params.id),
      ),
    );
  }),
);

// Retained for compatibility until the dedicated Journal phase replaces it.
router.get(
  "/decision-journal",
  authenticated(async (_req, res, userId) => {
    const entries = await db
      .select()
      .from(decisionJournalTable)
      .where(eq(decisionJournalTable.userId, userId))
      .orderBy(desc(decisionJournalTable.createdAt));
    res.json(entries);
  }),
);

router.post(
  "/decision-journal",
  authenticated(async (req, res, userId) => {
    const raw = body(req);
    const [entry] = await db
      .insert(decisionJournalTable)
      .values({
        userId,
        ticker: requiredText(raw.ticker, "ticker").toUpperCase(),
        name: optionalText(raw.name),
        action: requiredText(raw.action, "action"),
        date: optionalText(raw.date) ?? new Date().toISOString().slice(0, 10),
        rationale: optionalText(raw.rationale),
        outcome: optionalText(raw.outcome),
        pnl: optionalText(raw.pnl),
        learnings: optionalText(raw.learnings),
      })
      .returning();
    res.status(201).json(entry);
  }),
);

export default router;
