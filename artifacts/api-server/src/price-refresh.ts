import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { logger } from "./lib/logger";
import type { PriceRefreshBatchSummary } from "./services/liveData/priceRefreshScheduler";

export interface PriceRefreshCommandConfig {
  concurrency: number;
  globalLeaseMs: number;
  userLeaseMs: number;
}

export interface PriceRefreshCommandDependencies {
  runBatch(
    options: PriceRefreshCommandConfig & { workerId: string },
  ): Promise<PriceRefreshBatchSummary>;
  closePool(): Promise<void>;
  logCompleted(summary: PriceRefreshBatchSummary): void;
  logFatal(errorCode: "scheduler_unavailable"): void;
}

function configuredInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

export function loadPriceRefreshCommandConfig(
  env: NodeJS.ProcessEnv,
): PriceRefreshCommandConfig {
  return {
    concurrency: configuredInteger(
      env,
      "PRICE_REFRESH_CONCURRENCY",
      2,
      1,
      10,
    ),
    globalLeaseMs: configuredInteger(
      env,
      "PRICE_REFRESH_GLOBAL_LEASE_MS",
      10 * 60_000,
      30_000,
      60 * 60_000,
    ),
    userLeaseMs: configuredInteger(
      env,
      "PRICE_REFRESH_USER_LEASE_MS",
      10 * 60_000,
      30_000,
      60 * 60_000,
    ),
  };
}

export async function executePriceRefreshCommand(
  input: { env: NodeJS.ProcessEnv; workerId: string },
  dependencies: PriceRefreshCommandDependencies,
): Promise<{ exitCode: 0; summary: PriceRefreshBatchSummary } | { exitCode: 1; summary: null }> {
  try {
    const summary = await dependencies.runBatch({
      workerId: input.workerId,
      ...loadPriceRefreshCommandConfig(input.env),
    });
    dependencies.logCompleted(summary);
    return { exitCode: 0, summary };
  } catch {
    dependencies.logFatal("scheduler_unavailable");
    return { exitCode: 1, summary: null };
  } finally {
    await dependencies.closePool();
  }
}

async function main() {
  process.env.AI_REQUESTS_ENABLED = "false";
  const [database, runtime, scheduler] = await Promise.all([
    import("@workspace/db"),
    import("./services/liveData/priceRefreshRuntime"),
    import("./services/liveData/priceRefreshScheduler"),
  ]);
  const refreshDependencies =
    runtime.createProductionPriceRefreshDependencies();
  const workerId = `${hostname()}:${process.pid}:${randomUUID()}`.slice(0, 120);
  const result = await executePriceRefreshCommand(
    { env: process.env, workerId },
    {
      runBatch: (options) =>
        scheduler.runPriceRefreshBatch(options, refreshDependencies),
      closePool: () => database.pool.end(),
      logCompleted: (summary) =>
        logger.info({ priceRefresh: summary }, "price refresh completed"),
      logFatal: (errorCode) =>
        logger.error({ errorCode }, "price refresh failed"),
    },
  );
  process.exitCode = result.exitCode;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  void main().catch(() => {
    logger.error(
      { errorCode: "scheduler_unavailable" },
      "price refresh failed",
    );
    process.exitCode = 1;
  });
}
