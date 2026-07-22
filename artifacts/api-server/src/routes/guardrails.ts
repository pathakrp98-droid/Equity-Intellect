import { Router, type Request, type Response } from "express";

import { guardianService } from "../services/guardian/guardianService";
import type {
  GuardianAction,
  GuardianProposal,
} from "../services/guardian/guardianEngine";

const router = Router();

function requireUser(req: Request, res: Response): string | null {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to use Guardian Mode" });
    return null;
  }
  return req.user.id;
}

function sendError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Guardian request failed";
  const lower = message.toLowerCase();
  const status =
    lower.includes("not found") || lower.includes("unavailable")
      ? 404
      : lower.includes("required") ||
          lower.includes("invalid") ||
          lower.includes("expired") ||
          lower.includes("disabled")
        ? 400
        : 500;
  res.status(status).json({ error: message });
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("Numeric input is invalid");
  return number;
}

function proposalFromBody(body: Record<string, unknown>): GuardianProposal {
  const action = String(body.action ?? "review").toLowerCase() as GuardianAction;
  if (!["buy", "add", "sell", "trim", "exit", "hold", "review"].includes(action)) {
    throw new Error("Unsupported Guardian action");
  }
  const ticker = String(body.ticker ?? "").trim();
  if (!ticker) throw new Error("ticker is required");
  return {
    action,
    ticker,
    name: typeof body.name === "string" ? body.name : null,
    quantity: optionalNumber(body.quantity ?? body.suggestedQuantity),
    price: optionalNumber(body.price ?? body.suggestedPrice),
    fees: optionalNumber(body.fees),
    rationale: typeof body.rationale === "string" ? body.rationale : null,
    investmentHorizon:
      typeof body.investmentHorizon === "string"
        ? body.investmentHorizon
        : null,
    bearCase: typeof body.bearCase === "string" ? body.bearCase : null,
    targetPrice: optionalNumber(body.targetPrice),
    thesisInvalidation:
      typeof body.thesisInvalidation === "string"
        ? body.thesisInvalidation
        : null,
    maxAcceptableLossPct: optionalNumber(body.maxAcceptableLossPct),
    exitConditions:
      typeof body.exitConditions === "string" ? body.exitConditions : null,
    evidenceQuality:
      body.evidenceQuality === "high" ||
      body.evidenceQuality === "medium" ||
      body.evidenceQuality === "low"
        ? body.evidenceQuality
        : null,
    citedSourceIds: Array.isArray(body.citedSourceIds)
      ? body.citedSourceIds.map(String).slice(0, 50)
      : [],
  };
}

router.get("/settings", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(await guardianService.getSettings(userId));
  } catch (error) {
    sendError(res, error);
  }
});

router.put("/settings", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(await guardianService.updateSettings(userId, req.body ?? {}));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/context", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const ticker = typeof req.query.ticker === "string" ? req.query.ticker : undefined;
    res.json(await guardianService.getContext(userId, ticker));
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/check", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(await guardianService.check(userId, proposalFromBody(req.body ?? {})));
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/execute", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const body = req.body ?? {};
    res.json(
      await guardianService.execute(userId, {
        checkId: String(body.checkId ?? ""),
        userConfirmed: body.userConfirmed === true,
        overrideRationale:
          typeof body.overrideRationale === "string"
            ? body.overrideRationale
            : null,
      }),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/cancel", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(
      await guardianService.cancel(userId, String(req.body?.checkId ?? "")),
    );
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/decision-packets", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const limit = Number(req.query.limit ?? 100);
    res.json({
      entries: await guardianService.listDecisionPackets(userId, limit),
      isDemo: false,
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/audit-trail", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const limit = Number(req.query.limit ?? 100);
    res.json({
      entries: await guardianService.getAuditTrail(userId, limit),
      isDemo: false,
      message: null,
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/portfolio-health", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(await guardianService.getHealth(userId, true));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/health-history", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const limit = Number(req.query.limit ?? 30);
    res.json(await guardianService.getHealthHistory(userId, limit));
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
