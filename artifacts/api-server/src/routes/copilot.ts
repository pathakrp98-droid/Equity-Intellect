import { Router, type Request, type Response } from "express";

import {
  copilotService,
  type AskCopilotInput,
  type CreateConversationInput,
  type CreateMemoryInput,
} from "../services/copilot/copilotService";
import {
  type CopilotMemoryCategory,
  type CopilotMode,
} from "../services/copilot/grounding";

const router = Router();

type AuthenticatedHandler = (
  req: Request,
  res: Response,
  userId: string,
) => Promise<void>;

function authenticated(handler: AuthenticatedHandler) {
  return async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Sign in to use AlphaDesk Copilot" });
      return;
    }
    try {
      await handler(req, res, req.user.id);
    } catch (error) {
      sendError(res, error);
    }
  };
}

function sendError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = /not found/i.test(message)
    ? 404
    : /required|invalid|must|fewer|characters|select at least/i.test(message)
      ? 400
      : 500;
  res.status(status).json({ error: message });
}

function body(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}

function requiredText(value: unknown, field: string): string {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${field} is required`);
  return result;
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return String(value).trim() || null;
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid boolean: ${String(value)}`);
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const result = Number(value);
  if (!Number.isFinite(result))
    throw new Error(`Invalid number: ${String(value)}`);
  return result;
}

function positiveId(value: unknown): number {
  const result = Number(value);
  if (!Number.isInteger(result) || result <= 0)
    throw new Error("id must be a positive integer");
  return result;
}

function stringArray(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  const items = Array.isArray(value) ? value : String(value).split(",");
  return items.map((item) => String(item).trim()).filter(Boolean).slice(0, 6);
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined) return undefined;
  const result = String(value) as T;
  if (!allowed.includes(result)) {
    throw new Error(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return result;
}

const MODES = [
  "general",
  "portfolio_review",
  "company_analysis",
  "thesis_challenge",
  "company_compare",
  "research_gap",
  "performance_explain",
] as const;

const MEMORY_CATEGORIES = [
  "preference",
  "instruction",
  "portfolio",
  "thesis",
  "risk",
  "research",
  "decision",
] as const;

function parseConversationInput(
  raw: Record<string, unknown>,
): CreateConversationInput {
  return {
    title: optionalText(raw.title) ?? undefined,
    mode: enumValue(raw.mode, MODES, "mode") as CopilotMode | undefined,
    primaryTicker: optionalText(raw.primaryTicker),
    comparisonTickers: stringArray(raw.comparisonTickers),
  };
}

function parseAskInput(raw: Record<string, unknown>): AskCopilotInput {
  return {
    conversationId:
      raw.conversationId === undefined
        ? undefined
        : positiveId(raw.conversationId),
    question: requiredText(raw.question, "question"),
    mode: enumValue(raw.mode, MODES, "mode") as CopilotMode | undefined,
    tickers: stringArray(raw.tickers),
    saveMemoryCandidates: optionalBoolean(raw.saveMemoryCandidates),
  };
}

function parseMemoryInput(raw: Record<string, unknown>): CreateMemoryInput {
  return {
    category: enumValue(
      raw.category,
      MEMORY_CATEGORIES,
      "category",
    ) as CopilotMemoryCategory,
    subject: requiredText(raw.subject, "subject"),
    content: requiredText(raw.content, "content"),
    confidence: optionalNumber(raw.confidence),
    isPinned: optionalBoolean(raw.isPinned),
    sourceConversationId:
      raw.sourceConversationId === undefined || raw.sourceConversationId === null
        ? null
        : positiveId(raw.sourceConversationId),
    sourceMessageId:
      raw.sourceMessageId === undefined || raw.sourceMessageId === null
        ? null
        : positiveId(raw.sourceMessageId),
  };
}

router.get(
  "/conversations",
  authenticated(async (req, res, userId) => {
    res.json(
      await copilotService.listConversations(
        userId,
        req.query.archived === "true",
      ),
    );
  }),
);

router.post(
  "/conversations",
  authenticated(async (req, res, userId) => {
    res
      .status(201)
      .json(
        await copilotService.createConversation(
          userId,
          parseConversationInput(body(req)),
        ),
      );
  }),
);

router.get(
  "/conversations/:id",
  authenticated(async (req, res, userId) => {
    res.json(
      await copilotService.getConversation(userId, positiveId(req.params.id)),
    );
  }),
);

router.patch(
  "/conversations/:id",
  authenticated(async (req, res, userId) => {
    const archived = optionalBoolean(body(req).isArchived);
    res.json(
      await copilotService.archiveConversation(
        userId,
        positiveId(req.params.id),
        archived ?? true,
      ),
    );
  }),
);

router.delete(
  "/conversations/:id",
  authenticated(async (req, res, userId) => {
    res.json(
      await copilotService.deleteConversation(userId, positiveId(req.params.id)),
    );
  }),
);

router.post(
  "/ask",
  authenticated(async (req, res, userId) => {
    res.json(await copilotService.ask(userId, parseAskInput(body(req))));
  }),
);

router.post(
  "/conversations/:id/messages",
  authenticated(async (req, res, userId) => {
    const input = parseAskInput(body(req));
    res.json(
      await copilotService.ask(userId, {
        ...input,
        conversationId: positiveId(req.params.id),
      }),
    );
  }),
);

router.post(
  "/context-preview",
  authenticated(async (req, res, userId) => {
    const raw = body(req);
    res.json(
      await copilotService.previewContext(
        userId,
        requiredText(raw.question, "question"),
        (enumValue(raw.mode, MODES, "mode") ?? "general") as CopilotMode,
        stringArray(raw.tickers),
      ),
    );
  }),
);

router.get(
  "/memories",
  authenticated(async (req, res, userId) => {
    res.json(
      await copilotService.listMemories(userId, req.query.archived === "true"),
    );
  }),
);

router.post(
  "/memories",
  authenticated(async (req, res, userId) => {
    res
      .status(201)
      .json(await copilotService.createMemory(userId, parseMemoryInput(body(req))));
  }),
);

router.patch(
  "/memories/:id",
  authenticated(async (req, res, userId) => {
    const raw = body(req);
    res.json(
      await copilotService.updateMemory(userId, positiveId(req.params.id), {
        category: enumValue(raw.category, MEMORY_CATEGORIES, "category") as
          | CopilotMemoryCategory
          | undefined,
        subject: optionalText(raw.subject) ?? undefined,
        content: optionalText(raw.content) ?? undefined,
        confidence: optionalNumber(raw.confidence),
        isPinned: optionalBoolean(raw.isPinned),
        isArchived: optionalBoolean(raw.isArchived),
      }),
    );
  }),
);

router.delete(
  "/memories/:id",
  authenticated(async (req, res, userId) => {
    res.json(await copilotService.deleteMemory(userId, positiveId(req.params.id)));
  }),
);

export default router;
