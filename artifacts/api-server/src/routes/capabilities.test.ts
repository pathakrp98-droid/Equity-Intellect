import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

import { createCapabilitiesRouter } from "./capabilities";

async function readCapabilities(
  environment: Record<string, string | undefined>,
): Promise<unknown> {
  const app = express();
  app.use("/api/capabilities", createCapabilitiesRouter(environment));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("missing address");
  }
  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/capabilities`,
    );
    assert.equal(response.status, 200);
    return await response.json();
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("capabilities route: paid AI is disabled by default even when a key exists", async () => {
  assert.deepEqual(
    await readCapabilities({ OPENAI_API_KEY: "never-exposed" }),
    {
      ai: { enabled: false, available: false, reason: "disabled" },
    },
  );
});

test("capabilities route: enabled AI without a key reports the missing key safely", async () => {
  assert.deepEqual(await readCapabilities({ AI_REQUESTS_ENABLED: "true" }), {
    ai: { enabled: true, available: false, reason: "missing_key" },
  });
});

test("capabilities route: AI is available only with both explicit opt-in and a key", async () => {
  assert.deepEqual(
    await readCapabilities({
      AI_REQUESTS_ENABLED: "true",
      OPENAI_API_KEY: "never-exposed",
    }),
    {
      ai: { enabled: true, available: true, reason: "available" },
    },
  );
});
