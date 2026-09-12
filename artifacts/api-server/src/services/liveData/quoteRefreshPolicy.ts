import type { AutomaticAttemptStatus } from "./priceRefreshRepository";
import type {
  ProviderCapabilitySet,
  ProviderRefreshDiagnostic,
} from "./types";

export function providerSupportsQuoteOnlyRefresh(
  capabilities: ProviderCapabilitySet,
): boolean {
  return capabilities.quotes === true;
}

export function isUsableQuoteValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function shouldReplaceMarketPrice(
  existingSource: string | undefined,
  preserveExplicitManual: boolean,
): boolean {
  return !(preserveExplicitManual && existingSource === "manual");
}

export function classifyQuoteRefresh(input: {
  expectedSymbols: number;
  receivedSymbols: number;
  diagnostics: ProviderRefreshDiagnostic[];
}): AutomaticAttemptStatus {
  if (input.expectedSymbols < 1 || input.receivedSymbols < 1) return "failed";
  const hasFreshSuccess = input.diagnostics.some(
    (item) =>
      item.capability === "quotes" &&
      item.status === "success" &&
      item.records > 0,
  );
  const hasNonFreshResult = input.diagnostics.some(
    (item) =>
      item.capability === "quotes" &&
      item.status !== "success" &&
      item.status !== "skipped",
  );
  return hasFreshSuccess &&
    !hasNonFreshResult &&
    input.receivedSymbols >= input.expectedSymbols
    ? "fresh"
    : "partial";
}
