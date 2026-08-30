# AlphaDesk free-hosting runbook

## Current status

This repository is prepared for one same-origin Node web service, but nothing
has been deployed and no account, database, OAuth client, or paid resource has
been created. Do not apply `render.yaml` yet: Google sign-in and the explicit
legacy-owner binding still need their tested migration.

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

Google variables are intentionally absent until the authentication plan is
implemented and verified. The existing Replit issuer is compatibility code,
not the identity mechanism for the new deployment.

## Approval gates

Each item below requires confirmation at the moment it is performed:

1. Create or select the exact Neon Free project.
2. Restore the development archive into a new empty disposable database,
   without `--clean`, then verify counts, ownership, holdings, saved research,
   and an empty sessions table.
3. Ask the user whether that recovered snapshot is the portfolio to migrate.
4. Create the Google OAuth client and bind the verified issuer/subject to the
   existing internal owner ID. Never bind by email.
5. Upload the approved private data to the named Neon project.
6. Create the Render Free service from `render.yaml`, install secrets, and
   deploy. Stop on any billing, trial, card, or upgrade prompt.

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
