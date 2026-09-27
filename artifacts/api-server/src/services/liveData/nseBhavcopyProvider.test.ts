import assert from "node:assert/strict";
import test from "node:test";
import { deflateRawSync } from "node:zlib";

import { extractFirstZipEntry, parseCsv } from "./nseBhavcopyProvider";

function buildSingleEntryZip(fileName: string, content: string): Buffer {
  const nameBuf = Buffer.from(fileName, "utf8");
  const compressed = deflateRawSync(Buffer.from(content, "utf8"));
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(0, 6); // flags
  header.writeUInt16LE(8, 8); // compression method: deflate
  header.writeUInt16LE(0, 10); // mod time
  header.writeUInt16LE(0, 12); // mod date
  header.writeUInt32LE(0, 14); // crc32 (unused by our extractor)
  header.writeUInt32LE(compressed.length, 18); // compressed size
  header.writeUInt32LE(content.length, 22); // uncompressed size
  header.writeUInt16LE(nameBuf.length, 26); // file name length
  header.writeUInt16LE(0, 28); // extra field length
  return Buffer.concat([header, nameBuf, compressed]);
}

test("extractFirstZipEntry decompresses a standard deflate zip entry", () => {
  const csv = "TckrSymb,SctySrs,ClsPric\nRELIANCE,EQ,1226.00\n";
  const zip = buildSingleEntryZip("bhav.csv", csv);
  const extracted = extractFirstZipEntry(zip).toString("utf8");
  assert.equal(extracted, csv);
});

test("extractFirstZipEntry rejects non-zip input", () => {
  assert.throws(() => extractFirstZipEntry(Buffer.from("not a zip")));
});

test("parseCsv maps rows by header name and skips short/malformed lines", () => {
  const csv = [
    "TckrSymb,SctySrs,ClsPric,PrvsClsgPric",
    "RELIANCE,EQ,1226.00,1219.20",
    "SGBJUN28,GB,15040.00,14925.83",
    "TOOSHORT,EQ",
  ].join("\n");
  const rows = parseCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.TckrSymb, "RELIANCE");
  assert.equal(rows[0]!.ClsPric, "1226.00");
  assert.equal(rows[1]!.TckrSymb, "SGBJUN28");
});
