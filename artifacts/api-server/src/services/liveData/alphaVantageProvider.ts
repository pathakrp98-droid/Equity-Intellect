import crypto from "node:crypto";

import type {
  MarketEventInput,
  MarketNewsInput,
  MarketPointInput,
} from "../intelligence/types";
import type {
  LiveDataProvider,
  LiveDataProviderContext,
  ProviderSymbol,
} from "./types";

interface AlphaVantageQuoteResponse {
  "Global Quote"?: Record<string, string>;
  Note?: string;
  Information?: string;
  "Error Message"?: string;
}

interface AlphaVantageNewsResponse {
  feed?: Array<{
    title?: string;
    summary?: string;
    url?: string;
    time_published?: string;
    source?: string;
    overall_sentiment_label?: string;
    overall_sentiment_score?: number | string;
    ticker_sentiment?: Array<{
      ticker?: string;
      relevance_score?: string | number;
      ticker_sentiment_label?: string;
    }>;
  }>;
  Note?: string;
  Information?: string;
  "Error Message"?: string;
}

function baseUrl(): string {
  return process.env.ALPHA_VANTAGE_BASE_URL?.trim() ||
    "https://www.alphavantage.co/query";
}

function timeoutMs(): number {
  const parsed = Number(process.env.ALPHA_VANTAGE_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 20_000;
}

function apiKey(): string {
  const value = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  if (!value) throw new Error("ALPHA_VANTAGE_API_KEY is not configured");
  return value;
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseProviderTimestamp(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  if (/^\d{8}T\d{6}$/.test(value)) {
    const year = value.slice(0, 4);
    const month = value.slice(4, 6);
    const day = value.slice(6, 8);
    const hour = value.slice(9, 11);
    const minute = value.slice(11, 13);
    const second = value.slice(13, 15);
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function sentiment(value: string | undefined) {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("bullish") || normalized.includes("positive")) {
    return "positive" as const;
  }
  if (normalized.includes("bearish") || normalized.includes("negative")) {
    return "negative" as const;
  }
  if (normalized.includes("neutral")) return "neutral" as const;
  return "unknown" as const;
}

function externalId(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 40);
}

async function fetchWithTimeout(url: URL): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json, text/csv;q=0.9" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Alpha Vantage returned HTTP ${response.status}`);
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function providerError(payload: {
  Note?: string;
  Information?: string;
  "Error Message"?: string;
}): string | null {
  return payload["Error Message"] ?? payload.Note ?? payload.Information ?? null;
}

async function fetchJson<T extends object>(parameters: Record<string, string>): Promise<T> {
  const url = new URL(baseUrl());
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("apikey", apiKey());
  const response = await fetchWithTimeout(url);
  const payload = (await response.json()) as T & {
    Note?: string;
    Information?: string;
    "Error Message"?: string;
  };
  const error = providerError(payload);
  if (error) throw new Error(`Alpha Vantage: ${error}`);
  return payload;
}

async function mapSequential<T, R>(
  values: T[],
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (const value of values) results.push(await mapper(value));
  return results;
}

function quoteSourceUrl(symbol: string): string {
  const url = new URL(baseUrl());
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", symbol);
  return url.toString();
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current.trim());
  return values;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function findTickerForProviderSymbol(
  symbols: ProviderSymbol[],
  providerSymbol: string | undefined,
): string | null {
  const normalized = providerSymbol?.toUpperCase();
  if (!normalized) return null;
  const exact = symbols.find(
    (symbol) => symbol.providerSymbol.toUpperCase() === normalized,
  );
  if (exact) return exact.ticker;
  const withoutSuffix = normalized.split(".")[0];
  return symbols.find((symbol) => symbol.ticker === withoutSuffix)?.ticker ?? null;
}

export class AlphaVantageProvider implements LiveDataProvider {
  readonly name = "alpha-vantage";
  readonly capabilities = {
    quotes: true,
    news: true,
    calendar: true,
    corporateActions: false,
    snapshot: false,
  } as const;

  isConfigured(): boolean {
    return Boolean(process.env.ALPHA_VANTAGE_API_KEY?.trim());
  }

  configurationHint(): string {
    return "Set ALPHA_VANTAGE_API_KEY. Add provider symbol mappings when the exchange symbol differs from your portfolio ticker.";
  }

  async fetchQuotes(context: LiveDataProviderContext): Promise<MarketPointInput[]> {
    const results: MarketPointInput[] = [];
    const failures: string[] = [];

    for (const symbol of context.symbols) {
      try {
        const payload = await fetchJson<AlphaVantageQuoteResponse>({
          function: "GLOBAL_QUOTE",
          symbol: symbol.providerSymbol,
        });
        const quote = payload["Global Quote"] ?? {};
        const price = finiteNumber(quote["05. price"]);
        if (price === null || price <= 0) {
          throw new Error(`no quote returned for ${symbol.providerSymbol}`);
        }
        const previousClose = finiteNumber(quote["08. previous close"]);
        const change = finiteNumber(quote["09. change"]);
        const changePct = finiteNumber(
          String(quote["10. change percent"] ?? "").replace("%", ""),
        );
        const latestTradingDay = quote["07. latest trading day"];

        results.push({
          kind: "equity" as const,
          symbol: symbol.ticker,
          name: symbol.ticker,
          value: price,
          change,
          changePct,
          unit: "INR",
          region: symbol.exchange,
          source: this.name,
          sourceUrl: quoteSourceUrl(symbol.providerSymbol),
          asOf: latestTradingDay
            ? new Date(`${latestTradingDay}T15:30:00+05:30`)
            : context.now,
          metadata: {
            providerSymbol: symbol.providerSymbol,
            previousClose,
            open: finiteNumber(quote["02. open"]),
            high: finiteNumber(quote["03. high"]),
            low: finiteNumber(quote["04. low"]),
            volume: finiteNumber(quote["06. volume"]),
          },
        } satisfies MarketPointInput);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "provider request failed";
        failures.push(`${symbol.ticker} (${symbol.providerSymbol}): ${message}`);
      }
    }

    if (results.length === 0) {
      throw new Error(
        `Alpha Vantage returned no usable quotes. ${failures
          .slice(0, 5)
          .join("; ")}`,
      );
    }

    if (failures.length > 0) {
      console.warn(
        `[alpha-vantage] imported ${results.length} quotes and skipped ${failures.length}: ${failures.join("; ")}`,
      );
    }

    return results;
  }

  async fetchNews(context: LiveDataProviderContext): Promise<MarketNewsInput[]> {
    if (context.symbols.length === 0) return [];
    const payload = await fetchJson<AlphaVantageNewsResponse>({
      function: "NEWS_SENTIMENT",
      tickers: context.symbols.map((symbol) => symbol.providerSymbol).join(","),
      sort: "LATEST",
      limit: "50",
    });
    return (payload.feed ?? []).flatMap((item) => {
      if (!item.title) return [];
      const matchingSentiments = item.ticker_sentiment ?? [];
      const bestMatch = matchingSentiments
        .map((tickerSentiment) => ({
          ticker: findTickerForProviderSymbol(context.symbols, tickerSentiment.ticker),
          relevance: finiteNumber(tickerSentiment.relevance_score) ?? 0,
          label: tickerSentiment.ticker_sentiment_label,
        }))
        .filter((entry) => entry.ticker)
        .sort((a, b) => b.relevance - a.relevance)[0];
      const publishedAt = parseProviderTimestamp(item.time_published, context.now);
      const url = item.url ?? null;
      return [
        {
          externalId: externalId(`${url ?? item.title}|${publishedAt.toISOString()}`),
          ticker: bestMatch?.ticker ?? null,
          headline: item.title,
          summary: item.summary ?? null,
          source: item.source?.trim() || this.name,
          sourceUrl: url,
          publishedAt,
          sentiment: sentiment(bestMatch?.label ?? item.overall_sentiment_label),
          relevanceScore:
            bestMatch?.relevance ?? finiteNumber(item.overall_sentiment_score) ?? 0,
          metadata: {
            provider: this.name,
            providerSentiment: bestMatch?.label ?? item.overall_sentiment_label,
          },
        } satisfies MarketNewsInput,
      ];
    });
  }

  async fetchCalendar(context: LiveDataProviderContext): Promise<MarketEventInput[]> {
    const events = await mapSequential(context.symbols, async (symbol) => {
      const url = new URL(baseUrl());
      url.searchParams.set("function", "EARNINGS_CALENDAR");
      url.searchParams.set("symbol", symbol.providerSymbol);
      url.searchParams.set("horizon", "3month");
      url.searchParams.set("apikey", apiKey());
      const response = await fetchWithTimeout(url);
      const text = await response.text();
      if (/^(Note|Information|Error Message)/i.test(text.trim())) {
        throw new Error(`Alpha Vantage: ${text.trim().slice(0, 300)}`);
      }
      return parseCsv(text).flatMap((row) => {
        const reportDate = row.reportDate || row.report_date;
        if (!reportDate) return [];
        const eventAt = new Date(`${reportDate}T09:00:00+05:30`);
        if (Number.isNaN(eventAt.getTime())) return [];
        return [
          {
            externalId: externalId(`earnings|${symbol.ticker}|${reportDate}`),
            ticker: symbol.ticker,
            companyName: row.name || symbol.ticker,
            eventType: "earnings" as const,
            title: `${row.name || symbol.ticker} earnings`,
            description: row.estimate
              ? `Consensus EPS estimate: ${row.estimate}; fiscal date ending ${row.fiscalDateEnding || "not provided"}.`
              : `Fiscal date ending ${row.fiscalDateEnding || "not provided"}.`,
            eventAt,
            impact: "high" as const,
            source: this.name,
            sourceUrl: url.toString().replace(apiKey(), "REDACTED"),
            metadata: {
              providerSymbol: symbol.providerSymbol,
              estimate: row.estimate || null,
              currency: row.currency || null,
            },
          } satisfies MarketEventInput,
        ];
      });
    });
    return events.flat();
  }
}

export const alphaVantageProvider = new AlphaVantageProvider();
