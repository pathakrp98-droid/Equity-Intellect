import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  bindExternalIdentity,
  validateExternalIdentityBinding,
  type ExternalIdentityBindingInput,
} from "../services/auth/externalIdentityRepository";

const USAGE =
  "Usage: auth:bind -- --issuer <issuer> --subject <subject> --user-id <existing-user-id>";
const FLAG_TO_FIELD = {
  "--issuer": "issuer",
  "--subject": "subject",
  "--user-id": "userId",
} as const;

export interface BindingCommandDependencies {
  bind(
    input: ExternalIdentityBindingInput,
  ): Promise<"created" | "already_bound">;
  log(message: string): void;
  close(): Promise<void>;
}

function usageError(): Error {
  return new Error(USAGE);
}

export function parseBindingArgs(
  argumentsList: string[],
): ExternalIdentityBindingInput {
  const parsed: Partial<ExternalIdentityBindingInput> = {};
  const seen = new Set<string>();

  for (let index = 0; index < argumentsList.length; index += 2) {
    const flag = argumentsList[index];
    const value = argumentsList[index + 1];
    if (
      !flag ||
      !(flag in FLAG_TO_FIELD) ||
      seen.has(flag) ||
      value === undefined ||
      value.startsWith("--")
    ) {
      throw usageError();
    }
    seen.add(flag);
    const field = FLAG_TO_FIELD[flag as keyof typeof FLAG_TO_FIELD];
    parsed[field] = value;
  }

  if (
    argumentsList.length !== 6 ||
    parsed.issuer === undefined ||
    parsed.subject === undefined ||
    parsed.userId === undefined
  ) {
    throw usageError();
  }

  return validateExternalIdentityBinding(
    parsed as ExternalIdentityBindingInput,
  );
}

function safeMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "External identity binding failed.";
}

export async function runBindingCommand(
  argumentsList: string[],
  dependencies: BindingCommandDependencies,
): Promise<number> {
  let exitCode = 0;
  try {
    const result = await dependencies.bind(parseBindingArgs(argumentsList));
    dependencies.log(`External identity binding: ${result}.`);
  } catch (error) {
    dependencies.log(safeMessage(error));
    exitCode = 1;
  } finally {
    try {
      await dependencies.close();
    } catch {
      dependencies.log("Database connection cleanup failed.");
      exitCode = 1;
    }
  }
  return exitCode;
}

async function main(): Promise<void> {
  const { pool } = await import("@workspace/db");
  process.exitCode = await runBindingCommand(process.argv.slice(2), {
    bind: bindExternalIdentity,
    log: (message) => console.log(message),
    close: () => pool.end(),
  });
}

const entrypoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (entrypoint === import.meta.url) {
  await main();
}
