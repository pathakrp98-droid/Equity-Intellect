import type { AuthUser } from "@workspace/api-zod";

export interface ReplitSessionData {
  kind: "replit";
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface GoogleSessionData {
  kind: "google";
  user: AuthUser;
  expiresAt: number;
}

export interface PendingGoogleIdentity {
  issuer: string;
  subject: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export interface PendingGoogleIdentitySessionData {
  kind: "google_identity_setup";
  identity: PendingGoogleIdentity;
  expiresAt: number;
}

export type AuthenticatedSessionData = ReplitSessionData | GoogleSessionData;
export type StoredSessionData =
  AuthenticatedSessionData | PendingGoogleIdentitySessionData;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
): boolean {
  const actual = Object.keys(value);
  return (
    required.every((key) => actual.includes(key)) &&
    actual.every((key) => required.includes(key) || optional.includes(key))
  );
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function parseUser(value: unknown): AuthUser | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "id",
      "email",
      "firstName",
      "lastName",
      "profileImageUrl",
    ]) ||
    typeof value.id !== "string" ||
    value.id.trim() === "" ||
    !nullableString(value.email) ||
    !nullableString(value.firstName) ||
    !nullableString(value.lastName) ||
    !nullableString(value.profileImageUrl)
  ) {
    return null;
  }
  return {
    id: value.id,
    email: value.email,
    firstName: value.firstName,
    lastName: value.lastName,
    profileImageUrl: value.profileImageUrl,
  };
}

function positiveFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function optionalNonblankString(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

function parseReplitSession(
  value: Record<string, unknown>,
): ReplitSessionData | null {
  if (
    !hasExactKeys(
      value,
      ["kind", "user", "accessToken"],
      ["refreshToken", "expiresAt"],
    ) ||
    value.kind !== "replit"
  ) {
    return null;
  }
  const user = parseUser(value.user);
  const accessToken = optionalNonblankString(value.accessToken);
  const refreshToken = optionalNonblankString(value.refreshToken);
  const expiresAt =
    value.expiresAt === undefined
      ? undefined
      : positiveFiniteNumber(value.expiresAt);
  if (!user || !accessToken || refreshToken === null || expiresAt === null) {
    return null;
  }
  return {
    kind: "replit",
    user,
    accessToken,
    ...(refreshToken === undefined ? {} : { refreshToken }),
    ...(expiresAt === undefined ? {} : { expiresAt }),
  };
}

function parseLegacyReplitSession(
  value: Record<string, unknown>,
): ReplitSessionData | null {
  if (
    !hasExactKeys(
      value,
      ["user", "access_token"],
      ["refresh_token", "expires_at"],
    )
  ) {
    return null;
  }
  const user = parseUser(value.user);
  const accessToken = optionalNonblankString(value.access_token);
  const refreshToken = optionalNonblankString(value.refresh_token);
  const legacyExpiry =
    value.expires_at === undefined
      ? undefined
      : positiveFiniteNumber(value.expires_at);
  if (!user || !accessToken || refreshToken === null || legacyExpiry === null) {
    return null;
  }
  return {
    kind: "replit",
    user,
    accessToken,
    ...(refreshToken === undefined ? {} : { refreshToken }),
    ...(legacyExpiry === undefined ? {} : { expiresAt: legacyExpiry * 1_000 }),
  };
}

function parseGoogleSession(
  value: Record<string, unknown>,
): GoogleSessionData | null {
  if (!hasExactKeys(value, ["kind", "user", "expiresAt"])) return null;
  const user = parseUser(value.user);
  const expiresAt = positiveFiniteNumber(value.expiresAt);
  if (value.kind !== "google" || !user || expiresAt === null) return null;
  return { kind: "google", user, expiresAt };
}

function parsePendingIdentity(value: unknown): PendingGoogleIdentity | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "issuer",
      "subject",
      "email",
      "firstName",
      "lastName",
      "profileImageUrl",
    ]) ||
    typeof value.issuer !== "string" ||
    value.issuer.trim() === "" ||
    value.issuer.length > 512 ||
    typeof value.subject !== "string" ||
    value.subject.trim() === "" ||
    value.subject.length > 255 ||
    !nullableString(value.email) ||
    !nullableString(value.firstName) ||
    !nullableString(value.lastName) ||
    !nullableString(value.profileImageUrl)
  ) {
    return null;
  }
  return {
    issuer: value.issuer,
    subject: value.subject,
    email: value.email,
    firstName: value.firstName,
    lastName: value.lastName,
    profileImageUrl: value.profileImageUrl,
  };
}

function parsePendingGoogleIdentitySession(
  value: Record<string, unknown>,
): PendingGoogleIdentitySessionData | null {
  if (!hasExactKeys(value, ["kind", "identity", "expiresAt"])) return null;
  const identity = parsePendingIdentity(value.identity);
  const expiresAt = positiveFiniteNumber(value.expiresAt);
  if (
    value.kind !== "google_identity_setup" ||
    !identity ||
    expiresAt === null
  ) {
    return null;
  }
  return { kind: "google_identity_setup", identity, expiresAt };
}

export function parseStoredSession(value: unknown): StoredSessionData | null {
  if (!isRecord(value)) return null;
  if (value.kind === "replit") return parseReplitSession(value);
  if (value.kind === "google") return parseGoogleSession(value);
  if (value.kind === "google_identity_setup") {
    return parsePendingGoogleIdentitySession(value);
  }
  if (value.kind === undefined) return parseLegacyReplitSession(value);
  return null;
}
