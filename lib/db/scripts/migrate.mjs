import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import pg from "pg";

const ADVISORY_LOCK_ID = 81732026;
const migrationsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

function asError(error) {
  return error instanceof Error ? error : new Error(String(error));
}

function attachSuppressedError(primaryError, stage, error, logger) {
  primaryError.suppressedErrors ??= [];
  primaryError.suppressedErrors.push({ stage, error: asError(error) });
  try {
    logger.error?.(`Migration ${stage} also failed.`, error);
  } catch {
    // Logging must not replace the database failure.
  }
}

export async function loadMigrations(directory = migrationsDirectory) {
  const filenames = (await readdir(directory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
  return Promise.all(
    filenames.map(async (filename) => ({
      filename,
      sql: await readFile(path.join(directory, filename), "utf8"),
    })),
  );
}

export async function runMigrations({ client, migrations, logger = console }) {
  let lockAcquired = false;
  let transactionOpen = false;
  let primaryError;
  let appliedCount = 0;

  try {
    await client.connect();
    await client.query("select pg_advisory_lock($1)", [ADVISORY_LOCK_ID]);
    lockAcquired = true;

    await client.query("begin");
    transactionOpen = true;
    await client.query(`
      create table if not exists research_schema_migrations (
        filename varchar(255) primary key,
        checksum varchar(64) not null,
        applied_at timestamptz not null default now()
      )
    `);

    for (const migration of migrations) {
      const checksum = createHash("sha256").update(migration.sql).digest("hex");
      const applied = await client.query(
        "select checksum from research_schema_migrations where filename = $1",
        [migration.filename],
      );

      if (applied.rowCount) {
        if (applied.rows[0].checksum !== checksum) {
          throw new Error(
            `Checksum mismatch for applied migration ${migration.filename}; refusing to continue.`,
          );
        }
        continue;
      }

      await client.query(migration.sql);
      await client.query(
        "insert into research_schema_migrations (filename, checksum) values ($1, $2)",
        [migration.filename, checksum],
      );
      appliedCount += 1;
    }

    await client.query("commit");
    transactionOpen = false;
  } catch (error) {
    primaryError = asError(error);
    if (transactionOpen) {
      try {
        await client.query("rollback");
      } catch (rollbackError) {
        attachSuppressedError(primaryError, "rollback", rollbackError, logger);
      }
      transactionOpen = false;
    }
  } finally {
    if (lockAcquired) {
      try {
        await client.query("select pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
      } catch (unlockError) {
        if (primaryError) {
          attachSuppressedError(primaryError, "unlock", unlockError, logger);
        } else {
          primaryError = asError(unlockError);
        }
      }
    }

    try {
      await client.end();
    } catch (closeError) {
      if (primaryError) {
        attachSuppressedError(primaryError, "close", closeError, logger);
      } else {
        primaryError = asError(closeError);
      }
    }
  }

  if (primaryError) throw primaryError;
  logger.log(
    appliedCount === 0
      ? "No pending database migrations."
      : `Applied ${appliedCount} database migration(s).`,
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run reviewed migrations.");
  }
  const { Client } = pg;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await runMigrations({ client, migrations: await loadMigrations() });
}

const entrypoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (entrypoint === import.meta.url) {
  await main();
}
