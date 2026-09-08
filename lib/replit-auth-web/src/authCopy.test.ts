/// <reference types="node" />

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSignInLabel } from "./authCopy";

describe("provider-aware authentication copy", () => {
  it("names Google without changing the legacy or fail-closed label", () => {
    assert.equal(getSignInLabel("google"), "Sign in with Google");
    assert.equal(getSignInLabel("replit"), "Sign in");
    assert.equal(getSignInLabel(undefined), "Sign in");
  });
});
