import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import { pool } from "@workspace/db";

import { logger } from "./lib/logger";
import { runResearchBatch } from "./services/research/automation/researchWorker";
import { createProductionResearchWorkerDependencies } from "./services/research/automation/researchWorkerRuntime";

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
  const workerId = `${hostname()}:${process.pid}:${randomUUID()}`.slice(0, 120);
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
}

main()
  .catch((error) => {
    logger.error(
      { errorCode: "scheduler_unavailable" },
      "research worker failed",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
