import assert from "node:assert/strict";
import test from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";

import { buildRequeueExpiredJobsStatement } from "./researchAutomationRepository";

test("expired-job recovery emits a timestamptz completed-at value", () => {
  const query = new PgDialect().sqlToQuery(
    buildRequeueExpiredJobsStatement(new Date("2026-08-20T10:00:00.000Z")),
  );

  assert.match(
    query.sql,
    /"completed_at"\s*=\s*case[\s\S]*then \$\d+::timestamptz[\s\S]*else null end/,
  );
});
