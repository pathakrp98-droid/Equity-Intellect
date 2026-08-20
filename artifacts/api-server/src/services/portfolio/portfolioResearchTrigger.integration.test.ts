import assert from "node:assert/strict";
import test from "node:test";

import { buildHoldingResearchTrigger } from "../research/automation/researchTriggers";

const BASE = {
  ticker: "RELIANCE",
  name: "Reliance Industries",
  exchange: "NSE",
  sector: "Energy",
  isin: "INE002A01018",
  quantity: 10,
  marketPrice: 120,
  allocationPct: 8,
  unrealizedPnl: 100,
};

test("portfolio research trigger: volatile portfolio values do not change the holding identity fingerprint", () => {
  const original = buildHoldingResearchTrigger("user-a", 7, [BASE]);
  const repriced = buildHoldingResearchTrigger("user-a", 7, [
    {
      ...BASE,
      quantity: 999,
      marketPrice: 9999,
      allocationPct: 42,
      unrealizedPnl: -500,
    },
  ]);

  assert.equal(original.dedupeKey, repriced.dedupeKey);
  assert.equal(
    original.payload.holdingFingerprint,
    repriced.payload.holdingFingerprint,
  );
  assert.equal(original.trigger, "portfolio_reconciled");
  assert.equal(original.portfolioId, 7);
});

test("portfolio research trigger: identity changes and holding removals change the fingerprint", () => {
  const original = buildHoldingResearchTrigger("user-a", 7, [BASE]);
  for (const changed of [
    { ...BASE, ticker: "RIL" },
    { ...BASE, name: "Reliance Industries Ltd" },
    { ...BASE, exchange: "BSE" },
    { ...BASE, sector: "Industrials" },
    { ...BASE, isin: "INE002A01026" },
  ]) {
    assert.notEqual(
      original.payload.holdingFingerprint,
      buildHoldingResearchTrigger("user-a", 7, [changed]).payload
        .holdingFingerprint,
    );
  }
  assert.notEqual(
    original.payload.holdingFingerprint,
    buildHoldingResearchTrigger("user-a", 7, []).payload.holdingFingerprint,
  );
});

test("portfolio research trigger: holding order is deterministic", () => {
  const second = { ...BASE, ticker: "TCS", isin: "INE467B01029" };
  const left = buildHoldingResearchTrigger("user-a", 7, [BASE, second]);
  const right = buildHoldingResearchTrigger("user-a", 7, [second, BASE]);
  assert.equal(left.dedupeKey, right.dedupeKey);
});

test("portfolio research trigger: field delimiters cannot create an identity collision", () => {
  const left = buildHoldingResearchTrigger("user-a", 7, [
    {
      ticker: "TEST",
      name: "A|B",
      exchange: "C",
      sector: "D",
      isin: "E",
    },
  ]);
  const right = buildHoldingResearchTrigger("user-a", 7, [
    {
      ticker: "TEST",
      name: "A",
      exchange: "B",
      sector: "C",
      isin: "D|E",
    },
  ]);
  assert.notEqual(left.dedupeKey, right.dedupeKey);
});
