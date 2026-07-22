export interface ParsedHoldingCsvRow {
  symbol: string;
  isin: string | null;
  name: string | null;
  exchange: string;
  sector: string;
  quantity: number;
  availableQuantity: number | null;
  averageCost: number;
  previousClose: number;
  reportedUnrealizedPnl: number | null;
  reportedUnrealizedPnlPct: number | null;
}

export interface HoldingsCsvError {
  row: number;
  message: string;
  values?: Record<string, string>;
}

export interface HoldingsCsvResult {
  holdings: ParsedHoldingCsvRow[];
  errors: HoldingsCsvError[];
  warnings: string[];
}

const HEADER_ALIASES: Record<string, string[]> = {
  symbol: [
    "symbol",
    "ticker",
    "trading symbol",
    "tradingsymbol",
    "scrip",
    "scrip name",
    "scrip code",
    "security symbol",
    "stock symbol",
    "instrument symbol",
    "nse symbol",
    "bse symbol",
  ],
  isin: ["isin", "isin code", "security isin"],
  name: ["name", "company", "company name", "security name", "instrument"],
  exchange: ["exchange", "segment", "exchange segment"],
  sector: ["sector", "industry", "industry sector"],
  quantity: [
    "quantity",
    "total quantity",
    "qty",
    "holding quantity",
    "net quantity",
    "net qty",
    "total qty",
  ],
  availableQuantity: [
    "available quantity",
    "available qty",
    "free quantity",
    "sellable quantity",
  ],
  averageCost: [
    "long term average price",
    "longterm average price",
    "long term avg price",
    "lt average price",
    "lt avg price",
    "long term average cost",
    "average price",
    "avg price",
    "average cost",
    "avg cost",
  ],
  previousClose: [
    "previous closing price",
    "previous close",
    "prev close",
    "closing price",
    "previous closing",
    "prev closing price",
    "previous day closing price",
    "last closing price",
  ],
  reportedUnrealizedPnl: [
    "unrealized pnl",
    "unrealised pnl",
    "unrealized p l",
    "unrealised p l",
    "unrealized profit loss",
    "unrealised profit loss",
    "unrealized profit and loss",
    "unrealised profit and loss",
  ],
  reportedUnrealizedPnlPct: [
    "unrealized pnl pct",
    "unrealised pnl pct",
    "unrealized pnl percent",
    "unrealised pnl percent",
    "unrealized p l pct",
    "unrealised p l pct",
    "unrealized profit loss pct",
    "unrealised profit loss pct",
    "unrealized profit and loss pct",
    "unrealised profit and loss pct",
  ],
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, "")
    .replace(/\u0000/g, "")
    .replace(/%/g, " pct ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectDelimiter(csv: string): string {
  const sampleLines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30);
  const candidates = [",", "\t", ";"];
  const score = (candidate: string) =>
    sampleLines.reduce(
      (best, line) => Math.max(best, line.split(candidate).length),
      1,
    );
  return candidates.reduce(
    (best, candidate) => (score(candidate) > score(best) ? candidate : best),
    ",",
  );
}

function parseRows(csv: string): string[][] {
  const delimiter = detectDelimiter(csv);
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

    if (char === delimiter && !quoted) {
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

function resolveIndex(headers: string[], field: string): number {
  const aliases = HEADER_ALIASES[field] ?? [];
  return headers.findIndex((header) => aliases.includes(header));
}

function getCell(
  row: string[],
  headers: string[],
  field: string,
): string | undefined {
  const index = resolveIndex(headers, field);
  if (index < 0) return undefined;
  const value = row[index]?.trim();
  return value || undefined;
}

function parseNumber(
  value: string | undefined,
  field: string,
  required = false,
): number | undefined {
  if (!value) {
    if (required) throw new Error(`${field} is required`);
    return undefined;
  }
  const negative = /^\(.*\)$/.test(value.trim());
  const cleaned = value
    .replace(/[₹$£€,%]/g, "")
    .replace(/,/g, "")
    .replace(/[()]/g, "")
    .trim();
  const parsed = Number(cleaned);
  if (!cleaned || !Number.isFinite(parsed)) {
    throw new Error(`${field} must be a valid number`);
  }
  return negative ? -parsed : parsed;
}

function rowObject(headers: string[], row: string[]): Record<string, string> {
  return Object.fromEntries(
    headers.map((header, index) => [header, row[index] ?? ""]),
  );
}

export function parseHoldingsCsv(csv: string): HoldingsCsvResult {
  const rows = parseRows(csv);
  if (rows.length < 2) {
    throw new Error("CSV must contain a header and at least one holding row");
  }

  const headerIndex = rows
    .slice(0, Math.min(rows.length, 30))
    .findIndex((row) => {
      const candidate = row.map(normalizeHeader);
      const hasIdentifier =
        resolveIndex(candidate, "symbol") >= 0 ||
        resolveIndex(candidate, "isin") >= 0;
      const hasQuantity =
        resolveIndex(candidate, "quantity") >= 0 ||
        resolveIndex(candidate, "availableQuantity") >= 0;
      return (
        hasIdentifier &&
        hasQuantity &&
        resolveIndex(candidate, "averageCost") >= 0 &&
        resolveIndex(candidate, "previousClose") >= 0
      );
    });

  if (headerIndex < 0) {
    const detected = rows
      .slice(0, 5)
      .map((row) => row.map(normalizeHeader).filter(Boolean).join(" | "))
      .filter(Boolean)
      .join(" / ");
    throw new Error(
      `Could not find the holdings header row. Detected: ${detected || "no readable headers"}`,
    );
  }

  const headers = rows[headerIndex].map(normalizeHeader);
  if (
    resolveIndex(headers, "symbol") < 0 &&
    resolveIndex(headers, "isin") < 0
  ) {
    throw new Error("CSV requires Symbol or ISIN");
  }
  for (const field of ["averageCost", "previousClose"]) {
    if (resolveIndex(headers, field) < 0) {
      throw new Error(`CSV is missing a supported ${field} column`);
    }
  }
  if (
    resolveIndex(headers, "quantity") < 0 &&
    resolveIndex(headers, "availableQuantity") < 0
  ) {
    throw new Error("CSV requires Quantity or Available Quantity");
  }

  const holdings: ParsedHoldingCsvRow[] = [];
  const errors: HoldingsCsvError[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 1;
    try {
      const isin = getCell(row, headers, "isin")?.trim() || null;
      const symbol = String(getCell(row, headers, "symbol") ?? isin ?? "")
        .trim()
        .toUpperCase();
      if (!symbol) throw new Error("Symbol or ISIN is required");
      if (seen.has(symbol)) {
        throw new Error(`Duplicate Symbol in CSV: ${symbol}`);
      }

      const availableQuantity = parseNumber(
        getCell(row, headers, "availableQuantity"),
        "Available Quantity",
      );
      const quantity =
        parseNumber(getCell(row, headers, "quantity"), "Quantity") ??
        availableQuantity;
      if (quantity === undefined || quantity <= 0) {
        throw new Error("Quantity must be greater than zero");
      }
      if (
        availableQuantity !== undefined &&
        (availableQuantity < 0 || availableQuantity > quantity)
      ) {
        throw new Error(
          "Available Quantity must be between zero and Quantity",
        );
      }

      const averageCost = parseNumber(
        getCell(row, headers, "averageCost"),
        "Long Term Average Price",
        true,
      );
      const previousClose = parseNumber(
        getCell(row, headers, "previousClose"),
        "Previous Closing Price",
        true,
      );
      if (averageCost === undefined || averageCost < 0) {
        throw new Error("Long Term Average Price cannot be negative");
      }
      if (previousClose === undefined || previousClose < 0) {
        throw new Error("Previous Closing Price cannot be negative");
      }

      const reportedUnrealizedPnl = parseNumber(
        getCell(row, headers, "reportedUnrealizedPnl"),
        "Unrealized P&L",
      );
      const reportedUnrealizedPnlPct = parseNumber(
        getCell(row, headers, "reportedUnrealizedPnlPct"),
        "Unrealized P&L Pct.",
      );
      const calculatedPnl = quantity * (previousClose - averageCost);
      if (reportedUnrealizedPnl !== undefined) {
        const tolerance = Math.max(1, Math.abs(calculatedPnl) * 0.005);
        if (Math.abs(reportedUnrealizedPnl - calculatedPnl) > tolerance) {
          warnings.push(
            `Row ${rowNumber} (${symbol}): broker-reported Unrealized P&L differs from AlphaDesk calculation by ${(
              reportedUnrealizedPnl - calculatedPnl
            ).toFixed(2)}.`,
          );
        }
      }

      holdings.push({
        symbol,
        isin,
        name: getCell(row, headers, "name") ?? null,
        exchange:
          getCell(row, headers, "exchange")?.toUpperCase() ?? "NSE",
        sector: getCell(row, headers, "sector") ?? "Unclassified",
        quantity,
        availableQuantity: availableQuantity ?? null,
        averageCost,
        previousClose,
        reportedUnrealizedPnl: reportedUnrealizedPnl ?? null,
        reportedUnrealizedPnlPct: reportedUnrealizedPnlPct ?? null,
      });
      seen.add(symbol);
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : String(error),
        values: rowObject(headers, row),
      });
    }
  }

  return { holdings, errors, warnings };
}

export function buildHoldingsCsvTemplate(): string {
  const headers = [
    "Symbol",
    "ISIN",
    "Sector",
    "Quantity",
    "Available Quantity",
    "Long Term Average Price",
    "Previous Closing Price",
    "Unrealized P&L",
    "Unrealized P&L Pct.",
  ];
  const sample = [
    "RELIANCE",
    "INE002A01018",
    "Energy",
    "10",
    "10",
    "1500",
    "1525",
    "250",
    "1.67",
  ];
  return [headers, sample]
    .map((row) =>
      row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}
