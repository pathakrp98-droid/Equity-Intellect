DO $$ BEGIN
  CREATE TYPE research_security_type AS ENUM ('equity', 'etf', 'mutual_fund', 'unlisted', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE research_identity_status AS ENUM ('resolved', 'needs_identity');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE research_automation_trigger AS ENUM (
    'holding_added', 'holding_changed', 'portfolio_reconciled',
    'scheduled_refresh', 'material_event', 'manual_refresh'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE research_automation_status AS ENUM (
    'queued', 'running', 'succeeded', 'partial', 'failed',
    'dead_letter', 'cancelled', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE research_evidence_strength AS ENUM ('strong', 'moderate', 'limited');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE research_evidence_authority AS ENUM ('primary', 'secondary', 'excluded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE research_companies
  ADD COLUMN IF NOT EXISTS isin varchar(24),
  ADD COLUMN IF NOT EXISTS normalized_identity_key varchar(180),
  ADD COLUMN IF NOT EXISTS security_type research_security_type NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS identity_status research_identity_status NOT NULL DEFAULT 'needs_identity',
  ADD COLUMN IF NOT EXISTS identity_confidence double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS automation_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS research_automation_preferences (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  timezone varchar(80) NOT NULL DEFAULT 'Asia/Kolkata',
  daily_hour integer NOT NULL DEFAULT 6,
  minimum_refresh_interval_minutes integer NOT NULL DEFAULT 240,
  max_assets_per_daily_run integer NOT NULL DEFAULT 25,
  next_daily_run_at timestamptz,
  last_daily_enqueued_at timestamptz,
  last_reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_automation_preferences_daily_hour_check CHECK (daily_hour BETWEEN 0 AND 23),
  CONSTRAINT research_automation_preferences_interval_check CHECK (minimum_refresh_interval_minutes BETWEEN 15 AND 10080),
  CONSTRAINT research_automation_preferences_asset_cap_check CHECK (max_assets_per_daily_run BETWEEN 1 AND 250)
);

CREATE UNIQUE INDEX IF NOT EXISTS research_automation_preferences_user_uidx
  ON research_automation_preferences(user_id);

CREATE TABLE IF NOT EXISTS research_coverage_targets (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  portfolio_id integer NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES research_companies(id) ON DELETE CASCADE,
  ticker varchar(30) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  holding_fingerprint varchar(64) NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  CONSTRAINT research_coverage_targets_normalized_ticker_check CHECK (
    ticker = upper(trim(ticker)) AND ticker <> ''
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS research_coverage_targets_user_portfolio_ticker_uidx
  ON research_coverage_targets(user_id, portfolio_id, ticker);
CREATE INDEX IF NOT EXISTS research_coverage_targets_active_user_company_idx
  ON research_coverage_targets(user_id, company_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS research_automation_trigger_events (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  portfolio_id integer REFERENCES portfolios(id) ON DELETE SET NULL,
  ticker varchar(30),
  trigger research_automation_trigger NOT NULL,
  status research_automation_status NOT NULL DEFAULT 'queued',
  dedupe_key varchar(180) NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  lease_expires_at timestamptz,
  worker_id varchar(120),
  processed_at timestamptz,
  last_error varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_automation_trigger_events_attempts_check CHECK (attempts >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS research_automation_trigger_events_user_dedupe_uidx
  ON research_automation_trigger_events(user_id, dedupe_key);
CREATE INDEX IF NOT EXISTS research_automation_trigger_events_claim_idx
  ON research_automation_trigger_events(status, available_at, lease_expires_at, priority);

CREATE TABLE IF NOT EXISTS research_automation_jobs (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES research_companies(id) ON DELETE CASCADE,
  trigger_event_id integer REFERENCES research_automation_trigger_events(id) ON DELETE SET NULL,
  trigger research_automation_trigger NOT NULL,
  status research_automation_status NOT NULL DEFAULT 'queued',
  priority integer NOT NULL DEFAULT 100,
  idempotency_key varchar(180) NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  run_after timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  lease_expires_at timestamptz,
  worker_id varchar(120),
  error_code varchar(80),
  error_message varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_automation_jobs_attempts_check CHECK (attempts >= 0 AND max_attempts >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS research_automation_jobs_user_idempotency_uidx
  ON research_automation_jobs(user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS research_automation_jobs_claim_idx
  ON research_automation_jobs(status, run_after, lease_expires_at, priority);

CREATE TABLE IF NOT EXISTS automated_research_snapshots (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES research_companies(id) ON DELETE CASCADE,
  job_id integer NOT NULL REFERENCES research_automation_jobs(id) ON DELETE RESTRICT,
  version integer NOT NULL,
  schema_version varchar(40) NOT NULL,
  security_type research_security_type NOT NULL,
  template_version varchar(80) NOT NULL,
  payload jsonb NOT NULL,
  quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_set jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_strength research_evidence_strength NOT NULL,
  fresh_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  provider varchar(80) NOT NULL,
  model varchar(120) NOT NULL,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  evidence_count integer NOT NULL DEFAULT 0,
  primary_evidence_count integer NOT NULL DEFAULT 0,
  content_hash varchar(64) NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automated_research_snapshots_version_check CHECK (version >= 1),
  CONSTRAINT automated_research_snapshots_freshness_check CHECK (valid_until >= fresh_at),
  CONSTRAINT automated_research_snapshots_counts_check CHECK (
    evidence_count >= 0 AND primary_evidence_count >= 0 AND primary_evidence_count <= evidence_count
  ),
  CONSTRAINT automated_research_snapshots_usage_check CHECK (
    (input_tokens IS NULL OR input_tokens >= 0) AND
    (output_tokens IS NULL OR output_tokens >= 0) AND
    (latency_ms IS NULL OR latency_ms >= 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS automated_research_snapshots_job_uidx
  ON automated_research_snapshots(job_id);
CREATE UNIQUE INDEX IF NOT EXISTS automated_research_snapshots_company_version_uidx
  ON automated_research_snapshots(company_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS automated_research_snapshots_company_content_hash_uidx
  ON automated_research_snapshots(company_id, content_hash);

CREATE TABLE IF NOT EXISTS automated_research_sources (
  id serial PRIMARY KEY,
  snapshot_id integer NOT NULL REFERENCES automated_research_snapshots(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id integer NOT NULL REFERENCES research_companies(id) ON DELETE CASCADE,
  citation_key varchar(128) NOT NULL,
  authority research_evidence_authority NOT NULL,
  source_type varchar(100) NOT NULL,
  title varchar(2000) NOT NULL,
  publisher varchar(500) NOT NULL,
  canonical_url varchar(2000) NOT NULL,
  published_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  evidence_summary varchar(1000) NOT NULL,
  content_fingerprint varchar(128) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automated_research_sources_https_url_check CHECK (canonical_url LIKE 'https://%'),
  CONSTRAINT automated_research_sources_summary_length_check CHECK (char_length(evidence_summary) <= 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS automated_research_sources_snapshot_citation_uidx
  ON automated_research_sources(snapshot_id, citation_key);

WITH holding_universe AS (
  SELECT
    p.user_id,
    h.portfolio_id,
    upper(trim(h.ticker)) AS ticker,
    max(coalesce(nullif(trim(h.name), ''), upper(trim(h.ticker)))) AS name,
    max(h.exchange) AS exchange
  FROM portfolio_holdings h
  JOIN portfolios p ON p.id = h.portfolio_id
  WHERE nullif(trim(h.ticker), '') IS NOT NULL AND h.quantity <> 0
  GROUP BY p.user_id, h.portfolio_id, upper(trim(h.ticker))
  UNION
  SELECT
    p.user_id,
    h.portfolio_id,
    upper(trim(h.symbol)) AS ticker,
    max(coalesce(nullif(trim(h.name), ''), upper(trim(h.symbol)))) AS name,
    max(h.exchange) AS exchange
  FROM portfolio_direct_holdings h
  JOIN portfolios p ON p.id = h.portfolio_id
  WHERE nullif(trim(h.symbol), '') IS NOT NULL AND h.quantity <> 0
  GROUP BY p.user_id, h.portfolio_id, upper(trim(h.symbol))
)
INSERT INTO research_companies (user_id, ticker, name, exchange)
SELECT user_id, ticker, max(name), max(exchange)
FROM holding_universe
GROUP BY user_id, ticker
ON CONFLICT (user_id, ticker) DO NOTHING;

WITH active_users AS (
  SELECT DISTINCT p.user_id
  FROM portfolios p
  WHERE EXISTS (
    SELECT 1 FROM portfolio_holdings h
    WHERE h.portfolio_id = p.id AND h.quantity <> 0
  ) OR EXISTS (
    SELECT 1 FROM portfolio_direct_holdings h
    WHERE h.portfolio_id = p.id AND h.quantity <> 0
  )
)
INSERT INTO research_automation_preferences (user_id, next_daily_run_at)
SELECT user_id, now() FROM active_users
ON CONFLICT (user_id) DO NOTHING;

WITH holding_universe AS (
  SELECT
    p.user_id,
    h.portfolio_id,
    upper(trim(h.ticker)) AS ticker,
    md5(concat_ws('|', upper(trim(h.ticker)), h.quantity, h.average_cost, h.market_value)) AS fingerprint
  FROM portfolio_holdings h
  JOIN portfolios p ON p.id = h.portfolio_id
  WHERE nullif(trim(h.ticker), '') IS NOT NULL AND h.quantity <> 0
  UNION
  SELECT
    p.user_id,
    h.portfolio_id,
    upper(trim(h.symbol)) AS ticker,
    md5(concat_ws('|', upper(trim(h.symbol)), h.quantity, h.average_cost, h.previous_close)) AS fingerprint
  FROM portfolio_direct_holdings h
  JOIN portfolios p ON p.id = h.portfolio_id
  WHERE nullif(trim(h.symbol), '') IS NOT NULL AND h.quantity <> 0
), normalized_holdings AS (
  SELECT user_id, portfolio_id, ticker, max(fingerprint) AS fingerprint
  FROM holding_universe
  GROUP BY user_id, portfolio_id, ticker
)
INSERT INTO research_coverage_targets (
  user_id, portfolio_id, company_id, ticker, is_active,
  holding_fingerprint, first_seen_at, last_seen_at
)
SELECT
  h.user_id, h.portfolio_id, c.id, h.ticker, true,
  h.fingerprint, now(), now()
FROM normalized_holdings h
JOIN research_companies c ON c.user_id = h.user_id AND c.ticker = h.ticker
ON CONFLICT (user_id, portfolio_id, ticker) DO UPDATE SET
  company_id = EXCLUDED.company_id,
  is_active = true,
  holding_fingerprint = EXCLUDED.holding_fingerprint,
  last_seen_at = EXCLUDED.last_seen_at,
  removed_at = NULL;

INSERT INTO research_automation_jobs (
  user_id, company_id, trigger, status, priority,
  idempotency_key, context, attempts, max_attempts, run_after
)
SELECT
  t.user_id,
  t.company_id,
  'portfolio_reconciled',
  'queued',
  100,
  concat('baseline:', t.portfolio_id, ':', t.ticker),
  jsonb_build_object('portfolioId', t.portfolio_id, 'ticker', t.ticker, 'baseline', true),
  0,
  5,
  now()
FROM research_coverage_targets t
WHERE t.is_active = true
ON CONFLICT (user_id, idempotency_key) DO NOTHING;
