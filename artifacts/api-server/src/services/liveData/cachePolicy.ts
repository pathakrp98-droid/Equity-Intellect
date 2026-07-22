export interface CacheWindow {
  fetchedAt: Date;
  expiresAt: Date;
  staleIfErrorUntil: Date;
}

export type CacheState = "fresh" | "stale_fallback" | "expired";

export function buildCacheWindow(
  now: Date,
  ttlMinutes: number,
  staleIfErrorMinutes: number,
): CacheWindow {
  const safeTtl = Math.max(1, Math.floor(ttlMinutes));
  const safeStale = Math.max(0, Math.floor(staleIfErrorMinutes));
  const expiresAt = new Date(now.getTime() + safeTtl * 60_000);
  return {
    fetchedAt: now,
    expiresAt,
    staleIfErrorUntil: new Date(expiresAt.getTime() + safeStale * 60_000),
  };
}

export function getCacheState(
  window: Pick<CacheWindow, "expiresAt" | "staleIfErrorUntil">,
  now: Date,
): CacheState {
  if (now.getTime() <= window.expiresAt.getTime()) return "fresh";
  if (now.getTime() <= window.staleIfErrorUntil.getTime()) {
    return "stale_fallback";
  }
  return "expired";
}

export function cacheAgeMinutes(fetchedAt: Date, now: Date): number {
  return Math.max(0, (now.getTime() - fetchedAt.getTime()) / 60_000);
}

export function stableSymbolCacheKey(
  capability: string,
  symbols: Array<{ ticker: string; providerSymbol: string }>,
): string {
  const token = symbols
    .map((symbol) => `${symbol.ticker}:${symbol.providerSymbol}`)
    .sort()
    .join("|");
  return `${capability}:${token || "none"}`;
}
