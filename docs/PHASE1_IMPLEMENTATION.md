# AlphaDesk Portfolio Engine — Phase 1

This overlay replaces the demo portfolio tracker with a private, transaction-ledger-driven portfolio engine.

## What is implemented

### Ledger and persistence

- User-owned portfolios and broker accounts.
- Immutable source transactions for buys, sells, dividends, bonus shares, stock splits, rights, deposits, withdrawals, interest and fees.
- Idempotent broker CSV imports using external IDs or stable fingerprints.
- Manual market-price storage with previous-close support.
- Derived holdings, cash balances and timestamped portfolio snapshots.

### Calculation engine

- Weighted-average cost accounting.
- Partial and complete exits with realized P&L.
- Bonus and split adjustments without changing aggregate cost basis.
- Ledger-derived cash.
- Unrealized P&L, total P&L, simple return and money-weighted XIRR.
- Position and sector allocation.
- Concentration, negative-cash, low-cash and missing-price flags.
- Safe rejection of oversells and invalid corporate actions.
- Ledger rollback when a newly created/imported/deleted transaction would make the portfolio invalid.

### API

The existing `/api/portfolio` router is replaced and now exposes:

- `GET /api/portfolio`
- `GET /api/portfolio/holdings`
- `GET /api/portfolio/transactions`
- `POST /api/portfolio/transactions`
- `DELETE /api/portfolio/transactions/:id`
- `POST /api/portfolio/import`
- `GET /api/portfolio/template.csv`
- `PUT /api/portfolio/prices`
- `POST /api/portfolio/recalculate`
- `GET /api/portfolio/performance`
- `GET /api/portfolio/risk`
- `GET /api/portfolio/broker-snapshots`
- `GET /api/portfolio/position-sizing`

Existing database-backed watchlist and recommendation-history routes are preserved.

### UI

The `/portfolio` page now provides:

- Portfolio value, market value, cash, total P&L and XIRR cards.
- Calculated holdings and price-source visibility.
- Transaction entry and ledger deletion.
- Manual, Zerodha and Groww CSV import.
- Downloadable manual CSV template.
- Bulk manual quote updates.
- Sector allocation, concentration and risk/data-quality flags.

## Apply the overlay

The archive is designed to be extracted over the repository root. It adds new files and replaces four existing files:

- `lib/db/src/schema/index.ts`
- `artifacts/api-server/src/app.ts`
- `artifacts/api-server/src/routes/portfolio.ts`
- `artifacts/portfolio-intelligence/src/App.tsx`

Commit or back up local changes before applying it.

From the repository root:

```bash
unzip alphadesk-portfolio-engine-phase1.zip -d /tmp/alphadesk-phase1
rsync -av /tmp/alphadesk-phase1/ ./
```

Alternatively, copy the listed folders into the repository while preserving paths.

## Database and validation

After applying the files:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/db push
pnpm run typecheck
pnpm run build
```

No new npm dependency is required, so the lockfile does not need to change.

## First-use workflow

1. Sign in.
2. Open **Portfolio**.
3. Add a `deposit` transaction representing available/opening cash.
4. Add trades manually or import a broker CSV.
5. Enter current prices in `TICKER, price, previous close` format.
6. Review holdings, P&L, XIRR, allocation and risk flags.

For portfolios whose historical funding is unavailable, add an opening deposit on the valuation start date. XIRR is only meaningful when external contributions/withdrawals are represented in the ledger.

## CSV behavior

Supported import profiles:

- `manual`
- `zerodha`
- `groww`

The parser accepts common header variants, quoted values, commas inside numeric fields, ISO dates and day-first broker dates such as `02/07/2026`.

The downloadable manual template contains an opening cash deposit and a sample purchase. Every row should preferably have a stable `external_id`; this gives the strongest duplicate protection.

## Validation performed

- All TypeScript and TSX files passed syntax transpilation.
- Pure portfolio-engine and CSV-parser tests passed: weighted-average cost, partial sale, cash/P&L, bonus, split, oversell rejection, CSV parsing and duplicate fingerprinting.

A full monorepo typecheck could not be executed in the artifact environment because the repository dependencies and database are not mounted there. Run the commands above after applying the overlay.

## Deliberately deferred

Phase 1 does not pretend to calculate metrics that need unavailable time-series data. Benchmark return, beta, Sharpe ratio, VaR, correlations and max drawdown remain zero/empty with explicit data-quality metadata until live and historical market data are added.

The new runtime endpoints use a local typed React Query client under `features/portfolio/api.ts`. Updating the OpenAPI specification and regenerating the shared client is a clean-up task for the next integration pass; existing generated portfolio endpoints remain response-compatible.
