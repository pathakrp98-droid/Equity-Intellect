import type { MarketImportPayload } from "./types";

export interface MarketIntelligenceProvider {
  readonly name: string;
  isConfigured(): boolean;
  fetchSnapshot(tickers: string[]): Promise<MarketImportPayload>;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export class NormalizedHttpMarketProvider implements MarketIntelligenceProvider {
  readonly name = process.env.MARKET_INTELLIGENCE_PROVIDER_NAME?.trim() || "normalized-http";

  isConfigured(): boolean {
    return Boolean(process.env.MARKET_INTELLIGENCE_URL?.trim());
  }

  async fetchSnapshot(tickers: string[]): Promise<MarketImportPayload> {
    const endpoint = process.env.MARKET_INTELLIGENCE_URL?.trim();
    if (!endpoint) throw new Error("MARKET_INTELLIGENCE_URL is not configured");

    const url = new URL(endpoint);
    if (tickers.length > 0) url.searchParams.set("tickers", tickers.join(","));
    url.searchParams.set("format", "alphadesk-normalized-v1");

    const timeoutMs = readPositiveInteger(
      process.env.MARKET_INTELLIGENCE_TIMEOUT_MS,
      20_000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const apiKey = process.env.MARKET_INTELLIGENCE_API_KEY?.trim();
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Market provider returned HTTP ${response.status}`);
      }
      const payload = (await response.json()) as MarketImportPayload;
      return {
        ...payload,
        provider: payload.provider?.trim() || this.name,
        fetchedAt: payload.fetchedAt ?? new Date().toISOString(),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const marketIntelligenceProvider = new NormalizedHttpMarketProvider();
