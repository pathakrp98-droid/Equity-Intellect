import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { usersTable } from "./auth";

export const priceRefreshAttemptStatusEnum = pgEnum(
  "price_refresh_attempt_status",
  ["running", "fresh", "partial", "failed"],
);

export interface PriceRefreshAttemptDiagnostics {
  expectedSymbols?: number;
  receivedSymbols?: number;
  providers?: Array<{
    provider: string;
    status: string;
    records: number;
  }>;
}

export const priceRefreshLeasesTable = pgTable(
  "price_refresh_leases",
  {
    name: varchar("name", { length: 160 }).primaryKey(),
    workerId: varchar("worker_id", { length: 120 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "price_refresh_leases_name_check",
      sql`btrim(${table.name}) <> ''`,
    ),
    check(
      "price_refresh_leases_worker_check",
      sql`btrim(${table.workerId}) <> ''`,
    ),
  ],
);

export const priceRefreshAttemptsTable = pgTable(
  "price_refresh_attempts",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    localDay: date("local_day").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    status: priceRefreshAttemptStatusEnum("status")
      .notNull()
      .default("running"),
    workerId: varchar("worker_id", { length: 120 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    diagnostics: jsonb("diagnostics")
      .$type<PriceRefreshAttemptDiagnostics>()
      .notNull()
      .default({}),
    errorCode: varchar("error_code", { length: 80 }),
  },
  (table) => [
    uniqueIndex("price_refresh_attempts_user_day_attempt_uidx").on(
      table.userId,
      table.localDay,
      table.attemptNumber,
    ),
    index("price_refresh_attempts_user_day_idx").on(
      table.userId,
      table.localDay,
    ),
    check(
      "price_refresh_attempts_attempt_number_check",
      sql`${table.attemptNumber} between 1 and 3`,
    ),
    check(
      "price_refresh_attempts_worker_check",
      sql`btrim(${table.workerId}) <> ''`,
    ),
  ],
);

export type PriceRefreshLeaseRow =
  typeof priceRefreshLeasesTable.$inferSelect;
export type PriceRefreshAttemptRow =
  typeof priceRefreshAttemptsTable.$inferSelect;
