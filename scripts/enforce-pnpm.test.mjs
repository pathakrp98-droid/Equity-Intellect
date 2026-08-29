import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./enforce-pnpm.mjs", import.meta.url));

async function withDirectory(operation) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "alphadesk-pnpm-"));
  try {
    await operation(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("non-pnpm clients are rejected without removing lockfiles", async () => {
  await withDirectory(async (directory) => {
    const lockfile = path.join(directory, "package-lock.json");
    await writeFile(lockfile, '{"keep":true}', "utf8");

    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: directory,
      env: { ...process.env, npm_config_user_agent: "npm/11.0.0" },
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Use pnpm instead/);
    assert.equal(await readFile(lockfile, "utf8"), '{"keep":true}');
  });
});

test("pnpm removes conflicting lockfiles and preserves other files", async () => {
  await withDirectory(async (directory) => {
    await Promise.all([
      writeFile(path.join(directory, "package-lock.json"), "npm", "utf8"),
      writeFile(path.join(directory, "yarn.lock"), "yarn", "utf8"),
      writeFile(path.join(directory, "keep.txt"), "safe", "utf8"),
    ]);

    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: directory,
      env: { ...process.env, npm_config_user_agent: "pnpm/11.19.0" },
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    await assert.rejects(readFile(path.join(directory, "package-lock.json")));
    await assert.rejects(readFile(path.join(directory, "yarn.lock")));
    assert.equal(await readFile(path.join(directory, "keep.txt"), "utf8"), "safe");
  });
});
