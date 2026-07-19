# AlphaDesk v0.8 Security Review

## Implemented controls

### Authentication and isolation

All cumulative portfolio, research, Copilot, Guardian, journal, live-data, alert and integration routes use the existing authenticated user context. Phase 8's integration endpoint refuses unauthenticated access.

### Secret handling

Provider credentials are read from environment variables on the API server. The System Health response exposes configuration booleans and provider names only.

### Browser/API boundary

- credentialed CORS uses an explicit origin callback;
- production requests from unknown origins are rejected;
- `x-powered-by` is disabled;
- API responses include anti-sniffing, anti-framing, referrer and permissions headers;
- successful and error API responses are marked `no-store`;
- request IDs assist log correlation without revealing stack traces.

### AI boundary

The Phase 3 controls remain in force: grounded context, citation validation, context limits, `store: false`, prompt-injection treatment for retrieved research and deterministic fallback when the provider is unavailable.

### Execution boundary

Guardian confirmations create audit records. They do not transmit broker orders. Live data is read-only and portfolio synchronization updates prices, not transactions.

## Residual risks requiring deployment controls

- The host must use HTTPS in production.
- Session-cookie security is controlled by the repository's existing authentication layer and must be reviewed in the deployment environment.
- Database backups and least-privilege credentials remain an operational responsibility.
- Provider data can be delayed, incomplete or incorrect; freshness and source labels must remain visible.
- User-entered URLs should be treated as external links and opened with `noopener noreferrer`.
- Automated schedules require a trusted scheduler; first-access generation remains the fallback where no scheduler is configured.

## Recommended follow-up after deployment

- Run dependency audit tools in the actual monorepo.
- Enable repository secret scanning and branch protection.
- Add rate limiting at the reverse proxy or API gateway.
- Review authentication cookie flags in production.
- Add centralized error monitoring without sending portfolio content or provider secrets.
- Perform an authenticated multi-user isolation test with two test accounts.
