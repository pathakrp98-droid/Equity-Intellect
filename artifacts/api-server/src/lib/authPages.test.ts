import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getSafeReturnTo,
  renderAuthErrorPage,
  renderIdentitySetupPage,
} from "./authPages";

describe("authentication pages", () => {
  it("keeps only local return paths", () => {
    assert.equal(getSafeReturnTo("/"), "/");
    assert.equal(getSafeReturnTo("/portfolio"), "/portfolio");
    assert.equal(
      getSafeReturnTo("/research?holding=ABC#sources"),
      "/research?holding=ABC#sources",
    );

    for (const unsafe of [
      undefined,
      "",
      "portfolio",
      "https://attacker.example/",
      "//attacker.example/",
      "/\\attacker.example/",
      "/path\nheader",
      "/%00path",
      "/%5c%5cattacker.example",
      ["/portfolio"],
    ]) {
      assert.equal(getSafeReturnTo(unsafe), "/", JSON.stringify(unsafe));
    }
  });

  it("escapes every displayed identity value and explains the safety boundary", () => {
    const page = renderIdentitySetupPage({
      issuer: 'https://accounts.google.com/<script id="issuer">',
      subject: '<img src=x onerror="subject">',
      email: '<script id="email">bad@example.com</script>',
      firstName: "<b>First</b>",
      lastName: "& Last",
      profileImageUrl: null,
    });

    assert.doesNotMatch(page, /<script id=|<img src=|<b>First/);
    assert.match(page, /&lt;script id=&quot;issuer&quot;&gt;/);
    assert.match(page, /&lt;img src=x onerror=&quot;subject&quot;&gt;/);
    assert.match(page, /display information only/i);
    assert.match(page, /No portfolio data has been opened/i);
    assert.match(page, /https:\/\/accounts\.google\.com/);
    assert.match(page, /Sign in again/);
  });

  it("renders a closed recoverable error reason without raw provider text", () => {
    const page = renderAuthErrorPage("callback_failed");
    assert.match(page, /Sign-in could not be completed/i);
    assert.match(page, /Try sign-in again/i);
    assert.doesNotMatch(page, /access_token|client_secret|stack/i);
  });
});
