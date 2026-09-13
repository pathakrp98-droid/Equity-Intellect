import assert from "node:assert/strict";
import { describe, it } from "node:test";

import cookieParser from "cookie-parser";
import express, { type IRouter, type Response } from "express";

import type { AuthRuntimeConfig } from "../lib/authConfig";
import type { StoredSessionData } from "../lib/authSession";
import type { AuthRouterDependencies, AuthorizationCodeChecks } from "./auth";

process.env.DATABASE_URL ??= "postgresql://invalid:invalid@127.0.0.1:1/invalid";
const { createAuthRouter } = await import("./auth");

const googleConfig: AuthRuntimeConfig = {
  provider: "google",
  issuer: "https://accounts.google.com",
  clientId: "google-client",
  clientSecret: "google-secret",
  appOrigin: "https://alpha.example",
  callbackUrl: "https://alpha.example/api/callback",
};

const replitConfig: AuthRuntimeConfig = {
  provider: "replit",
  issuer: "https://replit.com/oidc",
  clientId: "replit-client",
};

const owner = {
  id: "existing-owner",
  email: "legacy-owner@example.com",
  firstName: "Existing",
  lastName: "Owner",
  profileImageUrl: null,
  createdAt: new Date("2026-08-30T00:00:00.000Z"),
  updatedAt: new Date("2026-08-30T00:00:00.000Z"),
};

interface RecordedSession {
  data: StoredSessionData;
  ttlMs: number | undefined;
}

interface RecordedErrorLog {
  metadata: Record<string, unknown>;
  message: string;
}

function dependencies(
  config: AuthRuntimeConfig,
  overrides: Partial<AuthRouterDependencies> = {},
): AuthRouterDependencies & {
  sessions: RecordedSession[];
  calls: string[];
} {
  const sessions: RecordedSession[] = [];
  const calls: string[] = [];
  const values = {
    sessions,
    calls,
    now: () => 1_700_000_000_000,
    getAuthConfig: () => config,
    async getOidcConfig() {
      calls.push("getOidcConfig");
      return {} as never;
    },
    randomState: () => "test-state",
    randomNonce: () => "test-nonce",
    randomCodeVerifier: () => "test-verifier",
    async calculateCodeChallenge(verifier: string) {
      calls.push(`challenge:${verifier}`);
      return "test-challenge";
    },
    buildAuthorizationUrl(
      _configuration: unknown,
      parameters: Record<string, string>,
    ) {
      calls.push(`authorization:${JSON.stringify(parameters)}`);
      const url = new URL("https://identity.example/authorize");
      for (const [name, value] of Object.entries(parameters)) {
        url.searchParams.set(name, value);
      }
      return url;
    },
    async exchangeAuthorizationCode() {
      calls.push("exchange");
      return {
        claims: {
          iss: "https://accounts.google.com",
          sub: "123456789",
          email: "google-display@example.com",
          given_name: "Google",
          family_name: "Owner",
          picture: "https://images.example/avatar.png",
          exp: 1_800_000_000,
        },
        accessToken: "google-access-must-not-be-stored",
        refreshToken: "google-refresh-must-not-be-stored",
        expiresIn: 3_600,
      };
    },
    buildEndSessionUrl() {
      calls.push("endSession");
      return new URL("https://identity.example/logout");
    },
    async createSession(data: StoredSessionData, ttlMs?: number) {
      sessions.push({ data, ttlMs });
      return `session-${sessions.length}`;
    },
    async getSession() {
      return null;
    },
    async clearSession(response: Response, sid?: string) {
      calls.push(`clearSession:${sid ?? "none"}`);
      response.clearCookie("sid", { path: "/" });
    },
    async deleteSession(sid: string) {
      calls.push(`deleteSession:${sid}`);
    },
    getSessionId(request: express.Request) {
      return request.cookies?.sid as string | undefined;
    },
    async findUserByExternalIdentity(issuer: string, subject: string) {
      calls.push(`find:${issuer}:${subject}`);
      return owner;
    },
    async upsertReplitUser() {
      calls.push("upsertReplitUser");
      return owner;
    },
    ...overrides,
  } satisfies AuthRouterDependencies & {
    sessions: RecordedSession[];
    calls: string[];
  };
  return values;
}

async function withServer<T>(
  router: IRouter,
  operation: (baseUrl: string) => Promise<T>,
  errorLogs?: RecordedErrorLog[],
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  if (errorLogs) {
    app.use((req, _res, next) => {
      req.log = {
        error(metadata: Record<string, unknown>, message: string) {
          errorLogs.push({ metadata, message });
        },
      } as unknown as typeof req.log;
      next();
    });
  }
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("missing address");
  try {
    return await operation(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function transientCookieHeader(returnTo = "/portfolio"): string {
  return [
    "code_verifier=test-verifier",
    "nonce=test-nonce",
    "state=test-state",
    `return_to=${encodeURIComponent(returnTo)}`,
  ].join("; ");
}

describe("provider-aware authentication routes", () => {
  it("starts Google login with fixed origin, minimal scopes, and PKCE", async () => {
    let parameters: Record<string, string> | undefined;
    const deps = dependencies(googleConfig, {
      buildAuthorizationUrl(_configuration, received) {
        parameters = received;
        return new URL("https://accounts.google.com/o/oauth2/v2/auth");
      },
    });

    await withServer(createAuthRouter(deps), async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/login?returnTo=${encodeURIComponent("/portfolio")}`,
        {
          redirect: "manual",
          headers: { "x-forwarded-host": "attacker.example" },
        },
      );
      assert.equal(response.status, 302);
      assert.equal(
        response.headers.get("location"),
        "https://accounts.google.com/o/oauth2/v2/auth",
      );
      assert.equal(parameters?.redirect_uri, googleConfig.callbackUrl);
      assert.equal(parameters?.scope, "openid email profile");
      assert.equal(parameters?.code_challenge, "test-challenge");
      assert.equal(parameters?.code_challenge_method, "S256");
      assert.equal(parameters?.state, "test-state");
      assert.equal(parameters?.nonce, "test-nonce");
      assert.equal("prompt" in (parameters ?? {}), false);
      assert.equal("access_type" in (parameters ?? {}), false);

      const cookies = response.headers.getSetCookie().join("\n");
      assert.match(cookies, /code_verifier=test-verifier/);
      assert.match(cookies, /return_to=%2Fportfolio/);
      assert.match(cookies, /HttpOnly/i);
      assert.match(cookies, /Secure/i);
      assert.match(cookies, /SameSite=Lax/i);
    });
  });

  it("creates a token-free Google session only for an exact mapped identity", async () => {
    let exchangeUrl: URL | undefined;
    let exchangeChecks: AuthorizationCodeChecks | undefined;
    const deps = dependencies(googleConfig, {
      async exchangeAuthorizationCode(_configuration, url, checks) {
        exchangeUrl = url;
        exchangeChecks = checks;
        return {
          claims: {
            iss: "https://accounts.google.com",
            sub: "123456789",
            email: "google-display@example.com",
          },
          accessToken: "must-not-be-stored",
          refreshToken: "must-not-be-stored",
          expiresIn: 3_600,
        };
      },
    });

    await withServer(createAuthRouter(deps), async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/callback?code=verified&state=test-state`,
        {
          redirect: "manual",
          headers: { Cookie: transientCookieHeader() },
        },
      );
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), "/portfolio");
      assert.equal(exchangeUrl?.origin, googleConfig.appOrigin);
      assert.equal(exchangeUrl?.pathname, "/api/callback");
      assert.equal(exchangeChecks?.pkceCodeVerifier, "test-verifier");
      assert.equal(exchangeChecks?.expectedState, "test-state");
      assert.equal(exchangeChecks?.expectedNonce, "test-nonce");
      assert.equal(exchangeChecks?.idTokenExpected, true);

      assert.equal(deps.sessions.length, 1);
      assert.deepEqual(deps.sessions[0]?.data, {
        kind: "google",
        user: {
          id: owner.id,
          email: owner.email,
          firstName: owner.firstName,
          lastName: owner.lastName,
          profileImageUrl: owner.profileImageUrl,
        },
        expiresAt: 1_700_604_800_000,
      });
      assert.equal(
        JSON.stringify(deps.sessions[0]?.data).includes("token"),
        false,
      );
      assert.equal(deps.calls.includes("upsertReplitUser"), false);
      assert.match(
        response.headers.getSetCookie().join("\n"),
        /code_verifier=;/,
      );
    });
  });

  it("keeps an unmapped Google identity unauthenticated for operator setup", async () => {
    const deps = dependencies(googleConfig, {
      async findUserByExternalIdentity() {
        return null;
      },
      async upsertReplitUser() {
        throw new Error("must not create a Google user");
      },
    });

    await withServer(createAuthRouter(deps), async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/callback?code=verified&state=test-state`,
        {
          redirect: "manual",
          headers: { Cookie: transientCookieHeader() },
        },
      );
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), "/api/auth/setup");
      assert.equal(deps.sessions.length, 1);
      assert.equal(deps.sessions[0]?.data.kind, "google_identity_setup");
      assert.equal(deps.sessions[0]?.ttlMs, 600_000);
      assert.equal("user" in (deps.sessions[0]?.data ?? {}), false);
      const cookies = response.headers.getSetCookie().join("\n");
      assert.match(cookies, /identity_setup_sid=session-1/);
      assert.equal(
        response.headers
          .getSetCookie()
          .some((cookie) => cookie.startsWith("sid=session-1")),
        false,
      );
    });
  });

  it("clears transient cookies and shows one recoverable callback error", async () => {
    const deps = dependencies(googleConfig, {
      async exchangeAuthorizationCode() {
        throw new Error("raw provider token error");
      },
    });

    await withServer(createAuthRouter(deps), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/callback?error=access_denied`, {
        redirect: "manual",
        headers: { Cookie: transientCookieHeader() },
      });
      assert.equal(response.status, 302);
      assert.equal(
        response.headers.get("location"),
        "/api/auth/error?reason=callback_failed",
      );
      const cookies = response.headers.getSetCookie().join("\n");
      for (const name of ["code_verifier", "nonce", "state", "return_to"]) {
        assert.match(cookies, new RegExp(`${name}=;`));
      }
      assert.doesNotMatch(cookies, /raw provider token error/);
    });
  });

  it("logs the safe callback stage when token exchange fails", async () => {
    const errorLogs: RecordedErrorLog[] = [];
    const deps = dependencies(googleConfig, {
      async exchangeAuthorizationCode() {
        throw new Error("sensitive provider detail");
      },
    });

    await withServer(
      createAuthRouter(deps),
      async (baseUrl) => {
        await fetch(`${baseUrl}/callback?code=verified&state=test-state`, {
          redirect: "manual",
          headers: { Cookie: transientCookieHeader() },
        });
      },
      errorLogs,
    );

    assert.equal(errorLogs.length, 1);
    assert.equal(errorLogs[0]?.message, "OIDC callback error");
    assert.equal(errorLogs[0]?.metadata.callbackStage, "token_exchange");
    assert.doesNotMatch(JSON.stringify(errorLogs), /sensitive provider detail/);
  });

  it("logs the safe callback stage when identity lookup fails", async () => {
    const errorLogs: RecordedErrorLog[] = [];
    const deps = dependencies(googleConfig, {
      async findUserByExternalIdentity() {
        throw new Error("sensitive database detail");
      },
    });

    await withServer(
      createAuthRouter(deps),
      async (baseUrl) => {
        await fetch(`${baseUrl}/callback?code=verified&state=test-state`, {
          redirect: "manual",
          headers: { Cookie: transientCookieHeader() },
        });
      },
      errorLogs,
    );

    assert.equal(errorLogs.length, 1);
    assert.equal(errorLogs[0]?.metadata.callbackStage, "identity_lookup");
    assert.doesNotMatch(JSON.stringify(errorLogs), /sensitive database detail/);
  });

  it("logs Google out locally and rejects native exchange before OIDC", async () => {
    const deps = dependencies(googleConfig, {
      async getOidcConfig() {
        throw new Error("Google logout/mobile must not discover OIDC");
      },
    });

    await withServer(createAuthRouter(deps), async (baseUrl) => {
      const logout = await fetch(`${baseUrl}/logout?returnTo=/portfolio`, {
        redirect: "manual",
        headers: { Cookie: "sid=active-google-session" },
      });
      assert.equal(logout.status, 302);
      assert.equal(
        logout.headers.get("location"),
        "https://alpha.example/portfolio",
      );
      assert.ok(deps.calls.includes("clearSession:active-google-session"));
      assert.equal(deps.calls.includes("endSession"), false);

      const mobile = await fetch(`${baseUrl}/mobile-auth/token-exchange`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: "code",
          code_verifier: "verifier",
          redirect_uri: "alphadesk://callback",
          state: "state",
        }),
      });
      assert.equal(mobile.status, 409);
      assert.deepEqual(await mobile.json(), {
        error: "Mobile token exchange is unavailable in Google web mode",
      });
    });
  });

  it("retains direct-sub Replit callback compatibility", async () => {
    const deps = dependencies(replitConfig, {
      async exchangeAuthorizationCode() {
        return {
          claims: {
            iss: "https://replit.com/oidc",
            sub: owner.id,
            email: owner.email,
            exp: 1_800_000_000,
          },
          accessToken: "replit-access",
          refreshToken: "replit-refresh",
          expiresIn: 3_600,
        };
      },
    });

    await withServer(createAuthRouter(deps), async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/callback?code=verified&state=test-state`,
        {
          redirect: "manual",
          headers: {
            Cookie: transientCookieHeader("/"),
            "x-forwarded-proto": "https",
            "x-forwarded-host": "legacy.example",
          },
        },
      );
      assert.equal(response.status, 302);
      assert.equal(deps.calls.includes("upsertReplitUser"), true);
      assert.equal(
        deps.calls.some((call) => call.startsWith("find:")),
        false,
      );
      assert.deepEqual(deps.sessions[0]?.data, {
        kind: "replit",
        user: {
          id: owner.id,
          email: owner.email,
          firstName: owner.firstName,
          lastName: owner.lastName,
          profileImageUrl: owner.profileImageUrl,
        },
        accessToken: "replit-access",
        refreshToken: "replit-refresh",
        expiresAt: 1_700_003_600_000,
      });

      const logout = await fetch(`${baseUrl}/logout?returnTo=/portfolio`, {
        redirect: "manual",
        headers: {
          Cookie: "sid=legacy-session",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "legacy.example",
        },
      });
      assert.equal(logout.status, 302);
      assert.equal(
        logout.headers.get("location"),
        "https://identity.example/logout",
      );
      assert.ok(deps.calls.includes("clearSession:legacy-session"));
      assert.ok(deps.calls.includes("endSession"));

      const mobile = await fetch(`${baseUrl}/mobile-auth/token-exchange`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: "mobile-code",
          code_verifier: "mobile-verifier",
          redirect_uri: "alphadesk://callback",
          state: "mobile-state",
        }),
      });
      assert.equal(mobile.status, 200);
      assert.deepEqual(await mobile.json(), { token: "session-2" });
      assert.equal(deps.sessions[1]?.data.kind, "replit");
    });
  });
});
