import assert from "node:assert/strict";
import test from "node:test";

import { calculatePortfolio } from "./engine";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

test("calculates average cost, cash and unrealized P&L from the ledger", () => {
  const result = calculatePortfolio(
    [
      { type: "deposit", amount: 100_000, tradeDate: day("2025-01-01") },
      {
        type: "buy",
        ticker: "TEST",
        name: "Test Ltd",
        sector: "Industrials",
        quantity: 10,
        price: 100,
        fees: 10,
        tradeDate: day("2025-01-02"),
      },
    ],
    [{ ticker: "TEST", price: 120, previousClose: 115 }],
    day("2026-01-01"),
  );

  assert.equal(result.cashBalance, 98_990);
  assert.equal(result.marketValue, 1_200);
  assert.equal(result.totalValue, 100_190);
  assert.equal(result.holdings[0].averageCost, 101);
  assert.equal(result.holdings[0].unrealizedPnl, 190);
  assert.equal(result.holdings[0].dayChange, 5);
  assert.ok(result.xirrPct !== null);
});

test("uses weighted average cost for a partial sell", () => {
  const result = calculatePortfolio(
    [
      { type: "deposit", amount: 10_000, tradeDate: day("2025-01-01") },
      {
        type: "buy",
        ticker: "TEST",
        quantity: 10,
        price: 100,
        fees: 10,
        tradeDate: day("2025-01-02"),
      },
      {
        type: "sell",
        ticker: "TEST",
        quantity: 4,
        price: 130,
        fees: 2,
        tradeDate: day("2025-02-01"),
      },
    ],
    [{ ticker: "TEST", price: 125 }],
    day("2025-12-31"),
  );

  assert.equal(result.holdings[0].quantity, 6);
  assert.equal(result.holdings[0].costBasis, 606);
  assert.equal(result.realizedPnl, 114);
  assert.equal(result.holdings[0].unrealizedPnl, 144);
});

test("keeps total cost basis unchanged through bonus and split actions", () => {
  const result = calculatePortfolio(
    [
      { type: "deposit", amount: 10_000, tradeDate: day("2025-01-01") },
      {
        type: "buy",
        ticker: "TEST",
        quantity: 10,
        price: 100,
        tradeDate: day("2025-01-02"),
      },
      {
        type: "bonus",
        ticker: "TEST",
        quantity: 2,
        tradeDate: day("2025-02-01"),
      },
      {
        type: "split",
        ticker: "TEST",
        splitNumerator: 2,
        splitDenominator: 1,
        tradeDate: day("2025-03-01"),
      },
    ],
    [{ ticker: "TEST", price: 50 }],
  );

  assert.equal(result.holdings[0].quantity, 24);
  assert.equal(result.holdings[0].costBasis, 1_000);
  assert.equal(result.holdings[0].averageCost, 41.66666667);
});

test("rejects overselling", () => {
  assert.throws(
    () =>
      calculatePortfolio([
        {
          type: "buy",
          ticker: "TEST",
          quantity: 2,
          price: 100,
          tradeDate: day("2025-01-01"),
        },
        {
          type: "sell",
          ticker: "TEST",
          quantity: 3,
          price: 110,
          tradeDate: day("2025-01-02"),
        },
      ]),
    /only 2 is available/,
  );
});
