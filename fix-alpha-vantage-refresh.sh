#!/usr/bin/env bash
set -euo pipefail

echo "Applying robust Alpha Vantage refresh fix..."

node <<'NODE'
const fs = require("fs");

const liveDataFile =
  "artifacts/api-server/src/services/liveData/liveDataService.ts";
let liveDataText = fs.readFileSync(liveDataFile, "utf8");

const oldSuffix = `    const defaultSuffix =
      provider.name === "alpha-vantage"
        ? process.env.ALPHA_VANTAGE_DEFAULT_SUFFIX?.trim()
        : undefined;`;

const newSuffix = `    const defaultSuffix =
      provider.name === "alpha-vantage"
        ? process.env.ALPHA_VANTAGE_DEFAULT_SUFFIX?.trim() || "BSE"
        : undefined;`;

if (liveDataText.includes(oldSuffix)) {
  liveDataText = liveDataText.replace(oldSuffix, newSuffix);
  fs.writeFileSync(liveDataFile, liveDataText, "utf8");
  console.log("Alpha Vantage now defaults Indian symbols to .BSE.");
} else if (liveDataText.includes('|| "BSE"')) {
  console.log("Default .BSE suffix is already configured.");
} else {
  throw new Error("Could not locate Alpha Vantage suffix logic.");
}

const providerFile =
  "artifacts/api-server/src/services/liveData/alphaVantageProvider.ts";
let providerText = fs.readFileSync(providerFile, "utf8");

const startMarker =
  "  async fetchQuotes(context: LiveDataProviderContext): Promise<MarketPointInput[]> {";
const endMarker =
  "\n\n  async fetchNews(context: LiveDataProviderContext): Promise<MarketNewsInput[]> {";

const start = providerText.indexOf(startMarker);
const end = providerText.indexOf(endMarker);

if (start < 0 || end < 0 || end <= start) {
  throw new Error("Could not locate Alpha Vantage quote method.");
}

const replacement = `  async fetchQuotes(context: LiveDataProviderContext): Promise<MarketPointInput[]> {
    const results: MarketPointInput[] = [];
    const failures: string[] = [];

    for (const symbol of context.symbols) {
      try {
        const payload = await fetchJson<AlphaVantageQuoteResponse>({
          function: "GLOBAL_QUOTE",
          symbol: symbol.providerSymbol,
        });
        const quote = payload["Global Quote"] ?? {};
        const price = finiteNumber(quote["05. price"]);
        if (price === null || price <= 0) {
          throw new Error(\`no quote returned for \${symbol.providerSymbol}\`);
        }
        const previousClose = finiteNumber(quote["08. previous close"]);
        const change = finiteNumber(quote["09. change"]);
        const changePct = finiteNumber(
          String(quote["10. change percent"] ?? "").replace("%", ""),
        );
        const latestTradingDay = quote["07. latest trading day"];

        results.push({
          kind: "equity" as const,
          symbol: symbol.ticker,
          name: symbol.ticker,
          value: price,
          change,
          changePct,
          unit: "INR",
          region: symbol.exchange,
          source: this.name,
          sourceUrl: quoteSourceUrl(symbol.providerSymbol),
          asOf: latestTradingDay
            ? new Date(\`\${latestTradingDay}T15:30:00+05:30\`)
            : context.now,
          metadata: {
            providerSymbol: symbol.providerSymbol,
            previousClose,
            open: finiteNumber(quote["02. open"]),
            high: finiteNumber(quote["03. high"]),
            low: finiteNumber(quote["04. low"]),
            volume: finiteNumber(quote["06. volume"]),
          },
        } satisfies MarketPointInput);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "provider request failed";
        failures.push(\`\${symbol.ticker} (\${symbol.providerSymbol}): \${message}\`);
      }
    }

    if (results.length === 0) {
      throw new Error(
        \`Alpha Vantage returned no usable quotes. \${failures
          .slice(0, 5)
          .join("; ")}\`,
      );
    }

    if (failures.length > 0) {
      console.warn(
        \`[alpha-vantage] imported \${results.length} quotes and skipped \${failures.length}: \${failures.join("; ")}\`,
      );
    }

    return results;
  }`;

if (!providerText.includes("imported ${results.length} quotes")) {
  providerText =
    providerText.slice(0, start) +
    replacement +
    providerText.slice(end);
  fs.writeFileSync(providerFile, providerText, "utf8");
  console.log("Quote refresh now keeps valid symbols when some symbols fail.");
} else {
  console.log("Partial quote refresh is already configured.");
}
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
sleep 6

if ! kill -0 "$(cat /tmp/alphadesk-api.pid)" 2>/dev/null; then
  echo "API failed to start:"
  cat /tmp/alphadesk-api.log
  exit 1
fi

git add \
  artifacts/api-server/src/services/liveData/liveDataService.ts \
  artifacts/api-server/src/services/liveData/alphaVantageProvider.ts

if ! git diff --cached --quiet; then
  git commit -m "Make Alpha Vantage refresh resilient for Indian holdings"
  git push
fi

echo "SUCCESS: Alpha Vantage partial quote refresh is running."
