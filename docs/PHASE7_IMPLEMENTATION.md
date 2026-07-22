# AlphaDesk v0.7 — Live Data and Alerts

Phase 7 extends the cumulative AlphaDesk overlay with a configurable live-data layer and a database-backed alert engine. It replaces the simulated Alerts route and screen.

## What is included

### 1. Provider abstraction

Two provider adapters are installed:

- `normalized-http`
  - Uses the Phase 4 AlphaDesk normalized-v1 contract.
  - Can provide quotes, news, earnings, corporate actions, macro and other market events in one payload.
  - Environment variables:
    - `MARKET_INTELLIGENCE_URL`
    - `MARKET_INTELLIGENCE_API_KEY` (optional)
    - `MARKET_INTELLIGENCE_TIMEOUT_MS` (optional)
- `alpha-vantage`
  - Uses native Node.js `fetch`; no npm package is added.
  - Supports portfolio quotes, market news sentiment and the earnings calendar.
  - Environment variables:
    - `ALPHA_VANTAGE_API_KEY`
    - `ALPHA_VANTAGE_BASE_URL` (optional)
    - `ALPHA_VANTAGE_TIMEOUT_MS` (optional)
    - `ALPHA_VANTAGE_DEFAULT_SUFFIX` (optional)

Corporate-action events remain available through the normalized HTTP provider or the existing normalized JSON import. The Alpha Vantage adapter does not claim a corporate-actions capability.

Secrets are read only from server environment variables. API keys are not stored in the AlphaDesk database or returned to the browser.

### 2. Symbol mapping

`live_data_symbol_mappings` maps a portfolio ticker to the exact symbol required by each provider.

Examples:

- Portfolio ticker: `INFY`
- Provider: `alpha-vantage`
- Provider symbol: `INFY.BSE`

When there is no explicit mapping, AlphaDesk sends the portfolio ticker. `ALPHA_VANTAGE_DEFAULT_SUFFIX` can append a default suffix, but explicit mappings are safer where exchange conventions differ.

### 3. Cache and stale-data fallback

`live_data_provider_cache` stores provider payloads by user, provider, capability and symbol set.

The cache has three states:

- `fresh`: returned without a network request.
- `stale_fallback`: used only if the provider request fails.
- `expired`: ignored and eligible for deletion.

Separate TTLs exist for quotes, news and calendar data. The stale-if-error period is independently configurable.

### 4. Portfolio synchronization

Fresh or cached equity quotes are imported through the Phase 4 normalization service. When `autoSyncPortfolio` is enabled, current price and previous close are written to the Phase 1 portfolio engine and the portfolio is recalculated.

The live-data page shows:

- Provider configuration status
- Provider capabilities
- Latest provider runs
- Quote/news/calendar freshness
- Cache health
- Refresh diagnostics
- Symbol mappings
- Refresh and fallback preferences

### 5. Alert rules

User-created rules support:

- Price above or below a threshold
- Daily percentage move above or below a threshold
- Thesis status
- Thesis review due
- News keyword
- Upcoming earnings
- Upcoming corporate action

Each rule has severity, cooldown and enabled state.

### 6. System alerts

The evaluation engine also creates grounded system alerts for:

- Weakening or broken portfolio theses
- Triggered thesis-invalidation conditions
- Overdue thesis reviews
- High-relevance negative news
- Earnings within seven days
- Dividends or corporate actions within seven days
- Missing or stale portfolio prices
- Recent provider failures

Alerts are deduplicated. Dismissing an alert does not delete its audit history.

### 7. Alert lifecycle

An alert can be:

- Active
- Acknowledged
- Dismissed
- Resolved
- Reopened

The alerts screen includes active alerts, history, rule management and evaluation preferences.

## API routes

### Live data

- `GET /api/live-data/status`
- `GET /api/live-data/preferences`
- `PUT /api/live-data/preferences`
- `GET /api/live-data/mappings`
- `PUT /api/live-data/mappings`
- `DELETE /api/live-data/mappings/:id`
- `GET /api/live-data/runs`
- `POST /api/live-data/refresh`
- `POST /api/live-data/cache/purge`

### Alerts

- `GET /api/alerts`
- `GET /api/alerts/summary`
- `POST /api/alerts/evaluate`
- `GET /api/alerts/settings`
- `PUT /api/alerts/settings`
- `GET /api/alerts/rules`
- `POST /api/alerts/rules`
- `PUT /api/alerts/rules/:id`
- `DELETE /api/alerts/rules/:id`
- `POST /api/alerts/:id/acknowledge`
- `POST /api/alerts/:id/dismiss`
- `POST /api/alerts/:id/reopen`
- `POST /api/alerts/:id/resolve`

All Phase 7 routes require authentication.

## Database additions

Phase 7 adds:

- `live_data_provider_cache`
- `live_data_symbol_mappings`
- `live_data_preferences`
- `alert_rules`
- `investment_alerts`
- `alert_preferences`

It also extends the Phase 4 normalized import service so portfolio-price synchronization can be disabled through live-data preferences.

## Installation

Apply v0.7 over the repository root, then run:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/db push
pnpm run typecheck
pnpm run build
```

Review any destructive database warning before approving it. The intended migration creates new tables and enum types; it should not require deleting Phase 1–6 data.

## Environment setup

At least one provider should be configured.

Example using Alpha Vantage:

```bash
ALPHA_VANTAGE_API_KEY=replace_with_secret
ALPHA_VANTAGE_DEFAULT_SUFFIX=BSE
```

Example using a normalized provider:

```bash
MARKET_INTELLIGENCE_URL=https://your-provider.example/alphadesk
MARKET_INTELLIGENCE_API_KEY=replace_with_secret
```

Do not commit these values.

## Operational limitation

Phase 7 does not install an always-on scheduler. Data refresh and alert evaluation run when the user presses refresh, when another authenticated client calls the refresh/evaluate endpoints, or when an external scheduler calls them. A production scheduler should use a trusted server-to-server authentication design rather than exposing a public unauthenticated cron endpoint.

Phase 7 creates in-app alerts only. Email, SMS, WhatsApp and browser push delivery are not implemented.

## Validation performed before packaging

- Seven Phase 7 unit tests passed.
- Pure alert, cache and Alpha Vantage adapter modules passed strict TypeScript compilation.
- Seventy-five cumulative TypeScript/TSX files passed syntax transpilation.
- JSON examples were parsed successfully.
- The installation script passed Bash syntax validation.
- ZIP integrity was checked after packaging.

A full monorepo typecheck and build still need to run inside the actual repository because the complete dependency tree and database are not mounted in the packaging environment.
