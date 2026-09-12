import { rm } from "node:fs/promises";

const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exitCode = 1;
} else {
  await Promise.all(
    ["package-lock.json", "yarn.lock"].map((filename) =>
      rm(filename, { force: true }),
    ),
  );
}
