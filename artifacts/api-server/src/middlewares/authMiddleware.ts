import type { AuthUser } from '@workspace/api-zod';
import { type NextFunction, type Request, type Response } from 'express';
import * as oidc from 'openid-client';

import {
  clearSession,
  getOidcConfig,
  getSession,
  getSessionId,
  updateSession,
} from '../lib/auth';
import type {
  ReplitSessionData,
  StoredSessionData,
} from '../lib/authSession';

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

async function refreshReplitSession(
  session: ReplitSessionData,
): Promise<ReplitSessionData | null> {
  if (!session.refreshToken) return null;
  try {
    const config = await getOidcConfig();
    const tokens = await oidc.refreshTokenGrant(config, session.refreshToken);
    const expiresIn = tokens.expiresIn();
    return {
      ...session,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? session.refreshToken,
      expiresAt: expiresIn
        ? Date.now() + expiresIn * 1_000
        : session.expiresAt,
    };
  } catch {
    return null;
  }
}

export interface AuthMiddlewareDependencies {
  now(): number;
  getSession(sid: string): Promise<StoredSessionData | null>;
  updateSession(sid: string, session: ReplitSessionData): Promise<void>;
  clearSession(res: Response, sid?: string): Promise<void>;
  refreshReplitSession(
    session: ReplitSessionData,
  ): Promise<ReplitSessionData | null>;
}

const defaultDependencies: AuthMiddlewareDependencies = {
  now: () => Date.now(),
  getSession,
  updateSession,
  clearSession,
  refreshReplitSession,
};

export function createAuthMiddleware(
  dependencies: AuthMiddlewareDependencies = defaultDependencies,
) {
  return async function providerAwareAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    req.isAuthenticated = function (this: Request) {
      return this.user != null;
    } as Request['isAuthenticated'];

    const sid = getSessionId(req);
    if (!sid) {
      next();
      return;
    }

    const session = await dependencies.getSession(sid);
    if (!session || session.kind === 'google_identity_setup') {
      await dependencies.clearSession(res, sid);
      next();
      return;
    }

    if (session.kind === 'google') {
      if (dependencies.now() > session.expiresAt) {
        await dependencies.clearSession(res, sid);
      } else {
        req.user = session.user;
      }
      next();
      return;
    }

    if (!session.expiresAt || dependencies.now() <= session.expiresAt) {
      req.user = session.user;
      next();
      return;
    }

    if (!session.refreshToken) {
      await dependencies.clearSession(res, sid);
      next();
      return;
    }

    const refreshed = await dependencies.refreshReplitSession(session);
    if (!refreshed) {
      await dependencies.clearSession(res, sid);
      next();
      return;
    }

    await dependencies.updateSession(sid, refreshed);
    req.user = refreshed.user;
    next();
  };
}

export const authMiddleware = createAuthMiddleware();
