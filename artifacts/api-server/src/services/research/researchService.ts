import {
  investmentThesesTable,
  portfolioHoldingsTable,
  portfoliosTable,
  researchCatalystsTable,
  researchCompaniesTable,
  researchInvalidationTriggersTable,
  researchNotesTable,
  researchRisksTable,
  researchValuationAssumptionsTable,
  db,
} from "@workspace/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { calculateResearchCompleteness } from "./completeness";

export type ResearchConviction = "high" | "medium" | "low" | "watch";
export type ThesisStatus =
  "draft" | "intact" | "monitoring" | "weakening" | "broken" | "closed";
export type ResearchImpact = "high" | "medium" | "low";
export type ResearchProbability = "high" | "medium" | "low";
export type ResearchItemStatus =
  "active" | "monitoring" | "triggered" | "resolved" | "archived";
export type ResearchScenario = "common" | "bull" | "base" | "bear";
export type ResearchNoteCategory =
  | "thesis"
  | "financials"
  | "valuation"
  | "management"
  | "industry"
  | "earnings"
  | "risk"
  | "catalyst"
  | "general";

export interface CreateResearchCompanyInput {
  ticker: string;
  name?: string | null;
  exchange?: string | null;
  sector?: string | null;
  industry?: string | null;
  description?: string | null;
  website?: string | null;
  marketCap?: number | null;
  currentPrice?: number | null;
  previousClose?: number | null;
  pe?: number | null;
}

export interface UpdateResearchCompanyInput extends Partial<
  Omit<CreateResearchCompanyInput, "ticker">
> {
  isArchived?: boolean;
}

export interface SaveThesisInput {
  summary?: string | null;
  bullCase?: string | null;
  baseCase?: string | null;
  bearCase?: string | null;
  conviction?: ResearchConviction;
  status?: ThesisStatus;
  moatRating?: string | null;
  managementRating?: string | null;
  investmentHorizon?: string | null;
  expectedReturnPct?: number | null;
  maxAcceptableLossPct?: number | null;
  targetPrice?: number | null;
  bullPrice?: number | null;
  basePrice?: number | null;
  bearPrice?: number | null;
  valuationMethodology?: string | null;
  keyAssumptions?: string[];
  lastReviewedAt?: Date | null;
  nextReviewAt?: Date | null;
}

export interface NoteInput {
  title: string;
  category?: ResearchNoteCategory;
  content: string;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  eventDate?: Date | null;
  isPinned?: boolean;
}

export interface CatalystInput {
  title: string;
  description?: string | null;
  expectedDate?: Date | null;
  impact?: ResearchImpact;
  probability?: ResearchProbability;
  status?: ResearchItemStatus;
}

export interface RiskInput {
  title: string;
  description?: string | null;
  severity?: ResearchImpact;
  probability?: ResearchProbability;
  mitigation?: string | null;
  status?: ResearchItemStatus;
}

export interface InvalidationInput {
  trigger: string;
  description?: string | null;
  severity?: ResearchImpact;
  metricName?: string | null;
  operator?: string | null;
  threshold?: number | null;
  unit?: string | null;
  currentValue?: number | null;
  status?: ResearchItemStatus;
  triggeredAt?: Date | null;
}

export interface ValuationAssumptionInput {
  label: string;
  value: string;
  unit?: string | null;
  scenario?: ResearchScenario;
  notes?: string | null;
  sortOrder?: number;
}

interface ResearchCompanyListRow {
  id: number | null;
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string | null;
  currentPrice: number | null;
  previousClose: number | null;
  marketCap: number | null;
  pe: number | null;
  conviction: ResearchConviction;
  thesisStatus: ThesisStatus;
  completenessScore: number;
  completenessBand: string;
  lastUpdated: Date | null;
  isHolding: boolean;
  isCovered: boolean;
  quantity: number;
  marketValue: number;
  allocationPct: number;
  isArchived: boolean;
}

interface ThesisSignal {
  conviction: ResearchConviction;
  status: ThesisStatus;
  targetPrice: number | null;
}

function normalizeTicker(value: string): string {
  const ticker = value.trim().toUpperCase();
  if (!ticker) throw new Error("ticker is required");
  if (!/^[A-Z0-9.&_-]{1,30}$/.test(ticker)) {
    throw new Error("ticker contains unsupported characters");
  }
  return ticker;
}

function cleanText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const cleaned = value.trim();
  return cleaned || null;
}

function countByCompany(
  rows: Array<{ companyId: number }>,
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of rows) {
    counts.set(row.companyId, (counts.get(row.companyId) ?? 0) + 1);
  }
  return counts;
}

class ResearchService {
  private async getHolding(userId: string, tickerValue: string) {
    const ticker = normalizeTicker(tickerValue);
    const [row] = await db
      .select({
        portfolioId: portfoliosTable.id,
        portfolioName: portfoliosTable.name,
        ticker: portfolioHoldingsTable.ticker,
        name: portfolioHoldingsTable.name,
        exchange: portfolioHoldingsTable.exchange,
        sector: portfolioHoldingsTable.sector,
        quantity: portfolioHoldingsTable.quantity,
        averageCost: portfolioHoldingsTable.averageCost,
        marketPrice: portfolioHoldingsTable.marketPrice,
        previousClose: portfolioHoldingsTable.previousClose,
        marketValue: portfolioHoldingsTable.marketValue,
        costBasis: portfolioHoldingsTable.costBasis,
        unrealizedPnl: portfolioHoldingsTable.unrealizedPnl,
        allocationPct: portfolioHoldingsTable.allocationPct,
      })
      .from(portfolioHoldingsTable)
      .innerJoin(
        portfoliosTable,
        eq(portfolioHoldingsTable.portfolioId, portfoliosTable.id),
      )
      .where(
        and(
          eq(portfoliosTable.userId, userId),
          eq(portfolioHoldingsTable.ticker, ticker),
        ),
      )
      .orderBy(desc(portfolioHoldingsTable.marketValue))
      .limit(1);
    return row ?? null;
  }

  private async getOwnedCompany(userId: string, tickerValue: string) {
    const ticker = normalizeTicker(tickerValue);
    const [company] = await db
      .select()
      .from(researchCompaniesTable)
      .where(
        and(
          eq(researchCompaniesTable.userId, userId),
          eq(researchCompaniesTable.ticker, ticker),
        ),
      )
      .limit(1);
    if (!company)
      throw new Error(`Research coverage for ${ticker} was not found`);
    return company;
  }

  async listCompanies(
    userId: string,
    options: {
      query?: string;
      status?: string;
      conviction?: string;
      holdingsOnly?: boolean;
      archived?: boolean;
    } = {},
  ) {
    const covered = await db
      .select()
      .from(researchCompaniesTable)
      .where(eq(researchCompaniesTable.userId, userId))
      .orderBy(desc(researchCompaniesTable.updatedAt));

    const holdings = await db
      .select({
        ticker: portfolioHoldingsTable.ticker,
        name: portfolioHoldingsTable.name,
        exchange: portfolioHoldingsTable.exchange,
        sector: portfolioHoldingsTable.sector,
        quantity: portfolioHoldingsTable.quantity,
        marketPrice: portfolioHoldingsTable.marketPrice,
        previousClose: portfolioHoldingsTable.previousClose,
        marketValue: portfolioHoldingsTable.marketValue,
        allocationPct: portfolioHoldingsTable.allocationPct,
      })
      .from(portfolioHoldingsTable)
      .innerJoin(
        portfoliosTable,
        eq(portfolioHoldingsTable.portfolioId, portfoliosTable.id),
      )
      .where(eq(portfoliosTable.userId, userId));

    const companyIds = covered.map((company) => company.id);
    const [theses, notes, catalysts, risks, invalidations, assumptions] =
      companyIds.length === 0
        ? [[], [], [], [], [], []]
        : await Promise.all([
            db
              .select()
              .from(investmentThesesTable)
              .where(inArray(investmentThesesTable.companyId, companyIds)),
            db
              .select({ companyId: researchNotesTable.companyId })
              .from(researchNotesTable)
              .where(inArray(researchNotesTable.companyId, companyIds)),
            db
              .select({ companyId: researchCatalystsTable.companyId })
              .from(researchCatalystsTable)
              .where(inArray(researchCatalystsTable.companyId, companyIds)),
            db
              .select({ companyId: researchRisksTable.companyId })
              .from(researchRisksTable)
              .where(inArray(researchRisksTable.companyId, companyIds)),
            db
              .select({
                companyId: researchInvalidationTriggersTable.companyId,
              })
              .from(researchInvalidationTriggersTable)
              .where(
                inArray(
                  researchInvalidationTriggersTable.companyId,
                  companyIds,
                ),
              ),
            db
              .select({
                companyId: researchValuationAssumptionsTable.companyId,
              })
              .from(researchValuationAssumptionsTable)
              .where(
                inArray(
                  researchValuationAssumptionsTable.companyId,
                  companyIds,
                ),
              ),
          ]);

    const thesisByCompany = new Map(
      theses.map((thesis) => [thesis.companyId, thesis]),
    );
    const noteCounts = countByCompany(notes);
    const catalystCounts = countByCompany(catalysts);
    const riskCounts = countByCompany(risks);
    const invalidationCounts = countByCompany(invalidations);
    const assumptionCounts = countByCompany(assumptions);

    const holdingByTicker = new Map<string, (typeof holdings)[number]>();
    for (const holding of holdings) {
      const existing = holdingByTicker.get(holding.ticker);
      if (!existing || holding.marketValue > existing.marketValue) {
        holdingByTicker.set(holding.ticker, holding);
      }
    }

    const rows: ResearchCompanyListRow[] = covered.map((company) => {
      const holding = holdingByTicker.get(company.ticker) ?? null;
      const thesis = thesisByCompany.get(company.id) ?? null;
      const completeness = calculateResearchCompleteness({
        company,
        thesis,
        noteCount: noteCounts.get(company.id) ?? 0,
        catalystCount: catalystCounts.get(company.id) ?? 0,
        riskCount: riskCounts.get(company.id) ?? 0,
        invalidationCount: invalidationCounts.get(company.id) ?? 0,
        valuationAssumptionCount: assumptionCounts.get(company.id) ?? 0,
      });
      return {
        id: company.id,
        ticker: company.ticker,
        name: company.name,
        exchange: company.exchange,
        sector: company.sector ?? holding?.sector ?? "Unclassified",
        industry: company.industry,
        currentPrice: company.currentPrice ?? holding?.marketPrice ?? null,
        previousClose: company.previousClose ?? holding?.previousClose ?? null,
        marketCap: company.marketCap,
        pe: company.pe,
        conviction: thesis?.conviction ?? "watch",
        thesisStatus: thesis?.status ?? "draft",
        completenessScore: completeness.score,
        completenessBand: completeness.band,
        lastUpdated: company.updatedAt,
        isHolding: holding !== null,
        isCovered: true,
        quantity: holding?.quantity ?? 0,
        marketValue: holding?.marketValue ?? 0,
        allocationPct: holding?.allocationPct ?? 0,
        isArchived: company.isArchived,
      };
    });

    for (const holding of holdingByTicker.values()) {
      if (covered.some((company) => company.ticker === holding.ticker))
        continue;
      rows.push({
        id: null,
        ticker: holding.ticker,
        name: holding.name ?? holding.ticker,
        exchange: holding.exchange,
        sector: holding.sector ?? "Unclassified",
        industry: null,
        currentPrice: holding.marketPrice,
        previousClose: holding.previousClose,
        marketCap: null,
        pe: null,
        conviction: "watch",
        thesisStatus: "draft",
        completenessScore: 0,
        completenessBand: "empty",
        lastUpdated: null,
        isHolding: true,
        isCovered: false,
        quantity: holding.quantity,
        marketValue: holding.marketValue,
        allocationPct: holding.allocationPct,
        isArchived: false,
      });
    }

    const query = options.query?.trim().toLowerCase();
    return rows
      .filter((row) => options.archived === true || !row.isArchived)
      .filter((row) => !options.holdingsOnly || row.isHolding)
      .filter((row) => !options.status || row.thesisStatus === options.status)
      .filter(
        (row) => !options.conviction || row.conviction === options.conviction,
      )
      .filter(
        (row) =>
          !query ||
          row.ticker.toLowerCase().includes(query) ||
          row.name.toLowerCase().includes(query) ||
          row.sector.toLowerCase().includes(query),
      )
      .sort((a, b) => {
        if (a.isHolding !== b.isHolding) return a.isHolding ? -1 : 1;
        if (a.completenessScore !== b.completenessScore) {
          return b.completenessScore - a.completenessScore;
        }
        return a.ticker.localeCompare(b.ticker);
      });
  }

  async createCompany(userId: string, input: CreateResearchCompanyInput) {
    const ticker = normalizeTicker(input.ticker);
    const holding = await this.getHolding(userId, ticker);
    const name = cleanText(input.name) ?? holding?.name ?? ticker;

    const [company] = await db
      .insert(researchCompaniesTable)
      .values({
        userId,
        ticker,
        name,
        exchange: cleanText(input.exchange) ?? holding?.exchange ?? "NSE",
        sector: cleanText(input.sector) ?? holding?.sector ?? null,
        industry: cleanText(input.industry),
        description: cleanText(input.description),
        website: cleanText(input.website),
        marketCap: input.marketCap ?? null,
        currentPrice: input.currentPrice ?? holding?.marketPrice ?? null,
        previousClose: input.previousClose ?? holding?.previousClose ?? null,
        pe: input.pe ?? null,
        dataSource: holding ? "portfolio" : "manual",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [researchCompaniesTable.userId, researchCompaniesTable.ticker],
        set: {
          name,
          exchange: cleanText(input.exchange) ?? holding?.exchange ?? "NSE",
          sector: cleanText(input.sector) ?? holding?.sector ?? null,
          industry: cleanText(input.industry),
          description: cleanText(input.description),
          website: cleanText(input.website),
          marketCap: input.marketCap ?? null,
          currentPrice: input.currentPrice ?? holding?.marketPrice ?? null,
          previousClose: input.previousClose ?? holding?.previousClose ?? null,
          pe: input.pe ?? null,
          isArchived: false,
          updatedAt: new Date(),
        },
      })
      .returning();

    return this.getWorkspace(userId, company.ticker);
  }

  async updateCompany(
    userId: string,
    tickerValue: string,
    input: UpdateResearchCompanyInput,
  ) {
    const company = await this.getOwnedCompany(userId, tickerValue);
    const [updated] = await db
      .update(researchCompaniesTable)
      .set({
        ...(input.name !== undefined
          ? { name: cleanText(input.name) ?? company.name }
          : {}),
        ...(input.exchange !== undefined
          ? { exchange: cleanText(input.exchange) ?? company.exchange }
          : {}),
        ...(input.sector !== undefined
          ? { sector: cleanText(input.sector) }
          : {}),
        ...(input.industry !== undefined
          ? { industry: cleanText(input.industry) }
          : {}),
        ...(input.description !== undefined
          ? { description: cleanText(input.description) }
          : {}),
        ...(input.website !== undefined
          ? { website: cleanText(input.website) }
          : {}),
        ...(input.marketCap !== undefined
          ? { marketCap: input.marketCap }
          : {}),
        ...(input.currentPrice !== undefined
          ? { currentPrice: input.currentPrice }
          : {}),
        ...(input.previousClose !== undefined
          ? { previousClose: input.previousClose }
          : {}),
        ...(input.pe !== undefined ? { pe: input.pe } : {}),
        ...(input.isArchived !== undefined
          ? { isArchived: input.isArchived }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(researchCompaniesTable.id, company.id))
      .returning();
    return updated;
  }

  async saveThesis(
    userId: string,
    tickerValue: string,
    input: SaveThesisInput,
  ) {
    const company = await this.getOwnedCompany(userId, tickerValue);
    const [existing] = await db
      .select()
      .from(investmentThesesTable)
      .where(eq(investmentThesesTable.companyId, company.id))
      .limit(1);

    const values = {
      companyId: company.id,
      summary:
        input.summary === undefined
          ? (existing?.summary ?? null)
          : cleanText(input.summary),
      bullCase:
        input.bullCase === undefined
          ? (existing?.bullCase ?? null)
          : cleanText(input.bullCase),
      baseCase:
        input.baseCase === undefined
          ? (existing?.baseCase ?? null)
          : cleanText(input.baseCase),
      bearCase:
        input.bearCase === undefined
          ? (existing?.bearCase ?? null)
          : cleanText(input.bearCase),
      conviction: input.conviction ?? existing?.conviction ?? "medium",
      status: input.status ?? existing?.status ?? "draft",
      moatRating:
        input.moatRating === undefined
          ? (existing?.moatRating ?? null)
          : cleanText(input.moatRating),
      managementRating:
        input.managementRating === undefined
          ? (existing?.managementRating ?? null)
          : cleanText(input.managementRating),
      investmentHorizon:
        input.investmentHorizon === undefined
          ? (existing?.investmentHorizon ?? null)
          : cleanText(input.investmentHorizon),
      expectedReturnPct:
        input.expectedReturnPct === undefined
          ? (existing?.expectedReturnPct ?? null)
          : input.expectedReturnPct,
      maxAcceptableLossPct:
        input.maxAcceptableLossPct === undefined
          ? (existing?.maxAcceptableLossPct ?? null)
          : input.maxAcceptableLossPct,
      targetPrice:
        input.targetPrice === undefined
          ? (existing?.targetPrice ?? null)
          : input.targetPrice,
      bullPrice:
        input.bullPrice === undefined
          ? (existing?.bullPrice ?? null)
          : input.bullPrice,
      basePrice:
        input.basePrice === undefined
          ? (existing?.basePrice ?? null)
          : input.basePrice,
      bearPrice:
        input.bearPrice === undefined
          ? (existing?.bearPrice ?? null)
          : input.bearPrice,
      valuationMethodology:
        input.valuationMethodology === undefined
          ? (existing?.valuationMethodology ?? null)
          : cleanText(input.valuationMethodology),
      keyAssumptions: input.keyAssumptions ?? existing?.keyAssumptions ?? [],
      lastReviewedAt:
        input.lastReviewedAt === undefined
          ? (existing?.lastReviewedAt ?? null)
          : input.lastReviewedAt,
      nextReviewAt:
        input.nextReviewAt === undefined
          ? (existing?.nextReviewAt ?? null)
          : input.nextReviewAt,
      version: (existing?.version ?? 0) + 1,
      updatedAt: new Date(),
    };

    const [thesis] = await db
      .insert(investmentThesesTable)
      .values(values)
      .onConflictDoUpdate({
        target: investmentThesesTable.companyId,
        set: values,
      })
      .returning();

    await db
      .update(researchCompaniesTable)
      .set({ updatedAt: new Date() })
      .where(eq(researchCompaniesTable.id, company.id));
    return thesis;
  }

  async getWorkspace(userId: string, tickerValue: string) {
    const company = await this.getOwnedCompany(userId, tickerValue);
    const [
      holding,
      thesisRows,
      notes,
      catalysts,
      risks,
      invalidations,
      assumptions,
    ] = await Promise.all([
      this.getHolding(userId, company.ticker),
      db
        .select()
        .from(investmentThesesTable)
        .where(eq(investmentThesesTable.companyId, company.id))
        .limit(1),
      db
        .select()
        .from(researchNotesTable)
        .where(eq(researchNotesTable.companyId, company.id))
        .orderBy(
          desc(researchNotesTable.isPinned),
          desc(researchNotesTable.updatedAt),
        ),
      db
        .select()
        .from(researchCatalystsTable)
        .where(eq(researchCatalystsTable.companyId, company.id))
        .orderBy(asc(researchCatalystsTable.expectedDate)),
      db
        .select()
        .from(researchRisksTable)
        .where(eq(researchRisksTable.companyId, company.id))
        .orderBy(desc(researchRisksTable.updatedAt)),
      db
        .select()
        .from(researchInvalidationTriggersTable)
        .where(eq(researchInvalidationTriggersTable.companyId, company.id))
        .orderBy(desc(researchInvalidationTriggersTable.updatedAt)),
      db
        .select()
        .from(researchValuationAssumptionsTable)
        .where(eq(researchValuationAssumptionsTable.companyId, company.id))
        .orderBy(
          asc(researchValuationAssumptionsTable.sortOrder),
          asc(researchValuationAssumptionsTable.id),
        ),
    ]);

    const thesis = thesisRows[0] ?? null;
    const completeness = calculateResearchCompleteness({
      company,
      thesis,
      noteCount: notes.length,
      catalystCount: catalysts.length,
      riskCount: risks.length,
      invalidationCount: invalidations.length,
      valuationAssumptionCount: assumptions.length,
    });

    return {
      company,
      holding,
      thesis,
      notes,
      catalysts,
      risks,
      invalidationTriggers: invalidations,
      valuationAssumptions: assumptions,
      completeness,
    };
  }

  async getThesisSignals(
    userId: string,
    tickerValues: string[],
  ): Promise<Map<string, ThesisSignal>> {
    const tickers = [...new Set(tickerValues.map(normalizeTicker))];
    if (tickers.length === 0) return new Map<string, ThesisSignal>();
    const companies = await db
      .select()
      .from(researchCompaniesTable)
      .where(
        and(
          eq(researchCompaniesTable.userId, userId),
          inArray(researchCompaniesTable.ticker, tickers),
        ),
      );
    if (companies.length === 0) return new Map<string, ThesisSignal>();
    const theses = await db
      .select()
      .from(investmentThesesTable)
      .where(
        inArray(
          investmentThesesTable.companyId,
          companies.map((item) => item.id),
        ),
      );
    const companyById = new Map(
      companies.map((company) => [company.id, company]),
    );
    return new Map(
      theses.map((thesis) => {
        const company = companyById.get(thesis.companyId)!;
        return [
          company.ticker,
          {
            conviction: thesis.conviction,
            status: thesis.status,
            targetPrice: thesis.targetPrice ?? thesis.basePrice,
          },
        ];
      }),
    );
  }

  async createNote(userId: string, ticker: string, input: NoteInput) {
    const company = await this.getOwnedCompany(userId, ticker);
    const [item] = await db
      .insert(researchNotesTable)
      .values({
        companyId: company.id,
        userId,
        title: input.title.trim(),
        category: input.category ?? "general",
        content: input.content.trim(),
        sourceLabel: cleanText(input.sourceLabel),
        sourceUrl: cleanText(input.sourceUrl),
        eventDate: input.eventDate ?? null,
        isPinned: input.isPinned ?? false,
      })
      .returning();
    return item;
  }

  async updateNote(userId: string, id: number, input: Partial<NoteInput>) {
    const [item] = await db
      .update(researchNotesTable)
      .set({
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.content !== undefined
          ? { content: input.content.trim() }
          : {}),
        ...(input.sourceLabel !== undefined
          ? { sourceLabel: cleanText(input.sourceLabel) }
          : {}),
        ...(input.sourceUrl !== undefined
          ? { sourceUrl: cleanText(input.sourceUrl) }
          : {}),
        ...(input.eventDate !== undefined
          ? { eventDate: input.eventDate }
          : {}),
        ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(researchNotesTable.id, id),
          eq(researchNotesTable.userId, userId),
        ),
      )
      .returning();
    if (!item) throw new Error("Research note was not found");
    return item;
  }

  async deleteNote(userId: string, id: number) {
    const [item] = await db
      .delete(researchNotesTable)
      .where(
        and(
          eq(researchNotesTable.id, id),
          eq(researchNotesTable.userId, userId),
        ),
      )
      .returning({ id: researchNotesTable.id });
    if (!item) throw new Error("Research note was not found");
    return item;
  }

  async createCatalyst(userId: string, ticker: string, input: CatalystInput) {
    const company = await this.getOwnedCompany(userId, ticker);
    const [item] = await db
      .insert(researchCatalystsTable)
      .values({
        companyId: company.id,
        userId,
        title: input.title.trim(),
        description: cleanText(input.description),
        expectedDate: input.expectedDate ?? null,
        impact: input.impact ?? "medium",
        probability: input.probability ?? "medium",
        status: input.status ?? "active",
      })
      .returning();
    return item;
  }

  async updateCatalyst(
    userId: string,
    id: number,
    input: Partial<CatalystInput>,
  ) {
    const [item] = await db
      .update(researchCatalystsTable)
      .set({
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined
          ? { description: cleanText(input.description) }
          : {}),
        ...(input.expectedDate !== undefined
          ? { expectedDate: input.expectedDate }
          : {}),
        ...(input.impact !== undefined ? { impact: input.impact } : {}),
        ...(input.probability !== undefined
          ? { probability: input.probability }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(researchCatalystsTable.id, id),
          eq(researchCatalystsTable.userId, userId),
        ),
      )
      .returning();
    if (!item) throw new Error("Catalyst was not found");
    return item;
  }

  async deleteCatalyst(userId: string, id: number) {
    const [item] = await db
      .delete(researchCatalystsTable)
      .where(
        and(
          eq(researchCatalystsTable.id, id),
          eq(researchCatalystsTable.userId, userId),
        ),
      )
      .returning({ id: researchCatalystsTable.id });
    if (!item) throw new Error("Catalyst was not found");
    return item;
  }

  async createRisk(userId: string, ticker: string, input: RiskInput) {
    const company = await this.getOwnedCompany(userId, ticker);
    const [item] = await db
      .insert(researchRisksTable)
      .values({
        companyId: company.id,
        userId,
        title: input.title.trim(),
        description: cleanText(input.description),
        severity: input.severity ?? "medium",
        probability: input.probability ?? "medium",
        mitigation: cleanText(input.mitigation),
        status: input.status ?? "active",
      })
      .returning();
    return item;
  }

  async updateRisk(userId: string, id: number, input: Partial<RiskInput>) {
    const [item] = await db
      .update(researchRisksTable)
      .set({
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined
          ? { description: cleanText(input.description) }
          : {}),
        ...(input.severity !== undefined ? { severity: input.severity } : {}),
        ...(input.probability !== undefined
          ? { probability: input.probability }
          : {}),
        ...(input.mitigation !== undefined
          ? { mitigation: cleanText(input.mitigation) }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(researchRisksTable.id, id),
          eq(researchRisksTable.userId, userId),
        ),
      )
      .returning();
    if (!item) throw new Error("Risk was not found");
    return item;
  }

  async deleteRisk(userId: string, id: number) {
    const [item] = await db
      .delete(researchRisksTable)
      .where(
        and(
          eq(researchRisksTable.id, id),
          eq(researchRisksTable.userId, userId),
        ),
      )
      .returning({ id: researchRisksTable.id });
    if (!item) throw new Error("Risk was not found");
    return item;
  }

  async createInvalidation(
    userId: string,
    ticker: string,
    input: InvalidationInput,
  ) {
    const company = await this.getOwnedCompany(userId, ticker);
    const [item] = await db
      .insert(researchInvalidationTriggersTable)
      .values({
        companyId: company.id,
        userId,
        trigger: input.trigger.trim(),
        description: cleanText(input.description),
        severity: input.severity ?? "high",
        metricName: cleanText(input.metricName),
        operator: cleanText(input.operator),
        threshold: input.threshold ?? null,
        unit: cleanText(input.unit),
        currentValue: input.currentValue ?? null,
        status: input.status ?? "monitoring",
        triggeredAt: input.triggeredAt ?? null,
      })
      .returning();
    return item;
  }

  async updateInvalidation(
    userId: string,
    id: number,
    input: Partial<InvalidationInput>,
  ) {
    const [item] = await db
      .update(researchInvalidationTriggersTable)
      .set({
        ...(input.trigger !== undefined
          ? { trigger: input.trigger.trim() }
          : {}),
        ...(input.description !== undefined
          ? { description: cleanText(input.description) }
          : {}),
        ...(input.severity !== undefined ? { severity: input.severity } : {}),
        ...(input.metricName !== undefined
          ? { metricName: cleanText(input.metricName) }
          : {}),
        ...(input.operator !== undefined
          ? { operator: cleanText(input.operator) }
          : {}),
        ...(input.threshold !== undefined
          ? { threshold: input.threshold }
          : {}),
        ...(input.unit !== undefined ? { unit: cleanText(input.unit) } : {}),
        ...(input.currentValue !== undefined
          ? { currentValue: input.currentValue }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.triggeredAt !== undefined
          ? { triggeredAt: input.triggeredAt }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(researchInvalidationTriggersTable.id, id),
          eq(researchInvalidationTriggersTable.userId, userId),
        ),
      )
      .returning();
    if (!item) throw new Error("Invalidation trigger was not found");
    return item;
  }

  async deleteInvalidation(userId: string, id: number) {
    const [item] = await db
      .delete(researchInvalidationTriggersTable)
      .where(
        and(
          eq(researchInvalidationTriggersTable.id, id),
          eq(researchInvalidationTriggersTable.userId, userId),
        ),
      )
      .returning({ id: researchInvalidationTriggersTable.id });
    if (!item) throw new Error("Invalidation trigger was not found");
    return item;
  }

  async createValuationAssumption(
    userId: string,
    ticker: string,
    input: ValuationAssumptionInput,
  ) {
    const company = await this.getOwnedCompany(userId, ticker);
    const [item] = await db
      .insert(researchValuationAssumptionsTable)
      .values({
        companyId: company.id,
        userId,
        label: input.label.trim(),
        value: input.value.trim(),
        unit: cleanText(input.unit),
        scenario: input.scenario ?? "common",
        notes: cleanText(input.notes),
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
    return item;
  }

  async updateValuationAssumption(
    userId: string,
    id: number,
    input: Partial<ValuationAssumptionInput>,
  ) {
    const [item] = await db
      .update(researchValuationAssumptionsTable)
      .set({
        ...(input.label !== undefined ? { label: input.label.trim() } : {}),
        ...(input.value !== undefined ? { value: input.value.trim() } : {}),
        ...(input.unit !== undefined ? { unit: cleanText(input.unit) } : {}),
        ...(input.scenario !== undefined ? { scenario: input.scenario } : {}),
        ...(input.notes !== undefined ? { notes: cleanText(input.notes) } : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: input.sortOrder }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(researchValuationAssumptionsTable.id, id),
          eq(researchValuationAssumptionsTable.userId, userId),
        ),
      )
      .returning();
    if (!item) throw new Error("Valuation assumption was not found");
    return item;
  }

  async deleteValuationAssumption(userId: string, id: number) {
    const [item] = await db
      .delete(researchValuationAssumptionsTable)
      .where(
        and(
          eq(researchValuationAssumptionsTable.id, id),
          eq(researchValuationAssumptionsTable.userId, userId),
        ),
      )
      .returning({ id: researchValuationAssumptionsTable.id });
    if (!item) throw new Error("Valuation assumption was not found");
    return item;
  }
}

export const researchService = new ResearchService();
