import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { NextFunction, Request, Response } from "express";

import type { ReplitSessionData, StoredSessionData } from "../lib/authSession";
import type { AuthMiddlewareDependencies } from "./authMiddleware";

process.env.DATABASE_URL ??= "postgresql://invalid:invalid@127.0.0.1:1/invalid";
const { createAuthMiddleware } = await import("./authMiddleware");

const user = {
  id: "existing-owner",
  email: "display@example.com",
  firstName: "Existing",
  lastName: "Owner",
  profileImageUrl: null,
};

interface RunResult {
  request: Request;
  calls: string[];
}

async function runMiddleware(
  session: StoredSessionData | null,
  overrides: Partial<AuthMiddlewareDependencies> = {},
): Promise<RunResult> {
  const calls: string[] = [];
  const request = {
    headers: {},
    cookies: { sid: "test-session" },
  } as unknown as Request;
  const response = {} as Response;
  const dependencies: AuthMiddlewareDependencies = {
    now: () => 1_700_000_000_000,
    async getSession(sid) {
      calls.push(`get:${sid}`);
      return session;
    },
    async updateSession(sid, updated) {
      calls.push(`update:${sid}:${updated.kind}`);
    },
    async clearSession(_response, sid) {
      calls.push(`clear:${sid}`);
    },
    async refreshReplitSession() {
      calls.push("refresh");
      return null;
    },
    ...overrides,
  };
  const middleware = createAuthMiddleware(dependencies);
  const next = (() => {
    calls.push("next");
  }) as NextFunction;

  await middleware(request, response, next);
  return { request, calls };
}

describe("provider-aware auth middleware", () => {
  it("authenticates an active Google session without token refresh", async () => {
    const result = await runMiddleware({
      kind: "google",
      user,
      expiresAt: 1_700_000_100_000,
    });

    assert.equal(result.request.user, user);
    assert.deepEqual(result.calls, ["get:test-session", "next"]);
    assert.equal(result.request.isAuthenticated(), true);
  });

  it("clears an expired Google session", async () => {
    const result = await runMiddleware({
      kind: "google",
      user,
      expiresAt: 1_699_999_999_999,
    });

    assert.equal(result.request.user, undefined);
    assert.deepEqual(result.calls, [
      "get:test-session",
      "clear:test-session",
      "next",
    ]);
    assert.equal(result.request.isAuthenticated(), false);
  });

  it("keeps an active Replit session compatible", async () => {
    const result = await runMiddleware({
      kind: "replit",
      user,
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: 1_700_000_100_000,
    });

    assert.equal(result.request.user, user);
    assert.deepEqual(result.calls, ["get:test-session", "next"]);
  });

  it("refreshes only an expired Replit token and stores the result", async () => {
    const refreshed: ReplitSessionData = {
      kind: "replit",
      user,
      accessToken: "new-access",
      refreshToken: "refresh",
      expiresAt: 1_700_000_100_000,
    };
    const calls: string[] = [];
    const result = await runMiddleware(
      {
        kind: "replit",
        user,
        accessToken: "expired-access",
        refreshToken: "refresh",
        expiresAt: 1_699_999_999_999,
      },
      {
        async refreshReplitSession(session) {
          calls.push(`refresh:${session.accessToken}`);
          return refreshed;
        },
        async updateSession(sid, updated) {
          calls.push(`update:${sid}:${updated.accessToken}`);
        },
      },
    );

    assert.equal(result.request.user, user);
    assert.deepEqual(calls, [
      "refresh:expired-access",
      "update:test-session:new-access",
    ]);
    assert.deepEqual(result.calls, ["get:test-session", "next"]);
  });

  it("clears an expired Replit session without a refresh token", async () => {
    const result = await runMiddleware({
      kind: "replit",
      user,
      accessToken: "expired-access",
      expiresAt: 1_699_999_999_999,
    });

    assert.deepEqual(result.calls, [
      "get:test-session",
      "clear:test-session",
      "next",
    ]);
  });

  it("never authenticates a pending Google identity", async () => {
    const result = await runMiddleware({
      kind: "google_identity_setup",
      identity: {
        issuer: "https://accounts.google.com",
        subject: "123456789",
        email: "display@example.com",
        firstName: "Existing",
        lastName: "Owner",
        profileImageUrl: null,
      },
      expiresAt: 1_700_000_100_000,
    });

    assert.equal(result.request.user, undefined);
    assert.deepEqual(result.calls, [
      "get:test-session",
      "clear:test-session",
      "next",
    ]);
  });
});
