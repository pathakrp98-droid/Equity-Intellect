import { Router, type Request, type Response } from "express";

import type { SecurityType } from "@workspace/research-contracts";
import {
  ResearchRefreshCooldownError,
  type ResearchAutomationApiService,
  type ResearchIdentityCorrectionInput,
} from "../services/research/automation/researchAutomationApi";

export {
  ResearchRefreshCooldownError,
  type ResearchAutomationApiService,
  type ResearchIdentityCorrectionInput,
} from "../services/research/automation/researchAutomationApi";

class ResearchAutomationRequestError extends Error {}

type AuthenticatedHandler = (
  req: Request,
  res: Response,
  userId: string,
) => Promise<void>;

function normalizeTicker(value: unknown): string {
  const ticker = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!ticker || ticker.length > 30 || !/^[A-Z0-9._&-]+$/.test(ticker)) {
    throw new ResearchAutomationRequestError("ticker is invalid");
  }
  return ticker;
}

function requiredText(value: unknown, field: string, maximum: number): string {
  const text = String(value ?? "").trim();
  if (!text || text.length > maximum || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new ResearchAutomationRequestError(`${field} is invalid`);
  }
  return text;
}

function parseJobId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ResearchAutomationRequestError("job id is invalid");
  }
  return id;
}

function parseIdentity(req: Request): ResearchIdentityCorrectionInput {
  const value = (req.body ?? {}) as Record<string, unknown>;
  const securityType = String(value.securityType ?? "") as Exclude<
    SecurityType,
    "unknown"
  >;
  if (!["equity", "etf", "mutual_fund", "unlisted"].includes(securityType)) {
    throw new ResearchAutomationRequestError("securityType is invalid");
  }
  const rawIsin = String(value.isin ?? "")
    .trim()
    .toUpperCase();
  if (rawIsin && !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(rawIsin)) {
    throw new ResearchAutomationRequestError("isin is invalid");
  }
  return {
    ticker: normalizeTicker(value.ticker),
    exchange: requiredText(value.exchange, "exchange", 30).toUpperCase(),
    isin: rawIsin || null,
    name: requiredText(value.name, "name", 300),
    securityType,
  };
}

function authenticated(handler: AuthenticatedHandler) {
  return async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Sign in to use automated research" });
      return;
    }
    try {
      await handler(req, res, req.user.id);
    } catch (error) {
      if (error instanceof ResearchRefreshCooldownError) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil(error.retryAfterSeconds),
        );
        res.setHeader("Retry-After", String(retryAfterSeconds));
        res.status(429).json({
          error: "Research refresh is cooling down",
          retryAfterSeconds,
        });
        return;
      }
      if (error instanceof ResearchAutomationRequestError) {
        res.status(400).json({ error: error.message });
        return;
      }
      res
        .status(500)
        .json({ error: "Automated research is temporarily unavailable" });
    }
  };
}

export function createResearchAutomationRouter(
  service: ResearchAutomationApiService,
) {
  const router = Router();

  router.get(
    "/coverage",
    authenticated(async (_req, res, userId) => {
      res.json({ coverage: await service.listCoverage(userId) });
    }),
  );

  router.get(
    "/companies/:ticker/history",
    authenticated(async (req, res, userId) => {
      const ticker = normalizeTicker(req.params.ticker);
      const history = await service.listHistory(userId, ticker);
      if (!history) {
        res.status(404).json({ error: "Research company not found" });
        return;
      }
      res.json({ history });
    }),
  );

  router.post(
    "/companies/:ticker/refresh",
    authenticated(async (req, res, userId) => {
      const result = await service.requestRefresh(
        userId,
        normalizeTicker(req.params.ticker),
      );
      if (!result) {
        res.status(404).json({ error: "Research company not found" });
        return;
      }
      res.status(202).json({ job: result });
    }),
  );

  router.patch(
    "/companies/:ticker/identity",
    authenticated(async (req, res, userId) => {
      const company = await service.correctIdentity(
        userId,
        normalizeTicker(req.params.ticker),
        parseIdentity(req),
      );
      if (!company) {
        res.status(404).json({ error: "Research company not found" });
        return;
      }
      res.json({ company });
    }),
  );

  router.get(
    "/companies/:ticker",
    authenticated(async (req, res, userId) => {
      const company = await service.getCompany(
        userId,
        normalizeTicker(req.params.ticker),
      );
      if (!company) {
        res.status(404).json({ error: "Research company not found" });
        return;
      }
      res.json({ company });
    }),
  );

  router.get(
    "/jobs/:id",
    authenticated(async (req, res, userId) => {
      const job = await service.getJob(userId, parseJobId(req.params.id));
      if (!job) {
        res.status(404).json({ error: "Research job not found" });
        return;
      }
      res.json({ job });
    }),
  );

  return router;
}
