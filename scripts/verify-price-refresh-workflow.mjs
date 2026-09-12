import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function requireMatch(text, pattern, message) {
  if (!pattern.test(text)) throw new Error(message);
}

export function verifyPriceRefreshWorkflowText(text) {
  requireMatch(
    text,
    /\npermissions:\s*\n\s+contents:\s*read\s*\n/i,
    "Workflow permissions must be read-only for contents.",
  );
  if (/contents:\s*(?:write|admin)/i.test(text)) {
    throw new Error("Workflow permissions must be read-only.");
  }
  if (/\bpull_request(?:_target)?:/i.test(text)) {
    throw new Error("Pull request triggers must not receive scheduler secrets.");
  }
  requireMatch(
    text,
    /workflow_dispatch:/i,
    "The workflow must support an approved manual dispatch.",
  );
  requireMatch(
    text,
    /cron:\s*["']47 10 \* \* 1-5["']/i,
    "The workflow must use the reviewed weekday 10:47 UTC schedule.",
  );
  requireMatch(
    text,
    /github\.event_name\s*==\s*'workflow_dispatch'[\s\S]*vars\.ENABLE_PRICE_REFRESH_SCHEDULE\s*==\s*'true'/i,
    "Scheduled execution must be disabled until the repository variable is enabled.",
  );
  requireMatch(text, /\nconcurrency:\s*\n/i, "A concurrency guard is required.");
  requireMatch(text, /timeout-minutes:\s*10/i, "A ten-minute timeout is required.");

  const actions = [...text.matchAll(/uses:\s*([^\s#]+)/g)].map(
    (match) => match[1],
  );
  if (actions.length < 2 || actions.some((action) => !/@[a-f0-9]{40}$/i.test(action))) {
    throw new Error("Every external action must be pinned to a full commit SHA.");
  }
  requireMatch(
    text,
    /AI_REQUESTS_ENABLED:\s*["']false["']/i,
    "The workflow must keep AI disabled.",
  );
  if (/OPENAI_API_KEY|secrets\.OPENAI/i.test(text)) {
    throw new Error("The price workflow must not receive an OpenAI secret.");
  }
  const secrets = [...text.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(
    (match) => match[1],
  );
  if (
    secrets.length !== 1 ||
    secrets[0] !== "ALPHADESK_DATABASE_URL"
  ) {
    throw new Error("Only the AlphaDesk database secret is permitted.");
  }
  requireMatch(text, /@workspace\/db\s+migrate/i, "Reviewed migrations must run first.");
  requireMatch(text, /prices:run-once/i, "The finite price command is required.");
  if (/research:run-once|REPLIT|cron job/i.test(text)) {
    throw new Error("The price workflow must not depend on research, Replit, or paid cron.");
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const workflowPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.github/workflows/daily-price-refresh.yml",
  );
  verifyPriceRefreshWorkflowText(readFileSync(workflowPath, "utf8"));
  console.log("Daily price refresh workflow policy passed.");
}
