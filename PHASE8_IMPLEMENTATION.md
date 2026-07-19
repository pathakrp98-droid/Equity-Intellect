# AlphaDesk v0.8 — Integration, Security and Production Polish

Phase 8 is the final cumulative integration release. It retains all functionality from v0.7 and adds a production-oriented shell around the portfolio, research, Copilot, intelligence, Guardian, journal, live-data and alerts modules.

## What changed

### 1. Unified operational readiness

A new authenticated endpoint, `GET /api/integration/health`, calculates a deterministic readiness score from the signed-in user's stored data. It checks:

- portfolio creation, ledger activity, holdings and price freshness;
- research coverage, active theses and overdue reviews;
- Copilot conversations, approved memory and optional live-AI configuration;
- Morning Brief and market-intelligence availability;
- Guardian health snapshots and pending decision packets;
- decision-journal entries and due reviews;
- configured live-data providers and cached records;
- active, critical and configured alerts.

The new `/system-health` screen exposes the score, blockers, recommendations, module-level scores and safe environment-status booleans. No secrets or provider keys are returned.

### 2. Unified Morning Brief

The Morning Brief now includes a compact System Readiness strip. This links the daily decision workflow to setup completeness, unresolved alerts and stale data instead of treating each module as an isolated feature.

### 3. Responsive application shell

- mobile navigation drawer and backdrop;
- compact mobile header;
- responsive content spacing and no fixed desktop margin on phones;
- online/offline state banner;
- touch-friendly navigation and explicit accessibility labels;
- route-level lazy loading to reduce the initial JavaScript bundle.

### 4. Error resilience

- application-wide React error boundary;
- reusable page loader, empty state and inline error components;
- React Query defaults for sensible caching, reconnect refresh and bounded retries;
- 401 and 403 responses are not repeatedly retried;
- API 404 responses are consistent JSON;
- unexpected API errors return a safe message and request ID instead of stack traces.

### 5. Security hardening

- Express `x-powered-by` disabled;
- explicit CORS allow-list support through `CORS_ALLOWED_ORIGINS`;
- Replit deployment domains are added from Replit environment variables;
- unknown production origins are rejected;
- security headers for content-type sniffing, framing, referrers, permissions and cross-origin isolation;
- HSTS on secure production requests;
- request IDs returned in `X-Request-Id` and error payloads;
- credentials remain server-side;
- API responses default to `Cache-Control: no-store`.

### 6. Removal of remaining simulated endpoints

The legacy `/api/dashboard/*` and `/api/market/*` routers are no longer mounted. Current screens use the grounded Portfolio, Market Intelligence, Live Data, Guardian and Alerts services. The old source files may still exist in the underlying repository, but they are unreachable from the Phase 8 API router.

### 7. Release validation

Phase 8 includes:

- deterministic integration-readiness tests;
- CORS-origin policy tests;
- a dependency-free runtime smoke script;
- deployment and acceptance checklists;
- cumulative manifest and checksums.

## New endpoints

- `GET /api/integration/health`

Authentication is required because the response is calculated from user-specific data.

## New frontend route

- `/system-health`

## Environment variables

Recommended for production:

```bash
NODE_ENV=production
APP_VERSION=0.8.0
CORS_ALLOWED_ORIGINS=https://your-app.example.com
```

Provider variables from previous phases remain unchanged. See `LIVE_DATA_ENVIRONMENT_EXAMPLE.md`.

## Installation

Apply v0.8 directly over the repository root. Do not apply v0.1–v0.7 first because v0.8 is cumulative.

```bash
unzip -o AlphaDesk-v0.8-Production-Integration.zip -d /tmp/alphadesk-v0.8
bash /tmp/alphadesk-v0.8/apply-v0.8.sh "$PWD"
pnpm install --frozen-lockfile
pnpm --filter @workspace/db push
pnpm run typecheck
pnpm run build
```

Review any destructive database warning before confirming. Phase 8 itself adds no new database table; it uses the cumulative schema introduced in Phases 1–7.

## Runtime smoke test

With the application running:

```bash
ALPHADESK_BASE_URL=http://localhost:5000 node scripts/phase8-smoke.mjs
```

The script checks API health, integration-route protection and removal of the two legacy simulated route families.

## Known installation boundary

The artifact environment validates the cumulative source package, pure tests and syntax. The final monorepo typecheck, production build, database connection and browser acceptance tests must run inside the real repository after installation.
