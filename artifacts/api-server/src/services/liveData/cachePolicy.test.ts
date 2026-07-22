import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCacheWindow,
  getCacheState,
  stableSymbolCacheKey,
} from "./cachePolicy";

test("cache state transitions from fresh to stale fallback to expired", () => {
  const now = new Date("2026-07-19T00:00:00Z");
  const window = buildCacheWindow(now, 10, 20);
  assert.equal(getCacheState(window, new Date("2026-07-19T00:05:00Z")), "fresh");
  assert.equal(
    getCacheState(window, new Date("2026-07-19T00:15:00Z")),
    "stale_fallback",
  );
  assert.equal(
    getCacheState(window, new Date("2026-07-19T00:31:00Z")),
    "expired",
  );
});

test("symbol cache key is stable regardless of input order", () => {
  const first = stableSymbolCacheKey("quotes", [
    { ticker: "INFY", providerSymbol: "INFY.BSE" },
    { ticker: "TCS", providerSymbol: "TCS.BSE" },
  ]);
  const second = stableSymbolCacheKey("quotes", [
    { ticker: "TCS", providerSymbol: "TCS.BSE" },
    { ticker: "INFY", providerSymbol: "INFY.BSE" },
  ]);
  assert.equal(first, second);
});
