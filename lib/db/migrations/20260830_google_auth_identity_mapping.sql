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
