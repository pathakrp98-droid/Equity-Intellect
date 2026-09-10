# AlphaDesk free-hosting runbook

## Current status

This repository is prepared for one same-origin Node web service, but nothing
has been deployed and no account, database, OAuth client, or paid resource has
been created. Do not apply `render.yaml` yet: the recovered data, exact Google
account, and existing AlphaDesk owner still require approval and verification.

The only saved archive currently available is a **development database**
archive. It is not a verified production backup. It has not been restored, and
the inaccessible Replit production database has not been compared with it.

## Zero-payment boundary

- Use only a Render web service whose compute plan visibly says **Free**.
- Do not add a payment method, paid disk, worker, cron job, Render Postgres, or
  usage upgrade. If Render cannot guarantee suspension instead of billing,
  stop.
- Use a provider-generated domain; do not buy a domain.
- Keep `AI_REQUESTS_ENABLED=false` and do not install `OPENAI_API_KEY`.
- Use Neon only after its dashboard visibly confirms the **Free** database
  plan and no payment requirement. Recheck limits at setup time.
- Never use keep-alive traffic to prevent the free web service from sleeping.

Render currently documents that Free web services sleep after 15 minutes of
inactivity, can take about a minute to wake, and have an ephemeral filesystem.
It also documents that accounts without a payment method are suspended or stop
building when included usage is exhausted instead of receiving an overage
charge. Reconfirm those rules immediately before account creation:

- <https://render.com/docs/free>
- <https://render.com/docs/blueprint-spec>
- <https://neon.com/pricing>

## What the build produces

Run from the repository root:

```powershell
$env:AI_REQUESTS_ENABLED = 'false'
$env:OPENAI_API_KEY = ''
pnpm install --frozen-lockfile
pnpm run build
```

The root build deliberately runs in this order:

1. typecheck every workspace;
2. build the React app into `artifacts/portfolio-intelligence/dist/public`;
3. build the API and copy that public directory to
   `artifacts/api-server/dist/public`;
4. build the standalone mockup.

The service starts with:

```powershell
$env:PORT = '5000'
$env:NODE_ENV = 'production'
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

Express keeps `/api/*` ahead of the SPA. Unknown API routes return JSON 404;
missing assets, dotfiles, source files, non-HTML requests, and non-GET requests
never receive `index.html`.

## Deployment variables

| Variable               | Requirement                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Neon TLS connection string, installed only after approval of the exact destination and private-data upload. |
| `CORS_ALLOWED_ORIGINS` | Exact final Render HTTPS origin, with no wildcard.                                                          |
| `NODE_ENV`             | `production`.                                                                                               |
| `NODE_VERSION`         | `24.19.0` for the reviewed build.                                                                           |
| `AI_REQUESTS_ENABLED`  | Literal `false`.                                                                                            |
| `OPENAI_API_KEY`       | Omit entirely.                                                                                              |
| `AUTH_PROVIDER`        | Literal `google` for the new deployment.                                                                    |
| `APP_ORIGIN`           | Exact final Render HTTPS origin, with no path or trailing slash.                                            |
| `GOOGLE_CLIENT_ID`     | Approved Google web OAuth client ID, installed as a secret.                                                 |
| `GOOGLE_CLIENT_SECRET` | Matching Google web OAuth client secret, installed as a secret.                                             |

Register this exact authorized redirect URI in the approved Google web OAuth
client:

```text
${APP_ORIGIN}/api/callback
```

Google mode never chooses an AlphaDesk owner by email. On the first sign-in by
an unmapped account, `/api/auth/setup` says that no portfolio data has been
opened and displays the verified issuer and subject. Only after the user
verifies that displayed Google account and the exact existing internal user ID,
bind the identity from a built workspace:

```powershell
pnpm --filter @workspace/api-server auth:bind -- --issuer https://accounts.google.com --subject GOOGLE_SUB_FROM_SETUP_PAGE --user-id EXISTING_INTERNAL_USER_ID
```

Then sign in again. The existing Replit issuer remains compatibility code only;
the Render blueprint intentionally contains no `ISSUER_URL` or `REPL_ID`.

## Approval gates

Each item below requires confirmation at the moment it is performed:

1. Create or select the exact Neon Free project.
2. Restore the development archive into a new empty disposable database,
   without `--clean`, then verify counts, ownership, holdings, saved research,
   and an empty sessions table.
3. Ask the user whether that recovered snapshot is the portfolio to migrate.
4. Create the Google web OAuth client with the exact callback above.
5. Install the three Google variables—`APP_ORIGIN`, `GOOGLE_CLIENT_ID`, and
   `GOOGLE_CLIENT_SECRET`—only into the approved deployment's secret store.
6. Upload the approved private data to the named Neon project.
7. After the user verifies the setup page's Google account and exact existing
   internal user ID, run the identity-binding command against that migrated
   database. Never bind by email.
8. Create the Render Free service from `render.yaml` and deploy. Stop on any
   billing, trial, card, or upgrade prompt.

OAuth client creation, secret installation, identity binding against migrated
data, and deployment are four separate action-time approvals. Approval of one
does not authorize the next.

## Smoke checks after an approved deployment

- `/api/healthz` returns process health without querying PostgreSQL.
- `/api/readyz` confirms the database separately.
- `/api/missing` returns JSON 404 and `/dashboard` returns the SPA.
- Sign-in reaches the previously bound internal user and existing portfolio.
- Desktop and narrow/mobile checks cover holdings, CSV import, manual holding
  edits, manual ETF market prices, stale/error quote status, Guardian, Morning
  Brief, and saved research.
- The Research screen visibly says AI generation is disabled, saved evidence
  remains readable, and refresh cannot enqueue a paid job.

If any ownership, restore, billing, or verification check fails, stop the
cutover. Preserve the source databases and private backups; do not overwrite an
existing database or delete the old data.

## Daily prices while the web service sleeps

The repository now contains a finite, quote-only command and a GitHub Actions
workflow for weekday price refreshes. The workflow is **disabled by default**:
scheduled events skip the job unless the repository variable
`ENABLE_PRICE_REFRESH_SCHEDULE` is exactly `true`. Do not create that variable
until GitHub's billing page visibly confirms that the repository/account has
enough included Actions usage and cannot create a payment or overage charge.

Recheck GitHub's current Actions billing rules immediately before enabling:

- <https://docs.github.com/en/billing/concepts/product-billing/github-actions>
- <https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables>

The workflow runs at 10:47 UTC (16:17 India time) Monday through Friday. It has
read-only repository permission, a ten-minute timeout, pinned official actions,
and receives only the `ALPHADESK_DATABASE_URL` secret. It explicitly disables
AI and has no OpenAI, Google, Render, or Replit secret. It applies only reviewed
additive database migrations, discovers owners with active holdings from the
database, and runs the same quote path available in the app. It does not run
research, news, calendar, or corporate-action providers.

After a separate action-time approval, add the database connection string as
the repository secret `ALPHADESK_DATABASE_URL`. A manual **Run workflow** is
also approval-gated because it sends that secret to a GitHub-hosted runner.
Verify a manual run and the portfolio's price statuses before enabling the
recurring variable.

Automatic attempts are recorded per owner and Asia/Kolkata day. One initial
attempt plus two retries are allowed, at least 30 minutes apart. A fully fresh
result ends automatic work for that day; partial or failed coverage remains
visible as stale/error status and can retry. Explicit market prices entered as
manual overrides are never replaced by the automatic path. Authenticated
in-app refresh remains available if the workflow stays disabled.

To disable recurring work, delete the variable or set it to any value other
than `true`. Do not delete quote history, leases, or attempt records. Disabling
the schedule does not affect manual prices or on-demand refresh.
