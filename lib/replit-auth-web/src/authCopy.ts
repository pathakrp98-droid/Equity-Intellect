export type AuthProvider = "replit" | "google";

export function getSignInLabel(provider: AuthProvider | undefined): string {
  return provider === "google" ? "Sign in with Google" : "Sign in";
}
