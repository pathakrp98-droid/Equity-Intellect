import { Router, type Request, type Response } from "express";

import {
  journalService,
  type JournalEntryInput,
  type JournalReviewInput,
} from "../services/journal/journalService";

const router = Router();

function requireUser(req: Request, res: Response): string | null {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to use the Decision Journal" });
    return null;
  }
  return req.user.id;
}

function sendError(res: Response, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Journal request failed";
  const lower = message.toLowerCase();
  const status = lower.includes("not found")
    ? 404
    : lower.includes("required") ||
        lower.includes("invalid") ||
        lower.includes("unsupported") ||
        lower.includes("does not belong")
      ? 400
      : 500;
  res.status(status).json({ error: message });
}

function positiveInteger(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${label} is invalid`);
  return parsed;
}

router.get("/entries", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(
      await journalService.list(userId, {
        ticker:
          typeof req.query.ticker === "string" ? req.query.ticker : undefined,
        outcome:
          typeof req.query.outcome === "string" ? req.query.outcome : undefined,
        status:
          typeof req.query.status === "string" ? req.query.status : undefined,
        archived: req.query.archived === "true",
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/entries/:id", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(
      await journalService.get(
        userId,
        positiveInteger(req.params.id, "entry id"),
      ),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/entries", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res
      .status(201)
      .json(await journalService.create(userId, req.body as JournalEntryInput));
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/entries/from-guardian", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res
      .status(201)
      .json(
        await journalService.createFromGuardian(
          userId,
          String(req.body?.checkId ?? ""),
        ),
      );
  } catch (error) {
    sendError(res, error);
  }
});

router.patch("/entries/:id", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(
      await journalService.update(
        userId,
        positiveInteger(req.params.id, "entry id"),
        req.body as Partial<JournalEntryInput>,
      ),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/entries/:id/archive", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(
      await journalService.archive(
        userId,
        positiveInteger(req.params.id, "entry id"),
        req.body?.archived !== false,
      ),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/entries/:id/reviews", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res
      .status(201)
      .json(
        await journalService.scheduleReview(
          userId,
          positiveInteger(req.params.id, "entry id"),
          req.body as JournalReviewInput,
        ),
      );
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/reviews", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(
      await journalService.listReviews(userId, {
        status:
          typeof req.query.status === "string" ? req.query.status : undefined,
        dueBefore:
          typeof req.query.dueBefore === "string"
            ? req.query.dueBefore
            : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/reviews/:id/complete", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(
      await journalService.completeReview(
        userId,
        positiveInteger(req.params.id, "review id"),
        req.body as JournalReviewInput,
      ),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/reviews/:id/skip", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(
      await journalService.skipReview(
        userId,
        positiveInteger(req.params.id, "review id"),
        typeof req.body?.notes === "string" ? req.body.notes : undefined,
      ),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/analytics", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(
      await journalService.analytics(userId, req.query.snapshot === "true"),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/analytics/history", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(
      await journalService.analyticsHistory(
        userId,
        Number(req.query.limit ?? 30),
      ),
    );
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
