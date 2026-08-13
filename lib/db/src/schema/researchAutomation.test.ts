import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getTableConfig } from "drizzle-orm/pg-core";

import * as schema from "./index";

function tableConfig(name: keyof typeof schema) {
  const table = schema[name];
  assert.ok(table, `${name} must be exported from the DB schema`);
  return getTableConfig(table as Parameters<typeof getTableConfig>[0]);
}

function columnNames(name: keyof typeof schema) {
  return tableConfig(name).columns.map((column) => column.name);
}

function indexNames(name: keyof typeof schema) {
  return tableConfig(name).indexes.map((entry) => entry.config.name);
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
    assert.deepEqual(
      new Set(indexNames("researchCoverageTargetsTable")),
      new Set([
        "research_coverage_targets_user_portfolio_ticker_uidx",
        "research_coverage_targets_active_user_company_idx",
      ]),
    );
    assert.deepEqual(
      new Set(indexNames("researchAutomationTriggerEventsTable")),
      new Set([
        "research_automation_trigger_events_user_dedupe_uidx",
        "research_automation_trigger_events_claim_idx",
      ]),
    );
    assert.deepEqual(
      new Set(indexNames("researchAutomationJobsTable")),
      new Set([
        "research_automation_jobs_user_idempotency_uidx",
        "research_automation_jobs_claim_idx",
      ]),
    );
    assert.deepEqual(
      new Set(indexNames("automatedResearchSnapshotsTable")),
      new Set([
        "automated_research_snapshots_job_uidx",
        "automated_research_snapshots_company_version_uidx",
        "automated_research_snapshots_company_content_hash_uidx",
      ]),
    );
    assert.deepEqual(
      new Set(indexNames("automatedResearchSourcesTable")),
      new Set(["automated_research_sources_snapshot_citation_uidx"]),
    );
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
});
