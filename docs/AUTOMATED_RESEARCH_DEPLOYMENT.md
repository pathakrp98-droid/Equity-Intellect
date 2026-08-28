# Automated Research Deployment

AlphaDesk automated research runs outside the web request path. Portfolio changes create durable database events, and a separate Replit Scheduled Deployment processes those events and refreshes evidence. Existing manual theses, notes, risks, catalysts, and valuation assumptions are not overwritten.

## Release prerequisites

Do not migrate or publish until all of these are true:

- The managed PostgreSQL service has a verified snapshot or point-in-time recovery point.
- The migration has been applied twice to a disposable/restored database; the second run must report no pending migrations.
- `pnpm test:db`, `pnpm test:research`, `pnpm typecheck`, and `pnpm build` all exit successfully.
- The autoscale web deployment and one-shot worker bundles both exist in `artifacts/api-server/dist`.
- `DATABASE_URL` and `OPENAI_API_KEY` are deployment secrets, not repository files.

## Database migration

Use the reviewed, checksum-protected migration runner:

```bash
pnpm --filter @workspace/db migrate
pnpm --filter @workspace/db migrate
```

The first command applies `lib/db/migrations/20260813_automated_research_engine.sql`; the second proves idempotency. Never run `db push` against production. The migration is additive and leaves manual research tables intact.

## Replit Scheduled Deployment

Create a deployment separate from the existing autoscale web app. Replit documents Scheduled Deployments as command-line jobs that stop after each run and supports a selected timezone, build/run commands, a job timeout, and deployment-scoped secrets. See [Replit Scheduled Deployments](https://docs.replit.com/cloud-services/deployments/scheduled-deployments).

Use these settings:

```text
Deployment type: Scheduled
Build command: pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server build
Run command: pnpm --filter @workspace/api-server research:run-once
Cron: */15 * * * *
Timezone: Asia/Calcutta
Job timeout: 10 minutes minimum
```

Required deployment secrets:

```text
DATABASE_URL
OPENAI_API_KEY
```

The Scheduled Deployment has its own secret configuration. Verify both secrets there even when the autoscale app already has them.

Optional controls currently honored by the worker/provider:

```text
RESEARCH_MODEL
RESEARCH_MAX_EVENTS_PER_RUN       # default 50, allowed 1..250
RESEARCH_MAX_JOBS_PER_RUN         # default 25, allowed 1..250
RESEARCH_MAX_CONCURRENCY          # default 2, allowed 1..10
RESEARCH_JOB_LEASE_MS             # default 600000, allowed 30000..3600000
RESEARCH_MAX_EVIDENCE_COUNT
RESEARCH_MAX_CONTEXT_CHARACTERS
RESEARCH_MAX_OUTPUT_TOKENS
RESEARCH_MAX_RESPONSE_CHARACTERS
RESEARCH_DISCOVERY_TIMEOUT_MS
RESEARCH_GENERATION_TIMEOUT_MS
```

Keep the initial rollout conservative: 5 jobs per run and concurrency 1. Increase only after reviewing duration, OpenAI usage, evidence quality, and retry counts. Do not configure older names such as `RESEARCH_JOB_LEASE_MINUTES`; the current worker uses `RESEARCH_JOB_LEASE_MS`.

## Run Now verification

After publishing the Scheduled Deployment:

1. Use **Run Now** once.
2. Confirm the log contains `research worker completed` and a structured `researchBatch` summary.
3. Confirm `leaseAcquired` is true, the command exits 0, and no raw secret or page content appears in logs.
4. Open AlphaDesk Research and verify a holding moves through Queued/Running to Current, Limited, or Needs identity.
5. Run it again and confirm duplicate jobs or duplicate snapshot versions are not created.
6. Open System Health and confirm current, limited, queued/running, stale, and failed counts are honest.

An individual provider retry or dead-letter is recorded in the database and does not delete the last successful snapshot. A database/scheduler failure makes the worker exit non-zero.

## Authenticated preview smoke

Run the smoke script against a preview deployment. Cookie values are temporary session data; never commit them or paste them into logs.

```bash
ALPHADESK_BASE_URL=https://your-preview.example \
ALPHADESK_SESSION_COOKIE='connect.sid=...' \
ALPHADESK_SECOND_USER_COOKIE='connect.sid=...' \
ALPHADESK_SMOKE_MUTATE=1 \
node scripts/phase8-smoke.mjs
```

The script checks signed-out protection, authenticated portfolio/coverage alignment, honest statuses, grounded facts, AI judgement kinds, append-only history, cross-user denial, refresh/cooldown behavior, and absence of cash fields from the new research API.

## Pause and rollback

The Scheduled Deployment is the operational feature flag for background generation. To stop new automated work without deleting research:

1. Pause the Replit Scheduled Deployment.
2. Leave the autoscale web app running; saved snapshots and manual research remain readable.
3. If a longer pause is required, disable automation preferences/companies through an approved database change or product control. Do not delete queued jobs or snapshot tables.

Application rollback means deploying the prior web/worker commit while leaving the additive tables in place. Do not reverse the migration by dropping tables or PostgreSQL enums. Restore the managed database only for a verified database incident, using the pre-migration recovery point.

## Release checklist

- [ ] Managed database snapshot/PITR verified.
- [ ] Migration passes twice on a disposable restored database.
- [ ] Full tests, typecheck, and build pass from a clean checkout.
- [ ] Autoscale web app deployed with the reviewed migration already present.
- [ ] Scheduled Deployment created with the commands, timezone, timeout, and secrets above.
- [ ] Bounded Run Now succeeds.
- [ ] One Current and one Limited/Needs identity path are visually checked.
- [ ] Guardian, Morning Brief, Alerts, and System Health show AI judgements and evidence links correctly.
- [ ] Desktop and mobile Research layouts are checked.
- [ ] Feature can be paused by stopping the schedule without losing snapshots.
