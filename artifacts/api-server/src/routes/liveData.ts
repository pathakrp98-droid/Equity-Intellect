import { Router, type Request, type Response } from "express";

import { alertService } from "../services/alerts/alertService";
import {
  liveDataService,
  type UpdateLiveDataPreferencesInput,
  type UpsertSymbolMappingInput,
} from "../services/liveData/liveDataService";

const router = Router();

type AuthenticatedHandler = (
  req: Request,
  res: Response,
  userId: string,
) => Promise<void>;

function authenticated(handler: AuthenticatedHandler) {
  return async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Sign in to use live market data" });
      return;
    }
    try {
      await handler(req, res, req.user.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      const status = /required|invalid|unsupported|must|cannot|numeric/i.test(message)
        ? 400
        : /not found/i.test(message)
          ? 404
          : 500;
      res.status(status).json({ error: message });
    }
  };
}

function numberParam(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("id must be a positive integer");
  }
  return parsed;
}

router.get(
  "/status",
  authenticated(async (_req, res, userId) => {
    res.json(await liveDataService.getStatus(userId));
  }),
);

router.get(
  "/preferences",
  authenticated(async (_req, res, userId) => {
    res.json(await liveDataService.getPreferences(userId));
  }),
);

router.put(
  "/preferences",
  authenticated(async (req, res, userId) => {
    res.json(
      await liveDataService.updatePreferences(
        userId,
        (req.body ?? {}) as UpdateLiveDataPreferencesInput,
      ),
    );
  }),
);

router.get(
  "/mappings",
  authenticated(async (_req, res, userId) => {
    res.json(await liveDataService.listMappings(userId));
  }),
);

router.put(
  "/mappings",
  authenticated(async (req, res, userId) => {
    res.json(
      await liveDataService.upsertMapping(
        userId,
        (req.body ?? {}) as UpsertSymbolMappingInput,
      ),
    );
  }),
);

router.delete(
  "/mappings/:id",
  authenticated(async (req, res, userId) => {
    res.json(await liveDataService.deleteMapping(userId, numberParam(req.params.id)));
  }),
);

router.get(
  "/runs",
  authenticated(async (req, res, userId) => {
    const limit = Number(req.query.limit ?? 50);
    res.json(
      await liveDataService.listRuns(
        userId,
        Number.isFinite(limit) ? limit : 50,
      ),
    );
  }),
);

router.post(
  "/refresh",
  authenticated(async (req, res, userId) => {
    const force = Boolean((req.body as { force?: boolean } | undefined)?.force);
    const result = await liveDataService.refresh(userId, { force });
    const alertEvaluation = result.preferences.autoEvaluateAlerts
      ? await alertService.evaluate(userId)
      : null;
    res.json({ ...result, alertEvaluation });
  }),
);

router.post(
  "/cache/purge",
  authenticated(async (_req, res, userId) => {
    res.json(await liveDataService.purgeExpiredCache(userId));
  }),
);

export default router;
