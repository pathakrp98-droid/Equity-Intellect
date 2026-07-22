# AlphaDesk Phase 4 — Morning Brief and Market Intelligence

Phase 4 turns the existing dashboard into a grounded daily decision desk. It combines the Phase 1 transaction-ledger portfolio, Phase 2 research workspaces and Phase 3 Copilot safeguards with normalized market snapshots, portfolio news and upcoming events.

The engine never fabricates missing market facts. When no provider or import is available, the brief explicitly labels market direction, news and event context as unavailable.

## What is included

### Morning Brief

- A persistent daily brief for each signed-in user's default portfolio.
- Portfolio value, cash, daily P&L, total return and concentration summary.
- Market tone and the largest verified market moves.
- Portfolio-relevant news and event counts.
- Priority actions generated from:
  - concentration and Portfolio Engine risk flags;
  - negative or mixed portfolio news;
  - weakening or broken research theses;
  - incomplete research workspaces;
  - scheduled thesis reviews;
  - critical or high-impact upcoming events;
  - missing or stale market data.
- Key-risk cards with stable source identifiers.
- Data-quality warnings and freshness timestamps.
- One brief per portfolio and local calendar date, updated on regeneration rather than duplicated.

### Market Intelligence workspace

- Market snapshot grouped by index, equity, FX, commodity, rate, macro, flow and sector.
- Portfolio-only news feed with source, timestamp, sentiment and relevance.
- Portfolio earnings, corporate-action, dividend, macro, regulatory and investor-event calendar.
- Normalized JSON import workspace.
- Provider status, last run and latest-data timestamps.
- User preferences for timezone, preferred brief hour, stale-data thresholds and included content.
- Equity quote imports can update matching Phase 1 holding prices and previous closes.

### Provider-neutral ingestion

A generic server-side HTTP adapter accepts any upstream service that returns the AlphaDesk normalized contract. The application adds the current portfolio tickers and contract version to the provider request:

```text
GET <MARKET_INTELLIGENCE_URL>?tickers=RELIANCE,INFY&format=alphadesk-normalized-v1
```

Provider credentials remain server-side. No provider-specific npm package is required.

### Data integrity and safety

- Authenticated, user-isolated storage for points, news, events, preferences, briefs and provider runs.
- Runtime validation of market kinds, event types, dates, numeric values and ticker characters.
- Input caps of 500 points, 1,000 news items and 1,000 events per import.
- Deterministic external IDs where a provider does not supply one.
- Upsert protection for repeat imports.
- Portfolio relevance derived from current holdings.
- Explicit source and source URL fields.
- Stale-data detection using configurable thresholds.
- Provider failures recorded without deleting the last successful data.
- No browser exposure of provider secrets.

## New database objects

Enums:

- `market_data_kind`
- `market_event_type`
- `market_impact`
- `market_sentiment`
- `provider_run_status`

Tables:

- `market_data_points`
- `market_news`
- `market_events`
- `morning_briefs`
- `market_intelligence_preferences`
- `market_provider_runs`

## New backend paths

- `lib/db/src/schema/marketIntelligence.ts`
- `artifacts/api-server/src/services/intelligence/types.ts`
- `artifacts/api-server/src/services/intelligence/normalization.ts`
- `artifacts/api-server/src/services/intelligence/briefEngine.ts`
- `artifacts/api-server/src/services/intelligence/httpProvider.ts`
- `artifacts/api-server/src/services/intelligence/marketIntelligenceService.ts`
- `artifacts/api-server/src/routes/intelligence.ts`

The route registry and database schema index are updated to expose the new module.

## API endpoints

- `GET /api/intelligence/brief/latest`
- `POST /api/intelligence/brief/generate`
- `GET /api/intelligence/brief/history`
- `GET /api/intelligence/snapshot`
- `GET /api/intelligence/news`
- `GET /api/intelligence/calendar`
- `GET /api/intelligence/preferences`
- `PUT /api/intelligence/preferences`
- `GET /api/intelligence/providers/status`
- `POST /api/intelligence/refresh`
- `POST /api/intelligence/import`

All endpoints require authentication.

## Frontend changes

- The root dashboard is replaced with the Morning Brief.
- A new `/market-intelligence` workspace is added.
- `/market` is retained as an alias to the new grounded workspace so the old simulated Market Signals screen is not presented as current data.
- The navigation now links directly to Morning Brief, Portfolio, Research, Market Intelligence and Copilot.
- The global banner reminds users that market facts are used only when imported or returned by a configured provider.

## Normalized import contract

The import body can contain any combination of `points`, `news` and `events`:

```json
{
  "provider": "verified-source",
  "fetchedAt": "2026-07-19T03:30:00.000Z",
  "points": [
    {
      "kind": "equity",
      "symbol": "RELIANCE",
      "name": "Reliance Industries",
      "value": 1500,
      "change": 12,
      "changePct": 0.81,
      "unit": "INR",
      "region": "India",
      "source": "Verified quote source",
      "sourceUrl": "https://example.com/quote",
      "asOf": "2026-07-19T03:30:00.000Z",
      "metadata": { "previousClose": 1488 }
    }
  ],
  "news": [
    {
      "externalId": "source-article-123",
      "ticker": "RELIANCE",
      "headline": "Verified headline",
      "summary": "Concise factual summary.",
      "source": "Verified publisher",
      "sourceUrl": "https://example.com/article",
      "publishedAt": "2026-07-19T02:00:00.000Z",
      "sentiment": "neutral",
      "relevanceScore": 0.9
    }
  ],
  "events": [
    {
      "externalId": "reliance-results-2026-q1",
      "ticker": "RELIANCE",
      "companyName": "Reliance Industries",
      "eventType": "earnings",
      "title": "Quarterly results",
      "eventAt": "2026-07-25T10:00:00.000Z",
      "impact": "high",
      "source": "Company calendar",
      "sourceUrl": "https://example.com/calendar"
    }
  ]
}
```

A ready-to-edit version is included at `docs/MARKET_INTELLIGENCE_IMPORT_EXAMPLE.json`.

## Environment variables

Required only for automatic provider refresh:

```text
MARKET_INTELLIGENCE_URL=https://your-server.example/snapshot
```

Optional:

```text
MARKET_INTELLIGENCE_API_KEY=<server-side secret>
MARKET_INTELLIGENCE_PROVIDER_NAME=your-provider
MARKET_INTELLIGENCE_TIMEOUT_MS=20000
```

Do not commit provider credentials or expose them to the browser.

## Installation after applying the cumulative package

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/db push
pnpm run typecheck
pnpm run build
```

Review any destructive Drizzle warning before approving it. Phase 4 is designed to add new objects, not remove existing tables.

## Validation completed before packaging

- 26 cumulative automated tests passed.
- Eleven Phase 4 tests cover normalization, deduplication, portfolio relevance, stale-data rules, invalid import shapes, unsafe source URLs, unsupported event rejection and deterministic Morning Brief generation.
- Phase 4's pure normalization and brief-decision modules passed strict TypeScript typechecking.
- All 43 TypeScript/TSX files in the cumulative overlay parsed with zero syntax failures.

A full monorepo typecheck and production build must still run after applying the package because the overlay does not contain every unchanged repository file or its installed dependencies.

## Known limitations deferred to later phases

- `briefHour` is stored as a preference, but Phase 4 does not install a background scheduler. Briefs are generated on page load, manual regeneration or provider refresh. Scheduled delivery belongs in a later integration/deployment phase.
- The package provides a normalized HTTP adapter rather than a paid vendor-specific market-data integration.
- No automated NSE/BSE filing crawler is included.
- No email, push or WhatsApp delivery is included.
- Historical market-series analytics and backfilled benchmark performance are not included.
- The legacy generated OpenAPI client is not regenerated; Phase 4 uses a dedicated typed frontend API module.
