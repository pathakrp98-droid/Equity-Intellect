# File manifest

## Database

- `lib/db/src/schema/portfolio.ts` — portfolio ledger, price, holding, cash and snapshot tables.
- `lib/db/src/schema/index.ts` — exports the new portfolio schema.

## Backend

- `artifacts/api-server/src/services/portfolio/engine.ts` — pure calculation engine and XIRR.
- `artifacts/api-server/src/services/portfolio/csv.ts` — manual/Zerodha/Groww CSV normalization.
- `artifacts/api-server/src/services/portfolio/portfolioService.ts` — ownership, persistence, recalculation and analytics service.
- `artifacts/api-server/src/services/portfolio/engine.test.ts` — engine unit tests.
- `artifacts/api-server/src/services/portfolio/csv.test.ts` — CSV parser tests.
- `artifacts/api-server/src/routes/portfolio.ts` — real portfolio API replacing demo data.
- `artifacts/api-server/src/app.ts` — raises request-body limit for CSV payloads.

## Frontend

- `artifacts/portfolio-intelligence/src/features/portfolio/api.ts` — typed React Query hooks.
- `artifacts/portfolio-intelligence/src/pages/PortfolioEngine.tsx` — complete phase-one UI.
- `artifacts/portfolio-intelligence/src/App.tsx` — routes `/portfolio` to the new engine.
