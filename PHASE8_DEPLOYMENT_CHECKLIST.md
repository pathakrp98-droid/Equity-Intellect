# AlphaDesk v0.8 Deployment Checklist

## Before applying

- Commit or checkpoint the current repository.
- Back up the production database.
- Confirm the ZIP checksum against `AlphaDesk-v0.8-Production-Integration.sha256`.
- Confirm no previous phase ZIP is being applied in the same deployment.

## Apply and validate

```bash
bash apply-v0.8.sh "$REPOSITORY_ROOT"
pnpm install --frozen-lockfile
pnpm --filter @workspace/db push
pnpm run typecheck
pnpm run build
```

Stop if the database tool proposes deleting existing tables, columns or user data.

## Production configuration

- Set `NODE_ENV=production`.
- Set `APP_VERSION=0.8.0`.
- Set `CORS_ALLOWED_ORIGINS` to exact HTTPS origins, comma-separated.
- Keep `OPENAI_API_KEY`, `ALPHA_VANTAGE_API_KEY` and normalized-provider keys in server secrets only.
- Confirm the authentication/session secrets already required by the repository are present.
- Do not commit `.env` files or broker exports.

## Functional checks

- Sign in and open `/system-health`.
- Confirm the database status is reachable.
- Confirm the portfolio is user-specific and contains no sample holdings.
- Import or enter at least one transaction and refresh prices.
- Create or link research for a holding.
- Generate a Morning Brief.
- Run a Guardian check and confirm no brokerage order is placed.
- Record a journal entry and schedule a review.
- Evaluate alerts and verify acknowledge/dismiss/reopen flows.
- Refresh the configured live-data provider and inspect freshness labels.
- Test at mobile width and desktop width.
- Disconnect the network temporarily and confirm the offline banner appears.
- Run `node scripts/phase8-smoke.mjs`.

## Go-live criteria

- Typecheck passes.
- Production build passes.
- Database migration completes without destructive changes.
- No legacy mock dashboard or market endpoints return data.
- `/api/integration/health` returns 401 signed out and user-specific data signed in.
- No provider secret appears in browser network responses.
- Critical alerts and system blockers are reviewed.
