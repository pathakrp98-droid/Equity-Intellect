import assert from "node:assert/strict";
import test from "node:test";

import { isOriginAllowed, resolveAllowedOrigins } from "./securityHeaders";

test("normalizes configured and Replit domains", () => {
  assert.deepEqual(
    resolveAllowedOrigins(
      "https://alpha.example.com, beta.example.com/",
      "dev-example.replit.dev",
      undefined,
    ),
    [
      "https://alpha.example.com",
      "https://beta.example.com",
      "https://dev-example.replit.dev",
    ],
  );
});

test("allows local development but not unknown production origins", () => {
  assert.equal(
    isOriginAllowed("http://localhost:5173", [], "development"),
    true,
  );
  assert.equal(
    isOriginAllowed("https://evil.example", [], "production"),
    false,
  );
  assert.equal(
    isOriginAllowed(
      "https://alpha.example.com",
      ["https://alpha.example.com"],
      "production",
    ),
    true,
  );
});
