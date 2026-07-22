import assert from "node:assert/strict";
import test from "node:test";

import { parsePortfolioCsv } from "./csv";

test("parses the manual CSV format", () => {
  const csv = [
    "trade_date,type,ticker,name,quantity,price,fees,taxes,external_id",
    '2025-01-01,deposit,,, , ,0,0,"cash-1"',
    '2025-01-02,buy,RELIANCE,"Reliance Industries",10,"1,500",20,5,trade-1',
  ].join("\n");

  const parsed = parsePortfolioCsv(csv, "manual");
  assert.equal(parsed.transactions.length, 1);
  assert.equal(parsed.errors.length, 1);
  assert.equal(parsed.transactions[0].ticker, "RELIANCE");
  assert.equal(parsed.transactions[0].price, 1500);
});

test("dedupe fingerprints are stable for the same row", () => {
  const csv = [
    "trade_date,type,ticker,quantity,price,external_id",
    "2025-01-02,buy,INFY,5,1500,abc-123",
  ].join("\n");
  const first = parsePortfolioCsv(csv, "zerodha");
  const second = parsePortfolioCsv(csv, "zerodha");
  assert.equal(first.transactions[0].externalId, second.transactions[0].externalId);
});


test("parses ambiguous slash dates as day-first broker dates", () => {
  const csv = [
    "trade_date,type,ticker,quantity,price,external_id",
    "02/07/2026,buy,INFY,5,1500,date-test",
  ].join("\n");
  const parsed = parsePortfolioCsv(csv, "manual");
  assert.equal(parsed.errors.length, 0);
  assert.equal(
    new Date(parsed.transactions[0].tradeDate).toISOString().slice(0, 10),
    "2026-07-02",
  );
});
