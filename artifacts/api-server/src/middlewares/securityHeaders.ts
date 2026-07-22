import type { NextFunction, Request, Response } from "express";

function normalizeOrigin(origin: string): string {
  const value = origin.trim().replace(/\/$/, "");
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function resolveAllowedOrigins(
  configured: string | undefined,
  replitDevDomain: string | undefined,
  replitDomains: string | undefined,
): string[] {
  const origins = new Set<string>();
  for (const raw of [configured, replitDevDomain, replitDomains]) {
    if (!raw) continue;
    for (const item of raw.split(",")) {
      const normalized = normalizeOrigin(item);
      if (normalized) origins.add(normalized);
    }
  }
  return [...origins];
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
  environment: string,
): boolean {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (allowedOrigins.includes(normalized)) return true;
  if (environment !== "production") {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized);
  }
  return false;
}

export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "no-store");
  if (process.env.NODE_ENV === "production" && req.secure) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  next();
}
