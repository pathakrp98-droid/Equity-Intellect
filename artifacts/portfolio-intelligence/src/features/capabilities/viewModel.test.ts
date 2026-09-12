import assert from "node:assert/strict";
import test from "node:test";

import { aiAvailabilityCopy } from "./viewModel";

const DISABLED_MESSAGE = "AI generation is disabled on this deployment.";

test("capability copy fails closed while capabilities are absent", () => {
  assert.deepEqual(aiAvailabilityCopy(undefined), {
    available: false,
    refreshDisabled: true,
    message: DISABLED_MESSAGE,
  });
});

test("capability copy disables refresh for every unavailable reason", () => {
  for (const reason of ["disabled", "missing_key"] as const) {
    assert.deepEqual(
      aiAvailabilityCopy({
        ai: { enabled: reason === "missing_key", available: false, reason },
      }),
      {
        available: false,
        refreshDisabled: true,
        message: DISABLED_MESSAGE,
      },
    );
  }
});

test("capability copy enables refresh only when the server reports AI available", () => {
  assert.deepEqual(
    aiAvailabilityCopy({
      ai: { enabled: true, available: true, reason: "available" },
    }),
    {
      available: true,
      refreshDisabled: false,
      message: "AI generation is available.",
    },
  );
});
