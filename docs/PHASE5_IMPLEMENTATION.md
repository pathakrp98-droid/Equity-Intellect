# Phase 5 — Guardian Mode

Phase 5 replaces the earlier demo-oriented guardrail screen and rule calculations with a user-specific decision-control layer grounded in the cumulative Portfolio, Research and Market Intelligence engines.

## What is included

### 1. Pre-trade decision packets

A proposed action creates a time-limited, immutable decision packet containing:

- the exact user input;
- a point-in-time portfolio snapshot;
- the matching holding and research record;
- available Market Intelligence context;
- projected cash, stock weight, sector weight and quantity;
- policy findings, evidence gaps, bias flags and stress scenarios;
- the resulting Guardian decision.

Decision packets expire after 30 minutes so stale prices or portfolio weights are not silently reused.

### 2. Portfolio policy checks

The engine calculates proposed exposure from the actual transaction amount and current portfolio state. It checks:

- available quantity on sells;
- available cash on buys;
- maximum stock concentration;
- maximum sector concentration;
- minimum cash buffer;
- maximum weekly new positions;
- portfolio drawdown lock;
- small-cap exposure;
- correlated sector clusters;
- broken and weakening thesis status.

Client-supplied allocation percentages are not trusted.

### 3. Required evidence

Buy and add decisions can require:

- a specific rationale;
- investment horizon;
- bear case;
- target price;
- thesis invalidation conditions;
- maximum acceptable loss;
- exit conditions;
- minimum Research Engine completeness;
- an existing Research Engine workspace.

Missing evidence results in `require_evidence`, not an approval.

### 4. Behavioural checks

The deterministic bias layer checks for:

- overconfidence language;
- FOMO and recent sharp price moves;
- panic-selling language;
- target-price anchoring;
- qualitative-only narrative bias;
- missing contrary evidence;
- averaging down without a recent thesis review;
- excessive weekly portfolio changes;
- high-impact news recency.

The checks are explainable heuristics. They do not diagnose the user or infer emotions beyond the submitted text and recorded actions.

### 5. Stress tests

Every buy or add packet can include:

- broad market correction;
- recession;
- RBI rate shock;
- crude-oil shock;
- INR depreciation;
- company-specific bear case.

The methodology is displayed beside every scenario. These are transparent sensitivity tests, not forecasts, VaR calculations or live derivative models.

### 6. Portfolio Health Score

The score is calculated from real stored data across:

- thesis integrity;
- stock and sector concentration;
- cash liquidity;
- research readiness;
- drawdown control;
- quote coverage and high-severity news.

Health snapshots are stored to support historical trend analysis in later releases.

### 7. Execution and overrides

Guardian does not connect to a broker and does not place orders. Confirming a packet only logs the user's decision.

- `approve` and `approve_with_warnings` can be confirmed and logged.
- `require_evidence` cannot be executed until the check is rerun with the missing evidence.
- `reject` can be overridden only when overrides are enabled and a rationale of at least 30 characters is provided.
- every override is retained in both the detailed packet and the existing audit table.

## Database additions

- `guardian_decision_packets`
- `guardian_health_snapshots`
- enum `guardian_packet_status`
- enum `guardian_health_band`

The existing `guardrail_settings` and `guardrail_audit` tables are reused for compatibility.

## API endpoints

- `GET /api/guardrails/settings`
- `PUT /api/guardrails/settings`
- `GET /api/guardrails/context?ticker=...`
- `POST /api/guardrails/check`
- `POST /api/guardrails/execute`
- `POST /api/guardrails/cancel`
- `GET /api/guardrails/decision-packets`
- `GET /api/guardrails/audit-trail`
- `GET /api/guardrails/portfolio-health`
- `GET /api/guardrails/health-history`

All Phase 5 endpoints require authentication and isolate records by user ID.

## Frontend

The `/guardrails` workspace now contains:

1. Health overview.
2. Pre-trade decision form and projected portfolio state.
3. Stored stress scenarios.
4. Decision-packet audit history.
5. Editable policy limits and evidence requirements.

## Installation

Apply the cumulative v0.5 package over the repository root, then run:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/db push
pnpm run typecheck
pnpm run build
```

Review any destructive Drizzle prompt before confirming. Phase 5 should add new Guardian tables and enums; it should not require deleting Portfolio, Research, Copilot or Market Intelligence data.

## Validation performed before packaging

- Guardian engine passed strict standalone TypeScript compilation.
- Six deterministic runtime tests passed: approval, concentration block, missing research, FOMO, overselling and health deterioration.
- All TypeScript and TSX files in the cumulative overlay passed syntax transpilation.
- JSON and shell installation assets were validated.

The full monorepo typecheck, database migration and production build remain installation-time checks because the repository itself has intentionally not been modified.
