import type { MarketPointInput } from "../intelligence/types";
import type {
  LiveDataProvider,
  LiveDataProviderContext,
  ProviderSymbol,
} from "./types";

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        exchangeName?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime?: number;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
}

function candidateSymbols(symbol: ProviderSymbol): string[] {
  const mapped = symbol.providerSymbol.trim().toUpperCase();
  const base = symbol.ticker.trim().toUpperCase().replace(/-F$/, "");
  const candidates = [
    `${base}.NS`,
    `${base}.BO`,
    ...(mapped.includes(".") ? [mapped] : []),
    base,
  ];
  return [...new Set(candidates.filter(Boolean))];
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchYahooQuote(providerSymbol: string) {
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}`,
  );
  url.searchParams.set("range", "5d");
  url.searchParams.set("interval", "1d");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as YahooChartResponse;
    const result = payload.chart?.result?.[0];
    const meta = result?.meta;
    const price = finiteNumber(meta?.regularMarketPrice);

    if (!meta || price === null || price <= 0) {
      throw new Error(
        payload.chart?.error?.description ||
          "Yahoo Finance returned no usable quote",
      );
    }

    const previousClose =
      finiteNumber(meta.chartPreviousClose) ?? finiteNumber(meta.previousClose);
    const change = previousClose === null ? null : price - previousClose;
    const changePct =
      previousClose !== null && previousClose !== 0 && change !== null
        ? (change / previousClose) * 100
        : null;
    const asOf = meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000)
      : new Date();

    return {
      providerSymbol,
      url: url.toString(),
      price,
      previousClose,
      change,
      changePct,
      asOf,
      currency: meta.currency ?? "INR",
      exchange: meta.exchangeName ?? "NSE",
    };
  } finally {
    clearTimeout(timer);
  }
}

export class AlphaVantageProvider implements LiveDataProvider {
  readonly name = "alpha-vantage";
  readonly capabilities = {
    quotes: true,
    news: false,
    calendar: false,
    corporateActions: false,
    snapshot: false,
  } as const;

  isConfigured(): boolean {
    return true;
  }

  configurationHint(): string {
    return "Indian equity and ETF quotes use Yahoo Finance with automatic NSE/BSE fallback.";
  }

  async fetchQuotes(
    context: LiveDataProviderContext,
  ): Promise<MarketPointInput[]> {
    const points: MarketPointInput[] = [];
    const failures: string[] = [];

    for (const symbol of context.symbols) {
      let lastError = "quote lookup failed";

      for (const candidate of candidateSymbols(symbol)) {
        try {
          const quote = await fetchYahooQuote(candidate);
          points.push({
            kind: "equity",
            symbol: symbol.ticker,
            name: symbol.ticker,
            value: quote.price,
            change: quote.change,
            changePct: quote.changePct,
            unit: quote.currency,
            region: quote.exchange,
            source: "yahoo-finance",
            sourceUrl: quote.url,
            asOf: quote.asOf,
            metadata: {
              providerSymbol: quote.providerSymbol,
              previousClose: quote.previousClose,
            },
          });
          lastError = "";
          break;
        } catch (error) {
          lastError =
            error instanceof Error ? error.message : "quote lookup failed";
        }
      }

      if (lastError) failures.push(`${symbol.ticker}: ${lastError}`);
    }

    if (points.length === 0) {
      throw new Error(
        `No usable Yahoo Finance quotes were returned. ${failures
          .slice(0, 5)
          .join("; ")}`,
      );
    }

    return points;
  }
}

export const alphaVantageProvider = new AlphaVantageProvider();
