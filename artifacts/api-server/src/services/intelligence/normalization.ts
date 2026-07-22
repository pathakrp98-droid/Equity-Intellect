import type {
  MarketDataKind,
  MarketEventInput,
  MarketEventType,
  MarketImpact,
  MarketImportPayload,
  MarketNewsInput,
  MarketPointInput,
  MarketSentiment,
  NormalizedMarketEvent,
  NormalizedMarketImport,
  NormalizedMarketNews,
  NormalizedMarketPoint,
} from "./types";

const MARKET_KINDS = new Set<MarketDataKind>([
  "index",
  "equity",
  "fx",
  "commodity",
  "rate",
  "macro",
  "flow",
  "sector",
]);
const SENTIMENTS = new Set<MarketSentiment>([
  "positive",
  "negative",
  "neutral",
  "mixed",
  "unknown",
]);
const EVENT_TYPES = new Set<MarketEventType>([
  "earnings",
  "corporate_action",
  "dividend",
  "macro",
  "regulatory",
  "investor_event",
  "other",
]);
const IMPACTS = new Set<MarketImpact>([
  "critical",
  "high",
  "medium",
  "low",
]);

function cleanText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) throw new Error(`${field} is required`);
  return cleaned.slice(0, maxLength);
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.slice(0, maxLength) : null;
}


function optionalHttpUrl(value: unknown, field: string): string | null {
  const text = optionalText(value, 1200);
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${field} must use http or https`);
  }
  return url.toString();
}

function optionalRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseDate(value: string | Date, field: string): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} is invalid`);
  return date;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  return value;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeTicker(value: unknown): string | null {
  const ticker = optionalText(value, 30)?.toUpperCase() ?? null;
  if (!ticker) return null;
  if (!/^[A-Z0-9.&_-]{1,30}$/.test(ticker)) {
    throw new Error(`Unsupported ticker: ${ticker}`);
  }
  return ticker;
}

export function stableExternalId(parts: Array<string | number | null | undefined>): string {
  const value = parts.map((part) => String(part ?? "")).join("|");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ad-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function scoreRelevance(
  inputScore: number | undefined,
  ticker: string | null,
  portfolioTickers: Set<string>,
): number {
  const provided =
    typeof inputScore === "number" && Number.isFinite(inputScore)
      ? Math.max(0, Math.min(1, inputScore))
      : 0;
  if (ticker && portfolioTickers.has(ticker)) return Math.max(0.9, provided);
  return provided;
}

function normalizePoint(input: MarketPointInput): NormalizedMarketPoint {
  if (!MARKET_KINDS.has(input.kind)) throw new Error("Unsupported market point kind");
  return {
    kind: input.kind,
    symbol: cleanText(input.symbol, "symbol", 40).toUpperCase(),
    name: cleanText(input.name, "name", 180),
    value: finiteNumber(input.value, "value"),
    change: optionalNumber(input.change),
    changePct: optionalNumber(input.changePct),
    unit: optionalText(input.unit, 40),
    region: optionalText(input.region, 80),
    source: cleanText(input.source, "source", 180),
    sourceUrl: optionalHttpUrl(input.sourceUrl, "sourceUrl"),
    asOf: parseDate(input.asOf, "asOf"),
    metadata: optionalRecord(input.metadata),
  };
}

function normalizeNews(
  input: MarketNewsInput,
  portfolioTickers: Set<string>,
): NormalizedMarketNews {
  const ticker = normalizeTicker(input.ticker);
  const headline = cleanText(input.headline, "headline", 500);
  const source = cleanText(input.source, "source", 180);
  const publishedAt = parseDate(input.publishedAt, "publishedAt");
  const sentiment = SENTIMENTS.has(input.sentiment ?? "unknown")
    ? (input.sentiment ?? "unknown")
    : "unknown";
  const relevanceScore = scoreRelevance(
    input.relevanceScore,
    ticker,
    portfolioTickers,
  );
  return {
    externalId:
      optionalText(input.externalId, 240) ??
      stableExternalId([source, ticker, headline, publishedAt.toISOString()]),
    ticker,
    headline,
    summary: optionalText(input.summary, 4000),
    source,
    sourceUrl: optionalHttpUrl(input.sourceUrl, "sourceUrl"),
    publishedAt,
    sentiment,
    relevanceScore,
    isPortfolioRelevant: Boolean(ticker && portfolioTickers.has(ticker)),
    metadata: optionalRecord(input.metadata),
  };
}

function normalizeEvent(
  input: MarketEventInput,
  portfolioTickers: Set<string>,
): NormalizedMarketEvent {
  const ticker = normalizeTicker(input.ticker);
  const source = cleanText(input.source, "source", 180);
  const title = cleanText(input.title, "title", 500);
  if (!EVENT_TYPES.has(input.eventType)) {
    throw new Error("Unsupported market event type");
  }
  const eventAt = parseDate(input.eventAt, "eventAt");
  const impact = IMPACTS.has(input.impact ?? "medium")
    ? (input.impact ?? "medium")
    : "medium";
  return {
    externalId:
      optionalText(input.externalId, 240) ??
      stableExternalId([source, ticker, input.eventType, title, eventAt.toISOString()]),
    ticker,
    companyName: optionalText(input.companyName, 180),
    eventType: input.eventType,
    title,
    description: optionalText(input.description, 4000),
    eventAt,
    impact,
    source,
    sourceUrl: optionalHttpUrl(input.sourceUrl, "sourceUrl"),
    isPortfolioRelevant: Boolean(ticker && portfolioTickers.has(ticker)),
    metadata: optionalRecord(input.metadata),
  };
}

function dedupe<T>(rows: T[], key: (row: T) => string): T[] {
  const map = new Map<string, T>();
  for (const row of rows) map.set(key(row), row);
  return [...map.values()];
}

export function normalizeMarketImport(
  payload: MarketImportPayload,
  portfolioTickerValues: string[],
  now = new Date(),
): NormalizedMarketImport {
  if (!payload || typeof payload !== "object") {
    throw new Error("Import payload must be an object");
  }
  if (payload.points !== undefined && !Array.isArray(payload.points)) {
    throw new Error("points must be an array");
  }
  if (payload.news !== undefined && !Array.isArray(payload.news)) {
    throw new Error("news must be an array");
  }
  if (payload.events !== undefined && !Array.isArray(payload.events)) {
    throw new Error("events must be an array");
  }
  const portfolioTickers = new Set(
    portfolioTickerValues.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean),
  );
  const warnings: string[] = [];
  const points = dedupe(
    (payload.points ?? []).slice(0, 500).map(normalizePoint),
    (row) => `${row.kind}:${row.symbol}`,
  );
  const news = dedupe(
    (payload.news ?? [])
      .slice(0, 1000)
      .map((item) => normalizeNews(item, portfolioTickers)),
    (row) => `${row.source}:${row.externalId}`,
  );
  const events = dedupe(
    (payload.events ?? [])
      .slice(0, 1000)
      .map((item) => normalizeEvent(item, portfolioTickers)),
    (row) => `${row.source}:${row.externalId}`,
  );

  if ((payload.points?.length ?? 0) > points.length) {
    warnings.push("Duplicate or excess market points were removed.");
  }
  if ((payload.news?.length ?? 0) > news.length) {
    warnings.push("Duplicate or excess news items were removed.");
  }
  if ((payload.events?.length ?? 0) > events.length) {
    warnings.push("Duplicate or excess calendar events were removed.");
  }
  if (points.length + news.length + events.length === 0) {
    warnings.push("The import did not contain any usable records.");
  }

  return {
    provider: optionalText(payload.provider, 120) ?? "manual-import",
    fetchedAt: payload.fetchedAt
      ? parseDate(payload.fetchedAt, "fetchedAt")
      : now,
    points,
    news,
    events,
    warnings,
  };
}

export function ageMinutes(date: Date, now = new Date()): number {
  return Math.max(0, (now.getTime() - date.getTime()) / 60_000);
}

export function isMarketPointStale(
  asOf: Date,
  staleAfterMinutes: number,
  now = new Date(),
): boolean {
  return ageMinutes(asOf, now) > staleAfterMinutes;
}

export function isNewsStale(
  publishedAt: Date,
  staleAfterHours: number,
  now = new Date(),
): boolean {
  return ageMinutes(publishedAt, now) > staleAfterHours * 60;
}
