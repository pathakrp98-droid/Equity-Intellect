import { createHash } from "node:crypto";

import type { NormalizedMarketImport } from "../../intelligence/types";

interface ResearchTriggerHolding {
  ticker: string;
  name?: string | null;
  exchange?: string | null;
  sector?: string | null;
  isin?: string | null;
  quantity?: number;
  marketPrice?: number;
  allocationPct?: number;
  unrealizedPnl?: number;
}

export function buildHoldingResearchTrigger(
  userId: string,
  portfolioId: number,
  holdings: readonly ResearchTriggerHolding[],
) {
  const identity = JSON.stringify(
    holdings
      .map((holding) =>
        JSON.stringify([
          holding.ticker.trim().toUpperCase(),
          holding.name?.trim().toUpperCase() ?? "",
          holding.exchange?.trim().toUpperCase() ?? "",
          holding.sector?.trim().toUpperCase() ?? "",
          holding.isin?.trim().toUpperCase() ?? "",
        ]),
      )
      .sort(),
  );
  const holdingFingerprint = createHash("sha256")
    .update(identity)
    .digest("hex");
  return {
    userId,
    portfolioId,
    ticker: null,
    trigger: "portfolio_reconciled" as const,
    dedupeKey: `holdings:${portfolioId}:${holdingFingerprint}`,
    priority: 100,
    payload: { portfolioId, holdingFingerprint },
  };
}

export interface MaterialResearchTrigger {
  userId: string;
  portfolioId: null;
  ticker: string;
  trigger: "material_event";
  dedupeKey: string;
  priority: number;
  payload: Record<string, unknown>;
}

export function buildMaterialResearchTriggers(
  userId: string,
  normalized: NormalizedMarketImport,
  portfolioTickers: ReadonlySet<string>,
): MaterialResearchTrigger[] {
  const accepted = new Map<string, MaterialResearchTrigger>();
  const add = (input: {
    ticker: string | null;
    source: string;
    externalId: string;
    title: string;
    sourceUrl: string | null;
    occurredAt: Date;
    category: "news" | "event";
  }) => {
    const ticker = input.ticker?.trim().toUpperCase() ?? "";
    if (!ticker || !portfolioTickers.has(ticker)) return;
    const rawDedupeKey = `material:${input.source.trim()}:${input.externalId.trim()}`;
    const dedupeKey =
      rawDedupeKey.length <= 180
        ? rawDedupeKey
        : `material:${createHash("sha256").update(rawDedupeKey).digest("hex")}`;
    if (accepted.has(dedupeKey)) return;
    accepted.set(dedupeKey, {
      userId,
      portfolioId: null,
      ticker,
      trigger: "material_event",
      dedupeKey,
      priority: 80,
      payload: {
        ticker,
        source: input.source,
        externalId: input.externalId,
        title: input.title,
        sourceUrl: input.sourceUrl,
        occurredAt: input.occurredAt.toISOString(),
        category: input.category,
      },
    });
  };

  for (const item of normalized.news) {
    if (!item.isPortfolioRelevant || item.relevanceScore < 0.8) continue;
    add({
      ticker: item.ticker,
      source: item.source,
      externalId: item.externalId,
      title: item.headline,
      sourceUrl: item.sourceUrl,
      occurredAt: item.publishedAt,
      category: "news",
    });
  }
  for (const item of normalized.events) {
    const material =
      item.impact === "critical" ||
      item.impact === "high" ||
      item.eventType === "earnings" ||
      item.eventType === "corporate_action" ||
      item.eventType === "dividend";
    if (!item.isPortfolioRelevant || !material) continue;
    add({
      ticker: item.ticker,
      source: item.source,
      externalId: item.externalId,
      title: item.title,
      sourceUrl: item.sourceUrl,
      occurredAt: item.eventAt,
      category: "event",
    });
  }
  return [...accepted.values()];
}
