import { createHash } from "node:crypto";

import type {
  EngineTransaction,
  PortfolioTransactionType,
} from "./engine";

export type SupportedBroker = "manual" | "zerodha" | "groww";

export interface ParsedCsvTransaction extends EngineTransaction {
  externalId: string;
  settlementDate?: Date | null;
  notes?: string | null;
  metadata: Record<string, unknown>;
}

export interface CsvImportError {
  row: number;
  message: string;
  values?: Record<string, string>;
}

export interface CsvImportResult {
  transactions: ParsedCsvTransaction[];
  errors: CsvImportError[];
}

const MANUAL_HEADERS = [
  "trade_date",
  "type",
  "ticker",
  "name",
  "exchange",
  "sector",
  "quantity",
  "price",
  "amount",
  "fees",
  "taxes",
  "currency",
  "external_id",
  "split_numerator",
  "split_denominator",
  "notes",
];

const HEADER_ALIASES: Record<string, string[]> = {
  tradeDate: [
    "trade_date",
    "tradedate",
    "date",
    "trade date",
    "order execution time",
    "order_execution_time",
    "execution date",
  ],
  type: [
    "type",
    "trade_type",
    "trade type",
    "transaction_type",
    "transaction type",
    "order_type",
    "order type",
    "buy/sell",
  ],
  ticker: [
    "ticker",
    "tradingsymbol",
    "trading symbol",
    "symbol",
    "stock symbol",
    "scrip",
  ],
  name: ["name", "stock name", "company", "company name", "instrument"],
  exchange: ["exchange", "segment", "exchange segment"],
  sector: ["sector", "industry"],
  quantity: ["quantity", "qty", "filled quantity", "filled_quantity"],
  price: [
    "price",
    "trade price",
    "trade_price",
    "average price",
    "average_price",
    "buy price",
    "sell price",
  ],
  amount: ["amount", "value", "net amount", "net_amount", "total"],
  fees: [
    "fees",
    "charges",
    "brokerage",
    "brokerage charges",
    "other charges",
  ],
  taxes: ["taxes", "tax", "stt", "statutory charges"],
  currency: ["currency", "ccy"],
  externalId: [
    "external_id",
    "external id",
    "trade_id",
    "trade id",
    "order_id",
    "order id",
    "contract note no",
  ],
  settlementDate: ["settlement_date", "settlement date", "settlement"],
  splitNumerator: ["split_numerator", "split numerator", "ratio numerator"],
  splitDenominator: [
    "split_denominator",
    "split denominator",
    "ratio denominator",
  ],
  notes: ["notes", "note", "remarks", "description"],
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  row.push(value.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

function resolveHeaderIndex(headers: string[], field: string): number {
  const aliases = HEADER_ALIASES[field] ?? [];
  return headers.findIndex((header) => aliases.includes(header));
}

function getCell(
  row: string[],
  headers: string[],
  field: string,
): string | undefined {
  const index = resolveHeaderIndex(headers, field);
  if (index < 0) return undefined;
  const value = row[index]?.trim();
  return value || undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const negative = /^\(.*\)$/.test(value.trim());
  const cleaned = value
    .replace(/[₹$£€,%]/g, "")
    .replace(/,/g, "")
    .replace(/[()]/g, "")
    .trim();
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number: ${value}`);
  }
  return negative ? -parsed : parsed;
}

function parseDate(value: string | undefined): Date {
  if (!value) throw new Error("trade_date is required");
  const trimmed = value.trim();

  // Parse explicit day-first broker formats before using the JavaScript parser.
  // Otherwise ambiguous values such as 02/07/2026 may be read as MM/DD/YYYY.
  const dayFirst = trimmed.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (dayFirst) {
    const [, day, month, rawYear, hour = "0", minute = "0", second = "0"] =
      dayFirst;
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    const parsed = new Date(
      Date.UTC(
        year,
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      ),
    );
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const isoAttempt = new Date(trimmed);
  if (!Number.isNaN(isoAttempt.getTime())) return isoAttempt;

  throw new Error(`Invalid date: ${value}`);
}

function normalizeType(value: string | undefined): PortfolioTransactionType {
  if (!value) throw new Error("type is required");
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const map: Record<string, PortfolioTransactionType> = {
    b: "buy",
    buy: "buy",
    bought: "buy",
    purchase: "buy",
    s: "sell",
    sell: "sell",
    sold: "sell",
    dividend: "dividend",
    div: "dividend",
    bonus: "bonus",
    split: "split",
    stocksplit: "split",
    rights: "rights",
    rightsissue: "rights",
    deposit: "deposit",
    funddeposit: "deposit",
    credit: "deposit",
    withdrawal: "withdrawal",
    withdraw: "withdrawal",
    debit: "withdrawal",
    interest: "interest",
    fees: "fees",
    fee: "fees",
    charges: "fees",
  };
  const type = map[normalized];
  if (!type) throw new Error(`Unsupported transaction type: ${value}`);
  return type;
}

function rowObject(headers: string[], row: string[]): Record<string, string> {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
}

function fingerprint(
  broker: SupportedBroker,
  transaction: Omit<ParsedCsvTransaction, "externalId" | "metadata">,
  rowNumber: number,
  providedExternalId?: string,
): string {
  if (providedExternalId) return `${broker}:${providedExternalId.trim()}`;
  const canonical = JSON.stringify({
    broker,
    rowNumber,
    type: transaction.type,
    ticker: transaction.ticker,
    quantity: transaction.quantity,
    price: transaction.price,
    amount: transaction.amount,
    tradeDate: new Date(transaction.tradeDate).toISOString(),
  });
  return `${broker}:${createHash("sha256").update(canonical).digest("hex").slice(0, 32)}`;
}

function validateTransaction(transaction: EngineTransaction): void {
  const securityTypes: PortfolioTransactionType[] = [
    "buy",
    "sell",
    "bonus",
    "split",
    "rights",
  ];
  if (securityTypes.includes(transaction.type) && !transaction.ticker) {
    throw new Error(`${transaction.type} requires ticker`);
  }

  if (["buy", "sell", "rights"].includes(transaction.type)) {
    if (!transaction.quantity || transaction.quantity <= 0) {
      throw new Error(`${transaction.type} requires a positive quantity`);
    }
    if (!transaction.price || transaction.price <= 0) {
      throw new Error(`${transaction.type} requires a positive price`);
    }
  }

  if (transaction.type === "bonus" && (!transaction.quantity || transaction.quantity <= 0)) {
    throw new Error("bonus requires a positive quantity");
  }

  if (
    transaction.type === "split" &&
    (!transaction.splitNumerator ||
      transaction.splitNumerator <= 0 ||
      !transaction.splitDenominator ||
      transaction.splitDenominator <= 0)
  ) {
    throw new Error("split requires positive split_numerator and split_denominator");
  }

  if (
    ["deposit", "withdrawal", "interest", "fees", "dividend"].includes(
      transaction.type,
    ) &&
    (!transaction.amount || transaction.amount <= 0) &&
    !(
      transaction.type === "dividend" &&
      transaction.quantity &&
      transaction.price &&
      transaction.quantity > 0 &&
      transaction.price > 0
    )
  ) {
    throw new Error(`${transaction.type} requires a positive amount`);
  }
}

export function parsePortfolioCsv(
  csv: string,
  broker: SupportedBroker,
): CsvImportResult {
  const rows = parseRows(csv);
  if (rows.length < 2) {
    throw new Error("CSV must contain a header and at least one transaction row");
  }

  const headers = rows[0].map(normalizeHeader);
  const transactions: ParsedCsvTransaction[] = [];
  const errors: CsvImportError[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 1;
    try {
      const type = normalizeType(getCell(row, headers, "type"));
      const ticker = getCell(row, headers, "ticker")?.toUpperCase();
      const tradeDate = parseDate(getCell(row, headers, "tradeDate"));
      const settlementDateValue = getCell(row, headers, "settlementDate");
      const quantity = parseNumber(getCell(row, headers, "quantity"));
      const price = parseNumber(getCell(row, headers, "price"));
      const amount = parseNumber(getCell(row, headers, "amount"));
      const fees = Math.abs(parseNumber(getCell(row, headers, "fees")) ?? 0);
      const taxes = Math.abs(parseNumber(getCell(row, headers, "taxes")) ?? 0);

      const base: Omit<ParsedCsvTransaction, "externalId" | "metadata"> = {
        type,
        ticker,
        name: getCell(row, headers, "name") ?? ticker,
        exchange: getCell(row, headers, "exchange")?.toUpperCase() ?? "NSE",
        sector: getCell(row, headers, "sector") ?? "Unclassified",
        quantity: quantity === undefined ? undefined : Math.abs(quantity),
        price: price === undefined ? undefined : Math.abs(price),
        amount: amount === undefined ? undefined : Math.abs(amount),
        fees,
        taxes,
        currency: getCell(row, headers, "currency")?.toUpperCase() ?? "INR",
        tradeDate,
        settlementDate: settlementDateValue
          ? parseDate(settlementDateValue)
          : null,
        splitNumerator: parseNumber(getCell(row, headers, "splitNumerator")),
        splitDenominator: parseNumber(getCell(row, headers, "splitDenominator")),
        notes: getCell(row, headers, "notes") ?? null,
        broker,
      };

      validateTransaction(base);
      const externalId = fingerprint(
        broker,
        base,
        rowNumber,
        getCell(row, headers, "externalId"),
      );
      transactions.push({
        ...base,
        externalId,
        metadata: {
          broker,
          importedRow: rowNumber,
          sourceHeaders: headers,
        },
      });
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : String(error),
        values: rowObject(headers, row),
      });
    }
  }

  return { transactions, errors };
}

export function buildManualCsvTemplate(): string {
  const sampleRows = [
    [
      "2026-07-01",
      "deposit",
      "",
      "",
      "",
      "",
      "",
      "",
      "500000",
      "0",
      "0",
      "INR",
      "opening-cash",
      "",
      "",
      "Opening portfolio funding",
    ],
    [
      "2026-07-02",
      "buy",
      "RELIANCE",
      "Reliance Industries",
      "NSE",
      "Energy",
      "10",
      "1500",
      "",
      "20",
      "5",
      "INR",
      "trade-001",
      "",
      "",
      "Initial purchase",
    ],
  ];
  return [MANUAL_HEADERS, ...sampleRows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
