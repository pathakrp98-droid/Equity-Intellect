import assert from "node:assert/strict";
import test from "node:test";

import { AlphaVantageProvider } from "./alphaVantageProvider";

const originalFetch = globalThis.fetch;

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("Yahoo quote mapping preserves the portfolio ticker", async () => {
  globalThis.fetch = async () =>
    jsonResponse({
      chart: {
        result: [
          {
            meta: {
              symbol: "INFY.NS",
              regularMarketPrice: 1500,
              chartPreviousClose: 1480,
              regularMarketTime: 1784419200,
              currency: "INR",
              exchangeName: "NSE",
            },
          },
        ],
        error: null,
      },
    });
  try {
    const provider = new AlphaVantageProvider();
    const quotes = await provider.fetchQuotes!({
      symbols: [
        { ticker: "INFY", exchange: "NSE", providerSymbol: "INFY.BSE" },
      ],
      now: new Date("2026-07-19T00:00:00Z"),
    });
    assert.equal(quotes[0].symbol, "INFY");
    assert.equal(quotes[0].value, 1500);
    assert.equal(quotes[0].metadata?.previousClose, 1480);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("quote fetching uses bounded symbol concurrency", async () => {
  let active = 0;
  let maximumActive = 0;
  globalThis.fetch = async (input) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
    const symbol = String(input).split("/").pop()?.split("?")[0] ?? "TEST.NS";
    return jsonResponse({
      chart: {
        result: [
          {
            meta: {
              symbol,
              regularMarketPrice: 100,
              chartPreviousClose: 98,
              regularMarketTime: 1784419200,
            },
          },
        ],
        error: null,
      },
    });
  };
  try {
    const provider = new AlphaVantageProvider();
    const quotes = await provider.fetchQuotes!({
      symbols: Array.from({ length: 9 }, (_, index) => ({
        ticker: `TEST${index}`,
        exchange: "NSE",
        providerSymbol: `TEST${index}.NS`,
      })),
      now: new Date("2026-07-19T00:00:00Z"),
    });
    assert.equal(quotes.length, 9);
    assert.ok(maximumActive > 1);
    assert.ok(maximumActive <= 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
