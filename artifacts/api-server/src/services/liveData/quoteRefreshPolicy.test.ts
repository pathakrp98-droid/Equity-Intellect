import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyQuoteRefresh,
  isUsableQuoteValue,
  providerSupportsQuoteOnlyRefresh,
  shouldReplaceMarketPrice,
} from "./quoteRefreshPolicy";

describe("quote-only refresh policy", () => {
  it("selects only a provider with a direct quote capability", () => {
    assert.equal(
      providerSupportsQuoteOnlyRefresh({
        quotes: true,
        news: true,
        calendar: true,
        corporateActions: true,
        snapshot: false,
      }),
      true,
    );
    assert.equal(
      providerSupportsQuoteOnlyRefresh({
        quotes: false,
        news: false,
        calendar: false,
        corporateActions: false,
        snapshot: true,
      }),
      false,
    );
  });

  it("accepts only finite positive live quote values", () => {
    assert.equal(isUsableQuoteValue(250.5), true);
    assert.equal(isUsableQuoteValue(0), false);
    assert.equal(isUsableQuoteValue(-1), false);
    assert.equal(isUsableQuoteValue(Number.NaN), false);
    assert.equal(isUsableQuoteValue(Number.POSITIVE_INFINITY), false);
  });

  it("classifies a complete provider success as fresh", () => {
    assert.equal(
      classifyQuoteRefresh({
        expectedSymbols: 3,
        receivedSymbols: 3,
        diagnostics: [
          {
            provider: "alpha-vantage",
            capability: "quotes",
            status: "success",
            records: 3,
          },
        ],
      }),
      "fresh",
    );
  });

  it("keeps missing, cached, and stale-fallback results partial", () => {
    for (const input of [
      {
        expectedSymbols: 3,
        receivedSymbols: 2,
        diagnostics: [
          {
            provider: "alpha-vantage" as const,
            capability: "quotes" as const,
            status: "success" as const,
            records: 2,
          },
        ],
      },
      {
        expectedSymbols: 3,
        receivedSymbols: 3,
        diagnostics: [
          {
            provider: "alpha-vantage" as const,
            capability: "quotes" as const,
            status: "cached" as const,
            records: 3,
          },
        ],
      },
      {
        expectedSymbols: 3,
        receivedSymbols: 3,
        diagnostics: [
          {
            provider: "alpha-vantage" as const,
            capability: "quotes" as const,
            status: "stale_fallback" as const,
            records: 3,
          },
        ],
      },
    ]) {
      assert.equal(classifyQuoteRefresh(input), "partial");
    }
  });

  it("classifies zero usable quotes or only failures as failed", () => {
    assert.equal(
      classifyQuoteRefresh({
        expectedSymbols: 3,
        receivedSymbols: 0,
        diagnostics: [
          {
            provider: "alpha-vantage",
            capability: "quotes",
            status: "failed",
            records: 0,
          },
        ],
      }),
      "failed",
    );
    assert.equal(
      classifyQuoteRefresh({
        expectedSymbols: 0,
        receivedSymbols: 0,
        diagnostics: [],
      }),
      "failed",
    );
  });

  it("protects explicit manual prices but upgrades import fallbacks", () => {
    assert.equal(shouldReplaceMarketPrice("manual", true), false);
    assert.equal(shouldReplaceMarketPrice("manual_holding", true), true);
    assert.equal(shouldReplaceMarketPrice("holdings_csv", true), true);
    assert.equal(shouldReplaceMarketPrice("yahoo-finance", true), true);
    assert.equal(shouldReplaceMarketPrice("manual", false), true);
    assert.equal(shouldReplaceMarketPrice(undefined, true), true);
  });
});
