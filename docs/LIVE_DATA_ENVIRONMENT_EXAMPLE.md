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

## Safety

- Store secrets in Replit Secrets, GitHub Codespaces secrets or the deployment platform's encrypted environment configuration.
- Never put an API key in a browser-side `VITE_` variable.
- Never commit `.env` files containing real values.
