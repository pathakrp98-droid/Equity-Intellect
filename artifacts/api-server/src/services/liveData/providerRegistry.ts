import type { MarketImportPayload } from "../intelligence/types";
import { marketIntelligenceProvider } from "../intelligence/httpProvider";
import { alphaVantageProvider } from "./alphaVantageProvider";
import type {
  LiveDataProvider,
  LiveDataProviderContext,
  ProviderCapabilitySet,
} from "./types";

class NormalizedHttpProviderAdapter implements LiveDataProvider {
  readonly name = "normalized-http";
  readonly capabilities: ProviderCapabilitySet = {
    quotes: false,
    news: false,
    calendar: false,
    corporateActions: false,
    snapshot: true,
  };

  isConfigured(): boolean {
    return marketIntelligenceProvider.isConfigured();
  }

  configurationHint(): string {
    return "Set MARKET_INTELLIGENCE_URL and optionally MARKET_INTELLIGENCE_API_KEY. The endpoint must return AlphaDesk normalized v1 JSON.";
  }

  async fetchSnapshot(context: LiveDataProviderContext): Promise<MarketImportPayload> {
    return marketIntelligenceProvider.fetchSnapshot(
      context.symbols.map((symbol) => symbol.ticker),
    );
  }
}

const providers: LiveDataProvider[] = [
  new NormalizedHttpProviderAdapter(),
  alphaVantageProvider,
];

export function listLiveDataProviders(): LiveDataProvider[] {
  return [...providers];
}

export function getLiveDataProvider(name: string): LiveDataProvider | null {
  return providers.find((provider) => provider.name === name) ?? null;
}
