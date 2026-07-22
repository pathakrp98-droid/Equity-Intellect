import {
  db,
  decisionJournalEntriesTable,
  decisionJournalReviewsTable,
  decisionQualitySnapshotsTable,
  guardianDecisionPacketsTable,
  portfolioTransactionsTable,
  portfoliosTable,
  researchCompaniesTable,
  type JournalSourceReference,
} from "@workspace/db";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";

import {
  calculateDecisionQuality,
  calculateReviewQuality,
  summarizeDecisionAnalytics,
} from "./quality";

const DECISION_TYPES = new Set([
  "buy",
  "add",
  "sell",
  "trim",
  "hold",
  "review",
  "avoid",
]);
const DECISION_STATUSES = new Set([
  "planned",
  "executed",
  "cancelled",
  "closed",
]);
const EMOTIONS = new Set([
  "confident",
  "calm",
  "neutral",
  "uncertain",
  "anxious",
  "fearful",
  "greedy",
  "frustrated",
]);
const OUTCOMES = new Set(["pending", "win", "loss", "mixed", "unknown"]);
const REVIEW_TYPES = new Set([
  "scheduled",
  "earnings",
  "event",
  "thesis_break",
  "manual",
]);
const REVIEW_ACTIONS = new Set([
  "no_change",
  "hold",
  "add",
  "trim",
  "exit",
  "research_more",
]);

export interface JournalEntryInput {
  portfolioId?: number | null;
  researchCompanyId?: number | null;
  transactionId?: number | null;
  guardianCheckId?: string | null;
  ticker: string;
  name?: string | null;
  decisionType: string;
  status?: string;
  decisionDate?: string | Date;
  executionPrice?: number | null;
  quantity?: number | null;
  thesisSummary?: string | null;
  rationale: string;
  expectedReturnPct?: number | null;
  expectedDownsidePct?: number | null;
  targetPrice?: number | null;
  bearPrice?: number | null;
  investmentHorizon?: string | null;
  emotionalState?: string;
  confidenceScore?: number;
  evidenceQuality?: string;
  keyFactors?: string[];
  contraryEvidence?: string[];
  sourceReferences?: JournalSourceReference[];
  nextReviewAt?: string | Date | null;
  outcome?: string;
  actualReturnPct?: number | null;
  outcomeNotes?: string | null;
  lessonsLearned?: string | null;
  isArchived?: boolean;
}

export interface JournalReviewInput {
  reviewType?: string;
  scheduledFor?: string | Date;
  currentPrice?: number | null;
  thesisStatusBefore?: string | null;
  thesisStatusAfter?: string | null;
  convictionBefore?: string | null;
  convictionAfter?: string | null;
  whatChanged?: string | null;
  evidenceFor?: string | null;
  evidenceAgainst?: string | null;
  actionAfterReview?: string;
  notes?: string | null;
  nextReviewAt?: string | Date | null;
  outcome?: string;
  outcomeNotes?: string | null;
  lessonsLearned?: string | null;
}

function normalizeTicker(value: string): string {
  const ticker = value.trim().toUpperCase();
  if (!/^[A-Z0-9.&_-]{1,30}$/.test(ticker)) {
    throw new Error("ticker contains unsupported characters");
  }
  return ticker;
}

function cleanText(value: unknown, maximum = 20_000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maximum) : null;
}

function requiredText(value: unknown, label: string, minimum = 1): string {
  const text = cleanText(value);
  if (!text || text.length < minimum) {
    throw new Error(`${label} is required`);
  }
  return text;
}

function finiteOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("Numeric input is invalid");
  return number;
}

function integerOrNull(value: unknown): number | null {
  const number = finiteOrNull(value);
  return number === null ? null : Math.trunc(number);
}

function parseDate(
  value: string | Date | null | undefined,
  label: string,
): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is invalid`);
  return date;
}

function uniqueTextList(value: unknown, maximum = 20): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.map((item) => cleanText(item, 500)).filter(Boolean) as string[],
    ),
  ].slice(0, maximum);
}

function sourceList(value: unknown): JournalSourceReference[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label = cleanText(row.label, 250);
      if (!label) return null;
      return {
        id: cleanText(row.id, 120) ?? `source-${index + 1}`,
        label,
        url: cleanText(row.url, 1000),
        publishedAt: cleanText(row.publishedAt, 60),
      };
    })
    .filter((item): item is JournalSourceReference => item !== null)
    .slice(0, 50);
}

function enumValue<T extends string>(
  value: unknown,
  allowed: Set<string>,
  fallback: T,
  label: string,
): T {
  const normalized = typeof value === "string" ? value.toLowerCase() : fallback;
  if (!allowed.has(normalized)) throw new Error(`${label} is invalid`);
  return normalized as T;
}

class JournalService {
  private async verifyPortfolio(userId: string, portfolioId: number | null) {
    if (portfolioId === null) return null;
    const [portfolio] = await db
      .select()
      .from(portfoliosTable)
      .where(
        and(
          eq(portfoliosTable.id, portfolioId),
          eq(portfoliosTable.userId, userId),
        ),
      )
      .limit(1);
    if (!portfolio) throw new Error("Portfolio not found");
    return portfolio;
  }

  private async verifyResearchCompany(
    userId: string,
    companyId: number | null,
  ) {
    if (companyId === null) return null;
    const [company] = await db
      .select()
      .from(researchCompaniesTable)
      .where(
        and(
          eq(researchCompaniesTable.id, companyId),
          eq(researchCompaniesTable.userId, userId),
        ),
      )
      .limit(1);
    if (!company) throw new Error("Research company not found");
    return company;
  }

  private async verifyTransaction(
    userId: string,
    transactionId: number | null,
  ) {
    if (transactionId === null) return null;
    const [row] = await db
      .select({
        transaction: portfolioTransactionsTable,
        portfolio: portfoliosTable,
      })
      .from(portfolioTransactionsTable)
      .innerJoin(
        portfoliosTable,
        eq(portfolioTransactionsTable.portfolioId, portfoliosTable.id),
      )
      .where(
        and(
          eq(portfolioTransactionsTable.id, transactionId),
          eq(portfoliosTable.userId, userId),
        ),
      )
      .limit(1);
    if (!row) throw new Error("Transaction not found");
    return row;
  }

  private normalizeEntry(input: JournalEntryInput, partial = false) {
    const ticker = input.ticker ? normalizeTicker(input.ticker) : undefined;
    if (!partial && !ticker) throw new Error("ticker is required");
    const rationale =
      input.rationale !== undefined
        ? requiredText(input.rationale, "rationale", 20)
        : undefined;
    if (!partial && !rationale) throw new Error("rationale is required");
    const confidence =
      input.confidenceScore === undefined
        ? undefined
        : Math.round(Number(input.confidenceScore));
    if (
      confidence !== undefined &&
      (!Number.isFinite(confidence) || confidence < 1 || confidence > 5)
    ) {
      throw new Error("confidenceScore must be between 1 and 5");
    }
    const nextReviewAt =
      input.nextReviewAt === undefined
        ? undefined
        : parseDate(input.nextReviewAt, "nextReviewAt");
    const decisionDate =
      input.decisionDate === undefined
        ? undefined
        : parseDate(input.decisionDate, "decisionDate");
    return {
      ...(ticker ? { ticker } : {}),
      ...(input.name !== undefined ? { name: cleanText(input.name, 180) } : {}),
      ...(input.decisionType !== undefined
        ? {
            decisionType: enumValue(
              input.decisionType,
              DECISION_TYPES,
              "review",
              "decisionType",
            ) as "buy" | "add" | "sell" | "trim" | "hold" | "review" | "avoid",
          }
        : {}),
      ...(input.status !== undefined
        ? {
            status: enumValue(
              input.status,
              DECISION_STATUSES,
              "planned",
              "status",
            ) as "planned" | "executed" | "cancelled" | "closed",
          }
        : {}),
      ...(decisionDate !== undefined
        ? { decisionDate: decisionDate ?? new Date() }
        : {}),
      ...(input.executionPrice !== undefined
        ? { executionPrice: finiteOrNull(input.executionPrice) }
        : {}),
      ...(input.quantity !== undefined
        ? { quantity: finiteOrNull(input.quantity) }
        : {}),
      ...(input.thesisSummary !== undefined
        ? { thesisSummary: cleanText(input.thesisSummary) }
        : {}),
      ...(rationale !== undefined ? { rationale } : {}),
      ...(input.expectedReturnPct !== undefined
        ? { expectedReturnPct: finiteOrNull(input.expectedReturnPct) }
        : {}),
      ...(input.expectedDownsidePct !== undefined
        ? { expectedDownsidePct: finiteOrNull(input.expectedDownsidePct) }
        : {}),
      ...(input.targetPrice !== undefined
        ? { targetPrice: finiteOrNull(input.targetPrice) }
        : {}),
      ...(input.bearPrice !== undefined
        ? { bearPrice: finiteOrNull(input.bearPrice) }
        : {}),
      ...(input.investmentHorizon !== undefined
        ? { investmentHorizon: cleanText(input.investmentHorizon, 120) }
        : {}),
      ...(input.emotionalState !== undefined
        ? {
            emotionalState: enumValue(
              input.emotionalState,
              EMOTIONS,
              "neutral",
              "emotionalState",
            ) as
              | "confident"
              | "calm"
              | "neutral"
              | "uncertain"
              | "anxious"
              | "fearful"
              | "greedy"
              | "frustrated",
          }
        : {}),
      ...(confidence !== undefined ? { confidenceScore: confidence } : {}),
      ...(input.evidenceQuality !== undefined
        ? {
            evidenceQuality: ["high", "medium", "low"].includes(
              String(input.evidenceQuality).toLowerCase(),
            )
              ? String(input.evidenceQuality).toLowerCase()
              : "medium",
          }
        : {}),
      ...(input.keyFactors !== undefined
        ? { keyFactors: uniqueTextList(input.keyFactors) }
        : {}),
      ...(input.contraryEvidence !== undefined
        ? { contraryEvidence: uniqueTextList(input.contraryEvidence) }
        : {}),
      ...(input.sourceReferences !== undefined
        ? { sourceReferences: sourceList(input.sourceReferences) }
        : {}),
      ...(nextReviewAt !== undefined ? { nextReviewAt } : {}),
      ...(input.outcome !== undefined
        ? {
            outcome: enumValue(
              input.outcome,
              OUTCOMES,
              "pending",
              "outcome",
            ) as "pending" | "win" | "loss" | "mixed" | "unknown",
          }
        : {}),
      ...(input.actualReturnPct !== undefined
        ? { actualReturnPct: finiteOrNull(input.actualReturnPct) }
        : {}),
      ...(input.outcomeNotes !== undefined
        ? { outcomeNotes: cleanText(input.outcomeNotes) }
        : {}),
      ...(input.lessonsLearned !== undefined
        ? { lessonsLearned: cleanText(input.lessonsLearned) }
        : {}),
      ...(input.isArchived !== undefined
        ? { isArchived: input.isArchived === true }
        : {}),
    };
  }

  async list(
    userId: string,
    filters: {
      ticker?: string;
      outcome?: string;
      status?: string;
      archived?: boolean;
      limit?: number;
    } = {},
  ) {
    const conditions = [eq(decisionJournalEntriesTable.userId, userId)];
    if (filters.ticker)
      conditions.push(
        eq(decisionJournalEntriesTable.ticker, normalizeTicker(filters.ticker)),
      );
    if (filters.outcome && OUTCOMES.has(filters.outcome)) {
      conditions.push(
        eq(
          decisionJournalEntriesTable.outcome,
          filters.outcome as "pending" | "win" | "loss" | "mixed" | "unknown",
        ),
      );
    }
    if (filters.status && DECISION_STATUSES.has(filters.status)) {
      conditions.push(
        eq(
          decisionJournalEntriesTable.status,
          filters.status as "planned" | "executed" | "cancelled" | "closed",
        ),
      );
    }
    conditions.push(
      eq(decisionJournalEntriesTable.isArchived, filters.archived === true),
    );
    const entries = await db
      .select()
      .from(decisionJournalEntriesTable)
      .where(and(...conditions))
      .orderBy(
        desc(decisionJournalEntriesTable.decisionDate),
        desc(decisionJournalEntriesTable.id),
      )
      .limit(Math.min(500, Math.max(1, Math.trunc(filters.limit ?? 200))));
    if (!entries.length) return [];
    const reviews = await db
      .select()
      .from(decisionJournalReviewsTable)
      .where(eq(decisionJournalReviewsTable.userId, userId))
      .orderBy(desc(decisionJournalReviewsTable.scheduledFor));
    const reviewMap = new Map<number, typeof reviews>();
    for (const review of reviews) {
      const list = reviewMap.get(review.entryId) ?? [];
      list.push(review);
      reviewMap.set(review.entryId, list);
    }
    return entries.map((entry) => {
      const quality = calculateDecisionQuality(entry);
      const entryReviews = reviewMap.get(entry.id) ?? [];
      return {
        ...entry,
        quality,
        reviewCount: entryReviews.length,
        overdueReviewCount: entryReviews.filter(
          (review) =>
            review.status === "due" &&
            review.scheduledFor.getTime() < Date.now(),
        ).length,
        latestReview: entryReviews[0] ?? null,
      };
    });
  }

  async get(userId: string, id: number) {
    const [entry] = await db
      .select()
      .from(decisionJournalEntriesTable)
      .where(
        and(
          eq(decisionJournalEntriesTable.id, id),
          eq(decisionJournalEntriesTable.userId, userId),
        ),
      )
      .limit(1);
    if (!entry) throw new Error("Journal entry not found");
    const reviews = await db
      .select()
      .from(decisionJournalReviewsTable)
      .where(
        and(
          eq(decisionJournalReviewsTable.entryId, id),
          eq(decisionJournalReviewsTable.userId, userId),
        ),
      )
      .orderBy(desc(decisionJournalReviewsTable.scheduledFor));
    return { ...entry, quality: calculateDecisionQuality(entry), reviews };
  }

  async create(userId: string, input: JournalEntryInput) {
    const portfolioId = integerOrNull(input.portfolioId);
    const researchCompanyId = integerOrNull(input.researchCompanyId);
    const transactionId = integerOrNull(input.transactionId);
    const [portfolio, company, transactionRow] = await Promise.all([
      this.verifyPortfolio(userId, portfolioId),
      this.verifyResearchCompany(userId, researchCompanyId),
      this.verifyTransaction(userId, transactionId),
    ]);
    if (
      transactionRow &&
      portfolioId &&
      transactionRow.portfolio.id !== portfolioId
    ) {
      throw new Error("Transaction does not belong to the selected portfolio");
    }
    const normalized = this.normalizeEntry(input);
    const nextReviewAt = normalized.nextReviewAt ?? null;
    return db.transaction(async (tx) => {
      const [entry] = await tx
        .insert(decisionJournalEntriesTable)
        .values({
          userId,
          portfolioId: portfolio?.id ?? transactionRow?.portfolio.id ?? null,
          researchCompanyId: company?.id ?? null,
          transactionId: transactionRow?.transaction.id ?? null,
          guardianCheckId: cleanText(input.guardianCheckId, 64),
          ticker: normalized.ticker!,
          name:
            normalized.name ??
            company?.name ??
            transactionRow?.transaction.name ??
            null,
          decisionType: normalized.decisionType!,
          status:
            normalized.status ?? (transactionRow ? "executed" : "planned"),
          decisionDate:
            normalized.decisionDate ??
            transactionRow?.transaction.tradeDate ??
            new Date(),
          executionPrice:
            normalized.executionPrice ??
            transactionRow?.transaction.price ??
            null,
          quantity:
            normalized.quantity ?? transactionRow?.transaction.quantity ?? null,
          thesisSummary: normalized.thesisSummary ?? null,
          rationale: normalized.rationale!,
          expectedReturnPct: normalized.expectedReturnPct ?? null,
          expectedDownsidePct: normalized.expectedDownsidePct ?? null,
          targetPrice: normalized.targetPrice ?? null,
          bearPrice: normalized.bearPrice ?? null,
          investmentHorizon: normalized.investmentHorizon ?? null,
          emotionalState: normalized.emotionalState ?? "neutral",
          confidenceScore: normalized.confidenceScore ?? 3,
          evidenceQuality: normalized.evidenceQuality ?? "medium",
          keyFactors: normalized.keyFactors ?? [],
          contraryEvidence: normalized.contraryEvidence ?? [],
          sourceReferences: normalized.sourceReferences ?? [],
          nextReviewAt,
          outcome: normalized.outcome ?? "pending",
          actualReturnPct: normalized.actualReturnPct ?? null,
          outcomeNotes: normalized.outcomeNotes ?? null,
          lessonsLearned: normalized.lessonsLearned ?? null,
          isArchived: normalized.isArchived ?? false,
          closedAt: normalized.status === "closed" ? new Date() : null,
          updatedAt: new Date(),
        })
        .returning();
      if (nextReviewAt) {
        await tx.insert(decisionJournalReviewsTable).values({
          entryId: entry.id,
          userId,
          reviewType: "scheduled",
          status: "due",
          scheduledFor: nextReviewAt,
        });
      }
      return { ...entry, quality: calculateDecisionQuality(entry) };
    });
  }

  async createFromGuardian(userId: string, checkId: string) {
    const normalizedCheckId = requiredText(checkId, "checkId");
    const [packet] = await db
      .select()
      .from(guardianDecisionPacketsTable)
      .where(
        and(
          eq(guardianDecisionPacketsTable.userId, userId),
          eq(guardianDecisionPacketsTable.checkId, normalizedCheckId),
        ),
      )
      .limit(1);
    if (!packet) throw new Error("Guardian decision packet not found");
    const existing = await db
      .select({ id: decisionJournalEntriesTable.id })
      .from(decisionJournalEntriesTable)
      .where(
        and(
          eq(decisionJournalEntriesTable.userId, userId),
          eq(decisionJournalEntriesTable.guardianCheckId, normalizedCheckId),
        ),
      )
      .limit(1);
    if (existing[0]) return this.get(userId, existing[0].id);
    const input = packet.input;
    const research = packet.contextSnapshot.research as Record<
      string,
      unknown
    > | null;
    const portfolio = packet.contextSnapshot.portfolio as Record<
      string,
      unknown
    >;
    const reviewAt = new Date(Date.now() + 90 * 86_400_000);
    return this.create(userId, {
      portfolioId: integerOrNull(portfolio.portfolioId),
      researchCompanyId: integerOrNull(research?.companyId),
      guardianCheckId: packet.checkId,
      ticker: packet.ticker,
      name: input.name ?? null,
      decisionType: input.action,
      status: ["executed", "overridden"].includes(packet.status)
        ? "executed"
        : "planned",
      decisionDate: packet.createdAt,
      executionPrice: input.price ?? null,
      quantity: input.quantity ?? null,
      rationale: input.rationale ?? packet.result.summary,
      thesisSummary:
        typeof research?.summary === "string" ? research.summary : null,
      targetPrice: input.targetPrice ?? null,
      expectedDownsidePct: input.maxAcceptableLossPct
        ? -Math.abs(input.maxAcceptableLossPct)
        : null,
      investmentHorizon: input.investmentHorizon ?? null,
      evidenceQuality: input.evidenceQuality ?? "medium",
      contraryEvidence: input.bearCase ? [input.bearCase] : [],
      keyFactors: packet.result.passedChecks.slice(0, 10),
      sourceReferences: (input.citedSourceIds ?? []).map((id) => ({
        id,
        label: id,
      })),
      nextReviewAt: reviewAt,
      emotionalState: "neutral",
      confidenceScore: packet.result.decision === "approve" ? 4 : 3,
    });
  }

  async update(userId: string, id: number, input: Partial<JournalEntryInput>) {
    const current = await this.get(userId, id);
    const portfolioId =
      input.portfolioId === undefined
        ? current.portfolioId
        : integerOrNull(input.portfolioId);
    const researchCompanyId =
      input.researchCompanyId === undefined
        ? current.researchCompanyId
        : integerOrNull(input.researchCompanyId);
    const transactionId =
      input.transactionId === undefined
        ? current.transactionId
        : integerOrNull(input.transactionId);
    await Promise.all([
      this.verifyPortfolio(userId, portfolioId),
      this.verifyResearchCompany(userId, researchCompanyId),
      this.verifyTransaction(userId, transactionId),
    ]);
    const normalized = this.normalizeEntry(
      {
        ...input,
        ticker: input.ticker ?? current.ticker,
        rationale: input.rationale ?? current.rationale,
      } as JournalEntryInput,
      true,
    );
    const [updated] = await db
      .update(decisionJournalEntriesTable)
      .set({
        ...normalized,
        ...(input.portfolioId !== undefined ? { portfolioId } : {}),
        ...(input.researchCompanyId !== undefined ? { researchCompanyId } : {}),
        ...(input.transactionId !== undefined ? { transactionId } : {}),
        ...(input.guardianCheckId !== undefined
          ? { guardianCheckId: cleanText(input.guardianCheckId, 64) }
          : {}),
        ...(normalized.status === "closed" && !current.closedAt
          ? { closedAt: new Date() }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(decisionJournalEntriesTable.id, id),
          eq(decisionJournalEntriesTable.userId, userId),
        ),
      )
      .returning();
    if (!updated) throw new Error("Journal entry not found");
    return { ...updated, quality: calculateDecisionQuality(updated) };
  }

  async archive(userId: string, id: number, archived = true) {
    const [entry] = await db
      .update(decisionJournalEntriesTable)
      .set({ isArchived: archived, updatedAt: new Date() })
      .where(
        and(
          eq(decisionJournalEntriesTable.id, id),
          eq(decisionJournalEntriesTable.userId, userId),
        ),
      )
      .returning();
    if (!entry) throw new Error("Journal entry not found");
    return { ...entry, quality: calculateDecisionQuality(entry) };
  }

  async scheduleReview(
    userId: string,
    entryId: number,
    input: JournalReviewInput,
  ) {
    await this.get(userId, entryId);
    const scheduledFor =
      parseDate(input.scheduledFor, "scheduledFor") ?? new Date();
    const reviewType = enumValue(
      input.reviewType,
      REVIEW_TYPES,
      "scheduled",
      "reviewType",
    ) as "scheduled" | "earnings" | "event" | "thesis_break" | "manual";
    const [review] = await db
      .insert(decisionJournalReviewsTable)
      .values({ entryId, userId, reviewType, status: "due", scheduledFor })
      .returning();
    await db
      .update(decisionJournalEntriesTable)
      .set({ nextReviewAt: scheduledFor, updatedAt: new Date() })
      .where(eq(decisionJournalEntriesTable.id, entryId));
    return review;
  }

  async listReviews(
    userId: string,
    filters: { status?: string; dueBefore?: string; limit?: number } = {},
  ) {
    const conditions = [eq(decisionJournalReviewsTable.userId, userId)];
    if (["due", "completed", "skipped"].includes(filters.status ?? "")) {
      conditions.push(
        eq(
          decisionJournalReviewsTable.status,
          filters.status as "due" | "completed" | "skipped",
        ),
      );
    }
    if (filters.dueBefore) {
      const dueBefore = parseDate(filters.dueBefore, "dueBefore");
      if (dueBefore)
        conditions.push(
          lte(decisionJournalReviewsTable.scheduledFor, dueBefore),
        );
    }
    const reviews = await db
      .select({
        review: decisionJournalReviewsTable,
        entry: decisionJournalEntriesTable,
      })
      .from(decisionJournalReviewsTable)
      .innerJoin(
        decisionJournalEntriesTable,
        eq(decisionJournalReviewsTable.entryId, decisionJournalEntriesTable.id),
      )
      .where(and(...conditions))
      .orderBy(asc(decisionJournalReviewsTable.scheduledFor))
      .limit(Math.min(500, Math.max(1, Math.trunc(filters.limit ?? 200))));
    return reviews.map(({ review, entry }) => ({
      ...review,
      ticker: entry.ticker,
      name: entry.name,
      decisionType: entry.decisionType,
      executionPrice: entry.executionPrice,
      decisionDate: entry.decisionDate,
      overdue:
        review.status === "due" && review.scheduledFor.getTime() < Date.now(),
    }));
  }

  async completeReview(
    userId: string,
    reviewId: number,
    input: JournalReviewInput,
  ) {
    const [joined] = await db
      .select({
        review: decisionJournalReviewsTable,
        entry: decisionJournalEntriesTable,
      })
      .from(decisionJournalReviewsTable)
      .innerJoin(
        decisionJournalEntriesTable,
        eq(decisionJournalReviewsTable.entryId, decisionJournalEntriesTable.id),
      )
      .where(
        and(
          eq(decisionJournalReviewsTable.id, reviewId),
          eq(decisionJournalReviewsTable.userId, userId),
        ),
      )
      .limit(1);
    if (!joined) throw new Error("Review not found");
    const currentPrice = finiteOrNull(input.currentPrice);
    const direction = ["sell", "trim", "avoid"].includes(
      joined.entry.decisionType,
    )
      ? -1
      : 1;
    const returnSinceDecisionPct =
      currentPrice !== null &&
      joined.entry.executionPrice &&
      joined.entry.executionPrice > 0
        ? ((currentPrice - joined.entry.executionPrice) /
            joined.entry.executionPrice) *
          100 *
          direction
        : null;
    const actionAfterReview = enumValue(
      input.actionAfterReview,
      REVIEW_ACTIONS,
      "no_change",
      "actionAfterReview",
    ) as "no_change" | "hold" | "add" | "trim" | "exit" | "research_more";
    const quality = calculateReviewQuality({ ...input, actionAfterReview });
    const nextReviewAt = parseDate(input.nextReviewAt, "nextReviewAt");
    const outcome = input.outcome
      ? (enumValue(input.outcome, OUTCOMES, "pending", "outcome") as
          "pending" | "win" | "loss" | "mixed" | "unknown")
      : undefined;
    return db.transaction(async (tx) => {
      const [review] = await tx
        .update(decisionJournalReviewsTable)
        .set({
          status: "completed",
          completedAt: new Date(),
          currentPrice,
          returnSinceDecisionPct,
          thesisStatusBefore: cleanText(input.thesisStatusBefore, 30),
          thesisStatusAfter: cleanText(input.thesisStatusAfter, 30),
          convictionBefore: cleanText(input.convictionBefore, 20),
          convictionAfter: cleanText(input.convictionAfter, 20),
          whatChanged: cleanText(input.whatChanged),
          evidenceFor: cleanText(input.evidenceFor),
          evidenceAgainst: cleanText(input.evidenceAgainst),
          actionAfterReview,
          reviewQualityScore: quality,
          notes: cleanText(input.notes),
          updatedAt: new Date(),
        })
        .where(eq(decisionJournalReviewsTable.id, reviewId))
        .returning();
      await tx
        .update(decisionJournalEntriesTable)
        .set({
          nextReviewAt,
          ...(outcome ? { outcome } : {}),
          ...(input.outcomeNotes !== undefined
            ? { outcomeNotes: cleanText(input.outcomeNotes) }
            : {}),
          ...(input.lessonsLearned !== undefined
            ? { lessonsLearned: cleanText(input.lessonsLearned) }
            : {}),
          ...(outcome &&
          outcome !== "pending" &&
          returnSinceDecisionPct !== null
            ? { actualReturnPct: returnSinceDecisionPct }
            : {}),
          ...(actionAfterReview === "exit"
            ? { status: "closed", closedAt: new Date() }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(decisionJournalEntriesTable.id, joined.entry.id));
      if (nextReviewAt) {
        await tx.insert(decisionJournalReviewsTable).values({
          entryId: joined.entry.id,
          userId,
          reviewType: "scheduled",
          status: "due",
          scheduledFor: nextReviewAt,
        });
      }
      return review;
    });
  }

  async skipReview(userId: string, reviewId: number, notes?: string) {
    const [review] = await db
      .update(decisionJournalReviewsTable)
      .set({
        status: "skipped",
        notes: cleanText(notes),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(decisionJournalReviewsTable.id, reviewId),
          eq(decisionJournalReviewsTable.userId, userId),
        ),
      )
      .returning();
    if (!review) throw new Error("Review not found");
    return review;
  }

  async analytics(userId: string, persistSnapshot = false) {
    const entries = await db
      .select()
      .from(decisionJournalEntriesTable)
      .where(
        and(
          eq(decisionJournalEntriesTable.userId, userId),
          eq(decisionJournalEntriesTable.isArchived, false),
        ),
      );
    const reviews = await db
      .select()
      .from(decisionJournalReviewsTable)
      .where(eq(decisionJournalReviewsTable.userId, userId));
    const scoredEntries = entries.map((entry) => ({
      ...entry,
      quality: calculateDecisionQuality(entry),
    }));
    const summary = summarizeDecisionAnalytics(
      scoredEntries.map((entry) => ({
        qualityScore: entry.quality.total,
        emotionalState: entry.emotionalState,
        outcome: entry.outcome,
        actualReturnPct: entry.actualReturnPct,
        lessonsLearned: entry.lessonsLearned,
        decisionType: entry.decisionType,
      })),
      reviews,
    );
    const average = (values: number[]) =>
      values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;
    const documentationScore = average(
      scoredEntries.map((entry) => (entry.quality.documentation / 20) * 100),
    );
    const evidenceBalanceScore = average(
      scoredEntries.map((entry) => (entry.quality.evidenceBalance / 20) * 100),
    );
    const reviewDisciplineScore = summary.reviewCompletionPct;
    const outcomeLearningScore = summary.lessonsCapturedPct;
    const overallScore = Math.round(
      average([
        summary.averageDecisionQuality,
        documentationScore,
        evidenceBalanceScore,
        reviewDisciplineScore,
        outcomeLearningScore,
      ]),
    );
    const result = {
      ...summary,
      overallScore,
      components: {
        documentationScore,
        evidenceBalanceScore,
        reviewDisciplineScore,
        outcomeLearningScore,
      },
      qualityBands: {
        excellent: scoredEntries.filter(
          (entry) => entry.quality.band === "excellent",
        ).length,
        disciplined: scoredEntries.filter(
          (entry) => entry.quality.band === "disciplined",
        ).length,
        developing: scoredEntries.filter(
          (entry) => entry.quality.band === "developing",
        ).length,
        weak: scoredEntries.filter((entry) => entry.quality.band === "weak")
          .length,
      },
      topProcessGaps: this.topProcessGaps(
        scoredEntries.map((entry) => entry.quality.missing),
      ),
      generatedAt: new Date().toISOString(),
    };
    if (persistSnapshot) {
      await db.insert(decisionQualitySnapshotsTable).values({
        userId,
        overallScore,
        documentationScore: Math.round(documentationScore),
        evidenceBalanceScore: Math.round(evidenceBalanceScore),
        reviewDisciplineScore: Math.round(reviewDisciplineScore),
        outcomeLearningScore: Math.round(outcomeLearningScore),
        metrics: result,
      });
    }
    return result;
  }

  private topProcessGaps(missingLists: string[][]) {
    const counts = new Map<string, number>();
    for (const list of missingLists) {
      for (const item of list) counts.set(item, (counts.get(item) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([gap, count]) => ({ gap, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  async analyticsHistory(userId: string, limit = 30) {
    return db
      .select()
      .from(decisionQualitySnapshotsTable)
      .where(eq(decisionQualitySnapshotsTable.userId, userId))
      .orderBy(desc(decisionQualitySnapshotsTable.asOf))
      .limit(Math.min(365, Math.max(1, Math.trunc(limit))));
  }
}

export const journalService = new JournalService();
