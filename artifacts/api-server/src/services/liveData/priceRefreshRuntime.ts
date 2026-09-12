import { pool } from "@workspace/db";

import { alertService } from "../alerts/alertService";
import { liveDataService } from "./liveDataService";
import {
  PriceRefreshRepository,
  type PriceRefreshQueryAdapter,
} from "./priceRefreshRepository";
import type { PriceRefreshSchedulerDependencies } from "./priceRefreshScheduler";

const queryAdapter: PriceRefreshQueryAdapter = {
  async query(text, values = []) {
    const result = await pool.query(text, values);
    return {
      rows: result.rows as Array<Record<string, unknown>>,
      rowCount: result.rowCount,
    };
  },
};

const repository = new PriceRefreshRepository(queryAdapter);

export function createProductionPriceRefreshDependencies(): PriceRefreshSchedulerDependencies {
  return {
    now: () => new Date(),
    acquireLease: (input) => repository.acquirePriceRefreshLease(input),
    releaseLease: (input) => repository.releasePriceRefreshLease(input),
    claimAttempt: (input) =>
      repository.claimAutomaticPriceAttempt(input),
    completeAttempt: (input) =>
      repository.completeAutomaticPriceAttempt(input),
    listActiveUserIds: () => repository.listActivePortfolioUserIds(),
    refreshQuotes: async ({ userId, force }) => {
      const result = await liveDataService.refreshQuotes(userId, { force });
      return {
        refreshedAt: result.refreshedAt,
        expectedSymbols: result.expectedSymbols,
        receivedSymbols: result.receivedSymbols,
        diagnostics: result.diagnostics,
        autoEvaluateAlerts: result.preferences.autoEvaluateAlerts,
      };
    },
    evaluateAlerts: async ({ userId }) => {
      const result = await alertService.evaluate(userId);
      return {
        evaluatedAt: result.evaluatedAt,
        candidates: result.candidates,
        alertsUpserted: result.alertsUpserted,
      };
    },
  };
}
