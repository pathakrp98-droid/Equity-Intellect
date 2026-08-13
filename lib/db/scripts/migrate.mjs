import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const ADVISORY_LOCK_ID = 81732026;
const migrationsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run reviewed migrations.");
}

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
let lockAcquired = false;
let transactionOpen = false;

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

  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
  let appliedCount = 0;

  for (const filename of filenames) {
    const migrationSql = await readFile(
      path.join(migrationsDirectory, filename),
      "utf8",
    );
    const checksum = createHash("sha256").update(migrationSql).digest("hex");
    const applied = await client.query(
      "select checksum from research_schema_migrations where filename = $1",
      [filename],
    );

    if (applied.rowCount) {
      if (applied.rows[0].checksum !== checksum) {
        throw new Error(
          `Checksum mismatch for applied migration ${filename}; refusing to continue.`,
        );
      }
      continue;
    }

    await client.query(migrationSql);
    await client.query(
      "insert into research_schema_migrations (filename, checksum) values ($1, $2)",
      [filename, checksum],
    );
    appliedCount += 1;
  }

  await client.query("commit");
  transactionOpen = false;
  console.log(
    appliedCount === 0
      ? "No pending database migrations."
      : `Applied ${appliedCount} database migration(s).`,
  );
} catch (error) {
  if (transactionOpen) {
    try {
      await client.query("rollback");
    } catch (rollbackError) {
      error.cause ??= rollbackError;
    }
    transactionOpen = false;
  }
  throw error;
} finally {
  try {
    if (lockAcquired) {
      await client.query("select pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
    }
  } finally {
    await client.end();
  }
}
