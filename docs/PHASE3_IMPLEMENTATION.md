# AlphaDesk Phase 3 — Grounded AI Copilot

Phase 3 adds a user-isolated investment Copilot on top of the Phase 1 Portfolio Engine and Phase 2 Research Engine. It is designed as a decision-support layer, not as a source of invented live market facts.

## What is included

### Conversation workspace

- Persistent conversations owned by the signed-in user.
- Modes for general analysis, portfolio review, performance explanation, company analysis, thesis challenge, company comparison and research-gap review.
- Optional ticker targeting for up to six holdings or covered companies.
- Conversation archive/delete support.
- Stored provider, model, token and latency metadata for assistant messages.

### Grounded context builder

Every answer receives a bounded context assembled from:

- The latest calculated portfolio snapshot.
- Current derived holdings, allocation and concentration.
- Portfolio performance and risk outputs, including explicit data-quality flags.
- Selected Research Engine workspaces.
- Approved durable investment memories.

Each context item receives a stable source ID. The answer and its structured citation list are validated against those IDs before being saved.

### Copilot answer format

Responses contain:

- Main answer.
- Summary.
- Key points.
- Risks.
- Unknowns and missing data.
- Suggested follow-up questions.
- Grounded citations.
- Optional durable-memory candidates.

### Provider and fallback

- Uses the OpenAI Responses API when `OPENAI_API_KEY` is configured.
- Requests strict JSON-schema output.
- Sends `store: false`.
- Uses native Node.js `fetch`; no new npm dependency is required.
- Falls back to a deterministic AlphaDesk analysis engine when the provider is unavailable or not configured.
- The fallback can review portfolio metrics, explain recorded P&L, compare saved research, challenge a thesis and identify research gaps.

### Hallucination controls

- Current prices, news, estimates, filings and macro facts may only be used when present in supplied AlphaDesk context.
- The model is explicitly instructed to treat source payloads as untrusted data and ignore embedded instructions.
- Unknown source markers and citations are removed during validation.
- Context size is capped globally and per source.
- Live data, price history and benchmark availability are labelled in every context snapshot.
- The interface clearly states that live market data is not yet connected.

### Investment memory

- Memories are user-owned and editable.
- Categories include preferences, instructions, portfolio facts, thesis statements, risks, research and decisions.
- Automatic memory saving is opt-in per message.
- Only explicit durable information from the latest user message may become a candidate.
- Low-confidence candidates are discarded.
- Duplicate subject/category memories are updated rather than inserted repeatedly.
- Memories can be pinned or deleted from the Copilot interface.

## New database tables

- `copilot_conversations`
- `copilot_messages`
- `copilot_memories`

The older `copilot_history` table is left untouched for migration safety, but the Phase 3 interface uses the new tables.

## New and replaced backend paths

- `lib/db/src/schema/copilot.ts`
- `artifacts/api-server/src/services/copilot/grounding.ts`
- `artifacts/api-server/src/services/copilot/openaiProvider.ts`
- `artifacts/api-server/src/services/copilot/copilotService.ts`
- `artifacts/api-server/src/routes/copilot.ts`
- `artifacts/api-server/src/routes/index.ts`

## Copilot endpoints

- `GET /api/copilot/conversations`
- `POST /api/copilot/conversations`
- `GET /api/copilot/conversations/:id`
- `PATCH /api/copilot/conversations/:id`
- `DELETE /api/copilot/conversations/:id`
- `POST /api/copilot/ask`
- `POST /api/copilot/conversations/:id/messages`
- `POST /api/copilot/context-preview`
- `GET /api/copilot/memories`
- `POST /api/copilot/memories`
- `PATCH /api/copilot/memories/:id`
- `DELETE /api/copilot/memories/:id`

All endpoints require authentication and enforce ownership through the authenticated user ID.

## Frontend

The Copilot page now includes:

- Conversation history.
- Analysis-mode selection.
- Optional ticker targeting.
- Structured answers with citations, risks and unknowns.
- Provider/fallback labels.
- Source and freshness panel.
- Memory review, pinning and deletion.
- Suggested workflows for portfolio review, performance explanation, thesis challenge and research-gap analysis.

## Environment variables

Required for live AI generation:

```text
OPENAI_API_KEY=<server-side secret>
```

Optional:

```text
OPENAI_MODEL=gpt-5-mini
COPILOT_TIMEOUT_MS=45000
COPILOT_MAX_OUTPUT_TOKENS=1800
COPILOT_MAX_CONTEXT_CHARACTERS=80000
COPILOT_MAX_SOURCE_CHARACTERS=12000
```

Never expose `OPENAI_API_KEY` to the browser or commit it to the repository.

## Validation completed before packaging

- Portfolio calculation tests.
- CSV-import tests.
- Research-completeness tests.
- Copilot grounding, inference, citation and memory-validation tests.
- Mocked Responses API request test confirming strict JSON-schema output and `store: false`.
- TypeScript/TSX syntax parsing for all files in the cumulative package.

A full monorepo typecheck and production build must still be run after applying the package to the actual repository because this package does not contain the repository's installed dependencies or every unchanged source file.

## Known limitations deferred to later phases

- No live market-price, news, earnings, filing or consensus provider.
- No streaming response UI.
- No semantic/vector memory retrieval; Phase 3 uses pinned/recent approved memories.
- No document ingestion or file-search pipeline.
- The generated OpenAPI client remains on the older Copilot contract; Phase 3 uses a dedicated typed frontend API module. Contract consolidation is planned for the integration phase.
