import { Router } from "express";

import { aiRequestsEnabled, openAiAvailable } from "../lib/aiPolicy";

type Environment = Record<string, string | undefined>;

export type AiCapabilityReason = "disabled" | "missing_key" | "available";

export function resolveAppCapabilities(environment: Environment = process.env) {
  const enabled = aiRequestsEnabled(environment);
  const available = openAiAvailable(environment);
  const reason: AiCapabilityReason = available
    ? "available"
    : enabled
      ? "missing_key"
      : "disabled";

  return { ai: { enabled, available, reason } };
}

export function createCapabilitiesRouter(
  environment: Environment = process.env,
) {
  const router = Router();
  router.get("/", (_req, res) => {
    res.json(resolveAppCapabilities(environment));
  });
  return router;
}
