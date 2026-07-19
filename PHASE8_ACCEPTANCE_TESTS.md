# AlphaDesk v0.8 Acceptance Tests

1. **Fresh account** — System Health reports portfolio setup as blocked and does not show another user's records.
2. **Portfolio setup** — Deposit and buy transactions create the correct cash balance, holding quantity and cost basis.
3. **Price freshness** — Missing or stale prices lower readiness and produce explicit recommendations.
4. **Research coverage** — Adding a research workspace and thesis increases the Research module score.
5. **Morning Brief** — Generating a brief creates a grounded summary with source/freshness labels.
6. **Copilot fallback** — Without an OpenAI key, the Copilot returns deterministic grounded output and System Health labels live AI as optional.
7. **Guardian boundary** — Confirming a decision records an audit event but does not place an order.
8. **Journal linkage** — A Guardian decision can create a journal record without duplicating an existing import.
9. **Alerts** — Evaluating rules creates deduplicated alerts; acknowledge, dismiss, resolve and reopen work.
10. **Provider failure** — A failed provider refresh uses eligible stale cache and records an explicit error state.
11. **Legacy routes** — `/api/dashboard/summary` and `/api/market/scanner` return 404.
12. **Authentication** — `/api/integration/health` returns 401 signed out.
13. **Responsive shell** — The mobile drawer opens, closes on navigation and does not leave a desktop margin.
14. **Error recovery** — A rendering error shows the global recovery screen rather than a blank page.
15. **CORS** — An unknown production origin is rejected while the configured HTTPS origin succeeds.
