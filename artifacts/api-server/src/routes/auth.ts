import {
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  GetCurrentAuthUserResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { usersTable, type User } from "@workspace/db/schema";
import { Router, type IRouter, type Request, type Response } from "express";
import * as oidc from "openid-client";

import {
  clearSession,
  createSession,
  deleteSession,
  getOidcConfig,
  getSession,
  getSessionId,
  SESSION_COOKIE,
  SESSION_TTL,
} from "../lib/auth";
import {
  getAuthConfig,
  GOOGLE_ISSUER,
  type AuthRuntimeConfig,
} from "../lib/authConfig";
import {
  getSafeReturnTo,
  parseAuthErrorReason,
  renderAuthErrorPage,
  renderIdentitySetupPage,
} from "../lib/authPages";
import type {
  PendingGoogleIdentity,
  StoredSessionData,
} from "../lib/authSession";
import { findUserByExternalIdentity } from "../services/auth/externalIdentityRepository";

const OIDC_COOKIE_TTL = 10 * 60 * 1_000;
const IDENTITY_SETUP_TTL = 10 * 60 * 1_000;
const IDENTITY_SETUP_COOKIE = "identity_setup_sid";
const TRANSIENT_COOKIES = ["code_verifier", "nonce", "state", "return_to"];
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

export interface AuthTokenSet {
  claims: Record<string, unknown> | null;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface AuthorizationCodeChecks {
  pkceCodeVerifier: string;
  expectedNonce?: string;
  expectedState: string;
  idTokenExpected: true;
}

export interface AuthRouterDependencies {
  now(): number;
  getAuthConfig(): AuthRuntimeConfig;
  getOidcConfig(): Promise<unknown>;
  randomState(): string;
  randomNonce(): string;
  randomCodeVerifier(): string;
  calculateCodeChallenge(verifier: string): Promise<string>;
  buildAuthorizationUrl(
    configuration: unknown,
    parameters: Record<string, string>,
  ): URL;
  exchangeAuthorizationCode(
    configuration: unknown,
    url: URL,
    checks: AuthorizationCodeChecks,
  ): Promise<AuthTokenSet>;
  buildEndSessionUrl(
    configuration: unknown,
    parameters: Record<string, string>,
  ): URL;
  createSession(data: StoredSessionData, ttlMs?: number): Promise<string>;
  getSession(sid: string): Promise<StoredSessionData | null>;
  clearSession(response: Response, sid?: string): Promise<void>;
  deleteSession(sid: string): Promise<void>;
  getSessionId(request: Request): string | undefined;
  findUserByExternalIdentity(
    issuer: string,
    subject: string,
  ): Promise<User | null>;
  upsertReplitUser(claims: Record<string, unknown>): Promise<User>;
}

function legacyOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

function setSessionCookie(res: Response, sid: string): void {
  res.cookie(SESSION_COOKIE, sid, cookieOptions(SESSION_TTL));
}

function setOidcCookie(
  res: Response,
  name: string,
  value: string,
  maxAge = OIDC_COOKIE_TTL,
): void {
  res.cookie(name, value, cookieOptions(maxAge));
}

function clearCookie(res: Response, name: string): void {
  res.clearCookie(name, { path: "/" });
}

function clearTransientCookies(res: Response): void {
  for (const name of TRANSIENT_COOKIES) clearCookie(res, name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorStatus(
  value: Record<string, unknown>,
): number | string | undefined {
  if (typeof value.status === "number" || typeof value.status === "string") {
    return value.status;
  }
  if (
    typeof value.statusCode === "number" ||
    typeof value.statusCode === "string"
  ) {
    return value.statusCode;
  }
  return undefined;
}

function getSafeErrorMetadata(error: unknown) {
  if (!isRecord(error)) return { errorName: typeof error };
  const errorStatus = getErrorStatus(error);
  const causeStatus = isRecord(error.cause)
    ? getErrorStatus(error.cause)
    : undefined;
  return {
    errorName: error instanceof Error ? error.name : "Error",
    errorStatus: errorStatus ?? causeStatus,
  };
}

function toAuthUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
  };
}

function optionalDisplayString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function getGoogleIdentity(
  claims: Record<string, unknown>,
): PendingGoogleIdentity | null {
  const issuer = claims.iss;
  const subject = claims.sub;
  if (
    (issuer !== GOOGLE_ISSUER && issuer !== "accounts.google.com") ||
    typeof subject !== "string" ||
    subject.trim() !== subject ||
    subject.length === 0 ||
    subject.length > 255 ||
    CONTROL_CHARACTER.test(subject)
  ) {
    return null;
  }
  return {
    issuer: GOOGLE_ISSUER,
    subject,
    email: optionalDisplayString(claims.email),
    firstName: optionalDisplayString(claims.given_name),
    lastName: optionalDisplayString(claims.family_name),
    profileImageUrl: optionalDisplayString(claims.picture),
  };
}

function getExpiresAt(
  now: number,
  tokens: AuthTokenSet,
  claims: Record<string, unknown>,
): number | undefined {
  if (
    typeof tokens.expiresIn === "number" &&
    Number.isFinite(tokens.expiresIn) &&
    tokens.expiresIn > 0
  ) {
    return now + tokens.expiresIn * 1_000;
  }
  return typeof claims.exp === "number" &&
    Number.isFinite(claims.exp) &&
    claims.exp > 0
    ? claims.exp * 1_000
    : undefined;
}

const defaultDependencies: AuthRouterDependencies = {
  now: Date.now,
  getAuthConfig,
  getOidcConfig,
  randomState: oidc.randomState,
  randomNonce: oidc.randomNonce,
  randomCodeVerifier: oidc.randomPKCECodeVerifier,
  calculateCodeChallenge: oidc.calculatePKCECodeChallenge,
  buildAuthorizationUrl(configuration, parameters) {
    return oidc.buildAuthorizationUrl(
      configuration as oidc.Configuration,
      parameters,
    );
  },
  async exchangeAuthorizationCode(configuration, url, checks) {
    const tokens = await oidc.authorizationCodeGrant(
      configuration as oidc.Configuration,
      url,
      checks,
    );
    if (typeof tokens.access_token !== "string") {
      throw new Error("OIDC token response omitted an access token.");
    }
    return {
      claims: (tokens.claims() as Record<string, unknown> | undefined) ?? null,
      accessToken: tokens.access_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      ...(tokens.expiresIn() ? { expiresIn: tokens.expiresIn() } : {}),
    };
  },
  buildEndSessionUrl(configuration, parameters) {
    return oidc.buildEndSessionUrl(
      configuration as oidc.Configuration,
      parameters,
    );
  },
  createSession,
  getSession,
  clearSession,
  deleteSession,
  getSessionId,
  findUserByExternalIdentity,
  async upsertReplitUser(claims) {
    const subject = claims.sub;
    if (
      typeof subject !== "string" ||
      subject.trim() === "" ||
      CONTROL_CHARACTER.test(subject)
    ) {
      throw new Error("Verified Replit identity has no valid subject.");
    }
    const userData = {
      id: subject,
      email: optionalDisplayString(claims.email),
      firstName: optionalDisplayString(claims.first_name),
      lastName: optionalDisplayString(claims.last_name),
      profileImageUrl:
        optionalDisplayString(claims.profile_image_url) ??
        optionalDisplayString(claims.picture),
    };
    const { db } = await import("@workspace/db");
    const [user] = await db
      .insert(usersTable)
      .values(userData)
      .onConflictDoUpdate({
        target: usersTable.id,
        set: { ...userData, updatedAt: new Date() },
      })
      .returning();
    if (!user) throw new Error("Replit user could not be saved.");
    return user;
  },
};

export function createAuthRouter(
  overrides: Partial<AuthRouterDependencies> = {},
): IRouter {
  const dependencies: AuthRouterDependencies = {
    ...defaultDependencies,
    ...overrides,
  };
  const router: IRouter = Router();

  router.get("/auth/user", (req: Request, res: Response) => {
    res.json(
      GetCurrentAuthUserResponse.parse({
        user: req.isAuthenticated() ? req.user : null,
        authProvider: dependencies.getAuthConfig().provider,
      }),
    );
  });

  router.get("/login", async (req: Request, res: Response) => {
    try {
      const config = dependencies.getAuthConfig();
      const setupSid = req.cookies?.[IDENTITY_SETUP_COOKIE] as
        string | undefined;
      if (setupSid) await dependencies.deleteSession(setupSid);
      clearCookie(res, IDENTITY_SETUP_COOKIE);

      const oidcConfig = await dependencies.getOidcConfig();
      const returnTo = getSafeReturnTo(req.query.returnTo);
      const state = dependencies.randomState();
      const nonce = dependencies.randomNonce();
      const codeVerifier = dependencies.randomCodeVerifier();
      const codeChallenge =
        await dependencies.calculateCodeChallenge(codeVerifier);
      const redirectUri =
        config.provider === "google"
          ? config.callbackUrl
          : `${legacyOrigin(req)}/api/callback`;
      const parameters: Record<string, string> = {
        redirect_uri: redirectUri,
        scope:
          config.provider === "google"
            ? "openid email profile"
            : "openid email profile offline_access",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
        nonce,
        ...(config.provider === "replit" ? { prompt: "login consent" } : {}),
      };
      const redirectTo = dependencies.buildAuthorizationUrl(
        oidcConfig,
        parameters,
      );

      setOidcCookie(res, "code_verifier", codeVerifier);
      setOidcCookie(res, "nonce", nonce);
      setOidcCookie(res, "state", state);
      setOidcCookie(res, "return_to", returnTo);
      res.redirect(redirectTo.href);
    } catch (error) {
      clearTransientCookies(res);
      req.log?.error(getSafeErrorMetadata(error), "Auth configuration error");
      res.redirect("/api/auth/error?reason=configuration_error");
    }
  });

  router.get("/callback", async (req: Request, res: Response) => {
    const codeVerifier = req.cookies?.code_verifier as string | undefined;
    const nonce = req.cookies?.nonce as string | undefined;
    const expectedState = req.cookies?.state as string | undefined;
    if (!codeVerifier || !expectedState) {
      clearTransientCookies(res);
      res.redirect("/api/auth/error?reason=missing_state");
      return;
    }

    try {
      const config = dependencies.getAuthConfig();
      const oidcConfig = await dependencies.getOidcConfig();
      const callbackUrl =
        config.provider === "google"
          ? config.callbackUrl
          : `${legacyOrigin(req)}/api/callback`;
      const currentUrl = new URL(callbackUrl);
      const incomingUrl = new URL(req.url, "https://callback.invalid");
      currentUrl.search = incomingUrl.search;
      const tokens = await dependencies.exchangeAuthorizationCode(
        oidcConfig,
        currentUrl,
        {
          pkceCodeVerifier: codeVerifier,
          expectedNonce: nonce,
          expectedState,
          idTokenExpected: true,
        },
      );
      clearTransientCookies(res);
      const claims = tokens.claims;
      if (!claims) throw new Error("Verified ID token contained no claims.");
      const returnTo = getSafeReturnTo(req.cookies?.return_to);

      if (config.provider === "google") {
        const identity = getGoogleIdentity(claims);
        if (!identity) throw new Error("Google identity claims were invalid.");
        const user = await dependencies.findUserByExternalIdentity(
          identity.issuer,
          identity.subject,
        );
        if (!user) {
          const setupSid = await dependencies.createSession(
            {
              kind: "google_identity_setup",
              identity,
              expiresAt: dependencies.now() + IDENTITY_SETUP_TTL,
            },
            IDENTITY_SETUP_TTL,
          );
          setOidcCookie(
            res,
            IDENTITY_SETUP_COOKIE,
            setupSid,
            IDENTITY_SETUP_TTL,
          );
          res.redirect("/api/auth/setup");
          return;
        }
        const sid = await dependencies.createSession({
          kind: "google",
          user: toAuthUser(user),
          expiresAt: dependencies.now() + SESSION_TTL,
        });
        setSessionCookie(res, sid);
        res.redirect(returnTo);
        return;
      }

      const user = await dependencies.upsertReplitUser(claims);
      const expiresAt = getExpiresAt(dependencies.now(), tokens, claims);
      const sid = await dependencies.createSession({
        kind: "replit",
        user: toAuthUser(user),
        accessToken: tokens.accessToken,
        ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
        ...(expiresAt ? { expiresAt } : {}),
      });
      setSessionCookie(res, sid);
      res.redirect(returnTo);
    } catch (error) {
      clearTransientCookies(res);
      req.log?.error(getSafeErrorMetadata(error), "OIDC callback error");
      res.redirect("/api/auth/error?reason=callback_failed");
    }
  });

  router.get("/auth/setup", async (req: Request, res: Response) => {
    const setupSid = req.cookies?.[IDENTITY_SETUP_COOKIE] as string | undefined;
    const session = setupSid ? await dependencies.getSession(setupSid) : null;
    if (!session || session.kind !== "google_identity_setup") {
      clearCookie(res, IDENTITY_SETUP_COOKIE);
      res.status(410).type("html").send(renderAuthErrorPage("setup_expired"));
      return;
    }
    res.type("html").send(renderIdentitySetupPage(session.identity));
  });

  router.get("/auth/error", (req: Request, res: Response) => {
    const reason = parseAuthErrorReason(req.query.reason);
    res.status(400).type("html").send(renderAuthErrorPage(reason));
  });

  router.get("/logout", async (req: Request, res: Response) => {
    const returnTo = getSafeReturnTo(req.query.returnTo);
    const sid = dependencies.getSessionId(req);
    await dependencies.clearSession(res, sid);

    try {
      const config = dependencies.getAuthConfig();
      if (config.provider === "google") {
        res.redirect(new URL(returnTo, config.appOrigin).href);
        return;
      }
      const origin = legacyOrigin(req);
      const localRedirect = new URL(returnTo, `${origin}/`).href;
      try {
        const oidcConfig = await dependencies.getOidcConfig();
        const providerRedirect = dependencies.buildEndSessionUrl(oidcConfig, {
          client_id: config.clientId,
          post_logout_redirect_uri: localRedirect,
        });
        res.redirect(providerRedirect.href);
      } catch (error) {
        req.log?.error(getSafeErrorMetadata(error), "Provider logout error");
        res.redirect(localRedirect);
      }
    } catch (error) {
      req.log?.error(getSafeErrorMetadata(error), "Auth configuration error");
      res.redirect("/api/auth/error?reason=configuration_error");
    }
  });

  router.post(
    "/mobile-auth/token-exchange",
    async (req: Request, res: Response) => {
      let config: AuthRuntimeConfig;
      try {
        config = dependencies.getAuthConfig();
      } catch (error) {
        req.log?.error(getSafeErrorMetadata(error), "Auth configuration error");
        res.status(500).json({ error: "Authentication is not configured" });
        return;
      }
      if (config.provider === "google") {
        res.status(409).json({
          error: "Mobile token exchange is unavailable in Google web mode",
        });
        return;
      }

      const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "Missing or invalid required parameters" });
        return;
      }
      const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

      try {
        const oidcConfig = await dependencies.getOidcConfig();
        const callbackUrl = new URL(redirect_uri);
        callbackUrl.searchParams.set("code", code);
        callbackUrl.searchParams.set("state", state);
        callbackUrl.searchParams.set("iss", config.issuer);
        const tokens = await dependencies.exchangeAuthorizationCode(
          oidcConfig,
          callbackUrl,
          {
            pkceCodeVerifier: code_verifier,
            expectedNonce: nonce ?? undefined,
            expectedState: state,
            idTokenExpected: true,
          },
        );
        if (!tokens.claims) {
          res.status(401).json({ error: "No claims in ID token" });
          return;
        }
        const user = await dependencies.upsertReplitUser(tokens.claims);
        const expiresAt = getExpiresAt(
          dependencies.now(),
          tokens,
          tokens.claims,
        );
        const sid = await dependencies.createSession({
          kind: "replit",
          user: toAuthUser(user),
          accessToken: tokens.accessToken,
          ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
          ...(expiresAt ? { expiresAt } : {}),
        });
        res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
      } catch (error) {
        req.log?.error(
          getSafeErrorMetadata(error),
          "Mobile token exchange error",
        );
        res.status(500).json({ error: "Token exchange failed" });
      }
    },
  );

  router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
    const sid = dependencies.getSessionId(req);
    if (sid) await dependencies.deleteSession(sid);
    res.json(LogoutMobileSessionResponse.parse({ success: true }));
  });

  return router;
}

export default createAuthRouter();
