# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm test:db` — migration/schema unit tests
- `pnpm test:research` — automated research contract, provider, lifecycle, API and UI tests
- `pnpm --filter @workspace/db migrate` — apply reviewed, checksum-protected production migrations
- `pnpm --filter @workspace/api-server research:run-once` — run one bounded automated-research worker batch
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Automated research also requires server-only `OPENAI_API_KEY`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Research contract: `lib/research-contracts/src/index.ts`
- Additive research schema/migration: `lib/db/src/schema/researchAutomation.ts`, `lib/db/migrations/20260813_automated_research_engine.sql`
- Worker/provider: `artifacts/api-server/src/services/research/automation/`
- Layman Research UI: `artifacts/portfolio-intelligence/src/pages/Research.tsx`
- Deployment runbook: `docs/AUTOMATED_RESEARCH_DEPLOYMENT.md`

## Architecture decisions

- Manual research and automated snapshots are separate; automation never overwrites user-authored rows.
- Web evidence is treated as untrusted input, canonicalized, source-ranked, bounded, and validated before publication.
- Snapshots are immutable and append-only; a failed refresh leaves the previous successful snapshot current.
- The web app never waits for OpenAI. Durable database jobs run in a separate Replit Scheduled Deployment.
- A single bulk read model supplies Guardian, Morning Brief, Alerts, and System Health.

## Product

AlphaDesk is a holdings-first portfolio monitor for a layperson. It imports or accepts holdings directly, refreshes market prices, builds evidence-first automated research for any active security, labels AI judgements, and carries material changes into Guardian, Morning Brief, Alerts, and System Health.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Never run `db push` in production; run the reviewed migration after verifying a managed database recovery point.
- The Scheduled Deployment has deployment-scoped secrets and must receive `DATABASE_URL` and `OPENAI_API_KEY` separately.
- Pause the schedule to stop new jobs; do not delete snapshot history during rollback.
- Production release gates and authenticated smoke steps are in `docs/AUTOMATED_RESEARCH_DEPLOYMENT.md`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
