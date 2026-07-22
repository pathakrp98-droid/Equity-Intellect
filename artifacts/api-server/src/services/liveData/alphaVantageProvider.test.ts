import assert from "node:assert/strict";
import test from "node:test";

import { AlphaVantageProvider } from "./alphaVantageProvider";

const originalFetch = globalThis.fetch;
const originalKey = process.env.ALPHA_VANTAGE_API_KEY;

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("Alpha Vantage quote mapping preserves portfolio ticker", async () => {
  process.env.ALPHA_VANTAGE_API_KEY = "test-key";
  globalThis.fetch = async () =>
    jsonResponse({
      "Global Quote": {
        "01. symbol": "INFY.BSE",
        "05. price": "1500.00",
        "08. previous close": "1480.00",
        "09. change": "20.00",
        "10. change percent": "1.3514%",
        "07. latest trading day": "2026-07-18",
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
    if (originalKey === undefined) delete process.env.ALPHA_VANTAGE_API_KEY;
    else process.env.ALPHA_VANTAGE_API_KEY = originalKey;
  }
});
