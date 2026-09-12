import crypto from 'crypto';
import { db, sessionsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { type Request, type Response } from 'express';
import * as client from 'openid-client';

import { getAuthConfig } from './authConfig';
import {
  parseStoredSession,
  type StoredSessionData,
} from './authSession';

export const ISSUER_URL = process.env.ISSUER_URL ?? 'https://replit.com/oidc';
export const SESSION_COOKIE = 'sid';
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

export type SessionData = StoredSessionData;

let oidcConfig: client.Configuration | null = null;

export async function getOidcConfig(): Promise<client.Configuration> {
  if (!oidcConfig) {
    const authConfig = getAuthConfig();
    oidcConfig =
      authConfig.provider === 'google'
        ? await client.discovery(
            new URL(authConfig.issuer),
            authConfig.clientId,
            { client_secret: authConfig.clientSecret },
            client.ClientSecretPost(authConfig.clientSecret),
          )
        : await client.discovery(
            new URL(authConfig.issuer),
            authConfig.clientId,
          );
  }
  return oidcConfig;
}

export async function createSession(
  data: SessionData,
  ttlMs = SESSION_TTL,
): Promise<string> {
  const parsed = parseStoredSession(data);
  if (!parsed) throw new Error('Invalid session data.');
  const sid = crypto.randomBytes(32).toString('hex');
  const boundedTtl = Math.min(Math.max(ttlMs, 1), SESSION_TTL);
  await db.insert(sessionsTable).values({
    sid,
    sess: parsed as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + boundedTtl),
  });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  const session = row ? parseStoredSession(row.sess) : null;
  const recordExpired =
    session?.kind !== 'replit' &&
    session !== null &&
    session.expiresAt <= Date.now();
  if (!row || row.expire < new Date() || !session || recordExpired) {
    if (row) await deleteSession(sid);
    return null;
  }

  return session;
}

export async function updateSession(
  sid: string,
  data: SessionData,
): Promise<void> {
  const parsed = parseStoredSession(data);
  if (!parsed) throw new Error('Invalid session data.');
  await db
    .update(sessionsTable)
    .set({
      sess: parsed as unknown as Record<string, unknown>,
      expire: new Date(Date.now() + SESSION_TTL),
    })
    .where(eq(sessionsTable.sid, sid));
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(res: Response, sid?: string): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return req.cookies?.[SESSION_COOKIE];
}
