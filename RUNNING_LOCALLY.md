# Running Equity-Intellect / Portfolio Intelligence locally (macOS)

This app is a **pnpm workspace monorepo** built to run on **Replit (Linux x64)**. Getting it
running on a local **Apple Silicon Mac** takes a few extra steps because the repo intentionally
strips non-Linux native binaries and relies on Replit's router to join the frontend and API.
This document captures everything needed to bootstrap it locally, plus how to stop it.

---

## 1. What the app is

| Package | Role | Port | Renders UI? |
|---|---|---|---|
| `@workspace/portfolio-intelligence` | React + Vite **frontend** (the UI) | **24637** | ✅ Yes |
| `@workspace/api-server` | Express 5 **backend**, serves `/api/*` (Postgres + Drizzle) | **8080** | No |
| `@workspace/mockup-sandbox` | Design/component preview only (`/__mockup`) | 8081 | Dev tool only |

- The UI fetches data via **relative `/api/*` calls**. On Replit an application router maps
  `/` → frontend and `/api` → backend on one origin. Locally we reproduce that with a **Vite dev proxy**.
- **Auth is optional.** Read endpoints serve data without login (much of it is baked into the API
  routes). A few DB-writing actions (e.g. saving a watchlist item) return **401 unless signed in** —
  real login needs Replit OIDC env vars that aren't available locally. The UI works fine without it.

---

## 2. Tech prerequisites

| Tool | Version used | Notes |
|---|---|---|
| **Node.js** | 22.x worked (repo targets **24** via `.replit`) | via nvm is fine |
| **pnpm** | 11.x | `corepack enable` or install globally |
| **PostgreSQL server** | 16 or 17 | **client alone is not enough — you need a running server** |
| Git | any | |

Check what you have:

```bash
node -v            # v22+ ok
pnpm -v            # 11+
psql --version     # client
postgres --version # SERVER binary — this is the one people are usually missing
```

**If you have no Postgres server**, any of these works:
- **Anaconda** ships one: `/opt/anaconda3/bin/postgres` (used in the steps below — no admin rights, no Docker)
- **Homebrew**: `brew install postgresql@16 && brew services start postgresql@16`
- **Docker Desktop**: `docker run -d --name pi-pg -e POSTGRES_PASSWORD=pg -p 5432:5432 postgres:16`
  (requires the Docker daemon to be running)

---

## 3. Two required local edits (⚠️ DO NOT COMMIT)

The repo is pinned to Linux x64. These two edits make it run on macOS; they are for local dev only.

### 3a. Re-enable Apple Silicon native binaries — `pnpm-workspace.yaml`

Under `overrides:`, **comment out** the four `darwin-arm64` exclusion lines so the real arm64
binaries install:

```yaml
  # "esbuild>@esbuild/darwin-arm64": "-"                       # LOCAL DEV (Apple Silicon): re-enabled; do not commit
  # "lightningcss>lightningcss-darwin-arm64": "-"              # LOCAL DEV (Apple Silicon): re-enabled; do not commit
  # "@tailwindcss/oxide>@tailwindcss/oxide-darwin-arm64": "-"  # LOCAL DEV (Apple Silicon): re-enabled; do not commit
  # "rollup>@rollup/rollup-darwin-arm64": "-"                  # LOCAL DEV (Apple Silicon): re-enabled; do not commit
```

> On an **Intel Mac**, comment out the `darwin-x64` lines instead.

### 3b. Add a `/api` dev proxy — `artifacts/portfolio-intelligence/vite.config.ts`

Inside `server: { ... }`, add:

```ts
    // LOCAL DEV: forward /api to the backend (Replit's router does this in prod). Do not commit.
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
```

**Revert both files when done:**
```bash
git checkout pnpm-workspace.yaml artifacts/portfolio-intelligence/vite.config.ts
```

---

## 4. Bootstrap (one-time)

Run from the repo root: `/Users/roshanpathak/IdeaProjects/codex-apps/Equity-Intellect`

```bash
# 0. Make the local edits in section 3 FIRST, then:

# 1. Install workspace dependencies (repo enforces pnpm)
pnpm install
#    "Ignored build scripts: esbuild" is expected and harmless — the arm64
#    binary is provided by the @esbuild/darwin-arm64 package we re-enabled.

# 2. Create a DURABLE Postgres data dir (survives reboots, unlike /tmp)
PGDATA="$HOME/.local/share/equity-intellect-pg"
/opt/anaconda3/bin/initdb -D "$PGDATA" -U postgres --auth=trust

# 3. Start Postgres on :5432 and create the database
/opt/anaconda3/bin/pg_ctl -D "$PGDATA" -o "-p 5432 -k /tmp" -l "$PGDATA/server.log" start
/opt/anaconda3/bin/createdb -h localhost -p 5432 -U postgres portfolio

# 4. Push the Drizzle schema (creates the tables)
cd lib/db
DATABASE_URL="postgres://postgres@localhost:5432/portfolio" \
  ./node_modules/.bin/drizzle-kit push --force --config ./drizzle.config.ts
cd ../..

# 5. Build the API server (esbuild bundle)
cd artifacts/api-server
node ./build.mjs
cd ../..
```

> **Why bypass `pnpm run`?** pnpm 11 runs a "verify deps before run" check that fails on the
> unapproved `esbuild` build script. Running the tool binaries directly
> (`./node_modules/.bin/...`, `node build.mjs`, `./node_modules/.bin/vite`) sidesteps it.
> Alternatively run `pnpm approve-builds` once and use the normal `pnpm --filter ... run dev` scripts.

---

## 5. Start the app (every session)

Three long-running processes. Use three terminals, or background each with `&`.

```bash
# Terminal 1 — Postgres (skip if already running)
PGDATA="$HOME/.local/share/equity-intellect-pg"
/opt/anaconda3/bin/pg_ctl -D "$PGDATA" -o "-p 5432 -k /tmp" -l "$PGDATA/server.log" start

# Terminal 2 — API server (:8080)
cd artifacts/api-server
node ./build.mjs   # only needed after backend code changes
PORT=8080 NODE_ENV=development \
  DATABASE_URL="postgres://postgres@localhost:5432/portfolio" \
  node --enable-source-maps ./dist/index.mjs

# Terminal 3 — Frontend UI (:24637)
cd artifacts/portfolio-intelligence
PORT=24637 BASE_PATH=/ ./node_modules/.bin/vite --config vite.config.ts --host 0.0.0.0
```

**Then open → http://localhost:24637**

### Verify it's healthy
```bash
# ports listening
for p in 5432 8080 24637; do nc -z localhost $p && echo "$p UP" || echo "$p DOWN"; done

# API direct + through the UI proxy (both should be 200 with JSON)
curl -s -o /dev/null -w "API healthz         -> %{http_code}\n" http://localhost:8080/api/healthz
curl -s -o /dev/null -w "dashboard via proxy -> %{http_code}\n" http://localhost:24637/api/dashboard/summary
curl -s -o /dev/null -w "holdings via proxy  -> %{http_code}\n" http://localhost:24637/api/portfolio/holdings
```

---

## 6. Stop the app

```bash
# Stop the UI and API (by port)
lsof -ti:24637 | xargs kill    # UI
lsof -ti:8080  | xargs kill    # API

# Stop Postgres
PGDATA="$HOME/.local/share/equity-intellect-pg"
/opt/anaconda3/bin/pg_ctl -D "$PGDATA" stop

# If you used Docker for Postgres instead:
# docker stop pi-pg      (docker start pi-pg to resume; docker rm -f pi-pg to delete)
```

To fully reset the database, stop Postgres and `rm -rf "$PGDATA"`, then redo bootstrap steps 2–4.

---

## 7. Environment variables reference

| Var | Used by | Value (local) |
|---|---|---|
| `DATABASE_URL` | API server, drizzle-kit | `postgres://postgres@localhost:5432/portfolio` |
| `PORT` | API server | `8080` |
| `PORT` | Vite UI | `24637` |
| `BASE_PATH` | Vite UI | `/` |
| `API_PROXY_TARGET` | Vite proxy (optional) | defaults to `http://localhost:8080` |
| `NODE_ENV` | API server | `development` |

---

## 8. Troubleshooting

- **`PORT environment variable is required`** — you launched the API or UI without `PORT` set. Prepend it.
- **`DATABASE_URL must be set`** — Postgres isn't referenced; add the `DATABASE_URL` env to the API command.
- **`ERR_PNPM_IGNORED_BUILDS: esbuild`** / `runDepsStatusCheck` failure — run the binaries directly
  (as in this doc) or run `pnpm approve-builds` once.
- **UI loads but data panels are empty / `/api` returns the HTML page** — the Vite `/api` proxy
  (section 3b) is missing, or the API server isn't running on :8080. Restart Vite after adding the proxy.
- **`Cannot find module @esbuild/darwin-arm64` / rollup / lightningcss errors** — the section 3a
  edit wasn't applied before `pnpm install`. Fix the file and re-run `pnpm install`.
- **`Cannot connect to the Docker daemon`** — start Docker Desktop, or use the Anaconda/Homebrew
  Postgres path instead.
- **401 on a write action** (e.g. add to watchlist) — expected without login; read flows are unaffected.

---

## 9. The intended (zero-setup) alternative

Because of the Linux-x64 pinning, the friction-free way to run the full app is its **native
environment**: open it on **Replit** and press **Run** (`.replit` → `runButton = "Project"`),
which starts both services behind the shared router with a provisioned Postgres — no local edits,
proxy, or database setup required.
