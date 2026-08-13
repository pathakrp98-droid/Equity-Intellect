import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { getTableConfig } from "drizzle-orm/pg-core";

import * as schema from "./index";

const migrationSql = readFileSync(
  new URL(
    "../../migrations/20260813_automated_research_engine.sql",
    import.meta.url,
  ),
  "utf8",
);

function tableConfig(name: keyof typeof schema) {
  const table = schema[name];
  assert.ok(table, `${name} must be exported from the DB schema`);
  return getTableConfig(table as Parameters<typeof getTableConfig>[0]);
}

function columnNames(name: keyof typeof schema) {
  return tableConfig(name).columns.map((column) => column.name);
}

function indexNames(name: keyof typeof schema) {
  return tableConfig(name)
    .indexes.map((entry) => entry.config.name)
    .filter((indexName): indexName is string => typeof indexName === "string");
}

function checkNames(name: keyof typeof schema) {
  return tableConfig(name).checks.map((entry) => entry.name);
}

function foreignKeySignatures(name: keyof typeof schema) {
  return tableConfig(name).foreignKeys.map((foreignKey) => {
    const reference = foreignKey.reference();
    const foreignTable = getTableConfig(reference.foreignTable).name;
    const localColumns = reference.columns
      .map((column) => column.name)
      .join(",");
    const foreignColumns = reference.foreignColumns
      .map((column) => column.name)
      .join(",");
    return `${localColumns}->${foreignTable}(${foreignColumns}):${foreignKey.onDelete ?? "no action"}`;
  });
}

function assertIncludesAll(actual: string[], expected: string[]) {
  for (const value of expected) {
    assert.ok(
      actual.includes(value),
      `Expected ${value} in ${actual.join(", ")}`,
    );
  }
}

function sqlEnumValues(name: string) {
  const match = migrationSql.match(
    new RegExp(`CREATE TYPE ${name} AS ENUM \\(([\\s\\S]*?)\\);`),
  );
  assert.ok(match, `Migration must create ${name}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

describe("automated research persistence schema", () => {
  it("adds backward-compatible company identity fields", () => {
    const companyColumns = columnNames("researchCompaniesTable");

    assert.ok(companyColumns.includes("isin"));
    assert.ok(companyColumns.includes("normalized_identity_key"));
    assert.ok(companyColumns.includes("security_type"));
    assert.ok(companyColumns.includes("identity_status"));
    assert.ok(companyColumns.includes("identity_confidence"));
    assert.ok(companyColumns.includes("automation_enabled"));
    assert.ok(
      indexNames("researchCompaniesTable").includes(
        "research_companies_user_ticker_uidx",
      ),
    );
  });

  it("defines durable coverage, outbox, jobs, snapshots, and sources", () => {
    const preferencesColumns = columnNames(
      "researchAutomationPreferencesTable",
    );
    const targetColumns = columnNames("researchCoverageTargetsTable");
    const eventColumns = columnNames("researchAutomationTriggerEventsTable");
    const jobColumns = columnNames("researchAutomationJobsTable");
    const snapshotColumns = columnNames("automatedResearchSnapshotsTable");
    const sourceColumns = columnNames("automatedResearchSourcesTable");

    assert.ok(preferencesColumns.includes("next_daily_run_at"));
    assert.ok(targetColumns.includes("holding_fingerprint"));
    assert.ok(eventColumns.includes("dedupe_key"));
    assert.ok(jobColumns.includes("idempotency_key"));
    assert.ok(jobColumns.includes("lease_expires_at"));
    assert.ok(snapshotColumns.includes("payload"));
    assert.ok(sourceColumns.includes("citation_key"));
  });

  it("exposes the required queue and immutable-history indexes", () => {
    assertIncludesAll(indexNames("researchCoverageTargetsTable"), [
      "research_coverage_targets_user_portfolio_ticker_uidx",
      "research_coverage_targets_active_user_company_idx",
    ]);
    assertIncludesAll(indexNames("researchAutomationTriggerEventsTable"), [
      "research_automation_trigger_events_user_dedupe_uidx",
      "research_automation_trigger_events_claim_idx",
    ]);
    assertIncludesAll(indexNames("researchAutomationJobsTable"), [
      "research_automation_jobs_user_idempotency_uidx",
      "research_automation_jobs_claim_idx",
    ]);
    assertIncludesAll(indexNames("automatedResearchSnapshotsTable"), [
      "automated_research_snapshots_job_uidx",
      "automated_research_snapshots_company_version_uidx",
      "automated_research_snapshots_company_content_hash_uidx",
    ]);
    assertIncludesAll(indexNames("automatedResearchSourcesTable"), [
      "automated_research_sources_snapshot_citation_uidx",
    ]);
  });

  it("keeps snapshots append-only without a circular job result link", () => {
    assert.ok(
      !columnNames("automatedResearchSnapshotsTable").includes("is_current"),
    );
    assert.ok(
      !columnNames("researchAutomationJobsTable").includes(
        "result_snapshot_id",
      ),
    );
  });

  it("enforces tenant ownership through composite foreign keys", () => {
    assertIncludesAll(foreignKeySignatures("researchAutomationJobsTable"), [
      "trigger_event_id->research_automation_trigger_events(id):set null",
      "company_id,user_id->research_companies(id,user_id):cascade",
      "trigger_event_id,user_id->research_automation_trigger_events(id,user_id):no action",
    ]);
    assertIncludesAll(foreignKeySignatures("automatedResearchSnapshotsTable"), [
      "job_id->research_automation_jobs(id):restrict",
      "job_id,user_id,company_id->research_automation_jobs(id,user_id,company_id):restrict",
    ]);
    assertIncludesAll(foreignKeySignatures("automatedResearchSourcesTable"), [
      "snapshot_id->automated_research_snapshots(id):cascade",
      "snapshot_id,user_id,company_id->automated_research_snapshots(id,user_id,company_id):cascade",
    ]);

    assertIncludesAll(indexNames("researchCompaniesTable"), [
      "research_companies_id_user_uidx",
    ]);
    assertIncludesAll(indexNames("researchAutomationTriggerEventsTable"), [
      "research_automation_trigger_events_id_user_uidx",
    ]);
    assertIncludesAll(indexNames("researchAutomationJobsTable"), [
      "research_automation_jobs_id_user_company_uidx",
    ]);
    assertIncludesAll(indexNames("automatedResearchSnapshotsTable"), [
      "automated_research_snapshots_id_user_company_uidx",
    ]);

    for (const name of [
      "research_companies_id_user_uidx",
      "research_automation_trigger_events_id_user_uidx",
      "research_automation_jobs_id_user_company_uidx",
      "automated_research_snapshots_id_user_company_uidx",
    ]) {
      assert.match(
        migrationSql,
        new RegExp(`CREATE UNIQUE INDEX IF NOT EXISTS ${name}`),
      );
    }

    assert.match(
      migrationSql,
      /CONSTRAINT research_automation_jobs_company_user_fk\s+FOREIGN KEY \(company_id, user_id\)\s+REFERENCES research_companies\(id, user_id\) ON DELETE CASCADE/,
    );
    assert.match(
      migrationSql,
      /CONSTRAINT research_automation_jobs_trigger_user_fk\s+FOREIGN KEY \(trigger_event_id, user_id\)\s+REFERENCES research_automation_trigger_events\(id, user_id\)/,
    );
    assert.match(
      migrationSql,
      /CONSTRAINT automated_research_snapshots_job_user_company_fk\s+FOREIGN KEY \(job_id, user_id, company_id\)\s+REFERENCES research_automation_jobs\(id, user_id, company_id\) ON DELETE RESTRICT/,
    );
    assert.match(
      migrationSql,
      /CONSTRAINT automated_research_sources_snapshot_user_company_fk\s+FOREIGN KEY \(snapshot_id, user_id, company_id\)\s+REFERENCES automated_research_snapshots\(id, user_id, company_id\) ON DELETE CASCADE/,
    );
  });

  it("hashes every normalized identity row in stable order without volatile values", () => {
    const components = [
      ...migrationSql.matchAll(
        /concat_ws\(\s*'\|',([\s\S]*?)\)\s+AS identity_component/g,
      ),
    ];
    assert.equal(
      components.length,
      2,
      "Both holding sources must contribute identity rows",
    );

    for (const [, component] of components) {
      assert.match(component, /ticker|symbol/);
      assert.match(component, /name/);
      assert.match(component, /exchange/);
      assert.match(component, /sector/);
      assert.match(component, /isin/);
      assert.doesNotMatch(
        component,
        /quantity|average_cost|market_value|previous_close|price|pnl|allocation/i,
      );
    }

    assert.match(
      migrationSql,
      /md5\(string_agg\(identity_component, E'\\n' ORDER BY identity_component\)\) AS fingerprint/,
    );
    assert.doesNotMatch(migrationSql, /max\(fingerprint\) AS fingerprint/);
  });

  it("keeps enum values, defaults, and checks aligned with the migration", () => {
    const expectedSecurityTypes = [
      "equity",
      "etf",
      "mutual_fund",
      "unlisted",
      "unknown",
    ];
    const expectedIdentityStatuses = ["resolved", "needs_identity"];
    const expectedTriggers = [
      "holding_added",
      "holding_changed",
      "portfolio_reconciled",
      "scheduled_refresh",
      "material_event",
      "manual_refresh",
    ];
    const expectedStatuses = [
      "queued",
      "running",
      "succeeded",
      "partial",
      "failed",
      "dead_letter",
      "cancelled",
      "skipped",
    ];
    const expectedEvidenceStrengths = ["strong", "moderate", "limited"];
    const expectedEvidenceAuthorities = ["primary", "secondary", "excluded"];
    assert.deepEqual(
      schema.researchSecurityTypeEnum.enumValues,
      expectedSecurityTypes,
    );
    assert.deepEqual(
      sqlEnumValues("research_security_type"),
      expectedSecurityTypes,
    );
    assert.deepEqual(
      schema.researchIdentityStatusEnum.enumValues,
      expectedIdentityStatuses,
    );
    assert.deepEqual(
      sqlEnumValues("research_identity_status"),
      expectedIdentityStatuses,
    );
    assert.deepEqual(
      schema.researchAutomationTriggerEnum.enumValues,
      expectedTriggers,
    );
    assert.deepEqual(
      sqlEnumValues("research_automation_trigger"),
      expectedTriggers,
    );
    assert.deepEqual(
      schema.researchAutomationStatusEnum.enumValues,
      expectedStatuses,
    );
    assert.deepEqual(
      sqlEnumValues("research_automation_status"),
      expectedStatuses,
    );
    assert.deepEqual(
      schema.researchEvidenceStrengthEnum.enumValues,
      expectedEvidenceStrengths,
    );
    assert.deepEqual(
      sqlEnumValues("research_evidence_strength"),
      expectedEvidenceStrengths,
    );
    assert.deepEqual(
      schema.researchEvidenceAuthorityEnum.enumValues,
      expectedEvidenceAuthorities,
    );
    assert.deepEqual(
      sqlEnumValues("research_evidence_authority"),
      expectedEvidenceAuthorities,
    );

    const preferences = tableConfig("researchAutomationPreferencesTable");
    const defaults = Object.fromEntries(
      preferences.columns.map((column) => [column.name, column.default]),
    );
    assert.equal(defaults.timezone, "Asia/Kolkata");
    assert.equal(defaults.daily_hour, 6);
    assert.equal(defaults.minimum_refresh_interval_minutes, 240);
    assert.equal(defaults.max_assets_per_daily_run, 25);
    assert.match(
      migrationSql,
      /timezone varchar\(80\) NOT NULL DEFAULT 'Asia\/Kolkata'/,
    );
    assert.match(migrationSql, /daily_hour integer NOT NULL DEFAULT 6/);
    assert.match(
      migrationSql,
      /minimum_refresh_interval_minutes integer NOT NULL DEFAULT 240/,
    );
    assert.match(
      migrationSql,
      /max_assets_per_daily_run integer NOT NULL DEFAULT 25/,
    );

    const companyDefaults = Object.fromEntries(
      tableConfig("researchCompaniesTable").columns.map((column) => [
        column.name,
        column.default,
      ]),
    );
    assert.equal(companyDefaults.security_type, "unknown");
    assert.equal(companyDefaults.identity_status, "needs_identity");
    assert.equal(companyDefaults.identity_confidence, 0);
    assert.equal(companyDefaults.automation_enabled, true);
    assert.match(
      migrationSql,
      /security_type research_security_type NOT NULL DEFAULT 'unknown'/,
    );
    assert.match(
      migrationSql,
      /identity_status research_identity_status NOT NULL DEFAULT 'needs_identity'/,
    );
    assert.match(
      migrationSql,
      /identity_confidence double precision NOT NULL DEFAULT 0/,
    );
    assert.match(
      migrationSql,
      /automation_enabled boolean NOT NULL DEFAULT true/,
    );

    const jobDefaults = Object.fromEntries(
      tableConfig("researchAutomationJobsTable").columns.map((column) => [
        column.name,
        column.default,
      ]),
    );
    assert.equal(jobDefaults.status, "queued");
    assert.equal(jobDefaults.attempts, 0);
    assert.equal(jobDefaults.max_attempts, 5);
    assert.match(
      migrationSql,
      /status research_automation_status NOT NULL DEFAULT 'queued'/,
    );
    assert.match(migrationSql, /attempts integer NOT NULL DEFAULT 0/);
    assert.match(migrationSql, /max_attempts integer NOT NULL DEFAULT 5/);

    const requiredChecks = [
      "research_automation_preferences_daily_hour_check",
      "research_automation_preferences_interval_check",
      "research_automation_preferences_asset_cap_check",
    ];
    assertIncludesAll(
      checkNames("researchAutomationPreferencesTable"),
      requiredChecks,
    );
    for (const name of requiredChecks) {
      assert.match(migrationSql, new RegExp(`CONSTRAINT ${name} CHECK`));
    }

    const tableChecks: Array<[keyof typeof schema, string[]]> = [
      [
        "researchCoverageTargetsTable",
        ["research_coverage_targets_normalized_ticker_check"],
      ],
      [
        "researchAutomationTriggerEventsTable",
        ["research_automation_trigger_events_attempts_check"],
      ],
      [
        "researchAutomationJobsTable",
        ["research_automation_jobs_attempts_check"],
      ],
      [
        "automatedResearchSnapshotsTable",
        [
          "automated_research_snapshots_version_check",
          "automated_research_snapshots_freshness_check",
          "automated_research_snapshots_counts_check",
          "automated_research_snapshots_usage_check",
        ],
      ],
      [
        "automatedResearchSourcesTable",
        [
          "automated_research_sources_https_url_check",
          "automated_research_sources_summary_length_check",
        ],
      ],
    ];
    for (const [table, expectedChecks] of tableChecks) {
      assertIncludesAll(checkNames(table), expectedChecks);
      for (const name of expectedChecks) {
        assert.match(migrationSql, new RegExp(`CONSTRAINT ${name} CHECK`));
      }
    }
  });
});

describe("reviewed migration runner", () => {
  it("preserves the primary migration error when rollback and cleanup also fail", async () => {
    const runnerUrl = new URL("../../scripts/migrate.mjs", import.meta.url)
      .href;
    const runner = await import(runnerUrl).catch(() => ({}));
    assert.equal(typeof runner.runMigrations, "function");

    const primaryError = new Error("migration failed");
    const client = {
      async connect() {},
      async query(statement: string) {
        if (statement === "select broken") throw primaryError;
        if (statement === "rollback") throw new Error("rollback failed");
        if (statement.startsWith("select pg_advisory_unlock")) {
          throw new Error("unlock failed");
        }
        if (statement.startsWith("select checksum")) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 1, rows: [] };
      },
      async end() {
        throw new Error("close failed");
      },
    };

    await assert.rejects(
      runner.runMigrations({
        client,
        migrations: [{ filename: "001_broken.sql", sql: "select broken" }],
        logger: {
          log() {},
          error() {
            throw new Error("logging failed");
          },
        },
      }),
      (error: Error & { suppressedErrors?: Array<{ stage: string }> }) => {
        assert.equal(error, primaryError);
        assert.deepEqual(
          error.suppressedErrors?.map((entry) => entry.stage),
          ["rollback", "unlock", "close"],
        );
        return true;
      },
    );
  });

  it("commits the migration and ledger atomically before unlocking", async () => {
    const runnerUrl = new URL("../../scripts/migrate.mjs", import.meta.url)
      .href;
    const runner = await import(runnerUrl).catch(() => ({}));
    assert.equal(typeof runner.runMigrations, "function");
    const calls: string[] = [];
    const client = {
      async connect() {
        calls.push("connect");
      },
      async query(statement: string) {
        calls.push(statement);
        if (statement.startsWith("select checksum")) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 1, rows: [] };
      },
      async end() {
        calls.push("close");
      },
    };

    await runner.runMigrations({
      client,
      migrations: [{ filename: "001_ok.sql", sql: "select migration" }],
      logger: { log() {}, error() {} },
    });

    const migrationIndex = calls.indexOf("select migration");
    const ledgerIndex = calls.findIndex((call) =>
      call.startsWith("insert into research_schema_migrations"),
    );
    const commitIndex = calls.indexOf("commit");
    const unlockIndex = calls.findIndex((call) =>
      call.startsWith("select pg_advisory_unlock"),
    );
    assert.ok(migrationIndex < ledgerIndex);
    assert.ok(ledgerIndex < commitIndex);
    assert.ok(commitIndex < unlockIndex);
    assert.equal(calls.at(-1), "close");
  });
});
