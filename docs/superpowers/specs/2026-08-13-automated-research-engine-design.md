# AlphaDesk Automated Research Engine Design

**Date:** 2026-08-13

**Status:** Approved product design

**Audience:** AlphaDesk product and engineering

## 1. Purpose

AlphaDesk must automatically create coverage for every security held in a user's portfolio and maintain evidence-backed research wherever reliable evidence is available. A layperson should only need to add or import holdings. The app must identify each security, gather reliable evidence, generate plain-language research, and keep that research current without an approval queue.

AI-generated interpretations must be clearly labelled as **AI judgement**. Material factual claims must be traceable to evidence. If sufficient evidence cannot be found, AlphaDesk must say so rather than filling gaps with unsupported claims.

## 2. Current State

The existing product already provides:

- holdings-first portfolios with CSV import and manual holding management;
- research companies linked to holdings by normalized ticker;
- structured thesis, notes, catalysts, risks, invalidation triggers, and valuation assumptions;
- an OpenAI Responses integration for grounded Copilot output;
- Guardian, Morning Brief, alerts, authentication, and PostgreSQL persistence;
- daily-on-use live quote refresh and manual price support.

Research coverage and research content are still principally created manually. The current completeness score rewards field and item counts but does not measure source quality, evidence coverage, security-type appropriateness, or freshness. The present research tables also do not provide an append-only automated research history or automation-run diagnostics.

## 3. Product Promise

For every active holding, AlphaDesk will answer in plain language:

1. What is this investment?
2. What evidence supports the investment case?
3. What could go wrong?
4. What changed recently?
5. How should valuation be assessed for this type of security?
6. What should the investor watch next?
7. How current and reliable is the research?

The system provides decision support, not personalized financial advice and not guaranteed buy, sell, or return predictions.

## 4. Goals

- Start research coverage automatically for existing and newly added holdings.
- Support listed equities, ETFs, mutual funds, and unlisted or otherwise thinly covered holdings.
- Use evidence appropriate to each security type.
- Distinguish verified facts, calculations, and AI judgement.
- Attach source references and as-of dates to material claims.
- Keep an append-only version history and explain what changed between versions.
- Refresh research after material events and when evidence becomes stale.
- Preserve all user-authored research and notes.
- Expose queued, running, current, limited, stale, and failed states clearly.
- Feed current research changes into Morning Brief, Guardian, and Alerts.
- Run reliably on Replit without relying on an in-process timer.
- Preserve existing CSV import, holdings flows, quotes, manual ETF prices, auth, and production database behaviour.

## 5. Non-goals

- A mandatory user approval workflow.
- Cash-balance features or a requirement to provide transaction history.
- Automatic trade execution or portfolio rebalancing.
- Guaranteed exhaustive coverage of obscure or unlisted securities.
- Scraping sites that prohibit automated access.
- Storing full copyrighted source documents when a citation, metadata, and short normalized evidence summary are sufficient.
- Replacing user-authored notes with AI-generated text.
- Forcing equity-style targets onto ETFs, liquid funds, or unlisted holdings without suitable evidence.

## 6. Chosen Approach

Build a **versioned evidence engine layered onto the existing research module**.

This approach preserves the current research workspace and its production data while adding separate automated evidence, run, and snapshot records. Existing manually created research remains readable and editable. The latest automated snapshot becomes the canonical system-generated research used by Research, Morning Brief, Guardian, and Alerts.

Rejected approaches:

- **Write directly into the existing manual fields:** faster initially, but it would obscure provenance, overwrite user work, and make changes difficult to audit.
- **Create a separate autonomous research application:** more operational complexity, duplicated portfolio identity, and unnecessary infrastructure at the current scale.

## 7. Core Architecture

### 7.1 Portfolio Research Reconciler

The reconciler compares active holdings with research coverage.

- A holding import or addition enqueues baseline research.
- A material identifier change enqueues identity resolution before research.
- Existing uncovered holdings are discovered by a reconciliation pass.
- A holding removed from all of a user's portfolios archives automated coverage but retains history.
- Re-adding an archived holding restores it and enqueues a freshness check.
- Multiple portfolios containing the same security share one user-scoped research record.
- User/portfolio/security coverage memberships are stored separately, so removing a holding from one portfolio does not archive research while it remains active in another.

The reconciliation operation must be idempotent and safe to run repeatedly.

Portfolio recalculation writes a small holding-reconciliation event into the same database transaction that updates calculated holdings. The event fingerprint contains identity fields but excludes prices, P&L, allocation, and quantity, preventing quote refreshes from flooding the research queue. Material market-intelligence imports use the same transactional-outbox pattern for high-relevance company events.

### 7.2 Security Identity and Classification

Coverage is keyed by a normalized security identity rather than ticker text alone. The resolver records, when available:

- ticker or symbol;
- exchange;
- ISIN;
- issuer or fund name;
- security type: `equity`, `etf`, `mutual_fund`, `unlisted`, or `unknown`;
- currency and country;
- identity confidence and resolution status.

Ticker and exchange remain supported for backward compatibility. ISIN is the preferred stable identifier when supplied by a broker import.

If identity cannot be resolved confidently, the holding remains visible with a **Needs identity** research state. AlphaDesk must not research a similarly named security as a substitute.

### 7.3 Evidence Acquisition

A `ResearchEvidenceProvider` interface isolates source retrieval from analysis. The first implementation will extend the existing OpenAI Responses integration with built-in web search and structured output. This is supported by the official [OpenAI Responses API tooling documentation](https://platform.openai.com/docs/quickstart).

The provider must return normalized evidence records, not unstructured prose alone. Each record includes:

- title and publisher;
- canonical URL;
- publication and retrieval timestamps;
- source class and reliability tier;
- security identifier;
- short evidence summary;
- content fingerprint for deduplication;
- provider metadata and retrieval status.

Source priority:

1. **Primary:** stock-exchange announcements, regulator filings, issuer investor-relations material, audited reports, official earnings releases, official fund/AMC factsheets, scheme documents, and index-provider documents.
2. **High-quality secondary:** established market-data providers and reputable financial news used for market context or events not yet reflected in primary material.
3. **Excluded by default:** anonymous posts, promotional blogs, unsourced social media, copied aggregator text, and search snippets treated as standalone evidence.

Primary sources carry the greatest evidence weight. Secondary sources can corroborate or provide context but cannot silently replace a missing primary source for material financial claims.

### 7.4 AI Research Generator

The generator receives only normalized portfolio context, security identity, current price context, prior research, and retrieved evidence. It returns strict schema-validated output.

Each output statement is classified as one of:

- **Fact:** directly supported by cited evidence.
- **Calculation:** derived deterministically from identified inputs.
- **AI judgement:** interpretation, thesis, risk assessment, scenario, valuation conclusion, or confidence judgement.

Every material fact must reference one or more evidence IDs. AI judgements must identify supporting evidence IDs, state confidence, and disclose important unknowns. The server rejects a generated snapshot if it contains uncited material facts, invalid evidence references, or an unsupported numeric target.

The generator must treat retrieved documents as untrusted data and ignore instructions embedded in source content.

### 7.5 Versioned Snapshot Store

Automated research is append-only. A successful run writes a new immutable snapshot containing:

- security profile;
- layman summary;
- thesis and counter-thesis;
- bull, base, and bear scenarios where appropriate;
- material risks and catalysts;
- invalidation conditions;
- valuation or security-appropriate assessment framework;
- recent changes;
- next proof points and expected events;
- evidence strength, confidence, and freshness;
- claim-level classifications and evidence references;
- comparison with the previous snapshot.

The newest successfully published snapshot is current for a company. Publishing a new snapshot does not delete or modify older snapshots.

Existing manual thesis fields, notes, risks, and catalysts remain user-owned. They are displayed separately as **Your research** and may be included as context for later automated runs, but automation never edits or deletes them.

### 7.6 Research Job Orchestrator

Database-backed jobs provide reliable execution on Replit.

Job triggers:

- `holding_added`
- `holding_changed`
- `portfolio_reconciled`
- `scheduled_refresh`
- `material_event`
- `manual_refresh`

Job states:

- `queued`
- `running`
- `succeeded`
- `partial`
- `failed`
- `skipped`

Requirements:

- deterministic idempotency keys prevent duplicate work;
- a database lease prevents concurrent execution for the same user and security;
- abandoned running jobs can be recovered after lease expiry;
- failures retry with bounded exponential backoff;
- partial evidence does not become a hidden success;
- concurrency and total run deadlines are bounded;
- error metadata is safe for display and does not expose secrets;
- a failed refresh leaves the last successful snapshot available and visibly stale.
- holding and material-event triggers are recorded transactionally before the scheduled worker consumes them;
- material-event bursts are coalesced and minimum refresh intervals are enforced.

### 7.7 Scheduling

An in-process timer is not sufficient because a Replit autoscale deployment can sleep. AlphaDesk will provide a one-shot research worker command that:

1. acquires a global scheduler lease;
2. finds due holdings across users;
3. enqueues idempotent research jobs;
4. processes a bounded batch of queued jobs synchronously; and
5. exits after recording the batch result.

A Replit Scheduled Deployment will run this command every 15 minutes in a separate scheduled environment, which continues to work while the autoscale web deployment sleeps. Replit documents Scheduled Deployments as command-line jobs intended for periodic background processing. Each tick consumes holding/material events and due jobs, while per-user preferences ensure a full no-event refresh is enqueued no more than once per configured daily cadence. The run command and required deployment-scoped secrets will be documented in the deployment checklist. Portfolio and Research page requests may read job state, but page loads must not block on evidence retrieval or AI generation.

Refresh policy:

- identity/profile check after holding changes and periodically;
- event and filing discovery daily;
- full research rebuild after a material filing, earnings release, fund factsheet change, or other relevant event;
- periodic full refresh when no event occurs;
- manual refresh available with rate limiting.

Refresh policy is security-type aware and configurable. The implementation must not promise real-time research.

## 8. Security-type Research Templates

### 8.1 Listed Equity

- business and segment overview;
- financial and operating evidence;
- management and governance evidence;
- thesis, counter-thesis, risks, catalysts, and falsifiers;
- valuation method and scenario framework only when inputs support it;
- earnings and corporate-event monitoring.

### 8.2 ETF

- investment objective and underlying exposure;
- index, commodity, or asset-class methodology;
- NAV/iNAV context, tracking difference, expense ratio, liquidity, and concentration;
- issuer and structure risks;
- no company-style earnings thesis or unsupported target price.

### 8.3 Mutual Fund or Liquid Fund

- scheme objective, category, benchmark, portfolio characteristics, costs, liquidity, and material risk;
- factsheet and scheme-document evidence;
- no stock-style target price.

### 8.4 Unlisted Holding

- issuer identity, business description, latest available filings or reliable disclosures;
- valuation evidence, transferability, liquidity, and exit-route limitations;
- a prominent **Limited public evidence** label where appropriate;
- no fabricated live price, target, or market comparables.

### 8.5 Unknown

The system stores no generated thesis until identity is sufficiently resolved. It displays the evidence gap and lets the user correct identifiers.

## 9. Data Model Changes

The precise names may follow repository conventions, but the implementation must provide these concepts.

### 9.1 Research Company Identity Extensions

Extend `research_companies` with:

- security type;
- ISIN and normalized identity key;
- identity status and confidence;
- automated coverage state;
- last successful research timestamp;
- next refresh timestamp.

The existing user-and-ticker uniqueness rule must be migrated carefully. Current production data must remain valid, and ticker-based lookup must continue to work.

### 9.2 Research Evidence

Add snapshot-linked automated research sources for normalized, deduplicated source metadata and short evidence summaries. Uniqueness uses snapshot, citation key, canonical URL, and content fingerprint as appropriate; full source pages are not stored.

### 9.3 Coverage Targets, Preferences, and Trigger Events

Add user preferences for automation cadence and cost caps, user-portfolio-security coverage targets, and a transactional trigger-event outbox. These records make portfolio membership, due scheduling, and event consumption durable without depending on unstable calculated holding row IDs.

### 9.4 Research Automation Runs

Add `research_automation_runs` for trigger, status, idempotency key, lease, timing, model/provider metadata, item counts, and sanitized errors.

### 9.5 Research Snapshots

Add `research_snapshots` for immutable versioned structured payloads, change summary, evidence-quality result, freshness, and model/provider metadata. The newest successful snapshot is selected as current rather than updating older snapshot rows.

Snapshot payloads must be validated by a shared strict schema on write and read. Claim objects carry classification, confidence, and evidence IDs.

### 9.6 Migration Safety

- Additive schema changes precede read-path changes.
- Existing records are backfilled without deleting or rewriting research text.
- The application remains able to read legacy data throughout deployment.
- Production migration must be reviewed and executed with a managed database snapshot or point-in-time recovery available.
- Automatic unreviewed schema push is not sufficient for this migration.

## 10. Evidence Quality and Completeness

Replace count-only automated completeness with a security-type-aware assessment containing:

- identity confidence;
- required section coverage;
- proportion of material claims with citations;
- primary-source coverage;
- evidence recency;
- agreement or conflict between sources;
- unresolved unknowns;
- successful generation and validation status.

User-facing evidence strength:

- **Strong:** current primary evidence covers the material sections and claims.
- **Moderate:** research is useful but relies partly on secondary, aging, or incomplete evidence.
- **Limited:** identity, primary documents, valuation inputs, or other material evidence is missing.

The UI must explain the reason for the label. A high item count alone cannot produce a Strong rating.

## 11. User Experience

### 11.1 Research Overview

Every active holding appears automatically with one status:

- Preparing research
- Current
- Update available/running
- Limited evidence
- Stale
- Failed
- Needs identity

The overview prioritizes portfolio weight, stale or failed coverage, material changes, and evidence weakness. It does not ask the user to start coverage manually for active holdings.

### 11.2 Holding Research Page

The first screen uses plain-language sections:

- What you own
- Investment case
- What changed
- Key risks
- Upcoming catalysts
- Valuation or fund assessment
- What to watch next
- Evidence and sources

AI-generated sections show a persistent **AI judgement** badge. Facts and calculations have distinct labels. Evidence links include publisher and date. Confidence and evidence strength use explanatory text, not unexplained numeric scores.

### 11.3 History and Manual Research

- A simple history view shows snapshot date, trigger, and change summary.
- User-authored material appears in a separate **Your research** area.
- The current automated view and older versions are read-only.
- A manual refresh control is available but cannot create duplicate concurrent jobs.

## 12. Downstream Integration

### 12.1 Morning Brief

Morning Brief receives only material changes since the previous successful snapshot, including:

- newly discovered evidence;
- changed AI judgement with explanation;
- new or elevated risks;
- upcoming catalysts;
- stale or failed research requiring attention.

### 12.2 Guardian

Guardian uses the latest successful automated snapshot when present and legacy research as a fallback. It considers evidence strength and freshness, not merely coverage existence. Limited evidence is not treated as missing research, but it reduces research readiness.

### 12.3 Alerts

Alerts may be generated for:

- thesis status deterioration;
- an invalidation condition becoming relevant;
- a material filing or event;
- a due or stale research refresh;
- provider or generation failure.

AI-derived alerts must be labelled accordingly and link to supporting evidence.

## 13. API Surface

Add authenticated endpoints for:

- listing automated coverage and status;
- reading the current snapshot;
- reading snapshot history;
- requesting a manual refresh;
- reading job status and sanitized errors;
- correcting an unresolved security identity.

Add a one-shot scheduled-worker command. It runs as a separate Replit Scheduled Deployment and does not expose an internet-facing scheduler endpoint.

Existing research endpoints remain compatible.

## 14. Error and Degraded-mode Behaviour

- Missing OpenAI configuration: show **Automated research unavailable** and preserve manual research.
- Search/provider failure: retry; keep the prior snapshot; show stale/error status.
- Partial evidence: generate only if validation can produce an honest Limited result; otherwise fail safely.
- Ambiguous identity: stop before evidence gathering and request identifier correction.
- Invalid AI output: reject, record diagnostics, and retry within limits.
- Unsupported valuation: omit numeric targets and explain the appropriate framework.
- Rate limit or budget limit: queue for later and show delayed status.
- One holding failure does not block other holdings or the portfolio page.

## 15. Security and Privacy

- All research records and jobs are scoped by authenticated user ID.
- Scheduler authentication uses a dedicated secret and constant-time verification.
- URLs and source metadata are treated as untrusted input.
- Source content cannot supply instructions to the model or application.
- Generated output is schema validated and rendered as text, not executable HTML.
- Logs and error responses must not contain API keys, cookies, tokens, or full sensitive source payloads.
- OpenAI requests continue to use `store: false`.
- Cost and usage metadata are recorded per run without exposing it to other users.

## 16. Observability and Cost Controls

Record structured metrics for:

- queued, successful, partial, failed, and retried runs;
- end-to-end duration;
- evidence count by source tier;
- generated input/output token usage;
- per-user and per-security refresh frequency;
- deduplication and skipped-run counts;
- stale coverage and provider health.

Set configurable limits for concurrency, daily jobs, evidence volume, context size, output size, manual refresh cooldown, and total run deadline. Scheduled work prioritizes active holdings by portfolio weight and staleness while ensuring smaller holdings are not starved indefinitely.

## 17. Delivery Decomposition

The complete product is delivered through three dependent milestones. Each milestone leaves the application deployable.

### Milestone 1: Evidence and Snapshot Foundation

- additive schema and migration;
- security classification;
- evidence provider;
- strict generated-research schema;
- versioned snapshots and validation;
- focused service tests.

### Milestone 2: Automatic Lifecycle and Reliability

- holding reconciliation triggers;
- job queue, leases, retries, idempotency, and recovery;
- scheduled worker and Replit Scheduled Deployment documentation/configuration;
- refresh policy and job-status APIs;
- reliability and concurrency tests.

### Milestone 3: Layman UX and Product Integration

- automatic Research overview and holding page;
- AI/fact/calculation labels and evidence-strength explanations;
- history and manual-research separation;
- Morning Brief, Guardian, Alert, and System Health integration;
- end-to-end and mobile smoke tests.

## 18. Acceptance Criteria

1. Every existing active holding is reconciled automatically without clicking Start Coverage.
2. Importing or adding a supported holding creates a queued coverage job automatically.
3. The portfolio request returns without waiting for research generation.
4. Every material factual claim in a published snapshot references valid stored evidence.
5. Every analytical conclusion is visibly labelled **AI judgement**.
6. Unsupported or weak evidence produces Limited/Needs identity status, not invented research.
7. Stocks, ETFs, funds, and unlisted holdings use different appropriate templates.
8. Older snapshots and all user-authored research remain unchanged.
9. Concurrent triggers create no more than one active job for the same user, security, and refresh reason.
10. A failed refresh preserves the prior snapshot and shows a visible stale/error state.
11. A 15-minute Replit Scheduled Deployment worker consumes durable events/jobs while daily cadence rules prevent unnecessary full refreshes, even when the autoscale web app sleeps.
12. Morning Brief, Guardian, and Alerts consume the latest successful snapshot and surface important changes.
13. Existing holdings CSV import, manual holdings, quotes, manual market prices, auth, and production persistence continue to work.
14. Build, typecheck, focused tests, migration validation, and smoke tests pass before deployment.

## 19. Test Strategy

### Unit tests

- identity normalization and security classification;
- source-tier scoring and evidence deduplication;
- strict generation schema and claim/evidence validation;
- security-specific template requirements;
- completeness and evidence-strength calculation;
- snapshot diff and materiality rules;
- idempotency keys, retry scheduling, and lease expiry.

### Service tests

- reconcile existing, new, removed, and re-added holdings;
- provider success, partial result, timeout, rate limit, and invalid output;
- append-only snapshot publishing;
- preservation of manual research;
- user ownership and cross-user isolation;
- scheduler authentication and due-job selection.

### Integration and smoke tests

- CSV import to queued research to current snapshot;
- manual holding addition to automated coverage;
- ETF and unlisted limited-evidence flows;
- Morning Brief, Guardian, and Alert propagation;
- stale fallback after failed refresh;
- desktop and mobile Research pages;
- existing portfolio, quote, auth, and production-database behaviour.

## 20. Deployment and Rollout

1. Back up or confirm point-in-time recovery for the production database.
2. Deploy additive schema changes while legacy read paths remain active.
3. Deploy the engine behind a feature flag with scheduled generation disabled.
4. Run a production identity/evidence dry run that writes runs but not current snapshots.
5. Enable automatic snapshots for a small bounded set of holdings and verify cost, evidence quality, and UI.
6. Reconcile existing holdings progressively with bounded concurrency.
7. Enable the daily scheduler.
8. Monitor failures, evidence strength, latency, and cost before removing the feature flag.

Rollback disables new job creation and automated snapshot reads while retaining all additive records. Existing manual research continues to operate.
