import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { getTableConfig } from "drizzle-orm/pg-core";

import { authExternalIdentitiesTable } from "./auth";

const migrationSql = readFileSync(
  new URL(
    "../../migrations/20260830_google_auth_identity_mapping.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("external authentication identity schema", () => {
  const config = getTableConfig(authExternalIdentitiesTable);

  it("keys identities by exact issuer and subject", () => {
    assert.equal(config.name, "auth_external_identities");
    assert.deepEqual(
      config.primaryKeys.map((key) => key.columns.map((column) => column.name)),
      [["issuer", "subject"]],
    );
    assert.equal(
      config.primaryKeys[0]?.getName(),
      "auth_external_identities_pk",
    );
  });

  it("stores only the external key and existing internal owner", () => {
    const columns = Object.fromEntries(
      config.columns.map((column) => [column.name, column]),
    );
    assert.deepEqual(Object.keys(columns), [
      "issuer",
      "subject",
      "user_id",
      "created_at",
    ]);
    assert.equal(columns.issuer?.getSQLType(), "varchar(512)");
    assert.equal(columns.subject?.getSQLType(), "varchar(255)");
    assert.equal(columns.issuer?.notNull, true);
    assert.equal(columns.subject?.notNull, true);
    assert.equal(columns.user_id?.notNull, true);
  });

  it("enforces owner deletion and lookup indexes", () => {
    assert.deepEqual(
      config.foreignKeys.map((foreignKey) => {
        const reference = foreignKey.reference();
        return {
          columns: reference.columns.map((column) => column.name),
          foreignTable: getTableConfig(reference.foreignTable).name,
          foreignColumns: reference.foreignColumns.map((column) => column.name),
          onDelete: foreignKey.onDelete,
        };
      }),
      [
        {
          columns: ["user_id"],
          foreignTable: "users",
          foreignColumns: ["id"],
          onDelete: "cascade",
        },
      ],
    );
    assert.ok(
      config.indexes.some(
        (index) => index.config.name === "auth_external_identities_user_id_idx",
      ),
    );
    assert.deepEqual(config.checks.map((check) => check.name).sort(), [
      "auth_external_identities_issuer_check",
      "auth_external_identities_subject_check",
    ]);
  });

  it("defines one additive migration without email matching", () => {
    assert.match(
      migrationSql,
      /CREATE TABLE IF NOT EXISTS auth_external_identities/i,
    );
    assert.match(migrationSql, /PRIMARY KEY \(issuer, subject\)/i);
    assert.match(
      migrationSql,
      /FOREIGN KEY \(user_id\)\s+REFERENCES users\(id\) ON DELETE CASCADE/i,
    );
    assert.match(
      migrationSql,
      /CREATE INDEX IF NOT EXISTS auth_external_identities_user_id_idx/i,
    );
    assert.doesNotMatch(migrationSql, /email/i);
    assert.doesNotMatch(migrationSql, /ALTER TABLE users|UPDATE users/i);
  });
});
