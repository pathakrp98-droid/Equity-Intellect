import { Router, type Request, type Response } from "express";

import {
  marketIntelligenceService,
  type UpdateMarketPreferencesInput,
} from "../services/intelligence/marketIntelligenceService";
import type { MarketImportPayload } from "../services/intelligence/types";

const router = Router();

type AuthenticatedHandler = (
  req: Request,
  res: Response,
  userId: string,
) => Promise<void>;

function authenticated(handler: AuthenticatedHandler) {
  return async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Sign in to use Market Intelligence" });
      return;
    }
    try {
      await handler(req, res, req.user.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      const status = /required|invalid|must|unsupported|cannot|timezone/i.test(message)
        ? 400
        : /not found/i.test(message)
          ? 404
          : 500;
      res.status(status).json({ error: message });
    }
  };
}

function numberQuery(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanQuery(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === true;
}

function parseImportPayload(req: Request): MarketImportPayload {
  const raw = (req.body ?? {}) as Record<string, unknown>;
  if (typeof raw.json === "string") {
    try {
      return JSON.parse(raw.json) as MarketImportPayload;
    } catch {
      throw new Error("json must contain valid JSON");
    }
  }
  return raw as unknown as MarketImportPayload;
}

router.get(
  "/brief/latest",
  authenticated(async (req, res, userId) => {
    res.json(
      await marketIntelligenceService.getLatestBrief(
        userId,
        booleanQuery(req.query.autoGenerate, true),
      ),
    );
  }),
);

router.post(
  "/brief/generate",
  authenticated(async (_req, res, userId) => {
    res.status(201).json(await marketIntelligenceService.generateBrief(userId));
  }),
);

router.get(
  "/brief/history",
  authenticated(async (req, res, userId) => {
    res.json(
      await marketIntelligenceService.getBriefHistory(
        userId,
        numberQuery(req.query.limit, 30),
      ),
    );
  }),
);

router.get(
  "/snapshot",
  authenticated(async (_req, res, userId) => {
    res.json(await marketIntelligenceService.getSnapshot(userId));
  }),
);

router.get(
  "/news",
  authenticated(async (req, res, userId) => {
    res.json(
      await marketIntelligenceService.getNews(userId, {
        portfolioOnly: booleanQuery(req.query.portfolioOnly, true),
        days: numberQuery(req.query.days, 7),
        limit: numberQuery(req.query.limit, 50),
      }),
    );
  }),
);

router.get(
  "/calendar",
  authenticated(async (req, res, userId) => {
    res.json(
      await marketIntelligenceService.getCalendar(userId, {
        portfolioOnly: booleanQuery(req.query.portfolioOnly, true),
        days: numberQuery(req.query.days, 30),
      }),
    );
  }),
);

router.get(
  "/preferences",
  authenticated(async (_req, res, userId) => {
    res.json(await marketIntelligenceService.getPreferences(userId));
  }),
);

router.put(
  "/preferences",
  authenticated(async (req, res, userId) => {
    res.json(
      await marketIntelligenceService.updatePreferences(
        userId,
        (req.body ?? {}) as UpdateMarketPreferencesInput,
      ),
    );
  }),
);

router.get(
  "/providers/status",
  authenticated(async (_req, res, userId) => {
    res.json(await marketIntelligenceService.getProviderStatus(userId));
  }),
);

router.post(
  "/refresh",
  authenticated(async (_req, res, userId) => {
    res.json(await marketIntelligenceService.refresh(userId));
  }),
);

router.post(
  "/import",
  authenticated(async (req, res, userId) => {
    res.status(201).json(
      await marketIntelligenceService.importNormalizedData(
        userId,
        parseImportPayload(req),
      ),
    );
  }),
);

export default router;
