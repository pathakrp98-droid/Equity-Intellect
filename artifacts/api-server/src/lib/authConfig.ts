export const GOOGLE_ISSUER = "https://accounts.google.com";
const DEFAULT_REPLIT_ISSUER = "https://replit.com/oidc";

export interface ReplitAuthConfig {
  provider: "replit";
  issuer: string;
  clientId: string;
}

export interface GoogleAuthConfig {
  provider: "google";
  issuer: typeof GOOGLE_ISSUER;
  clientId: string;
  clientSecret: string;
  appOrigin: string;
  callbackUrl: string;
}

export type AuthRuntimeConfig = ReplitAuthConfig | GoogleAuthConfig;

function requiredValue(
  env: NodeJS.ProcessEnv,
  name: keyof NodeJS.ProcessEnv,
): string {
  const value = env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `${String(name)} is required for the selected auth provider.`,
    );
  }
  return value.trim();
}

function parseUrl(value: string, variableName: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid URL.`);
  }
}

function validateIssuer(value: string): string {
  const issuer = parseUrl(value, "ISSUER_URL");
  if (
    (issuer.protocol !== "https:" && issuer.protocol !== "http:") ||
    issuer.username !== "" ||
    issuer.password !== "" ||
    issuer.search !== "" ||
    issuer.hash !== ""
  ) {
    throw new Error("ISSUER_URL must be a valid HTTP(S) issuer URL.");
  }
  return issuer.href.replace(/\/$/, "");
}

function validateAppOrigin(value: string): string {
  const origin = parseUrl(value, "APP_ORIGIN");
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const validProtocol =
    origin.protocol === "https:" ||
    (origin.protocol === "http:" && loopbackHosts.has(origin.hostname));
  if (
    !validProtocol ||
    origin.username !== "" ||
    origin.password !== "" ||
    origin.pathname !== "/" ||
    origin.search !== "" ||
    origin.hash !== ""
  ) {
    throw new Error(
      "APP_ORIGIN must be an HTTPS origin without credentials, path, query, or fragment.",
    );
  }
  return origin.origin;
}

export function loadAuthConfig(env: NodeJS.ProcessEnv): AuthRuntimeConfig {
  const provider = env.AUTH_PROVIDER ?? "replit";
  if (provider === "replit") {
    return {
      provider,
      issuer: validateIssuer(env.ISSUER_URL ?? DEFAULT_REPLIT_ISSUER),
      clientId: requiredValue(env, "REPL_ID"),
    };
  }

  if (provider === "google") {
    const appOrigin = validateAppOrigin(requiredValue(env, "APP_ORIGIN"));
    return {
      provider,
      issuer: GOOGLE_ISSUER,
      clientId: requiredValue(env, "GOOGLE_CLIENT_ID"),
      clientSecret: requiredValue(env, "GOOGLE_CLIENT_SECRET"),
      appOrigin,
      callbackUrl: `${appOrigin}/api/callback`,
    };
  }

  throw new Error('AUTH_PROVIDER must be either "replit" or "google".');
}

export function getAuthConfig(): AuthRuntimeConfig {
  return loadAuthConfig(process.env);
}
