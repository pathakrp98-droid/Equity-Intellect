import {
  db,
  liveDataPreferencesTable,
  liveDataProviderCacheTable,
  liveDataSymbolMappingsTable,
  marketDataPointsTable,
  marketEventsTable,
  marketNewsTable,
  marketProviderRunsTable,
} from "@workspace/db";
import { and, asc, desc, eq, lt } from "drizzle-orm";

import { marketIntelligenceService } from "../intelligence/marketIntelligenceService";
import type {
  MarketEventInput,
  MarketImportPayload,
  MarketNewsInput,
  MarketPointInput,
} from "../intelligence/types";
import { portfolioService } from "../portfolio/portfolioService";
import {
  buildCacheWindow,
  cacheAgeMinutes,
  getCacheState,
  stableSymbolCacheKey,
} from "./cachePolicy";
import { listLiveDataProviders } from "./providerRegistry";
import type {
  LiveDataProvider,
  ProviderRefreshDiagnostic,
  ProviderSymbol,
} from "./types";

export interface UpdateLiveDataPreferencesInput {
  providerPriority?: string[];
  autoSyncPortfolio?: boolean;
  autoEvaluateAlerts?: boolean;
  quoteTtlMinutes?: number;
  newsTtlMinutes?: number;
  calendarTtlMinutes?: number;
  staleIfErrorMinutes?: number;
  maxSymbolsPerRefresh?: number;
}

export interface UpsertSymbolMappingInput {
  ticker: string;
  exchange?: string;
  provider: string;
  providerSymbol: string;
  isEnabled?: boolean;
}

type Capability = "snapshot" | "quotes" | "news" | "calendar" | "corporateActions";

function normalizeTicker(value: string): string {
  const ticker = value.trim().toUpperCase();
  if (!ticker || ticker.length > 30 || !/^[A-Z0-9._&-]+$/.test(ticker)) {
    throw new Error("ticker is invalid");
  }
  return ticker;
}

function cleanProvider(value: string): string {
  const provider = value.trim().toLowerCase();
  if (!provider || provider.length > 120 || !/^[a-z0-9._-]+$/.test(provider)) {
    throw new Error("provider is invalid");
  }
  return provider;
}

function boundedInteger(
  value: number | undefined,
  minimum: number,
  maximum: number,
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) throw new Error("Preference value must be numeric");
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class LiveDataService {
  async getPreferences(userId: string) {
    const [existing] = await db
      .select()
      .from(liveDataPreferencesTable)
      .where(eq(liveDataPreferencesTable.userId, userId))
      .limit(1);
    if (existing) return existing;
    const [created] = await db
      .insert(liveDataPreferencesTable)
      .values({ userId })
      .returning();
    return created;
  }

  async updatePreferences(userId: string, input: UpdateLiveDataPreferencesInput) {
    await this.getPreferences(userId);
    const knownProviders = new Set(listLiveDataProviders().map((provider) => provider.name));
    const providerPriority = input.providerPriority
      ? [...new Set(input.providerPriority.map(cleanProvider))]
      : undefined;
    if (providerPriority?.some((provider) => !knownProviders.has(provider))) {
      throw new Error("providerPriority contains an unsupported provider");
    }
    const [updated] = await db
      .update(liveDataPreferencesTable)
      .set({
        ...(providerPriority ? { providerPriority } : {}),
        ...(input.autoSyncPortfolio !== undefined
          ? { autoSyncPortfolio: input.autoSyncPortfolio }
          : {}),
        ...(input.autoEvaluateAlerts !== undefined
          ? { autoEvaluateAlerts: input.autoEvaluateAlerts }
          : {}),
        ...(boundedInteger(input.quoteTtlMinutes, 1, 1_440) !== undefined
          ? { quoteTtlMinutes: boundedInteger(input.quoteTtlMinutes, 1, 1_440)! }
          : {}),
        ...(boundedInteger(input.newsTtlMinutes, 5, 10_080) !== undefined
          ? { newsTtlMinutes: boundedInteger(input.newsTtlMinutes, 5, 10_080)! }
          : {}),
        ...(boundedInteger(input.calendarTtlMinutes, 15, 43_200) !== undefined
          ? {
              calendarTtlMinutes: boundedInteger(
                input.calendarTtlMinutes,
                15,
                43_200,
              )!,
            }
          : {}),
        ...(boundedInteger(input.staleIfErrorMinutes, 0, 43_200) !== undefined
          ? {
              staleIfErrorMinutes: boundedInteger(
                input.staleIfErrorMinutes,
                0,
                43_200,
              )!,
            }
          : {}),
        ...(boundedInteger(input.maxSymbolsPerRefresh, 1, 250) !== undefined
          ? {
              maxSymbolsPerRefresh: boundedInteger(
                input.maxSymbolsPerRefresh,
                1,
                250,
              )!,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(liveDataPreferencesTable.userId, userId))
      .returning();
    return updated;
  }

  async listMappings(userId: string) {
    return db
      .select()
      .from(liveDataSymbolMappingsTable)
      .where(eq(liveDataSymbolMappingsTable.userId, userId))
      .orderBy(
        asc(liveDataSymbolMappingsTable.provider),
        asc(liveDataSymbolMappingsTable.ticker),
      );
  }

  async upsertMapping(userId: string, input: UpsertSymbolMappingInput) {
    const ticker = normalizeTicker(input.ticker);
    const provider = cleanProvider(input.provider);
    const providerSymbol = input.providerSymbol.trim();
    if (!providerSymbol || providerSymbol.length > 120) {
      throw new Error("providerSymbol is required and must be at most 120 characters");
    }
    const [row] = await db
      .insert(liveDataSymbolMappingsTable)
      .values({
        userId,
        ticker,
        exchange: input.exchange?.trim().toUpperCase() || "NSE",
        provider,
        providerSymbol,
        isEnabled: input.isEnabled ?? true,
      })
      .onConflictDoUpdate({
        target: [
          liveDataSymbolMappingsTable.userId,
          liveDataSymbolMappingsTable.provider,
          liveDataSymbolMappingsTable.ticker,
        ],
        set: {
          exchange: input.exchange?.trim().toUpperCase() || "NSE",
          providerSymbol,
          isEnabled: input.isEnabled ?? true,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async deleteMapping(userId: string, id: number) {
    const [deleted] = await db
      .delete(liveDataSymbolMappingsTable)
      .where(
        and(
          eq(liveDataSymbolMappingsTable.id, id),
          eq(liveDataSymbolMappingsTable.userId, userId),
        ),
      )
      .returning();
    if (!deleted) throw new Error("Symbol mapping not found");
    return deleted;
  }

  private async resolveSymbols(
    userId: string,
    provider: LiveDataProvider,
    maxSymbols: number,
  ): Promise<ProviderSymbol[]> {
    const overview = await portfolioService.getOverview(userId);
    const holdings = overview.holdings.slice(0, maxSymbols);
    const mappings = (await this.listMappings(userId)).filter(
      (mapping) => mapping.provider === provider.name && mapping.isEnabled,
    );
    const mappingByTicker = new Map(mappings.map((mapping) => [mapping.ticker, mapping]));
    const defaultSuffix =
      provider.name === "alpha-vantage"
        ? process.env.ALPHA_VANTAGE_DEFAULT_SUFFIX?.trim() || "BSE"
        : undefined;
    return holdings.map((holding) => {
      const ticker = normalizeTicker(holding.ticker);
      const mapping = mappingByTicker.get(ticker);
      return {
        ticker,
        exchange: mapping?.exchange || "NSE",
        providerSymbol:
          mapping?.providerSymbol ||
          (defaultSuffix ? `${ticker}.${defaultSuffix}` : ticker),
      };
    });
  }

  private async getCache(
    userId: string,
    provider: string,
    cacheKey: string,
  ) {
    const [row] = await db
      .select()
      .from(liveDataProviderCacheTable)
      .where(
        and(
          eq(liveDataProviderCacheTable.userId, userId),
          eq(liveDataProviderCacheTable.provider, provider),
          eq(liveDataProviderCacheTable.cacheKey, cacheKey),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async storeCache(
    userId: string,
    provider: string,
    cacheKey: string,
    kind: "quotes" | "news" | "calendar" | "corporate_actions" | "snapshot",
    data: unknown,
    ttlMinutes: number,
    staleIfErrorMinutes: number,
    now: Date,
    warnings: string[] = [],
  ) {
    const window = buildCacheWindow(now, ttlMinutes, staleIfErrorMinutes);
    const payload = jsonClone({ data, warnings, metadata: {} });
    const [row] = await db
      .insert(liveDataProviderCacheTable)
      .values({
        userId,
        provider,
        cacheKey,
        kind,
        payload,
        ...window,
        lastError: null,
      })
      .onConflictDoUpdate({
        target: [
          liveDataProviderCacheTable.userId,
          liveDataProviderCacheTable.provider,
          liveDataProviderCacheTable.cacheKey,
        ],
        set: {
          kind,
          payload,
          ...window,
          lastError: null,
          updatedAt: now,
        },
      })
      .returning();
    return row;
  }

  private async recordCacheError(
    userId: string,
    provider: string,
    cacheKey: string,
    error: string,
  ) {
    await db
      .update(liveDataProviderCacheTable)
      .set({ lastError: error, updatedAt: new Date() })
      .where(
        and(
          eq(liveDataProviderCacheTable.userId, userId),
          eq(liveDataProviderCacheTable.provider, provider),
          eq(liveDataProviderCacheTable.cacheKey, cacheKey),
        ),
      );
  }

  private async fetchWithCache<T>(input: {
    userId: string;
    provider: LiveDataProvider;
    capability: Capability;
    cacheKind: "quotes" | "news" | "calendar" | "corporate_actions" | "snapshot";
    symbols: ProviderSymbol[];
    ttlMinutes: number;
    staleIfErrorMinutes: number;
    force: boolean;
    fetcher: () => Promise<T>;
  }): Promise<{ data: T | null; diagnostic: ProviderRefreshDiagnostic }> {
    const now = new Date();
    const cacheKey = stableSymbolCacheKey(input.capability, input.symbols);
    const cached = await this.getCache(
      input.userId,
      input.provider.name,
      cacheKey,
    );
    if (cached && !input.force && getCacheState(cached, now) === "fresh") {
      return {
        data: cached.payload.data as T,
        diagnostic: {
          provider: input.provider.name,
          capability: input.capability,
          status: "cached",
          records: Array.isArray(cached.payload.data) ? cached.payload.data.length : 1,
          cacheAgeMinutes: cacheAgeMinutes(cached.fetchedAt, now),
        },
      };
    }

    try {
      const data = await input.fetcher();
      await this.storeCache(
        input.userId,
        input.provider.name,
        cacheKey,
        input.cacheKind,
        data,
        input.ttlMinutes,
        input.staleIfErrorMinutes,
        now,
      );
      return {
        data,
        diagnostic: {
          provider: input.provider.name,
          capability: input.capability,
          status: "success",
          records: Array.isArray(data) ? data.length : 1,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider request failed";
      if (cached) await this.recordCacheError(input.userId, input.provider.name, cacheKey, message);
      if (cached && getCacheState(cached, now) === "stale_fallback") {
        return {
          data: cached.payload.data as T,
          diagnostic: {
            provider: input.provider.name,
            capability: input.capability,
            status: "stale_fallback",
            records: Array.isArray(cached.payload.data)
              ? cached.payload.data.length
              : 1,
            message,
            cacheAgeMinutes: cacheAgeMinutes(cached.fetchedAt, now),
          },
        };
      }
      return {
        data: null,
        diagnostic: {
          provider: input.provider.name,
          capability: input.capability,
          status: "failed",
          records: 0,
          message,
        },
      };
    }
  }

  async refresh(userId: string, options: { force?: boolean } = {}) {
    const preferences = await this.getPreferences(userId);
    const providersByName = new Map(
      listLiveDataProviders().map((provider) => [provider.name, provider]),
    );
    const orderedProviders = preferences.providerPriority
      .map((name) => providersByName.get(name))
      .filter((provider): provider is LiveDataProvider => Boolean(provider));
    const diagnostics: ProviderRefreshDiagnostic[] = [];
    const imports: Array<{ provider: string; imported: Awaited<ReturnType<typeof marketIntelligenceService.importNormalizedData>> }> = [];
    const capabilitySatisfied = {
      quotes: false,
      news: false,
      calendar: false,
      corporateActions: false,
    };

    for (const provider of orderedProviders) {
      const startedAt = new Date();
      const [run] = await db
        .insert(marketProviderRunsTable)
        .values({
          userId,
          provider: provider.name,
          status: provider.isConfigured() ? "running" : "skipped",
          startedAt,
          completedAt: provider.isConfigured() ? null : startedAt,
          metadata: { capabilities: provider.capabilities },
        })
        .returning();

      if (!provider.isConfigured()) {
        diagnostics.push({
          provider: provider.name,
          capability: "snapshot",
          status: "skipped",
          records: 0,
          message: provider.configurationHint(),
        });
        continue;
      }

      const symbols = await this.resolveSymbols(
        userId,
        provider,
        preferences.maxSymbolsPerRefresh,
      );
      const context = { symbols, now: startedAt };
      let payload: MarketImportPayload = {
        provider: provider.name,
        fetchedAt: startedAt,
        points: [],
        news: [],
        events: [],
      };

      if (provider.capabilities.snapshot && provider.fetchSnapshot) {
        const result = await this.fetchWithCache({
          userId,
          provider,
          capability: "snapshot",
          cacheKind: "snapshot",
          symbols,
          ttlMinutes: Math.min(
            preferences.quoteTtlMinutes,
            preferences.newsTtlMinutes,
          ),
          staleIfErrorMinutes: preferences.staleIfErrorMinutes,
          force: options.force ?? false,
          fetcher: () => provider.fetchSnapshot!(context),
        });
        diagnostics.push(result.diagnostic);
        if (result.data) payload = { ...result.data, provider: provider.name };
      } else {
        if (!capabilitySatisfied.quotes && provider.capabilities.quotes && provider.fetchQuotes) {
          const result = await this.fetchWithCache<MarketPointInput[]>({
            userId,
            provider,
            capability: "quotes",
            cacheKind: "quotes",
            symbols,
            ttlMinutes: preferences.quoteTtlMinutes,
            staleIfErrorMinutes: preferences.staleIfErrorMinutes,
            force: options.force ?? false,
            fetcher: () => provider.fetchQuotes!(context),
          });
          diagnostics.push(result.diagnostic);
          payload.points = result.data ?? [];
        }
        if (!capabilitySatisfied.news && provider.capabilities.news && provider.fetchNews) {
          const result = await this.fetchWithCache<MarketNewsInput[]>({
            userId,
            provider,
            capability: "news",
            cacheKind: "news",
            symbols,
            ttlMinutes: preferences.newsTtlMinutes,
            staleIfErrorMinutes: preferences.staleIfErrorMinutes,
            force: options.force ?? false,
            fetcher: () => provider.fetchNews!(context),
          });
          diagnostics.push(result.diagnostic);
          payload.news = result.data ?? [];
        }
        if (
          !capabilitySatisfied.calendar &&
          provider.capabilities.calendar &&
          provider.fetchCalendar
        ) {
          const result = await this.fetchWithCache<MarketEventInput[]>({
            userId,
            provider,
            capability: "calendar",
            cacheKind: "calendar",
            symbols,
            ttlMinutes: preferences.calendarTtlMinutes,
            staleIfErrorMinutes: preferences.staleIfErrorMinutes,
            force: options.force ?? false,
            fetcher: () => provider.fetchCalendar!(context),
          });
          diagnostics.push(result.diagnostic);
          payload.events = [...(payload.events ?? []), ...(result.data ?? [])];
        }
        if (
          !capabilitySatisfied.corporateActions &&
          provider.capabilities.corporateActions &&
          provider.fetchCorporateActions
        ) {
          const result = await this.fetchWithCache<MarketEventInput[]>({
            userId,
            provider,
            capability: "corporateActions",
            cacheKind: "corporate_actions",
            symbols,
            ttlMinutes: preferences.calendarTtlMinutes,
            staleIfErrorMinutes: preferences.staleIfErrorMinutes,
            force: options.force ?? false,
            fetcher: () => provider.fetchCorporateActions!(context),
          });
          diagnostics.push(result.diagnostic);
          payload.events = [...(payload.events ?? []), ...(result.data ?? [])];
        }
      }

      const recordCount =
        (payload.points?.length ?? 0) +
        (payload.news?.length ?? 0) +
        (payload.events?.length ?? 0);
      const failedForProvider = diagnostics.filter(
        (diagnostic) =>
          diagnostic.provider === provider.name && diagnostic.status === "failed",
      );
      if (recordCount > 0) {
        const imported = await marketIntelligenceService.importNormalizedData(
          userId,
          payload,
          provider.name,
          { syncPortfolioPrices: preferences.autoSyncPortfolio },
        );
        imports.push({ provider: provider.name, imported });
        if ((payload.points?.length ?? 0) > 0) capabilitySatisfied.quotes = true;
        if ((payload.news?.length ?? 0) > 0) capabilitySatisfied.news = true;
        if ((payload.events ?? []).some((event) => event.eventType === "earnings")) {
          capabilitySatisfied.calendar = true;
        }
        if (
          (payload.events ?? []).some((event) =>
            ["corporate_action", "dividend"].includes(event.eventType),
          )
        ) {
          capabilitySatisfied.corporateActions = true;
        }
        await db
          .update(marketProviderRunsTable)
          .set({
            status: failedForProvider.length > 0 ? "partial" : "success",
            completedAt: new Date(),
            recordsUpserted: imported.total,
            metadata: {
              diagnostics: diagnostics.filter(
                (diagnostic) => diagnostic.provider === provider.name,
              ),
              warnings: imported.warnings,
            },
          })
          .where(eq(marketProviderRunsTable.id, run.id));
      } else {
        await db
          .update(marketProviderRunsTable)
          .set({
            status: failedForProvider.length > 0 ? "failed" : "partial",
            completedAt: new Date(),
            recordsUpserted: 0,
            error: failedForProvider.map((item) => item.message).filter(Boolean).join("; ") || null,
            metadata: {
              diagnostics: diagnostics.filter(
                (diagnostic) => diagnostic.provider === provider.name,
              ),
            },
          })
          .where(eq(marketProviderRunsTable.id, run.id));
      }
    }

    return {
      refreshedAt: new Date(),
      configuredProviderCount: orderedProviders.filter((provider) => provider.isConfigured()).length,
      imports,
      diagnostics,
      satisfiedCapabilities: capabilitySatisfied,
      preferences,
    };
  }

  async getStatus(userId: string) {
    const [preferences, mappings, latestRuns, latestPoint, latestNews, latestEvent, cacheRows] =
      await Promise.all([
        this.getPreferences(userId),
        this.listMappings(userId),
        db
          .select()
          .from(marketProviderRunsTable)
          .where(eq(marketProviderRunsTable.userId, userId))
          .orderBy(desc(marketProviderRunsTable.startedAt))
          .limit(20),
        db
          .select()
          .from(marketDataPointsTable)
          .where(eq(marketDataPointsTable.userId, userId))
          .orderBy(desc(marketDataPointsTable.asOf))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select()
          .from(marketNewsTable)
          .where(eq(marketNewsTable.userId, userId))
          .orderBy(desc(marketNewsTable.publishedAt))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select()
          .from(marketEventsTable)
          .where(eq(marketEventsTable.userId, userId))
          .orderBy(desc(marketEventsTable.eventAt))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select()
          .from(liveDataProviderCacheTable)
          .where(eq(liveDataProviderCacheTable.userId, userId)),
      ]);
    const now = new Date();
    return {
      providers: listLiveDataProviders().map((provider) => ({
        name: provider.name,
        configured: provider.isConfigured(),
        capabilities: provider.capabilities,
        configurationHint: provider.configurationHint(),
      })),
      preferences,
      mappings,
      latestRuns,
      latestData: {
        quoteAsOf: latestPoint?.asOf ?? null,
        newsPublishedAt: latestNews?.publishedAt ?? null,
        calendarEventAt: latestEvent?.eventAt ?? null,
      },
      cache: {
        entries: cacheRows.length,
        fresh: cacheRows.filter((row) => getCacheState(row, now) === "fresh").length,
        staleFallback: cacheRows.filter(
          (row) => getCacheState(row, now) === "stale_fallback",
        ).length,
        expired: cacheRows.filter((row) => getCacheState(row, now) === "expired").length,
      },
      secretsStoredInDatabase: false,
    };
  }

  async listRuns(userId: string, limit = 50) {
    return db
      .select()
      .from(marketProviderRunsTable)
      .where(eq(marketProviderRunsTable.userId, userId))
      .orderBy(desc(marketProviderRunsTable.startedAt))
      .limit(Math.max(1, Math.min(200, limit)));
  }

  async purgeExpiredCache(userId: string) {
    const deleted = await db
      .delete(liveDataProviderCacheTable)
      .where(
        and(
          eq(liveDataProviderCacheTable.userId, userId),
          lt(liveDataProviderCacheTable.staleIfErrorUntil, new Date()),
        ),
      )
      .returning({ id: liveDataProviderCacheTable.id });
    return { deleted: deleted.length };
  }
}

export const liveDataService = new LiveDataService();
