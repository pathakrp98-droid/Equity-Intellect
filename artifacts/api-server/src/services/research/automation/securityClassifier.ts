import type { SecurityType } from "@workspace/research-contracts";

export interface SecurityClassificationInput {
  ticker: string | null;
  name: string | null;
  exchange: string | null;
  isin: string | null;
}

export interface SecurityClassificationResult {
  securityType: SecurityType;
  confidence: "high" | "moderate" | "limited";
  reasons: string[];
}

function normalized(value: string | null): string {
  return value?.trim().toUpperCase() ?? "";
}

function classifyConfidence(candidateCount: number, hasIsin: boolean): SecurityClassificationResult["confidence"] {
  if (candidateCount >= 2 || hasIsin) return "high";
  if (candidateCount === 1) return "moderate";
  return "limited";
}

export function classifySecurity(
  input: SecurityClassificationInput,
): SecurityClassificationResult {
  const ticker = normalized(input.ticker);
  const name = normalized(input.name);
  const exchange = normalized(input.exchange);
  const isin = normalized(input.isin);
  const candidates = new Set<SecurityType>();
  const reasons: string[] = [];

  const isUnlistedExchange = ["UNLISTED", "PRIVATE"].includes(exchange);
  const hasEtfName = /\b(ETF|EXCHANGE TRADED FUND)\b/.test(name);
  const hasEtfTicker = /(BEES|ETF)$/.test(ticker);
  const hasMutualFundName = /\b(MUTUAL FUND|LIQUID FUND)\b/.test(name);
  const hasEquityName = /\b(LIMITED|LTD|INDUSTRIES|CORPORATION|CORP|BANK)\b/.test(name);
  const isListedExchange = ["NSE", "BSE"].includes(exchange);

  if (isUnlistedExchange) {
    candidates.add("unlisted");
    reasons.push(`${exchange} explicitly identifies the security as unlisted.`);
  }
  if (hasEtfName || hasEtfTicker) {
    candidates.add("etf");
    if (hasEtfName) reasons.push("The security name explicitly identifies an ETF.");
    if (hasEtfTicker) reasons.push("The ticker uses an ETF naming convention.");
  }
  if (hasMutualFundName) {
    candidates.add("mutual_fund");
    reasons.push("The security name explicitly identifies a mutual fund.");
  }
  if (!isUnlistedExchange && isListedExchange && (isin.length > 0 || hasEquityName)) {
    candidates.add("equity");
    if (isin.length > 0) reasons.push(`${exchange} listing and ISIN support listed equity classification.`);
    if (hasEquityName) reasons.push("The security name uses a listed-company convention.");
  }

  if (candidates.size !== 1) {
    if (candidates.size > 1) {
      reasons.push("Classification signals conflict, so identity needs review.");
    } else {
      reasons.push("The holding identity does not provide enough explicit classification evidence.");
    }
    return { securityType: "unknown", confidence: "limited", reasons };
  }

  const [securityType] = candidates;
  return {
    securityType,
    confidence: classifyConfidence(reasons.length, isin.length > 0),
    reasons,
  };
}
