import { inflateRawSync } from "node:zlib";

import type { MarketImportPayload, MarketPointInput } from "../intelligence/types";
import type { LiveDataProvider, LiveDataProviderContext } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const REFERER = "https://www.nseindia.com/all-reports";
const MAX_LOOKBACK_DAYS = 8;
const CACHE_TTL_MS = 20 * 60 * 60 * 1000;
const INDEX_NAMES = new Set(["Nifty 50", "Nifty Bank", "Nifty Next 50"]);

interface EquityRow {
  ticker: string;
  name: string;
  close: number;
  prevClose: number;
}

interface EquitySnapshot {
  tradingDate: string;
  rows: Map<string, EquityRow>;
}

interface IndexSnapshot {
  tradingDate: string;
  points: MarketPointInput[];
}

let cachedEquitySnapshot: EquitySnapshot | null = null;
let cachedIndexSnapshot: IndexSnapshot | null = null;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

function toYyyymmdd(date: Date): string {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}`;
}

function toDdmmyyyy(date: Date): string {
  return `${pad2(date.getUTCDate())}${pad2(date.getUTCMonth() + 1)}${date.getUTCFullYear()}`;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * NSE's bhavcopy archive is a single-entry zip. Parsing the local file
 * header directly avoids adding a zip dependency for one file per day.
 */
export function extractFirstZipEntry(buf: Buffer): Buffer {
  if (buf.length < 30 || buf.readUInt32LE(0) !== 0x04034b50) {
    throw new Error("NSE bhavcopy response was not a zip archive");
  }
  const compressionMethod = buf.readUInt16LE(8);
  const compressedSize = buf.readUInt32LE(18);
  const fileNameLength = buf.readUInt16LE(26);
  const extraFieldLength = buf.readUInt16LE(28);
  const dataStart = 30 + fileNameLength + extraFieldLength;
  const compressedData = buf.subarray(dataStart, dataStart + compressedSize);
  if (compressionMethod === 0) return Buffer.from(compressedData);
  if (compressionMethod === 8) return inflateRawSync(compressedData);
  throw new Error(`Unsupported NSE bhavcopy zip compression method ${compressionMethod}`);
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines[0]!.split(",");
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(",");
    if (cells.length < header.length) continue;
    const row: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) row[header[c]!] = cells[c] ?? "";
    rows.push(row);
  }
  return rows;
}

async function fetchBinary(url: string, timeoutMs = 8_000): Promise<{ status: number; body: Buffer }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Referer: REFERER, Accept: "*/*" },
      signal: controller.signal,
    });
    const body = Buffer.from(await response.arrayBuffer());
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function loadEquitySnapshot(now: Date): Promise<EquitySnapshot> {
  if (cachedEquitySnapshot) {
    const ageMs = now.getTime() - new Date(`${cachedEquitySnapshot.tradingDate}T00:00:00Z`).getTime();
    if (ageMs < CACHE_TTL_MS) return cachedEquitySnapshot;
  }
  let cursor = new Date(now);
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_LOOKBACK_DAYS; attempt++) {
    const url = `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${toYyyymmdd(cursor)}_F_0000.csv.zip`;
    try {
      const { status, body } = await fetchBinary(url);
      if (status === 200) {
        const csv = extractFirstZipEntry(body).toString("utf8");
        const rows = new Map<string, EquityRow>();
        for (const row of parseCsv(csv)) {
          if (row.SctySrs !== "EQ") continue;
          const ticker = (row.TckrSymb ?? "").trim().toUpperCase();
          const close = Number(row.ClsPric);
          const prevClose = Number(row.PrvsClsgPric);
          if (!ticker || !Number.isFinite(close)) continue;
          rows.set(ticker, {
            ticker,
            name: row.FinInstrmNm ?? ticker,
            close,
            prevClose: Number.isFinite(prevClose) ? prevClose : close,
          });
        }
        cachedEquitySnapshot = { tradingDate: toIsoDate(cursor), rows };
        return cachedEquitySnapshot;
      }
    } catch (error) {
      lastError = error;
    }
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  throw new Error(
    `No NSE equity bhavcopy was available in the last ${MAX_LOOKBACK_DAYS} days${lastError ? `: ${String(lastError)}` : ""}`,
  );
}

async function loadIndexSnapshot(now: Date): Promise<IndexSnapshot> {
  if (cachedIndexSnapshot) {
    const ageMs = now.getTime() - new Date(`${cachedIndexSnapshot.tradingDate}T00:00:00Z`).getTime();
    if (ageMs < CACHE_TTL_MS) return cachedIndexSnapshot;
  }
  let cursor = new Date(now);
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_LOOKBACK_DAYS; attempt++) {
    const url = `https://nsearchives.nseindia.com/content/indices/ind_close_all_${toDdmmyyyy(cursor)}.csv`;
    try {
      const { status, body } = await fetchBinary(url);
      if (status === 200) {
        const rows = parseCsv(body.toString("utf8"));
        const points: MarketPointInput[] = [];
        const seen = new Set<string>();
        const asOf = new Date(`${toIsoDate(cursor)}T15:30:00+05:30`);
        for (const row of rows) {
          const name = row["Index Name"]?.trim();
          if (!name || !INDEX_NAMES.has(name) || seen.has(name)) continue;
          const close = Number(row["Closing Index Value"]);
          if (!Number.isFinite(close)) continue;
          seen.add(name);
          const change = Number(row["Points Change"]);
          const changePct = Number(row["Change(%)"]);
          points.push({
            kind: "index",
            symbol: name.replace(/\s+/g, "").toUpperCase(),
            name,
            value: close,
            change: Number.isFinite(change) ? change : null,
            changePct: Number.isFinite(changePct) ? changePct : null,
            unit: "points",
            region: "India",
            source: "NSE India (official EOD index bhavcopy)",
            sourceUrl: "https://www.nseindia.com/all-reports",
            asOf,
          });
        }
        cachedIndexSnapshot = { tradingDate: toIsoDate(cursor), points };
        return cachedIndexSnapshot;
      }
    } catch (error) {
      lastError = error;
    }
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  throw new Error(
    `No NSE index bhavcopy was available in the last ${MAX_LOOKBACK_DAYS} days${lastError ? `: ${String(lastError)}` : ""}`,
  );
}

export class NseBhavcopyProvider implements LiveDataProvider {
  readonly name = "nse-bhavcopy";
  readonly capabilities = {
    quotes: true,
    news: false,
    calendar: false,
    corporateActions: false,
    snapshot: true,
  } as const;

  isConfigured(): boolean {
    return true;
  }

  configurationHint(): string {
    return "Uses NSE India's free official end-of-day Bhavcopy archive (nseindia.com). Prices are the last completed trading day's close, not real-time.";
  }

  async fetchQuotes(context: LiveDataProviderContext): Promise<MarketPointInput[]> {
    if (context.symbols.length === 0) return [];
    const snapshot = await loadEquitySnapshot(context.now);
    const asOf = new Date(`${snapshot.tradingDate}T15:30:00+05:30`);
    const points: MarketPointInput[] = [];
    for (const symbol of context.symbols) {
      const row = snapshot.rows.get(symbol.ticker.toUpperCase());
      if (!row) continue;
      const change = row.prevClose > 0 ? row.close - row.prevClose : null;
      const changePct = change !== null && row.prevClose > 0 ? (change / row.prevClose) * 100 : null;
      points.push({
        kind: "equity",
        symbol: symbol.ticker,
        name: row.name,
        value: row.close,
        change,
        changePct,
        unit: "INR",
        region: "NSE",
        source: "NSE India (official EOD bhavcopy)",
        sourceUrl: "https://www.nseindia.com/all-reports",
        asOf,
        metadata: { previousClose: row.prevClose, tradingDate: snapshot.tradingDate },
      });
    }
    return points;
  }

  async fetchSnapshot(context: LiveDataProviderContext): Promise<MarketImportPayload> {
    const indices = await loadIndexSnapshot(context.now);
    const points: MarketPointInput[] = [...indices.points];
    if (context.symbols.length > 0) {
      const equityQuotes = await this.fetchQuotes(context);
      points.push(...equityQuotes);
    }
    return {
      provider: this.name,
      fetchedAt: context.now,
      points,
      news: [],
      events: [],
    };
  }
}

export const nseBhavcopyProvider = new NseBhavcopyProvider();
