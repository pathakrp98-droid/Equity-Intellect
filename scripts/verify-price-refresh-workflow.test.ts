import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { verifyPriceRefreshWorkflowText } from "./verify-price-refresh-workflow.mjs";

const workflow = readFileSync(
  new URL("../.github/workflows/daily-price-refresh.yml", import.meta.url),
  "utf8",
);

describe("daily price refresh workflow policy", () => {
  it("accepts the reviewed disabled-by-default workflow", () => {
    assert.doesNotThrow(() => verifyPriceRefreshWorkflowText(workflow));
  });

  for (const scenario of [
    {
      name: "write repository permissions",
      mutate: (text: string) => text.replace("contents: read", "contents: write"),
      pattern: /read-only/i,
    },
    {
      name: "an unpinned action",
      mutate: (text: string) =>
        text.replace(
          /actions\/checkout@[a-f0-9]{40}/,
          "actions/checkout@v7",
        ),
      pattern: /pinned/i,
    },
    {
      name: "a pull-request trigger",
      mutate: (text: string) => text.replace("  schedule:", "  pull_request:\n  schedule:"),
      pattern: /pull request/i,
    },
    {
      name: "a missing enable gate",
      mutate: (text: string) =>
        text.replace("vars.ENABLE_PRICE_REFRESH_SCHEDULE == 'true'", "true"),
      pattern: /disabled/i,
    },
    {
      name: "the wrong cron",
      mutate: (text: string) => text.replace("47 10 * * 1-5", "0 * * * *"),
      pattern: /weekday/i,
    },
    {
      name: "no job timeout",
      mutate: (text: string) => text.replace(/\n\s+timeout-minutes: 10/, ""),
      pattern: /timeout/i,
    },
    {
      name: "no concurrency guard",
      mutate: (text: string) =>
        text.replace(/\nconcurrency:[\s\S]*?\njobs:/, "\njobs:"),
      pattern: /concurrency/i,
    },
    {
      name: "paid AI enablement",
      mutate: (text: string) =>
        text.replace('AI_REQUESTS_ENABLED: "false"', 'AI_REQUESTS_ENABLED: "true"'),
      pattern: /AI disabled/i,
    },
    {
      name: "an OpenAI secret",
      mutate: (text: string) =>
        text.replace(
          "DATABASE_URL:",
          "OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}\n      DATABASE_URL:",
        ),
      pattern: /OpenAI/i,
    },
  ]) {
    it(`rejects ${scenario.name}`, () => {
      assert.throws(
        () => verifyPriceRefreshWorkflowText(scenario.mutate(workflow)),
        scenario.pattern,
      );
    });
  }
});
