import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import express from "express";

import { mountFrontend } from "./frontendHosting";

const INDEX_MARKER = "ALPHADESK_TEST_INDEX";
const ASSET_MARKER = "ALPHADESK_TEST_ASSET";
const SECRET_MARKER = "MUST_NOT_BE_SERVED";

async function fixture() {
  const cleanupDirectory = await mkdtemp(
    path.join(tmpdir(), "alphadesk-static-"),
  );
  const directory = path.join(cleanupDirectory, ".private-root", "public");
  await mkdir(path.join(directory, "assets"), { recursive: true });
  await writeFile(
    path.join(directory, "index.html"),
    `<html><body>${INDEX_MARKER}</body></html>`,
  );
  await writeFile(
    path.join(directory, "assets", "app.js"),
    `globalThis.marker = "${ASSET_MARKER}";`,
  );
  await writeFile(path.join(directory, ".env"), SECRET_MARKER);
  return { cleanupDirectory, directory };
}

async function withServer<T>(
  assetsDirectory: string,
  operation: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  mountFrontend(app, { assetsDirectory });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("missing address");
  }
  try {
    return await operation(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("frontend hosting: serves built assets and browser navigation", async () => {
  const { cleanupDirectory, directory } = await fixture();
  try {
    await withServer(directory, async (baseUrl) => {
      const navigation = await fetch(`${baseUrl}/dashboard`, {
        headers: { Accept: "text/html" },
      });
      assert.equal(navigation.status, 200);
      assert.match(await navigation.text(), new RegExp(INDEX_MARKER));

      const head = await fetch(`${baseUrl}/portfolio/holdings`, {
        method: "HEAD",
        headers: { Accept: "text/html" },
      });
      assert.equal(head.status, 200);
      assert.equal(await head.text(), "");

      const asset = await fetch(`${baseUrl}/assets/app.js`);
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get("content-type") ?? "", /javascript/);
      assert.match(await asset.text(), new RegExp(ASSET_MARKER));
    });
  } finally {
    await rm(cleanupDirectory, { recursive: true, force: true });
  }
});

test("frontend hosting: never falls unsafe or non-navigation requests through to the SPA", async () => {
  const { cleanupDirectory, directory } = await fixture();
  try {
    await withServer(directory, async (baseUrl) => {
      const cases: Array<{ path: string; init?: RequestInit }> = [
        { path: "/api/missing", init: { headers: { Accept: "text/html" } } },
        { path: "/missing.js", init: { headers: { Accept: "text/html" } } },
        { path: "/.env", init: { headers: { Accept: "text/html" } } },
        { path: "/%2eenv", init: { headers: { Accept: "text/html" } } },
        {
          path: "/dashboard",
          init: { method: "POST", headers: { Accept: "text/html" } },
        },
        {
          path: "/dashboard",
          init: { headers: { Accept: "application/json" } },
        },
      ];

      for (const item of cases) {
        const response = await fetch(`${baseUrl}${item.path}`, item.init);
        const body = await response.text();
        assert.equal(
          response.status,
          404,
          `${item.init?.method ?? "GET"} ${item.path}`,
        );
        assert.doesNotMatch(body, new RegExp(INDEX_MARKER));
        assert.doesNotMatch(body, new RegExp(SECRET_MARKER));
      }
    });
  } finally {
    await rm(cleanupDirectory, { recursive: true, force: true });
  }
});
