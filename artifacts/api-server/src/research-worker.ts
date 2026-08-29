import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import { aiRequestsEnabled } from "./lib/aiPolicy";
import { logger } from "./lib/logger";

function configuredInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

async function main() {
  if (!aiRequestsEnabled()) {
    logger.info({ reason: "ai_requests_disabled" }, "research worker skipped");
    return;
  }

  const [
    { pool },
    { runResearchBatch },
    { createProductionResearchWorkerDependencies },
  ] = await Promise.all([
    import("@workspace/db"),
    import("./services/research/automation/researchWorker"),
    import("./services/research/automation/researchWorkerRuntime"),
  ]);

  try {
    const workerId = `${hostname()}:${process.pid}:${randomUUID()}`.slice(
      0,
      120,
    );
    const summary = await runResearchBatch(
      {
        workerId,
        maxEvents: configuredInteger("RESEARCH_MAX_EVENTS_PER_RUN", 50, 1, 250),
        maxJobs: configuredInteger("RESEARCH_MAX_JOBS_PER_RUN", 25, 1, 250),
        concurrency: configuredInteger("RESEARCH_MAX_CONCURRENCY", 2, 1, 10),
        leaseMs: configuredInteger(
          "RESEARCH_JOB_LEASE_MS",
          10 * 60_000,
          30_000,
          60 * 60_000,
        ),
      },
      createProductionResearchWorkerDependencies(),
    );
    logger.info({ researchBatch: summary }, "research worker completed");
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  logger.error(
    { errorCode: "scheduler_unavailable" },
    "research worker failed",
  );
  process.exitCode = 1;
});
