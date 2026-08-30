import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseStoredSession } from "./authSession";

const user = {
  id: "existing-owner",
  email: "display@example.com",
  firstName: "Existing",
  lastName: "Owner",
  profileImageUrl: null,
};

describe("stored authentication sessions", () => {
  it("normalizes the current untagged Replit session format", () => {
    assert.deepEqual(
      parseStoredSession({
        user,
        access_token: "legacy-access",
        refresh_token: "legacy-refresh",
        expires_at: 1_800_000_000,
      }),
      {
        kind: "replit",
        user,
        accessToken: "legacy-access",
        refreshToken: "legacy-refresh",
        expiresAt: 1_800_000_000_000,
      },
    );
  });

  it("accepts the tagged Replit session format", () => {
    assert.deepEqual(
      parseStoredSession({
        kind: "replit",
        user,
        accessToken: "access",
        refreshToken: "refresh",
        expiresAt: 1_800_000_000_000,
      }),
      {
        kind: "replit",
        user,
        accessToken: "access",
        refreshToken: "refresh",
        expiresAt: 1_800_000_000_000,
      },
    );
  });

  it("accepts a token-free Google session", () => {
    assert.deepEqual(
      parseStoredSession({
        kind: "google",
        user,
        expiresAt: 1_800_000_000_000,
      }),
      {
        kind: "google",
        user,
        expiresAt: 1_800_000_000_000,
      },
    );
  });

  it("accepts an unauthenticated pending Google identity", () => {
    const identity = {
      issuer: "https://accounts.google.com",
      subject: "123456789",
      email: "display@example.com",
      firstName: "Existing",
      lastName: "Owner",
      profileImageUrl: null,
    };
    assert.deepEqual(
      parseStoredSession({
        kind: "google_identity_setup",
        identity,
        expiresAt: 1_800_000_000_000,
      }),
      {
        kind: "google_identity_setup",
        identity,
        expiresAt: 1_800_000_000_000,
      },
    );
  });

  it("rejects provider tokens and unknown fields in Google sessions", () => {
    assert.equal(
      parseStoredSession({
        kind: "google",
        user,
        expiresAt: 1_800_000_000_000,
        accessToken: "forbidden",
      }),
      null,
    );
    assert.equal(
      parseStoredSession({
        kind: "google_identity_setup",
        identity: {
          issuer: "https://accounts.google.com",
          subject: "123456789",
          email: null,
          firstName: null,
          lastName: null,
          profileImageUrl: null,
          userId: "forbidden-owner",
        },
        expiresAt: 1_800_000_000_000,
      }),
      null,
    );
  });

  it("rejects malformed users, times, and session kinds", () => {
    for (const session of [
      null,
      {},
      { kind: "unknown", user, expiresAt: 1_800_000_000_000 },
      {
        kind: "google",
        user: { ...user, id: "" },
        expiresAt: 1_800_000_000_000,
      },
      { kind: "google", user, expiresAt: Number.NaN },
      { user, access_token: "", expires_at: 1_800_000_000 },
      { user, access_token: "access", expires_at: -1 },
    ]) {
      assert.equal(parseStoredSession(session), null);
    }
  });
});
