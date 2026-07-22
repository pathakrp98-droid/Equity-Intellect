# AlphaDesk v0.2 — Research Engine

AlphaDesk v0.2 is a cumulative release. It contains the complete Phase 1 Portfolio Engine plus the Phase 2 Research Engine.

## What Phase 2 adds

### Persistent research database

The release adds user-isolated tables for:

- Covered companies
- Investment theses
- Research notes and source links
- Catalysts
- Material risks
- Thesis invalidation triggers
- Valuation assumptions

Each record is tied to the authenticated user. Research for one user is not returned to another user.

### Company workspace

The `/research` page now provides:

- Searchable coverage universe
- Automatic discovery of portfolio holdings without research coverage
- One-click creation of a workspace from an existing holding
- Holding value, quantity, allocation and P&L context
- Company profile editor
- Thesis versioning and review dates

### Thesis framework

Each company can store:

- Core thesis
- Bull, base and bear cases
- Conviction
- Thesis status
- Moat and management ratings
- Investment horizon
- Expected return and maximum acceptable loss
- Scenario prices and action target
- Valuation methodology
- Falsifiable key assumptions

### Evidence and monitoring

The workspace supports:

- Categorised notes
- Pinned notes
- Source labels and URLs
- Catalysts with date, impact and probability
- Risks with severity, probability and monitoring plan
- Quantitative or qualitative invalidation triggers
- Scenario-specific valuation assumptions

### Research completeness

The server calculates a 0–100 completeness score from the actual saved record. The score covers:

- Company profile
- Core thesis
- Bull/base/bear cases
- Decision framing
- Valuation framework
- Key assumptions
- Risks
- Catalysts
- Invalidation triggers
- Research evidence

Completeness is a documentation-quality indicator, not an investment recommendation.

### Portfolio integration

- Portfolio holdings link directly to `/research?ticker=...`.
- The legacy holdings API now reads conviction, thesis status and target price from the Research Engine instead of always returning placeholders.

## API surface

- `GET /api/research/companies`
- `POST /api/research/companies`
- `GET /api/research/companies/:ticker`
- `PATCH /api/research/companies/:ticker`
- `PUT /api/research/companies/:ticker/thesis`
- `POST /api/research/companies/:ticker/notes`
- `PATCH|DELETE /api/research/notes/:id`
- `POST /api/research/companies/:ticker/catalysts`
- `PATCH|DELETE /api/research/catalysts/:id`
- `POST /api/research/companies/:ticker/risks`
- `PATCH|DELETE /api/research/risks/:id`
- `POST /api/research/companies/:ticker/invalidation-triggers`
- `PATCH|DELETE /api/research/invalidation-triggers/:id`
- `POST /api/research/companies/:ticker/valuation-assumptions`
- `PATCH|DELETE /api/research/valuation-assumptions/:id`

The existing decision-journal endpoints are retained until the dedicated Journal phase.

## Data migration

The schema update creates new tables and PostgreSQL enums. It should not delete Portfolio Engine data. Still review every Drizzle prompt before confirming a destructive operation.

## Validation performed

- Every added or modified TypeScript/TSX file was parsed successfully with esbuild.
- Portfolio calculation tests passed.
- CSV import tests passed.
- Research completeness tests passed.
- Total automated tests passed: 10.

A complete monorepo typecheck and production build must still be run after applying the release to the actual repository, because the isolated build environment does not contain the repository's installed workspace dependencies or database.
