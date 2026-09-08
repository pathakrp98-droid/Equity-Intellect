import type { PendingGoogleIdentity } from "./authSession";

export type AuthErrorReason =
  "callback_failed" | "missing_state" | "setup_expired" | "configuration_error";

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

export function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    CONTROL_CHARACTER.test(value)
  ) {
    return "/";
  }

  try {
    const decoded = decodeURIComponent(value);
    if (
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      CONTROL_CHARACTER.test(decoded)
    ) {
      return "/";
    }
    const parsed = new URL(value, "https://alphadesk.invalid");
    if (parsed.origin !== "https://alphadesk.invalid") return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

function page(title: string, content: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>${escapeHtml(title)} · AlphaDesk</title>
    <style>
      :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #07111f; color: #e5edf7; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
      main { width: min(640px, 100%); background: #0c1829; border: 1px solid #24354d; border-radius: 16px; padding: 28px; box-sizing: border-box; }
      h1 { margin: 0 0 12px; font-size: 1.5rem; }
      p, dt, dd { line-height: 1.55; }
      dl { display: grid; gap: 6px; margin: 20px 0; }
      dt { color: #9fb0c6; font-size: .85rem; }
      dd { margin: 0 0 8px; overflow-wrap: anywhere; }
      a { display: inline-block; color: #fff; background: #2563eb; padding: 10px 14px; border-radius: 9px; text-decoration: none; }
      .note { color: #b8c5d6; }
    </style>
  </head>
  <body><main>${content}</main></body>
</html>`;
}

export function renderIdentitySetupPage(
  identity: PendingGoogleIdentity,
): string {
  const displayName = [identity.firstName, identity.lastName]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  return page(
    "Account link required",
    `<h1>One secure setup step remains</h1>
<p>Google verified this account, but it is not linked to an AlphaDesk owner yet. <strong>No portfolio data has been opened.</strong></p>
<dl>
  <dt>Google name</dt><dd>${escapeHtml(displayName || "Not provided")}</dd>
  <dt>Display email (display information only — never used to select a portfolio)</dt><dd>${escapeHtml(identity.email ?? "Not provided")}</dd>
  <dt>Verified issuer</dt><dd>${escapeHtml(identity.issuer)}</dd>
  <dt>Verified subject</dt><dd>${escapeHtml(identity.subject)}</dd>
</dl>
<p class="note">Ask the administrator to bind this exact issuer and subject to the existing owner. After confirmation, Sign in again.</p>
<a href="/api/login">Sign in again</a>`,
  );
}

const ERROR_MESSAGES: Record<AuthErrorReason, string> = {
  callback_failed:
    "The identity provider response could not be verified. No session was created.",
  missing_state:
    "The sign-in attempt expired or its security state was missing. No session was created.",
  setup_expired:
    "The account-link setup details expired. Start sign-in again to verify the account.",
  configuration_error:
    "Sign-in is not configured correctly on this deployment. No session was created.",
};

export function parseAuthErrorReason(value: unknown): AuthErrorReason {
  return typeof value === "string" && value in ERROR_MESSAGES
    ? (value as AuthErrorReason)
    : "callback_failed";
}

export function renderAuthErrorPage(reason: AuthErrorReason): string {
  return page(
    "Sign-in could not be completed",
    `<h1>Sign-in could not be completed</h1>
<p>${escapeHtml(ERROR_MESSAGES[reason])}</p>
<p class="note">You can safely Try sign-in again. If the problem continues, check the deployment configuration.</p>
<a href="/api/login">Try sign-in again</a>`,
  );
}
