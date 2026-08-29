# AlphaDesk free-hosting migration design

Date: 2026-08-28. Status: approved by the user on 2026-08-29.

## Outcome and boundaries

Move the existing AlphaDesk application from Replit to one Render Free web service and a Neon Free PostgreSQL database, using Google sign-in. Preserve the existing portfolio and its ownership. The user has approved Google sign-in and does not authorize any payment.

This is a personal-use, best-effort deployment, not an always-on production service. Free hosting may sleep or stop at its quota. A first visit can be slow. This migration does not promise free hosting forever or unlimited usage.

Global requirements:

- No payment, subscription upgrade, trial requiring a card, or billable overage.
- No Replit Agent and no paid AI requests during development, verification, or deployment.
- Preserve holdings CSV import, manual holding entry/editing, manual ETF prices, quote diagnostics, Guardian, Morning Brief, saved research, and desktop/mobile layouts.
- Do not add cash features or require transaction history.
- Preserve existing user IDs, portfolio IDs, and tenant ownership; do not merge accounts by email.
- Keep private backups and credentials out of Git, browser bundles, logs, and deployment artifacts.
- Do not modify or delete the Replit databases or the saved backups.
- Push application changes only after relevant tests, typecheck, and production build pass.

New AI research generation, a different investment methodology, native mobile apps, and a public multi-user launch are outside this migration. Existing research data remains available; the UI must not imply new AI research is running while it is disabled.

## Existing system and recovery boundary

The repository is a pnpm workspace with a React/Vite frontend, Express API, PostgreSQL/Drizzle data layer, and `openid-client` authentication. The browser already calls relative `/api` routes. Replit currently supplies same-origin routing; Express does not yet serve the frontend.

Authentication currently uses Replit subjects directly as internal user IDs. Changing the provider without an identity mapping could create a different account or strand the existing portfolio. Sessions contain provider tokens and must not be reused across providers.

The saved PostgreSQL archive is from the accessible **development database only**. Its checksum and archive readability have been verified. A restore has not yet been tested. Session rows were excluded deliberately. The frozen production database could not be compared with development; this archive must never be described as a verified production backup.

Before cutover, show the recovered holdings and saved records to the user and obtain confirmation that this development snapshot is acceptable. Do not imply inaccessible production-only changes have been recovered.

## Architecture

### One web service, one database

Render runs the existing Node API and serves the built frontend from the same HTTPS origin. Neon stores application data and sessions. Use provider-generated domains; no domain purchase is needed.

Express must mount API routes before the frontend fallback. Unknown `/api` paths continue returning JSON 404 responses. Only browser GET/HEAD navigation requests may receive the SPA entrypoint; missing assets, non-GET requests, dotfiles, backups, and server source must not fall through to HTML or become downloadable. Serve only the frontend's built `dist/public` directory.

Keep `/api/healthz` as a cheap process health check. Keep `/api/readyz` for database readiness. Hosting health probes must not repeatedly wake the database just to check whether Node is running. Preserve security headers and same-origin cookies; reject untrusted CORS origins.

Use Node 24 and preserve the existing dependency versions. Review lockfile adjustments needed for cross-platform installation, then deploy with a frozen lockfile. Render configuration must explicitly select its Free web-service plan and must not provision Render PostgreSQL, disks, paid workers, or paid cron jobs. Build and startup paths must work from a clean Linux checkout. Secrets are supplied through host settings, never frontend build variables.

### Database restore and migrations

Restore to a new, empty disposable PostgreSQL database first, never over an existing database. Use PostgreSQL tools compatible with the saved archive, stop on restore errors, and do not use destructive `--clean` restoration. Compare table counts, primary keys, foreign-key ownership, holdings totals, and representative saved records. Confirm the sessions table is empty.

The current SQL migrations are additive and assume the older application schema exists. Restore that schema from the archive before running reviewed migrations; do not substitute an unreviewed schema push. Preserve the migration ledger and checksums. The existing advisory-lock/transaction migration runner remains the execution path.

After the user approves the exact Neon destination and private-data transfer, repeat the verified restore procedure there. Use TLS connections, bounded connection pools, and separate runtime versus migration credentials where supported. Do not expose database credentials to the frontend or install them in untrusted CI contexts.

### Google sign-in and ownership

Add an explicit `AUTH_PROVIDER=google` mode while retaining the existing Replit mode for compatibility. Google mode requires a canonical `APP_ORIGIN`, client ID, and client secret. Missing or invalid configuration must fail clearly, not silently select another provider.

Continue using `openid-client` for discovery and verified authorization-code exchange with PKCE, state, nonce, and ID-token validation. Request only `openid email profile`; the app does not need Google Drive, Gmail, billing, or offline access. Use the exact registered `/api/callback` URL derived from `APP_ORIGIN`, not arbitrary forwarded host headers. Return paths must remain on that origin. Clear temporary OAuth cookies on success and failure; show a recoverable sign-in error instead of an endless redirect loop.

Add an external-identity table mapping a unique `(issuer, subject)` to the existing internal user ID. Internal IDs and dependent rows do not change. Enforce foreign keys and uniqueness; never infer account ownership from an email match, including a verified email.

For the first migrated owner, use an operator-assisted setup: a successful Google callback for an unmapped identity shows a setup screen with that validated identity's setup information, but creates no authenticated portfolio session and exposes no existing portfolio. After the user confirms this is their intended Google account, an administrative command binds that exact issuer/subject to the selected existing user ID. The binding is transactional, refuses conflicting mappings, and has no public administrative endpoint. Repeat Google sign-in to obtain the normal session. Open registration remains disabled for this personal deployment; there is no hardcoded owner email or holdings list in source.

Google sessions use an opaque random database-backed session ID with the existing seven-day maximum lifetime. They do not retain Google access/refresh tokens because no Google APIs are needed after authentication. Model provider-specific session data explicitly so the middleware never refreshes a Google session through Replit or treats a legacy session as Google-authenticated. Production cookies remain HttpOnly, Secure, SameSite=Lax, and scoped to the app.

Logout clears the app session and returns to the app; it must not log the user out of their entire Google account. Mobile browsers use this same web flow. Preserve existing native token-exchange behavior in Replit mode; reject it clearly in Google mode until a separately registered native-client flow exists.

### No-spend AI behavior

Add a shared `AI_REQUESTS_ENABLED` policy that defaults to false and enables requests only for the exact value `true`. Set it to `false` in the migrated environment and do not install an OpenAI key there.

Both Copilot and automated research must check the policy when reporting availability **and immediately before every outbound AI request**. An accidentally present API key cannot override the disabled policy. Test that disabled calls produce zero network requests, including discovery, generation, retries, and worker entrypoints.

Keep saved research and Copilot history readable. Disable generation controls with a concise explanation such as “AI generation is disabled on this deployment.” Do not repeatedly enqueue, lease, or retry AI jobs while disabled, and do not erase existing jobs or research history. Continue the existing rule-based Guardian and Morning Brief behavior; do not fabricate research or label deterministic output as newly AI-generated.

### Daily price refresh without an always-on server

Preserve the existing quote providers, cache/fallback logic, manual-price behavior, and per-ticker stale/error information. Keep on-demand refresh and the current due-refresh path as fallback. A failed quote request must not replace a usable price with zero or make an old price look current.

Add a finite price-refresh CLI for a GitHub Actions scheduled run, independent of Render sleeping. It discovers active portfolios from the database; it does not hardcode this user's holdings. It must not invoke the research worker or any AI provider. The scheduled path refreshes quotes only, using approved free market-data sources and existing symbol/batch limits.

Schedule one weekday run at 10:47 UTC (16:17 India time), with a manual-dispatch option, a ten-minute workflow timeout, and concurrency control. Scheduling is best-effort, not a guarantee of precise timing. Add a database-backed lease shared with daily refresh so independent processes cannot stampede providers. Count automatic attempts by user and Asia/Kolkata calendar day: one initial attempt and at most two retries, at least thirty minutes apart. A successful fresh refresh suppresses further automatic work for that day; manual refresh retains its existing limits. Do not hold a database transaction open during network requests. Record attempts separately from successful fresh prices; stale fallback or partial failure must remain visibly stale/partial.

Workflow permissions are read-only for repository contents. Use standard hosted runners, pinned actions, and only the required database/quote secrets; never attach those secrets to pull-request or fork code. Verify the account's free allowance and no-overage settings before enabling the schedule. If a zero-payment setup cannot be confirmed, leave the schedule disabled and retain authenticated on-demand refresh. Do not use artificial keep-alive traffic to prevent Render sleeping.

## Implementation boundaries

Keep changes concentrated in the existing auth routes/library/middleware, a small identity-binding module and additive database migration, static hosting setup, the two AI providers and availability consumers, and the live-price scheduler. Avoid renaming packages merely because their names contain “replit.” Retain Replit configuration for reference and compatibility; it is not a promise that the frozen deployment can be restarted free.

Add a deployment runbook and secret-free environment example. Update obsolete local-run instructions only where this migration makes them inaccurate. Ignore local secret files while retaining the example. Do not add database dump files to the repository.

The baseline checkout currently excludes Windows native packages in `pnpm-workspace.yaml`. On 2026-08-28, 10 database tests, 161 research tests, and typecheck passed, but the production build stopped because `@esbuild/win32-x64` was missing. Make clean Windows installs reproducible by correcting platform exclusions for the native build dependencies, without weakening the minimum-release-age policy. Verify the Linux build as well; temporary machine-only package copies are not the release solution.

## Acceptance and cutover gates

1. Add failing regression tests before changing application behavior. Cover auth issuer/subject ownership, conflicting bindings, state/nonce rejection, safe callbacks/return paths, session expiration, and cross-tenant denial.
2. Verify same-origin static serving, protected API responses, SPA navigation, missing assets, and secret-file exclusion using the built server.
3. Prove disabled AI paths make no external AI requests even with a dummy key. Keep existing research/Guardian/Morning Brief behavior tests passing.
4. Verify daily refresh locks, expired leases, provider failure, stale/partial status, per-user isolation, and manual ETF-price preservation with mocked providers.
5. Run the complete relevant test suite, typecheck, and production build from a clean supported environment. Do not push a failing build.
6. Complete the disposable restore test. Obtain specific approval for account/OAuth credential setup, private-data upload to the named Neon project, secret installation, and the final deployment as those actions arise. Never accept billing prompts.
7. Verify the recovered snapshot and Google-owner binding with the user, then smoke-test authenticated desktop and narrow/mobile layouts: holdings, CSV import, manual edit/price, quote errors, Guardian, Morning Brief, and saved research. Use synthetic/disposable data for destructive or mutating checks.
8. Confirm no paid plan/key/AI worker was enabled. Enable scheduled prices only after the free-usage checks pass. Record the new URL and recovery instructions; preserve the old data and both local backups.

If verification fails, stop cutover. Keep the known backup intact and restore only to a separately approved empty destination. Roll back application code only when compatible with the additive schema; do not drop identity tables or overwrite newer portfolio data. Do not republish the Replit workspace while its temporary download copy remains in a deployment-included directory.

## Provider references

Provider limits and setup requirements were checked during migration discovery on 2026-08-28 and must be rechecked at account setup, since free plans can change.

- [Render Free limitations](https://render.com/docs/free): sleeping web services and free-plan restrictions; do not use expiring Render Free PostgreSQL for this migration.
- [Neon pricing](https://neon.com/pricing): confirm the Free plan and its current limits without adding billing.
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions): confirm included usage and prevent overages before enabling a private-repository schedule.
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect): identity validation, stable subjects, OAuth client setup, and redirect requirements.
