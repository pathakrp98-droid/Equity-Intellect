# AlphaDesk v0.6 — Decision Journal and Review System

Phase 6 turns investment decisions into a structured, reviewable dataset. It is designed to preserve what was known, expected and felt **before** the outcome became visible, then compare that record with subsequent evidence and results.

This package is cumulative and includes Phases 1–6.

## What Phase 6 adds

### 1. Persistent decision records

Each journal entry can store:

- Ticker, action and decision date
- Planned or executed status
- Execution price and quantity
- Original thesis summary and full rationale
- Expected return and expected downside
- Target and bear prices
- Investment horizon
- Emotional state and confidence score
- Evidence-quality rating
- Supporting factors and contrary evidence
- Source references
- Next scheduled review date
- Outcome, actual return and lessons learned

Records are isolated by authenticated user.

### 2. Links to the rest of AlphaDesk

A decision can be linked to:

- A portfolio
- A portfolio transaction
- A Research Engine company workspace
- A Guardian decision packet

The `POST /api/journal/entries/from-guardian` endpoint converts an existing Guardian packet into a pre-filled journal entry. Repeating the same import returns the existing entry instead of creating a duplicate.

### 3. Scheduled reviews

Reviews support:

- Scheduled reviews
- Earnings reviews
- Event-driven reviews
- Thesis-break reviews
- Manual reviews

A completed review records what changed, evidence for and against the thesis, updated conviction, updated thesis status, current price, return since the original decision and the action selected after review.

A completed review may create the next scheduled review automatically. Selecting `exit` closes the original journal entry.

### 4. Decision-quality scoring

Each decision receives a deterministic process score based on:

- Documentation quality: 20 points
- Quantified expectations: 20 points
- Evidence balance: 20 points
- Review plan: 15 points
- Guardian/Research process links: 15 points
- Outcome learning: 10 points

Quality bands:

- 85–100: Excellent
- 70–84: Disciplined
- 50–69: Developing
- Below 50: Weak

The score evaluates the decision process, not whether the trade later made money.

### 5. Process analytics

The analytics workspace calculates:

- Overall decision-process score
- Average decision quality
- Review-completion rate
- Overdue review count
- Win rate for completed outcomes
- Average realised outcome return
- Lessons-captured rate
- Quality-band distribution
- Recurring process gaps
- Results grouped by emotional state

Analytics snapshots can be persisted for trend analysis.

## New database objects

The package adds:

- `decision_journal_entries`
- `decision_journal_reviews`
- `decision_quality_snapshots`

It also adds the required PostgreSQL enums for decision type, decision status, emotional state, outcome, review type, review status and review action.

## New API routes

Base path: `/api/journal`

- `GET /entries`
- `GET /entries/:id`
- `POST /entries`
- `POST /entries/from-guardian`
- `PATCH /entries/:id`
- `POST /entries/:id/archive`
- `POST /entries/:id/reviews`
- `GET /reviews`
- `POST /reviews/:id/complete`
- `POST /reviews/:id/skip`
- `GET /analytics`
- `GET /analytics/history`

All routes require authentication.

## New interface

The `/journal` page includes:

- Decision-history list and filters
- Full decision detail and quality breakdown
- New-decision form
- Guardian packet import
- Outcome and lessons editor
- Review scheduling
- Review queue
- Review-completion workspace
- Process analytics dashboard

## Installation

Apply **v0.6 alone**. Do not apply older cumulative ZIPs first.

From the extracted package directory:

```bash
bash apply-v0.6.sh /path/to/Equity-Intellect
```

Then, from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/db push
pnpm run typecheck
pnpm run build
```

The helper backs up every replaced file under `.alphadesk-backups/` and does not run the migration itself.

## Migration safety

The schema update should create new journal tables and enums. Stop before confirming if the database tool proposes deleting an existing table, dropping a column or truncating data.

## Validation performed in the build workspace

- Decision-quality engine deterministic tests
- Review-quality tests
- Analytics aggregation tests
- Strict TypeScript check for the pure scoring engine
- TypeScript/TSX syntax parsing across the cumulative overlay
- Prettier formatting
- Shell-script syntax check
- JSON sample validation
- ZIP integrity check

A complete monorepo typecheck and production build still need to run after the overlay is applied to the actual repository, because the ZIP is an overlay and does not include the repository's dependency installation.

## Behavioural note

A profitable trade can have a weak process score, and a losing trade can have an excellent process score. The Journal intentionally keeps outcome quality separate from decision quality so that luck is not mistaken for skill.
