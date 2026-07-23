#!/usr/bin/env bash
set -euo pipefail

echo "Applying flexible holdings CSV header fix..."

node <<'NODE'
const fs = require("fs");

const file = "artifacts/api-server/src/services/portfolio/holdingsCsv.ts";
let text = fs.readFileSync(file, "utf8");

const newResolver = `function resolveIndex(headers: string[], field: string): number {
  const aliases = HEADER_ALIASES[field] ?? [];
  const exactIndex = headers.findIndex((header) => aliases.includes(header));
  if (exactIndex >= 0) return exactIndex;

  return headers.findIndex((header) => {
    const value = \` \${header} \`;
    const hasAny = (...terms: string[]) =>
      terms.some((term) => value.includes(term));
    const hasAll = (...terms: string[]) =>
      terms.every((term) => value.includes(term));

    const isQuantity = hasAny("quantity", " qty ");
    const isPnl =
      hasAny("unrealized", "unrealised") &&
      (hasAny("pnl", "p l") || hasAll("profit", "loss"));

    switch (field) {
      case "symbol":
        return (
          hasAny(
            "symbol",
            "ticker",
            "trading symbol",
            "tradingsymbol",
            "scrip",
            "stock code",
            "security code",
            "instrument code",
          ) && !hasAny("isin")
        );
      case "isin":
        return hasAny("isin");
      case "name":
        return (
          hasAll("company", "name") ||
          hasAll("security", "name") ||
          hasAll("instrument", "name") ||
          header === "name"
        );
      case "exchange":
        return hasAny("exchange", "segment");
      case "sector":
        return hasAny("sector", "industry");
      case "availableQuantity":
        return (
          isQuantity &&
          hasAny("available", "free", "sellable", "saleable", "deliverable")
        );
      case "quantity":
        return (
          isQuantity &&
          !hasAny(
            "available",
            "free",
            "sellable",
            "saleable",
            "blocked",
            "pledged",
            "collateral",
          )
        );
      case "averageCost":
        return (
          (hasAny("average", " avg ") && hasAny("price", "cost")) ||
          hasAll("long term", "price")
        );
      case "previousClose":
        return (
          (hasAny("previous", "prev") && hasAny("close", "closing")) ||
          header === "closing price"
        );
      case "reportedUnrealizedPnl":
        return isPnl && !hasAny("pct", "percent", "percentage");
      case "reportedUnrealizedPnlPct":
        return isPnl && hasAny("pct", "percent", "percentage");
      default:
        return false;
    }
  });
}

function getCell`;

if (!text.includes("const exactIndex = headers.findIndex")) {
  const resolverPattern =
    /function resolveIndex\(headers: string\[\], field: string\): number \{[\s\S]*?\n\}\n\nfunction getCell/;
  if (!resolverPattern.test(text)) {
    throw new Error("Could not locate resolveIndex in holdingsCsv.ts");
  }
  text = text.replace(resolverPattern, newResolver);
}

if (!text.includes("const headerIndex = rows.findIndex((row) => {")) {
  const scanPattern =
    /const headerIndex = rows\s*\.slice\(0,\s*Math\.min\(rows\.length,\s*30\)\)\s*\.findIndex\(\(row\) => \{/m;
  if (!scanPattern.test(text)) {
    throw new Error("Could not locate the 30-row header scan in holdingsCsv.ts");
  }
  text = text.replace(
    scanPattern,
    "const headerIndex = rows.findIndex((row) => {",
  );
}

fs.writeFileSync(file, text, "utf8");
console.log("Source patch applied.");
NODE

echo "Building API..."
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/api-server build

echo "Restarting API..."
kill "$(cat /tmp/alphadesk-api.pid 2>/dev/null)" 2>/dev/null || true
pkill -f 'node --enable-source-maps ./dist/index.mjs' 2>/dev/null || true
sleep 2

PORT=5000 NODE_ENV=development \
pnpm --filter @workspace/api-server start \
> /tmp/alphadesk-api.log 2>&1 &

echo $! > /tmp/alphadesk-api.pid
sleep 5

if ! kill -0 "$(cat /tmp/alphadesk-api.pid)" 2>/dev/null; then
  echo "API failed to start:"
  cat /tmp/alphadesk-api.log
  exit 1
fi

echo "Saving fix to GitHub..."
git add artifacts/api-server/src/services/portfolio/holdingsCsv.ts
if ! git diff --cached --quiet; then
  git commit -m "Improve holdings CSV header detection"
  git push
fi

echo "SUCCESS: Flexible holdings CSV detection is running."
