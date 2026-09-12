# Database-Leased Daily Price Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan inline, task by task.
> Steps use checkbox (`- [ ]`) syntax for tracking. Do not dispatch subagents.

**Goal:** Refresh every active AlphaDesk portfolio's live market prices once per
Asia/Kolkata day even when the free web service sleeps, without invoking AI,
overwriting explicit manual prices, or creating a paid hosting dependency.

**Architecture:** A finite quote-only command discovers active users from
PostgreSQL. Database leases coordinate both scheduled and page-triggered work
across processes, while a separate attempt ledger enforces one initial attempt
plus at most two retries per local day. Existing quote cache, provider
diagnostics, per-ticker stale/error display, and authenticated manual refresh
remain the source of truth. A GitHub Actions workflow contains the intended
weekday schedule but skips scheduled jobs unless an operator explicitly sets a
repository variable after confirming zero-payment limits.

**Tech Stack:** TypeScript, Node 24, PostgreSQL, Drizzle ORM, Yahoo Finance
quote adapter, Node test runner, GitHub Actions, Render Free configuration.

**Spec:**
`docs/superpowers/specs/2026-08-28-free-hosting-migration-design.md`

## Global Constraints

- No payment, subscription, billable trial, Replit Agent, paid AI request, or
  artificial keep-alive traffic.
- Do not create accounts, install secrets, restore/upload private data, deploy,
  enable a schedule, bind an identity, or push during this plan.
- Preserve holdings CSV import, manual holding/edit flows, manual ETF prices,
  quote diagnostics, Guardian, Morning Brief, auth/ownership, saved research,
  and desktop/mobile layouts.
- Do not add cash features or require transaction history.
- Automatic price work is quote-only. It must not call news, calendar,
  corporate-action, snapshot, research-worker, or AI-provider paths.
- A failed or partial quote request must not replace a usable price with zero or
  make stale data appear fresh.
- Explicit `manual` market prices survive automatic quote imports. Initial
  `manual_holding` and `holdings_csv` fallback prices remain eligible for a
  later live quote.
- Scheduled and page-triggered automatic work share the same per-user database
  lease and retry ledger. Authenticated manual refresh keeps its existing
  behavior and is not rate-limited by this ledger.
- For each user and Asia/Kolkata date: allow one initial automatic attempt and
  at most two retries, at least 30 minutes apart. A fully fresh result suppresses
  further automatic attempts that day. Partial/failed results remain visible.
- Never hold a database transaction open while performing provider network
  requests.
- Every behavior begins with a failing focused test and ends with that test
  green before its commit.

---

### Task 1: Add scheduler leases and the automatic-attempt ledger

**Files:**

- Create: `lib/db/migrations/20260910_price_refresh_scheduler.sql`
- Create: `lib/db/src/schema/priceRefresh.ts`
- Create: `lib/db/src/schema/priceRefresh.test.ts`
- Modify: `lib/db/src/schema/index.ts`

**Interfaces:**

- `priceRefreshLeasesTable`, keyed by a bounded lease name, with owner,
  expiry, and update timestamps.
- `priceRefreshAttemptsTable`, keyed uniquely by user/local-day/attempt-number,
  with `running | fresh | partial | failed` status, safe diagnostics, worker,
  start/completion timestamps, and a user/day index.

- [x] Write schema/migration tests for columns, keys, checks, foreign keys,
  indexes, and additive/idempotent SQL.
- [x] Run the schema test red because the schema and migration do not exist.
- [x] Add the Drizzle schema and reviewed additive migration. Use a PostgreSQL
  `date` column for the Asia/Kolkata bucket and checks for nonblank lease/worker
  values and attempt numbers from 1 through 3.
- [x] Export the schema and run the focused schema test plus DB typecheck green.
- [x] Commit with `feat: add price refresh coordination schema`.

### Task 2: Implement atomic lease and attempt coordination

**Files:**

- Create:
  `artifacts/api-server/src/services/liveData/priceRefreshRepository.ts`
- Create:
  `artifacts/api-server/src/services/liveData/priceRefreshRepository.test.ts`

**Interfaces:**

- `localDateInKolkata(now: Date): string`.
- `listActivePortfolioUserIds(): Promise<string[]>` using dynamic portfolio
  ownership and existing calculated/direct holdings.
- `acquirePriceRefreshLease({ name, workerId, now, leaseMs })` with atomic
  expired-lease takeover and exact-owner renewal.
- `releasePriceRefreshLease({ name, workerId })` with exact-owner matching.
- `claimAutomaticPriceAttempt(...)` with atomic unique insertion, fresh-result
  suppression, maximum three attempts, and 30-minute separation.
- `completeAutomaticPriceAttempt(...)` restricted to the exact user, attempt,
  and worker.

- [x] Write tests over an injected query adapter for Kolkata date boundaries,
  dynamic active-user discovery, exact tenant predicates, concurrent conflict
  handling, current-lease rejection, expired takeover, exact-owner release,
  daily fresh suppression, cooldown, max attempts, and safe completion data.
- [x] Run the repository tests red.
- [x] Implement parameterized SQL; never interpolate user IDs, worker IDs,
  dates, or diagnostics. Return explicit claim/skip reasons without leaking
  provider or database payloads.
- [x] Run repository tests and API typecheck green.
- [x] Commit with `feat: coordinate automatic price refreshes`.

### Task 3: Add a quote-only refresh path and preserve manual prices

**Files:**

- Create:
  `artifacts/api-server/src/services/liveData/quoteRefreshPolicy.test.ts`
- Create:
  `artifacts/api-server/src/services/liveData/quoteRefreshPolicy.ts`
- Modify:
  `artifacts/api-server/src/services/liveData/liveDataService.ts`
- Modify:
  `artifacts/api-server/src/services/intelligence/marketIntelligenceService.ts`
- Modify:
  `artifacts/api-server/src/services/portfolio/portfolioService.ts`

**Interfaces:**

- `liveDataService.refreshQuotes(userId, { force })` uses quote-capable
  providers only and returns expected/received symbols plus the existing
  diagnostics/import summary.
- `portfolioService.setMarketPrices(..., { preserveExplicitManual })` skips an
  existing `source === "manual"` row only for automatic imports.
- `marketIntelligenceService.importNormalizedData` can disable research-trigger
  emission for quote-only scheduled imports.

- [x] Write policy tests proving quote-only mode never selects snapshot, news,
  calendar, or corporate actions; classifies complete fresh versus partial or
  failed results; ignores invalid/zero quote values; and protects only explicit
  manual overrides.
- [x] Run the policy tests red.
- [x] Refactor the existing refresh loop behind an all-capabilities/quotes-only
  mode without changing authenticated manual refresh defaults.
- [x] Make quote-only imports skip research-trigger emission and preserve
  explicit manual prices. Retain stale fallback diagnostics and per-ticker
  missing-symbol reporting.
- [x] Run the policy, provider, normalization, portfolio, and API typecheck
  suites green.
- [x] Commit with `feat: add safe quote-only portfolio refresh`.

### Task 4: Run bounded automatic refreshes from pages and a finite CLI

**Files:**

- Create:
  `artifacts/api-server/src/services/liveData/priceRefreshScheduler.ts`
- Create:
  `artifacts/api-server/src/services/liveData/priceRefreshScheduler.test.ts`
- Create:
  `artifacts/api-server/src/services/liveData/priceRefreshRuntime.ts`
- Create: `artifacts/api-server/src/price-refresh.ts`
- Create: `artifacts/api-server/src/price-refresh.test.ts`
- Modify:
  `artifacts/api-server/src/services/liveData/liveDataService.ts`
- Modify: `artifacts/api-server/build.mjs`
- Modify: `artifacts/api-server/package.json`

**Interfaces:**

- `runAutomaticPriceRefreshForUser` acquires the shared user lease, claims an
  eligible attempt, performs one forced quote-only refresh outside a database
  transaction, records `fresh | partial | failed`, and releases the lease.
- `runPriceRefreshBatch` acquires one global lease, discovers active users,
  processes them with bounded concurrency, isolates per-user failures, and
  returns a safe finite summary.
- Compiled command:
  `artifacts/api-server/dist/price-refresh.mjs` and script `prices:run-once`.

- [x] Write scheduler tests for shared lock rejection, expired recovery via the
  repository contract, no holdings hardcoding, per-user isolation, bounded
  concurrency, attempt status, partial/missing ticker behavior, no retry after
  fresh, and release on errors.
- [x] Write entry-point tests for finite configuration bounds, nonzero fatal
  exit behavior, safe logs, `AI_REQUESTS_ENABLED=false`, and pool shutdown.
- [x] Run scheduler/entry tests red.
- [x] Implement scheduler, runtime wiring, page-triggered `refreshDaily`
  delegation, finite command, build entry, and package script.
- [x] Run all live-data, portfolio, route, scheduler, typecheck, and production
  build checks green.
- [x] Commit with `feat: schedule database-leased price refreshes`.

### Task 5: Add an initially disabled, zero-payment GitHub workflow

**Files:**

- Create: `.github/workflows/daily-price-refresh.yml`
- Create: `scripts/verify-price-refresh-workflow.mjs`
- Create: `scripts/verify-price-refresh-workflow.test.ts`
- Modify: `package.json`
- Modify: `render.yaml`
- Modify: `.env.example`
- Modify: `docs/deployment/free-hosting.md`

**Interfaces:**

- Weekday `10:47 UTC` cron and manual dispatch.
- Scheduled job condition requires
  `vars.ENABLE_PRICE_REFRESH_SCHEDULE == 'true'`; unset is disabled. Manual
  dispatch remains available after an action-time approval.
- Read-only contents permission, pinned checkout/setup actions, Node 24,
  frozen install, reviewed migrations, ten-minute timeout, concurrency guard,
  database secret only, and AI explicitly disabled with no OpenAI secret.

- [x] Write a structural workflow verifier that rejects write permissions,
  unpinned actions, pull-request triggers, missing enable gate, non-weekday cron,
  absent timeout/concurrency, AI enablement, OpenAI secrets, or any Replit/paid
  cron dependency.
- [x] Run the workflow verifier red.
- [x] Add the disabled-by-default workflow and build/runtime configuration.
  Ensure reviewed migrations run before both web startup and the scheduler.
- [x] Extend the runbook with the free-allowance/no-overage check, exact manual
  enable/disable steps, retry/status interpretation, secret scope, rollback,
  and the authenticated on-demand fallback. Do not claim the schedule is on.
- [x] Run the workflow verifier and configuration tests green.
- [x] Commit with `feat: prepare free daily price workflow`.

### Task 6: Full regression and no-spend handoff

**Files:**

- Modify this plan by checking every completed step.
- Modify documentation only if verification discovers an inaccurate command.

- [x] Run all DB, auth, live-data, portfolio, intelligence, Guardian, Morning
  Brief, research, capabilities, frontend, typecheck, workflow, and production
  build tests with `AI_REQUESTS_ENABLED=false` and no OpenAI key.
- [x] Run `git diff --check`, inspect `git status`, and scan tracked/diff files
  for `.env`, database dumps, OAuth credentials, API keys, tokens, session
  secrets, and generated build artifacts.
- [x] Confirm the workflow is disabled by default, only quote code is reachable,
  manual refresh is unchanged, and no automatic path can call AI.
- [x] Commit verified plan checkmarks with
  `docs: verify daily price refresh migration`.
- [x] Do not push, deploy, enable, create credentials, or upload/restore data.
  Report the exact remaining approval-gated actions to the user.

## Verification Record — 2026-09-12

- All 320 TypeScript tests under `lib/` and `artifacts/` passed with
  `AI_REQUESTS_ENABLED=false` and an empty `OPENAI_API_KEY`.
- Both package-manager policy tests and all 10 workflow-policy tests passed.
- The full workspace typecheck and production build passed. Vite emitted only
  the three pre-existing UI source-map location warnings.
- The built `price-refresh.mjs` command was probed without `DATABASE_URL`; it
  exited nonzero and logged only `scheduler_unavailable`, without a stack or
  environment value.
- `git diff --check` passed. The changed-file and tracked-file scans found no
  dump, generated build output, private key, OAuth credential, API token, or
  session secret. `.env.example` contains placeholders only.
- No live database was opened because no approved disposable or destination
  database was provided. No workflow was dispatched or enabled, and nothing
  was pushed or deployed.
