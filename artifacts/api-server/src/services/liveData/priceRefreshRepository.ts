export interface PriceRefreshQueryResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number | null;
}

export interface PriceRefreshQueryAdapter {
  query(text: string, values?: unknown[]): Promise<PriceRefreshQueryResult>;
}

export type AutomaticAttemptStatus = "fresh" | "partial" | "failed";

export interface AutomaticAttemptDiagnostics {
  expectedSymbols: number;
  receivedSymbols: number;
  providers: Array<{
    provider: string;
    status: string;
    records: number;
  }>;
}

export type AutomaticAttemptClaim =
  | {
      claimed: true;
      attemptId: number;
      attemptNumber: number;
      localDay: string;
    }
  | {
      claimed: false;
      reason:
        | "already_fresh"
        | "attempt_limit"
        | "retry_not_due"
        | "concurrent_attempt";
    };

const KOLKATA_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function localDateInKolkata(now: Date): string {
  if (!Number.isFinite(now.getTime())) throw new Error("now is invalid");
  const parts = Object.fromEntries(
    KOLKATA_DATE_FORMATTER.formatToParts(now).map((part) => [
      part.type,
      part.value,
    ]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function boundedText(value: string, name: string, maximum: number): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum) {
    throw new Error(`${name} is invalid`);
  }
  return cleaned;
}

function finiteDuration(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1 || value > 60 * 60_000) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

function asPositiveInteger(value: unknown, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} is invalid`);
  return parsed;
}

export class PriceRefreshRepository {
  constructor(private readonly client: PriceRefreshQueryAdapter) {}

  async listActivePortfolioUserIds(): Promise<string[]> {
    const result = await this.client.query(`
      SELECT DISTINCT p.user_id
      FROM portfolios p
      WHERE EXISTS (
        SELECT 1 FROM portfolio_holdings h WHERE h.portfolio_id = p.id
      ) OR EXISTS (
        SELECT 1 FROM portfolio_direct_holdings d WHERE d.portfolio_id = p.id
      )
      ORDER BY p.user_id
    `);
    return result.rows
      .map((row) => row.user_id)
      .filter((userId): userId is string => typeof userId === "string");
  }

  async acquirePriceRefreshLease(input: {
    name: string;
    workerId: string;
    now: Date;
    leaseMs: number;
  }): Promise<boolean> {
    const name = boundedText(input.name, "lease name", 160);
    const workerId = boundedText(input.workerId, "worker ID", 120);
    const leaseMs = finiteDuration(input.leaseMs, "lease duration");
    if (!Number.isFinite(input.now.getTime())) throw new Error("now is invalid");
    const expiresAt = new Date(input.now.getTime() + leaseMs);
    const result = await this.client.query(
      `
        INSERT INTO price_refresh_leases (name, worker_id, expires_at, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO UPDATE
        SET worker_id = EXCLUDED.worker_id,
            expires_at = EXCLUDED.expires_at,
            updated_at = EXCLUDED.updated_at
        WHERE price_refresh_leases.expires_at <= $4
           OR price_refresh_leases.worker_id = $2
        RETURNING name
      `,
      [name, workerId, expiresAt, input.now],
    );
    return result.rows.length === 1;
  }

  async releasePriceRefreshLease(input: {
    name: string;
    workerId: string;
  }): Promise<boolean> {
    const result = await this.client.query(
      `
        DELETE FROM price_refresh_leases
        WHERE name = $1 AND worker_id = $2
        RETURNING name
      `,
      [
        boundedText(input.name, "lease name", 160),
        boundedText(input.workerId, "worker ID", 120),
      ],
    );
    return result.rows.length === 1;
  }

  async claimAutomaticPriceAttempt(input: {
    userId: string;
    workerId: string;
    now: Date;
    cooldownMs?: number;
  }): Promise<AutomaticAttemptClaim> {
    const userId = boundedText(input.userId, "user ID", 255);
    const workerId = boundedText(input.workerId, "worker ID", 120);
    if (!Number.isFinite(input.now.getTime())) throw new Error("now is invalid");
    const cooldownMs = finiteDuration(
      input.cooldownMs ?? 30 * 60_000,
      "retry cooldown",
    );
    const localDay = localDateInKolkata(input.now);
    const retryCutoff = new Date(input.now.getTime() - cooldownMs);

    const inserted = await this.client.query(
      `
        WITH day_state AS (
          SELECT
            count(*)::integer AS attempt_count,
            coalesce(bool_or(status = 'fresh'), false) AS has_fresh,
            max(started_at) AS last_started_at,
            coalesce(max(attempt_number), 0)::integer AS last_attempt_number
          FROM price_refresh_attempts
          WHERE user_id = $1 AND local_day = $2
        )
        INSERT INTO price_refresh_attempts (
          user_id, local_day, attempt_number, status, worker_id, started_at
        )
        SELECT $1, $2, last_attempt_number + 1, 'running', $3, $4
        FROM day_state
        WHERE has_fresh = false
          AND attempt_count < 3
          AND (last_started_at IS NULL OR last_started_at <= $5)
        ON CONFLICT DO NOTHING
        RETURNING id, attempt_number, local_day
      `,
      [userId, localDay, workerId, input.now, retryCutoff],
    );
    const claimed = inserted.rows[0];
    if (claimed) {
      return {
        claimed: true,
        attemptId: asPositiveInteger(claimed.id, "attempt ID"),
        attemptNumber: asPositiveInteger(
          claimed.attempt_number,
          "attempt number",
        ),
        localDay: String(claimed.local_day),
      };
    }

    const existing = await this.client.query(
      `
        SELECT status, attempt_number, started_at
        FROM price_refresh_attempts
        WHERE user_id = $1 AND local_day = $2
        ORDER BY attempt_number DESC
      `,
      [userId, localDay],
    );
    if (existing.rows.some((row) => row.status === "fresh")) {
      return { claimed: false, reason: "already_fresh" };
    }
    const latest = existing.rows[0];
    if (latest && Number(latest.attempt_number) >= 3) {
      return { claimed: false, reason: "attempt_limit" };
    }
    const latestStartedAt = latest?.started_at;
    const latestDate =
      latestStartedAt instanceof Date
        ? latestStartedAt
        : typeof latestStartedAt === "string"
          ? new Date(latestStartedAt)
          : null;
    if (latestDate && latestDate.getTime() > retryCutoff.getTime()) {
      return { claimed: false, reason: "retry_not_due" };
    }
    return { claimed: false, reason: "concurrent_attempt" };
  }

  async completeAutomaticPriceAttempt(input: {
    attemptId: number;
    userId: string;
    workerId: string;
    status: AutomaticAttemptStatus;
    completedAt: Date;
    diagnostics: AutomaticAttemptDiagnostics;
    errorCode?: string | null;
  }): Promise<boolean> {
    const attemptId = asPositiveInteger(input.attemptId, "attempt ID");
    const userId = boundedText(input.userId, "user ID", 255);
    const workerId = boundedText(input.workerId, "worker ID", 120);
    if (!Number.isFinite(input.completedAt.getTime())) {
      throw new Error("completion time is invalid");
    }
    if (!(["fresh", "partial", "failed"] as const).includes(input.status)) {
      throw new Error("attempt status is invalid");
    }
    const errorCode = input.errorCode
      ? boundedText(input.errorCode, "error code", 80)
      : null;
    const diagnostics = JSON.stringify(input.diagnostics);
    if (diagnostics.length > 20_000) throw new Error("diagnostics are too large");

    const result = await this.client.query(
      `
        UPDATE price_refresh_attempts
        SET status = $4,
            completed_at = $5,
            error_code = $6,
            diagnostics = $7::jsonb
        WHERE id = $1
          AND user_id = $2
          AND worker_id = $3
          AND status = 'running'
        RETURNING id
      `,
      [
        attemptId,
        userId,
        workerId,
        input.status,
        input.completedAt,
        errorCode,
        diagnostics,
      ],
    );
    return result.rows.length === 1;
  }
}
