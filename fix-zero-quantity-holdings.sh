#!/usr/bin/env bash
set -euo pipefail

echo "Updating holdings importer to skip zero-quantity rows..."

node <<'NODE'
const fs = require("fs");

const file = "artifacts/api-server/src/services/portfolio/holdingsCsv.ts";
let text = fs.readFileSync(file, "utf8");

const oldBlock = `      if (quantity === undefined || quantity <= 0) {
        throw new Error("Quantity must be greater than zero");
      }`;

const newBlock = `      if (quantity === undefined || quantity <= 0) {
        warnings.push(
          \`Row \${rowNumber} (\${symbol}): skipped because Quantity is zero or missing.\`,
        );
        continue;
      }`;

if (text.includes(newBlock)) {
  console.log("Zero-quantity handling is already updated.");
} else if (text.includes(oldBlock)) {
  text = text.replace(oldBlock, newBlock);
  fs.writeFileSync(file, text, "utf8");
  console.log("Zero-quantity rows will now be skipped with a warning.");
} else {
  throw new Error("Could not locate the quantity validation block.");
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
sleep 5

if ! kill -0 "$(cat /tmp/alphadesk-api.pid)" 2>/dev/null; then
  echo "API failed to start:"
  cat /tmp/alphadesk-api.log
  exit 1
fi

git add artifacts/api-server/src/services/portfolio/holdingsCsv.ts
if ! git diff --cached --quiet; then
  git commit -m "Skip zero-quantity holdings rows"
  git push
fi

echo "SUCCESS: Zero-quantity rows will no longer block holdings imports."
