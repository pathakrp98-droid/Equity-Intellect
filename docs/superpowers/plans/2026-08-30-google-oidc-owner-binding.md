# Google OIDC Owner Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan inline, task by task.
> Steps use checkbox (`- [ ]`) syntax for tracking. Do not dispatch subagents
> for this migration.

**Goal:** Add Google browser sign-in without changing any existing internal
user ID, portfolio ID, or tenant-owned row, using an explicit operator binding
between a verified Google issuer/subject and the existing owner.

**Architecture:** Authentication configuration becomes an explicit Replit or
Google union. Google callbacks resolve only through a new additive external
identity table; an unknown Google identity gets a short-lived, unauthenticated
setup record and never a portfolio session. A database-backed operator command
performs the binding transaction, while discriminated session records prevent
Google sessions from entering the legacy token-refresh path.

**Tech Stack:** TypeScript, Express 5, `openid-client` 6.8.4, Drizzle ORM,
PostgreSQL, Node test runner, Zod-generated API contracts, React/Vite.

**Spec:**
`docs/superpowers/specs/2026-08-28-free-hosting-migration-design.md`

## Global Constraints

- No payment, subscription, billable trial, Replit Agent, or paid AI request.
- Do not create Google credentials, upload data, create accounts, deploy, or
  push during this implementation plan.
- Preserve holdings CSV import, manual holding/edit flows, manual ETF prices,
  quote diagnostics, Guardian, Morning Brief, saved research, and responsive
  layouts.
- Do not add cash features or require transaction history.
- Preserve all existing `users.id`, portfolio IDs, and tenant foreign keys.
- Never match, merge, or bind accounts by email, including verified email.
- Google requests only `openid email profile`; it does not request offline
  access and the stored session contains no Google access or refresh token.
- The Google callback is exactly `${APP_ORIGIN}/api/callback`; forwarded host
  headers cannot change it.
- Production cookies remain HttpOnly, Secure, SameSite=Lax, and path `/`.
- Native token exchange remains available only in Replit mode.
- Every behavioral change begins with a failing test and ends with a focused
  green test before its commit.

---

### Task 1: Validate provider-specific authentication configuration

**Files:**

- Create: `artifacts/api-server/src/lib/authConfig.ts`
- Create: `artifacts/api-server/src/lib/authConfig.test.ts`
- Modify: `artifacts/api-server/src/lib/auth.ts`

**Interfaces:**

- Produces:
  `loadAuthConfig(env: NodeJS.ProcessEnv): AuthRuntimeConfig`.
- Produces the discriminated union
  `ReplitAuthConfig | GoogleAuthConfig`, where both variants expose
  `provider`, `issuer`, and `clientId`, and Google additionally exposes
  `clientSecret`, `appOrigin`, and `callbackUrl`.
- Produces `getAuthConfig(): AuthRuntimeConfig` and
  `getOidcConfig(): Promise<openidClient.Configuration>` for route and
  middleware consumers.

- [ ] **Step 1: Write the configuration tests**

Cover exact mode selection and fail-closed validation:

```ts
assert.equal(
  loadAuthConfig({ AUTH_PROVIDER: "replit", REPL_ID: "r1" }).provider,
  "replit",
);
assert.throws(() => loadAuthConfig({ AUTH_PROVIDER: "google" }), /APP_ORIGIN/);
assert.throws(
  () =>
    loadAuthConfig({
      AUTH_PROVIDER: "google",
      APP_ORIGIN: "https://alpha.example/path",
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
    }),
  /origin/i,
);
const google = loadAuthConfig({
  AUTH_PROVIDER: "google",
  APP_ORIGIN: "https://alpha.example",
  GOOGLE_CLIENT_ID: "client",
  GOOGLE_CLIENT_SECRET: "secret",
});
assert.equal(google.callbackUrl, "https://alpha.example/api/callback");
assert.equal(google.issuer, "https://accounts.google.com");
```

Also reject unknown `AUTH_PROVIDER`, blank client fields, credentials embedded
in `APP_ORIGIN`, query/fragment/path values, and non-HTTPS non-loopback origins.

- [ ] **Step 2: Run the configuration test red**

Run:

```powershell
node --import tsx --test artifacts/api-server/src/lib/authConfig.test.ts
```

Expected: FAIL because `authConfig.ts` does not exist.

- [ ] **Step 3: Implement the configuration union**

Use these public types and exact Google issuer:

```ts
export const GOOGLE_ISSUER = "https://accounts.google.com";

export interface ReplitAuthConfig {
  provider: "replit";
  issuer: string;
  clientId: string;
}

export interface GoogleAuthConfig {
  provider: "google";
  issuer: typeof GOOGLE_ISSUER;
  clientId: string;
  clientSecret: string;
  appOrigin: string;
  callbackUrl: string;
}

export type AuthRuntimeConfig = ReplitAuthConfig | GoogleAuthConfig;
```

Default `AUTH_PROVIDER` to `replit` only for legacy compatibility. Selecting
Google must not read `ISSUER_URL` or `REPL_ID`. Build Google discovery with
`openidClient.ClientSecretPost(config.clientSecret)` and client metadata
containing `client_secret`; keep the existing public-client discovery behavior
for Replit.

- [ ] **Step 4: Run the focused tests and typecheck**

Run:

```powershell
node --import tsx --test artifacts/api-server/src/lib/authConfig.test.ts
pnpm --filter @workspace/api-server run typecheck
```

Expected: all configuration tests PASS and typecheck exits 0.

- [ ] **Step 5: Commit provider configuration**

```powershell
git add artifacts/api-server/src/lib/authConfig.ts artifacts/api-server/src/lib/authConfig.test.ts artifacts/api-server/src/lib/auth.ts
git commit -m "feat: validate auth provider configuration"
```

### Task 2: Add issuer/subject ownership persistence and binding command

**Files:**

- Create: `lib/db/migrations/20260830_google_auth_identity_mapping.sql`
- Create: `lib/db/src/schema/auth.test.ts`
- Modify: `lib/db/src/schema/auth.ts`
- Create:
  `artifacts/api-server/src/services/auth/externalIdentityRepository.ts`
- Create:
  `artifacts/api-server/src/services/auth/externalIdentityRepository.test.ts`
- Create: `artifacts/api-server/src/scripts/bindExternalIdentity.ts`
- Create: `artifacts/api-server/src/scripts/bindExternalIdentity.test.ts`
- Modify: `artifacts/api-server/build.mjs`
- Modify: `artifacts/api-server/package.json`

**Interfaces:**

- Produces `authExternalIdentitiesTable` keyed by `(issuer, subject)` with a
  foreign key to `users.id` and a `user_id` lookup index.
- Produces
  `findUserByExternalIdentity(issuer: string, subject: string): Promise<User | null>`.
- Produces
  `bindExternalIdentity(input: { issuer: string; subject: string; userId: string }): Promise<"created" | "already_bound">`.
- Produces the compiled operator command
  `artifacts/api-server/dist/bind-auth-identity.mjs`.

- [ ] **Step 1: Write schema and migration tests**

Use `getTableConfig` plus literal migration inspection to assert:

```ts
assert.deepEqual(primaryKeyColumns("authExternalIdentitiesTable"), [
  "issuer",
  "subject",
]);
assert.ok(
  indexNames("authExternalIdentitiesTable").includes(
    "auth_external_identities_user_id_idx",
  ),
);
assert.match(
  migrationSql,
  /FOREIGN KEY \(user_id\) REFERENCES users\(id\) ON DELETE CASCADE/i,
);
assert.doesNotMatch(migrationSql, /email/i);
```

The schema uses `varchar(512)` for issuer, `varchar(255)` for subject, a
non-null `user_id`, `created_at timestamptz default now()`, nonblank checks,
and no email column.

- [ ] **Step 2: Run the schema test red**

Run:

```powershell
node --import tsx --test lib/db/src/schema/auth.test.ts
```

Expected: FAIL because the table and migration are absent.

- [ ] **Step 3: Add the additive table and migration**

Use one composite primary key, one user index, and this ownership direction:

```sql
CREATE TABLE IF NOT EXISTS auth_external_identities (
  issuer varchar(512) NOT NULL,
  subject varchar(255) NOT NULL,
  user_id varchar NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_external_identities_pk PRIMARY KEY (issuer, subject),
  CONSTRAINT auth_external_identities_issuer_check CHECK (btrim(issuer) <> ''),
  CONSTRAINT auth_external_identities_subject_check CHECK (btrim(subject) <> ''),
  CONSTRAINT auth_external_identities_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS auth_external_identities_user_id_idx
  ON auth_external_identities(user_id);
```

Do not modify `users.id` or any dependent table.

- [ ] **Step 4: Write repository binding tests**

Use a fake transactional adapter to prove all four outcomes: missing internal
user rejects, unbound identity inserts, identical binding is idempotent, and a
binding to another user rejects. Assert that all repository predicates contain
both exact `issuer` and case-sensitive `subject`; no test or implementation may
query users by email.

- [ ] **Step 5: Run the repository test red**

Run:

```powershell
node --import tsx --test artifacts/api-server/src/services/auth/externalIdentityRepository.test.ts
```

Expected: FAIL because the repository is absent.

- [ ] **Step 6: Implement transactional lookup and binding**

Inside one `db.transaction`, lock the selected user row, read the exact
issuer/subject row, then insert only if absent. Return `already_bound` only
when the stored `user_id` equals the requested `userId`; otherwise throw the
safe message `External identity is already bound to another user.`. Throw
`Selected internal user does not exist.` before inserting when the user lock
returns no row.

- [ ] **Step 7: Write and implement strict CLI parsing**

Test missing, duplicated, and unknown flags. The accepted invocation is exact:

```powershell
pnpm --filter @workspace/api-server run auth:bind -- --issuer https://accounts.google.com --subject 123456789 --user-id existing-internal-id
```

`parseBindingArgs(argv)` must return only `{ issuer, subject, userId }`, enforce
the schema length/nonblank rules, reject a subject containing control
characters, and never accept email. The command prints `created` or
`already_bound`, sets a nonzero exit code for conflicts, and closes the pool in
`finally`.

- [ ] **Step 8: Bundle and verify the operator command**

Add `bind-auth-identity` to the API esbuild entry points and add:

```json
"auth:bind": "node --enable-source-maps ./dist/bind-auth-identity.mjs"
```

Run:

```powershell
node --import tsx --test lib/db/src/schema/auth.test.ts artifacts/api-server/src/services/auth/externalIdentityRepository.test.ts artifacts/api-server/src/scripts/bindExternalIdentity.test.ts
pnpm run test:db
pnpm --filter @workspace/api-server run build
```

Expected: all tests pass and the binding artifact exists. Do not execute the
command against a real database during this task.

- [ ] **Step 9: Commit identity persistence**

```powershell
git add lib/db/migrations/20260830_google_auth_identity_mapping.sql lib/db/src/schema/auth.ts lib/db/src/schema/auth.test.ts artifacts/api-server/src/services/auth artifacts/api-server/src/scripts/bindExternalIdentity.ts artifacts/api-server/src/scripts/bindExternalIdentity.test.ts artifacts/api-server/build.mjs artifacts/api-server/package.json
git commit -m "feat: add explicit external identity binding"
```

### Task 3: Model provider-specific and pending sessions

**Files:**

- Create: `artifacts/api-server/src/lib/authSession.ts`
- Create: `artifacts/api-server/src/lib/authSession.test.ts`
- Modify: `artifacts/api-server/src/lib/auth.ts`
- Modify: `artifacts/api-server/src/middlewares/authMiddleware.ts`
- Create: `artifacts/api-server/src/middlewares/authMiddleware.test.ts`

**Interfaces:**

- Produces `ReplitSessionData`, `GoogleSessionData`,
  `PendingGoogleIdentitySessionData`, and `StoredSessionData` as a
  discriminated union.
- Produces `parseStoredSession(value: unknown): StoredSessionData | null`,
  including a backward-compatible parser for the current untagged Replit
  session JSON.
- `createSession(data, ttlMs)` retains opaque random IDs and caps authenticated
  lifetime at seven days; pending setup lifetime is ten minutes.

- [ ] **Step 1: Write session parsing tests**

The test matrix must prove:

```ts
assert.equal(parseStoredSession(legacyFixture)?.kind, "replit");
assert.equal(parseStoredSession(googleFixture)?.kind, "google");
assert.equal(parseStoredSession(pendingFixture)?.kind, "google_identity_setup");
assert.equal(
  parseStoredSession({ kind: "google", accessToken: "forbidden" }),
  null,
);
assert.equal(
  parseStoredSession({ user: { id: "" }, access_token: "token" }),
  null,
);
```

The Google session contains only `kind`, normalized `user`, and `expiresAt`.
The pending record contains only safe display claims plus exact issuer/subject;
it has no internal user ID and cannot satisfy authentication.

- [ ] **Step 2: Run the session test red**

Run:

```powershell
node --import tsx --test artifacts/api-server/src/lib/authSession.test.ts
```

Expected: FAIL because the parser is absent.

- [ ] **Step 3: Implement strict session parsing and storage**

Normalize the legacy snake-case fields into `ReplitSessionData` at read time,
but write new Replit sessions with the discriminant. Reject unknown keys for
Google and pending session variants. `getSession` returns null and deletes the
row when the database expiry or the authenticated `expiresAt` has passed.

- [ ] **Step 4: Write middleware behavior tests**

Inject session lookup, update, delete, and a refresh spy. Prove that an active
Google session sets `req.user` with zero refresh calls; an expired Google
session clears its cookie; an active legacy/Replit session remains compatible;
an expired Replit session refreshes only when it has a refresh token; and a
pending Google identity never sets `req.user`.

- [ ] **Step 5: Implement provider-aware middleware**

Replace in-place session mutation with a returned Replit session. Branch on
`session.kind` before calling `refreshTokenGrant`. A Google or pending session
must never call discovery or token refresh.

- [ ] **Step 6: Run middleware tests and typecheck**

```powershell
node --import tsx --test artifacts/api-server/src/lib/authSession.test.ts artifacts/api-server/src/middlewares/authMiddleware.test.ts
pnpm --filter @workspace/api-server run typecheck
```

Expected: all tests PASS and typecheck exits 0.

- [ ] **Step 7: Commit provider-specific sessions**

```powershell
git add artifacts/api-server/src/lib/auth.ts artifacts/api-server/src/lib/authSession.ts artifacts/api-server/src/lib/authSession.test.ts artifacts/api-server/src/middlewares/authMiddleware.ts artifacts/api-server/src/middlewares/authMiddleware.test.ts
git commit -m "feat: isolate provider auth sessions"
```

### Task 4: Implement mapped Google browser login and safe setup pages

**Files:**

- Create: `artifacts/api-server/src/routes/auth.test.ts`
- Create: `artifacts/api-server/src/lib/authPages.ts`
- Create: `artifacts/api-server/src/lib/authPages.test.ts`
- Modify: `artifacts/api-server/src/routes/auth.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`

**Interfaces:**

- Produces `createAuthRouter(dependencies?: Partial<AuthRouterDependencies>)`;
  the default router supplies real OIDC, identity, and session dependencies.
- Adds unauthenticated display routes `/auth/setup` and `/auth/error` under
  `/api`; neither route returns portfolio data or creates a user.
- Preserves `/login`, `/callback`, `/logout`, `/auth/user`, and both mobile
  endpoint paths.

- [ ] **Step 1: Write HTML escaping and safe-return tests**

`renderIdentitySetupPage` must HTML-escape display name, email, issuer, and
subject. `renderAuthErrorPage` accepts a closed reason union and never renders
raw provider errors. `getSafeReturnTo` accepts `/`, `/portfolio`, and query
strings on local paths, but maps absolute, protocol-relative, backslash, null,
and control-character input to `/`.

- [ ] **Step 2: Write route tests before the refactor**

Use an Express test server and injected OIDC/database functions. Cover these
exact behaviors:

- Google `/login` uses only `openid email profile`, the fixed APP_ORIGIN
  callback, PKCE S256, state, and nonce.
- A failed token exchange clears every transient cookie and redirects once to
  `/api/auth/error?reason=callback_failed`, never `/api/login`.
- The grant receives the cookie state, nonce, and code verifier.
- A mapped `(https://accounts.google.com, sub)` creates a Google session for
  the returned existing `users.id` and redirects to the sanitized return path.
- An unmapped identity does not insert a user or create an authenticated
  session; it creates a ten-minute pending setup record and redirects to
  `/api/auth/setup`.
- Google logout deletes only the app session and returns to APP_ORIGIN; it does
  not call a provider end-session endpoint.
- Google mode returns 409 JSON for mobile token exchange before any OIDC call.
- Replit mode retains direct-sub upsert, provider logout, and mobile exchange.

- [ ] **Step 3: Run route and page tests red**

Run:

```powershell
node --import tsx --test artifacts/api-server/src/lib/authPages.test.ts artifacts/api-server/src/routes/auth.test.ts
```

Expected: FAIL because the factory, pages, and Google branches are absent.

- [ ] **Step 4: Refactor the router without changing Replit behavior**

Move external operations behind `AuthRouterDependencies`. Keep a default export
created by `createAuthRouter()`. Use `config.callbackUrl` only for Google; the
legacy forwarded-origin helper remains confined to the Replit branch. Clear
the transient `code_verifier`, `nonce`, `state`, and `return_to` cookies on all
callback success and failure exits.

- [ ] **Step 5: Add the mapped Google callback**

Require verified string `iss` and `sub` claims. Canonicalize Google's legacy
`accounts.google.com` issuer to `https://accounts.google.com`; reject every
other issuer. Resolve the exact identity mapping. For mapped users, create:

```ts
const session: GoogleSessionData = {
  kind: "google",
  user: toAuthUser(existingUser),
  expiresAt: Date.now() + SESSION_TTL,
};
```

Do not store `tokens.access_token`, `tokens.refresh_token`, email ownership, or
a new internal user.

- [ ] **Step 6: Add the unmapped setup path and recoverable error page**

Store a ten-minute `google_identity_setup` record behind a separate
`identity_setup_sid` HttpOnly cookie. The setup page says that no portfolio has
been opened, labels email as display information only, shows the exact issuer
and subject required by the operator command, and asks the user to return after
the administrator confirms the binding. It exposes no database user list and
has no POST/admin endpoint.

- [ ] **Step 7: Run auth tests and the protected-route regression**

Run:

```powershell
node --import tsx --test artifacts/api-server/src/lib/authConfig.test.ts artifacts/api-server/src/lib/authSession.test.ts artifacts/api-server/src/lib/authPages.test.ts artifacts/api-server/src/middlewares/authMiddleware.test.ts artifacts/api-server/src/routes/auth.test.ts
node --import tsx --test artifacts/api-server/src/routes/researchAutomation.test.ts
pnpm --filter @workspace/api-server run typecheck
```

Expected: auth tests pass, another user's protected records remain 404, and
typecheck exits 0.

- [ ] **Step 8: Commit Google browser auth**

```powershell
git add artifacts/api-server/src/lib/authPages.ts artifacts/api-server/src/lib/authPages.test.ts artifacts/api-server/src/routes/auth.ts artifacts/api-server/src/routes/auth.test.ts artifacts/api-server/src/routes/index.ts
git commit -m "feat: add mapped Google browser sign-in"
```

### Task 5: Expose provider-aware sign-in copy and secret-safe configuration

**Files:**

- Modify: `lib/api-spec/openapi.yaml`
- Regenerate: `lib/api-zod/src/generated/**`
- Regenerate: `lib/api-client-react/src/generated/**`
- Modify: `lib/replit-auth-web/src/use-auth.ts`
- Create: `lib/replit-auth-web/src/authCopy.ts`
- Create: `lib/replit-auth-web/src/authCopy.test.ts`
- Modify:
  `artifacts/portfolio-intelligence/src/components/auth/AuthBanner.tsx`
- Modify: `.env.example`
- Modify: `render.yaml`
- Modify: `docs/deployment/free-hosting.md`

**Interfaces:**

- `GET /api/auth/user` returns
  `{ user: AuthUser | null, authProvider: "replit" | "google" }`.
- `useAuth()` exposes `authProvider` and keeps the existing user, loading,
  login, and logout fields.
- Produces `getSignInLabel(provider)` returning `Sign in with Google` only for
  Google and `Sign in` for Replit/unknown.

- [ ] **Step 1: Write provider-copy tests**

```ts
assert.equal(getSignInLabel("google"), "Sign in with Google");
assert.equal(getSignInLabel("replit"), "Sign in");
assert.equal(getSignInLabel(undefined), "Sign in");
```

- [ ] **Step 2: Update and regenerate the API contract**

Add a required `authProvider` enum to `AuthUserEnvelope`, change logout summary
to `Clear the application session`, and document that mobile exchange returns
409 in Google mode. Run:

```powershell
pnpm --filter @workspace/api-spec run codegen
```

Inspect generated diffs and reject unrelated generated contract changes.

- [ ] **Step 3: Update the hook and banner**

Parse `authProvider` fail-closed as undefined on network/schema failure. Render
the provider-aware button copy without changing the existing relative
same-origin login/logout URLs. Keep the existing loading state, keyboard button
behavior, and responsive sidebar layout.

- [ ] **Step 4: Add configuration without credentials**

The example documents both modes. The Render blueprint contains:

```yaml
- key: AUTH_PROVIDER
  value: google
- key: APP_ORIGIN
  sync: false
- key: GOOGLE_CLIENT_ID
  sync: false
- key: GOOGLE_CLIENT_SECRET
  sync: false
```

Remove Google-inapplicable `ISSUER_URL`/`REPL_ID` from Render only; keep them in
`.env.example` under a clearly marked legacy mode. Do not place real values in
Git.

- [ ] **Step 5: Extend the runbook approval gates**

Document the exact registered callback `${APP_ORIGIN}/api/callback`, the three
Google secret variables, the unmapped setup page, and the binding command.
State that the command is run only after the user verifies the displayed
Google account and exact existing internal user ID. Keep OAuth client creation,
secret installation, identity binding against migrated data, and deployment as
separate action-time approvals.

- [ ] **Step 6: Run frontend auth tests and typecheck**

```powershell
node --import tsx --test lib/replit-auth-web/src/authCopy.test.ts
pnpm run typecheck
pnpm --filter @workspace/portfolio-intelligence run build
```

Expected: provider copy tests pass, all workspaces typecheck, and the frontend
production build exits 0.

- [ ] **Step 7: Commit provider-aware product copy**

```powershell
git add lib/api-spec/openapi.yaml lib/api-zod/src/generated lib/api-client-react/src/generated lib/replit-auth-web/src/use-auth.ts lib/replit-auth-web/src/authCopy.ts lib/replit-auth-web/src/authCopy.test.ts artifacts/portfolio-intelligence/src/components/auth/AuthBanner.tsx .env.example render.yaml docs/deployment/free-hosting.md
git commit -m "feat: prepare Google sign-in deployment"
```

### Task 6: Verify the auth migration as one release unit

**Files:**

- Modify:
  `docs/superpowers/plans/2026-08-30-google-oidc-owner-binding.md`

**Interfaces:**

- Consumes every configuration, schema, session, router, CLI, UI, and
  deployment interface above.
- Produces a locally committed, not-pushed auth migration ready for the later
  disposable database restore and credential approval gates.

- [ ] **Step 1: Run all auth and database tests**

```powershell
node --import tsx --test artifacts/api-server/src/lib/authConfig.test.ts artifacts/api-server/src/lib/authSession.test.ts artifacts/api-server/src/lib/authPages.test.ts artifacts/api-server/src/middlewares/authMiddleware.test.ts artifacts/api-server/src/routes/auth.test.ts artifacts/api-server/src/services/auth/externalIdentityRepository.test.ts artifacts/api-server/src/scripts/bindExternalIdentity.test.ts lib/db/src/schema/auth.test.ts
pnpm run test:db
```

Expected: all tests PASS with no real OIDC or database network call.

- [ ] **Step 2: Run existing product regressions**

```powershell
pnpm run test:research
node --import tsx --test artifacts/api-server/src/routes/capabilities.test.ts artifacts/api-server/src/lib/frontendHosting.test.ts artifacts/portfolio-intelligence/src/features/capabilities/viewModel.test.ts
```

Expected: database tenancy, saved research, disabled AI, and frontend hosting
tests all remain green.

- [ ] **Step 3: Prove fail-closed runtime configuration**

Build the API, then start it once with
`AUTH_PROVIDER=google` and no Google secret. Expected: startup exits nonzero
with a missing-configuration message and no discovery request. Start it again
with `AUTH_PROVIDER=replit`, the legacy variables, AI disabled, and a disposable
database URL; expected: health and capability routes work without invoking
OIDC.

- [ ] **Step 4: Run final typecheck and production build**

```powershell
pnpm run typecheck
pnpm run build
git diff --check
```

Expected: every command exits 0. The existing Vite sourcemap-location warnings
may remain, but there are no type, test, or build failures.

- [ ] **Step 5: Review the staged release boundary**

Confirm `git status --short` contains no dump, `.env`, token, Google client
value, session row, or generated build artifact. Confirm `render.yaml` still
declares only one `plan: free` web service and `AI_REQUESTS_ENABLED=false`.

- [ ] **Step 6: Commit verification metadata only when changed**

Mark every completed checkbox in this plan, stage only this plan if it changed,
and commit:

```powershell
git add docs/superpowers/plans/2026-08-30-google-oidc-owner-binding.md
git commit -m "docs: verify Google auth migration"
```

Do not push, create credentials, bind a real account, restore private data, or
deploy. Those remain explicit user approval gates after the price-refresh plan
and final regression gate are complete.

## Self-review

- The plan covers strict mode selection, fixed callback origin, minimal Google
  scopes, state/nonce/PKCE validation, safe local returns, recoverable errors,
  transient-cookie cleanup, exact issuer/subject ownership, transactional
  conflicts, no email matching, legacy-session compatibility, Google token
  exclusion, local logout, Replit mobile compatibility, provider-aware UI,
  secret-safe deployment config, tenancy regression, and full build gates.
- Types are consistent across tasks: the table, repository, router, CLI, and
  setup page all use exact `issuer`, `subject`, and existing `userId` fields.
- No task creates a Google credential, deploys, uploads data, invokes paid AI,
  exposes a public binding endpoint, or changes an existing internal owner ID.
