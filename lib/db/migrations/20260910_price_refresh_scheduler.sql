DO $$ BEGIN
  CREATE TYPE price_refresh_attempt_status AS ENUM ('running', 'fresh', 'partial', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS price_refresh_leases (
  name varchar(160) PRIMARY KEY,
  worker_id varchar(120) NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_refresh_leases_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT price_refresh_leases_worker_check CHECK (btrim(worker_id) <> '')
);

CREATE TABLE IF NOT EXISTS price_refresh_attempts (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL,
  local_day date NOT NULL,
  attempt_number integer NOT NULL,
  status price_refresh_attempt_status NOT NULL DEFAULT 'running',
  worker_id varchar(120) NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code varchar(80),
  CONSTRAINT price_refresh_attempts_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT price_refresh_attempts_user_day_attempt_unique
    UNIQUE (user_id, local_day, attempt_number),
  CONSTRAINT price_refresh_attempts_attempt_number_check
    CHECK (attempt_number BETWEEN 1 AND 3),
  CONSTRAINT price_refresh_attempts_worker_check CHECK (btrim(worker_id) <> '')
);

CREATE INDEX IF NOT EXISTS price_refresh_attempts_user_day_idx
  ON price_refresh_attempts(user_id, local_day);
