import { Router, type Request, type Response } from "express";

import {
  alertService,
  type CreateAlertRuleInput,
  type UpdateAlertPreferencesInput,
} from "../services/alerts/alertService";
import type { AlertSeverity } from "../services/alerts/alertEngine";

const router = Router();

type AuthenticatedHandler = (
  req: Request,
  res: Response,
  userId: string,
) => Promise<void>;

function authenticated(handler: AuthenticatedHandler) {
  return async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Sign in to use alerts" });
      return;
    }
    try {
      await handler(req, res, req.user.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      const status = /required|invalid|unsupported|must|cannot|numeric|threshold|keyword/i.test(
        message,
      )
        ? 400
        : /not found/i.test(message)
          ? 404
          : 500;
      res.status(status).json({ error: message });
    }
  };
}

function idParam(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("id must be a positive integer");
  }
  return parsed;
}

router.get(
  "/",
  authenticated(async (req, res, userId) => {
    res.json(
      await alertService.listAlerts(userId, {
        status: (req.query.status as
          | "active"
          | "acknowledged"
          | "dismissed"
          | "resolved"
          | "all"
          | undefined) ?? "active",
        severity: req.query.severity as AlertSeverity | undefined,
        ticker: typeof req.query.ticker === "string" ? req.query.ticker : undefined,
        limit: Number(req.query.limit ?? 200),
      }),
    );
  }),
);

router.get(
  "/summary",
  authenticated(async (_req, res, userId) => {
    res.json(await alertService.getSummary(userId));
  }),
);

router.post(
  "/evaluate",
  authenticated(async (_req, res, userId) => {
    res.json(await alertService.evaluate(userId));
  }),
);

router.get(
  "/settings",
  authenticated(async (_req, res, userId) => {
    res.json(await alertService.getPreferences(userId));
  }),
);

router.put(
  "/settings",
  authenticated(async (req, res, userId) => {
    res.json(
      await alertService.updatePreferences(
        userId,
        (req.body ?? {}) as UpdateAlertPreferencesInput,
      ),
    );
  }),
);

router.get(
  "/rules",
  authenticated(async (_req, res, userId) => {
    res.json(await alertService.listRules(userId));
  }),
);

router.post(
  "/rules",
  authenticated(async (req, res, userId) => {
    res.status(201).json(
      await alertService.createRule(
        userId,
        (req.body ?? {}) as CreateAlertRuleInput,
      ),
    );
  }),
);

router.put(
  "/rules/:id",
  authenticated(async (req, res, userId) => {
    res.json(
      await alertService.updateRule(
        userId,
        idParam(req.params.id),
        (req.body ?? {}) as Partial<CreateAlertRuleInput>,
      ),
    );
  }),
);

router.delete(
  "/rules/:id",
  authenticated(async (req, res, userId) => {
    res.json(await alertService.deleteRule(userId, idParam(req.params.id)));
  }),
);

router.post(
  "/:id/acknowledge",
  authenticated(async (req, res, userId) => {
    res.json(await alertService.acknowledge(userId, idParam(req.params.id)));
  }),
);

router.post(
  "/:id/dismiss",
  authenticated(async (req, res, userId) => {
    res.json(await alertService.dismiss(userId, idParam(req.params.id)));
  }),
);

router.post(
  "/:id/reopen",
  authenticated(async (req, res, userId) => {
    res.json(await alertService.reopen(userId, idParam(req.params.id)));
  }),
);

router.post(
  "/:id/resolve",
  authenticated(async (req, res, userId) => {
    res.json(await alertService.resolve(userId, idParam(req.params.id)));
  }),
);

export default router;
