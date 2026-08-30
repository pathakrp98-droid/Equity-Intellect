import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GOOGLE_ISSUER, loadAuthConfig } from "./authConfig";

describe("authentication configuration", () => {
  it("defaults to the compatible Replit provider", () => {
    assert.deepEqual(loadAuthConfig({ REPL_ID: "replit-client" }), {
      provider: "replit",
      issuer: "https://replit.com/oidc",
      clientId: "replit-client",
    });
  });

  it("accepts an explicit Replit issuer without reading Google fields", () => {
    assert.deepEqual(
      loadAuthConfig({
        AUTH_PROVIDER: "replit",
        ISSUER_URL: "https://identity.example.test/oidc",
        REPL_ID: "replit-client",
        GOOGLE_CLIENT_ID: "ignored",
        GOOGLE_CLIENT_SECRET: "ignored",
      }),
      {
        provider: "replit",
        issuer: "https://identity.example.test/oidc",
        clientId: "replit-client",
      },
    );
  });

  it("builds Google configuration from one canonical application origin", () => {
    assert.deepEqual(
      loadAuthConfig({
        AUTH_PROVIDER: "google",
        APP_ORIGIN: "https://alpha.example/",
        GOOGLE_CLIENT_ID: "google-client",
        GOOGLE_CLIENT_SECRET: "google-secret",
        ISSUER_URL: "https://attacker.example",
        REPL_ID: "ignored",
      }),
      {
        provider: "google",
        issuer: GOOGLE_ISSUER,
        clientId: "google-client",
        clientSecret: "google-secret",
        appOrigin: "https://alpha.example",
        callbackUrl: "https://alpha.example/api/callback",
      },
    );
  });

  it("allows HTTP only for loopback development origins", () => {
    for (const appOrigin of [
      "http://localhost:5000",
      "http://127.0.0.1:5000",
      "http://[::1]:5000",
    ]) {
      const config = loadAuthConfig({
        AUTH_PROVIDER: "google",
        APP_ORIGIN: appOrigin,
        GOOGLE_CLIENT_ID: "google-client",
        GOOGLE_CLIENT_SECRET: "google-secret",
      });
      assert.equal(config.provider, "google");
      assert.equal(config.appOrigin, appOrigin);
    }
  });

  it("rejects missing or unknown provider configuration", () => {
    assert.throws(() => loadAuthConfig({}), /REPL_ID/);
    assert.throws(
      () =>
        loadAuthConfig({
          AUTH_PROVIDER: "github",
          REPL_ID: "replit-client",
        }),
      /AUTH_PROVIDER/,
    );
    assert.throws(
      () => loadAuthConfig({ AUTH_PROVIDER: "google" }),
      /APP_ORIGIN/,
    );
    assert.throws(
      () =>
        loadAuthConfig({
          AUTH_PROVIDER: "google",
          APP_ORIGIN: "https://alpha.example",
          GOOGLE_CLIENT_SECRET: "google-secret",
        }),
      /GOOGLE_CLIENT_ID/,
    );
    assert.throws(
      () =>
        loadAuthConfig({
          AUTH_PROVIDER: "google",
          APP_ORIGIN: "https://alpha.example",
          GOOGLE_CLIENT_ID: "google-client",
        }),
      /GOOGLE_CLIENT_SECRET/,
    );
  });

  it("rejects non-origin and credential-bearing APP_ORIGIN values", () => {
    for (const appOrigin of [
      "https://alpha.example/path",
      "https://alpha.example/?query=1",
      "https://alpha.example/#fragment",
      "https://user:password@alpha.example",
      "http://alpha.example",
      "ftp://alpha.example",
      "not a URL",
    ]) {
      assert.throws(
        () =>
          loadAuthConfig({
            AUTH_PROVIDER: "google",
            APP_ORIGIN: appOrigin,
            GOOGLE_CLIENT_ID: "google-client",
            GOOGLE_CLIENT_SECRET: "google-secret",
          }),
        /APP_ORIGIN/,
        appOrigin,
      );
    }
  });

  it("rejects invalid Replit issuer and blank client values", () => {
    assert.throws(
      () =>
        loadAuthConfig({
          AUTH_PROVIDER: "replit",
          ISSUER_URL: "not a URL",
          REPL_ID: "replit-client",
        }),
      /ISSUER_URL/,
    );
    assert.throws(
      () => loadAuthConfig({ AUTH_PROVIDER: "replit", REPL_ID: "   " }),
      /REPL_ID/,
    );
    assert.throws(
      () =>
        loadAuthConfig({
          AUTH_PROVIDER: "google",
          APP_ORIGIN: "https://alpha.example",
          GOOGLE_CLIENT_ID: "   ",
          GOOGLE_CLIENT_SECRET: "google-secret",
        }),
      /GOOGLE_CLIENT_ID/,
    );
  });
});
