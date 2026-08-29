import assert from "node:assert/strict";
import test from "node:test";

import {
  aiRequestsEnabled,
  assertOpenAiAvailable,
  openAiAvailable,
} from "./aiPolicy";

test("AI policy: paid requests are disabled unless explicitly enabled", () => {
  for (const value of [undefined, "false", "TRUE", "1", " true "]) {
    assert.equal(
      aiRequestsEnabled({ AI_REQUESTS_ENABLED: value }),
      false,
      `expected ${String(value)} to remain disabled`,
    );
  }

  assert.equal(aiRequestsEnabled({ AI_REQUESTS_ENABLED: "true" }), true);
});

test("AI policy: OpenAI requires both the explicit switch and a nonblank key", () => {
  assert.equal(
    openAiAvailable({
      AI_REQUESTS_ENABLED: "false",
      OPENAI_API_KEY: "test-key",
    }),
    false,
  );
  assert.equal(
    openAiAvailable({ AI_REQUESTS_ENABLED: "true", OPENAI_API_KEY: "  " }),
    false,
  );
  assert.equal(
    openAiAvailable({
      AI_REQUESTS_ENABLED: "true",
      OPENAI_API_KEY: "test-key",
    }),
    true,
  );
});

test("AI policy: unavailable reasons fail closed in a predictable order", () => {
  assert.throws(
    () =>
      assertOpenAiAvailable({
        AI_REQUESTS_ENABLED: "false",
        OPENAI_API_KEY: "test-key",
      }),
    /Paid AI requests are disabled\./,
  );
  assert.throws(
    () => assertOpenAiAvailable({ AI_REQUESTS_ENABLED: "true" }),
    /OPENAI_API_KEY is not configured/,
  );
  assert.doesNotThrow(() =>
    assertOpenAiAvailable({
      AI_REQUESTS_ENABLED: "true",
      OPENAI_API_KEY: "test-key",
    }),
  );
});
