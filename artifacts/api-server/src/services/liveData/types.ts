import type {
  MarketEventInput,
  MarketImportPayload,
  MarketNewsInput,
  MarketPointInput,
} from "../intelligence/types";

export interface ProviderSymbol {
  ticker: string;
  exchange: string;
  providerSymbol: string;
}

export interface LiveDataProviderContext {
  symbols: ProviderSymbol[];
  now: Date;
}

export interface ProviderCapabilitySet {
  quotes: boolean;
  news: boolean;
  calendar: boolean;
  corporateActions: boolean;
  snapshot: boolean;
}

export interface LiveDataProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilitySet;
  isConfigured(): boolean;
  configurationHint(): string;
  fetchSnapshot?(context: LiveDataProviderContext): Promise<MarketImportPayload>;
  fetchQuotes?(context: LiveDataProviderContext): Promise<MarketPointInput[]>;
  fetchNews?(context: LiveDataProviderContext): Promise<MarketNewsInput[]>;
  fetchCalendar?(context: LiveDataProviderContext): Promise<MarketEventInput[]>;
  fetchCorporateActions?(
    context: LiveDataProviderContext,
  ): Promise<MarketEventInput[]>;
}

export interface ProviderRefreshDiagnostic {
  provider: string;
  capability: keyof ProviderCapabilitySet;
  status: "success" | "cached" | "stale_fallback" | "failed" | "skipped";
  records: number;
  message?: string;
  cacheAgeMinutes?: number;
}
