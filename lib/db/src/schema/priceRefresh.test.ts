import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { getTableConfig } from "drizzle-orm/pg-core";

import {
  priceRefreshAttemptsTable,
  priceRefreshLeasesTable,
} from "./priceRefresh";

const migrationSql = readFileSync(
  new URL(
    "../../migrations/20260910_price_refresh_scheduler.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("automatic price refresh coordination schema", () => {
  it("stores one expiring exact-owner lease per bounded name", () => {
    const config = getTableConfig(priceRefreshLeasesTable);
    const columns = Object.fromEntries(
      config.columns.map((column) => [column.name, column]),
    );

    assert.equal(config.name, "price_refresh_leases");
    assert.equal(columns.name?.primary, true);
    assert.equal(columns.name?.getSQLType(), "varchar(160)");
    assert.equal(columns.worker_id?.notNull, true);
    assert.equal(columns.expires_at?.notNull, true);
    assert.deepEqual(config.checks.map((check) => check.name).sort(), [
      "price_refresh_leases_name_check",
      "price_refresh_leases_worker_check",
    ]);
  });

  it("audits at most three attempts per user and local day", () => {
    const config = getTableConfig(priceRefreshAttemptsTable);
    const columns = Object.fromEntries(
      config.columns.map((column) => [column.name, column]),
    );

    assert.equal(config.name, "price_refresh_attempts");
    assert.equal(columns.local_day?.getSQLType(), "date");
    assert.equal(columns.attempt_number?.notNull, true);
    assert.equal(columns.status?.getSQLType(), "price_refresh_attempt_status");
    assert.equal(columns.diagnostics?.notNull, true);
    assert.ok(
      config.indexes.some(
        (index) =>
          index.config.name === "price_refresh_attempts_user_day_attempt_uidx" &&
          index.config.unique,
      ),
    );
    assert.ok(
      config.indexes.some(
        (index) => index.config.name === "price_refresh_attempts_user_day_idx",
      ),
    );
    assert.deepEqual(config.checks.map((check) => check.name).sort(), [
      "price_refresh_attempts_attempt_number_check",
      "price_refresh_attempts_worker_check",
    ]);
  });

  it("cascades attempts only with their exact internal owner", () => {
    const config = getTableConfig(priceRefreshAttemptsTable);
    assert.deepEqual(
      config.foreignKeys.map((foreignKey) => {
        const reference = foreignKey.reference();
        return {
          columns: reference.columns.map((column) => column.name),
          foreignTable: getTableConfig(reference.foreignTable).name,
          foreignColumns: reference.foreignColumns.map(
            (column) => column.name,
          ),
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
  });

  it("defines an additive and idempotent reviewed migration", () => {
    assert.match(
      migrationSql,
      /CREATE TYPE price_refresh_attempt_status AS ENUM \('running', 'fresh', 'partial', 'failed'\)/i,
    );
    assert.match(
      migrationSql,
      /EXCEPTION WHEN duplicate_object THEN NULL/i,
    );
    assert.match(
      migrationSql,
      /CREATE TABLE IF NOT EXISTS price_refresh_leases/i,
    );
    assert.match(
      migrationSql,
      /CREATE TABLE IF NOT EXISTS price_refresh_attempts/i,
    );
    assert.match(
      migrationSql,
      /UNIQUE \(user_id, local_day, attempt_number\)/i,
    );
    assert.match(
      migrationSql,
      /attempt_number BETWEEN 1 AND 3/i,
    );
    assert.match(
      migrationSql,
      /FOREIGN KEY \(user_id\) REFERENCES users\(id\) ON DELETE CASCADE/i,
    );
    assert.doesNotMatch(
      migrationSql,
      /\bDROP\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bUPDATE\s+\w+\s+SET\b/i,
    );
  });
});
