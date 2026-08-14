# Phase 7 environment example

Choose one or both provider paths.

## Alpha Vantage

```bash
ALPHA_VANTAGE_API_KEY=replace_with_secret
ALPHA_VANTAGE_DEFAULT_SUFFIX=BSE
ALPHA_VANTAGE_TIMEOUT_MS=20000
```

`ALPHA_VANTAGE_DEFAULT_SUFFIX` is optional. Explicit symbol mappings in `/live-data` take priority.

## AlphaDesk normalized HTTP provider

```bash
MARKET_INTELLIGENCE_URL=https://provider.example/alphadesk/snapshot
MARKET_INTELLIGENCE_API_KEY=replace_with_secret
MARKET_INTELLIGENCE_TIMEOUT_MS=20000
```

The endpoint should return the normalized-v1 payload described in `MARKET_INTELLIGENCE_IMPORT_EXAMPLE.json`.

## AlphaDesk automated research

```bash
OPENAI_API_KEY=replace_with_secret
RESEARCH_MODEL=gpt-5-mini
RESEARCH_DISCOVERY_TIMEOUT_MS=45000
RESEARCH_GENERATION_TIMEOUT_MS=45000
RESEARCH_MAX_EVIDENCE_COUNT=20
RESEARCH_MAX_CONTEXT_CHARACTERS=40000
RESEARCH_MAX_OUTPUT_TOKENS=4000
```

`OPENAI_API_KEY` is required for automated research. `RESEARCH_MODEL` is optional; it falls back to `OPENAI_MODEL`, then `gpt-5-mini`. The remaining values are optional server-side limits for each evidence search or snapshot generation request. The provider caps timeouts at 120 seconds, evidence at 50 sources, prompt context at 100,000 characters, and output at 10,000 tokens even when higher values are configured.

Keep every research setting on the API server. In particular, never expose `OPENAI_API_KEY` through a browser-side variable or response.

## Safety

- Store secrets in Replit Secrets, GitHub Codespaces secrets or the deployment platform's encrypted environment configuration.
- Never put an API key in a browser-side `VITE_` variable.
- Never commit `.env` files containing real values.
