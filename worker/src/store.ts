export interface Sql {
  first<T>(query: string, ...binds: unknown[]): Promise<T | null>;
  all<T>(query: string, ...binds: unknown[]): Promise<T[]>;
  run(query: string, ...binds: unknown[]): Promise<{ changes: number }>;
}

export interface Limits {
  now: number;
  windowMs: number;
  limit: number;
  bucket: string;
}

export interface RunClock {
  now: number;
  windowMs: number;
  runTtlMs: number;
  runsPerHour: number;
  bucket: string;
}

export interface WinInput {
  runId: string;
  heroineId: string;
  now: number;
  minRunMs: number;
  windowMs: number;
  winsPerHour: number;
  bucket: string;
}

export type WinResult =
  | { ok: true; counted: true; wins: number; status: 200 }
  | { ok: true; counted: false; reason: "duplicate"; status: 200 }
  | { ok: false; error: "unknown_run"; status: 400 }
  | { ok: false; error: "too_early"; status: 429; retryAfterMs: number }
  | { ok: false; error: "rate_limited"; status: 429 };

const RATE_SQL = `INSERT INTO rate_buckets (bucket, hits, window_start)
VALUES (?1, 1, ?2)
ON CONFLICT(bucket) DO UPDATE SET
  hits = CASE
    WHEN rate_buckets.window_start <= ?2 - ?3 THEN 1
    ELSE rate_buckets.hits + 1
  END,
  window_start = CASE
    WHEN rate_buckets.window_start <= ?2 - ?3 THEN ?2
    ELSE rate_buckets.window_start
  END
RETURNING hits`;

async function hits(sql: Sql, bucket: string, now: number, windowMs: number): Promise<number> {
  const row = await sql.first<{ hits: number }>(RATE_SQL, bucket, now, windowMs);
  return Number(row?.hits ?? 0);
}

export async function createRun(sql: Sql, input: RunClock): Promise<{ ok: true; runId: string } | { ok: false; error: "rate_limited" }> {
  await sql.run(`DELETE FROM open_runs WHERE created_at < ?`, input.now - input.runTtlMs);
  await sql.run(`DELETE FROM rate_buckets WHERE window_start < ?`, input.now - input.windowMs * 2);
  const count = await hits(sql, input.bucket, input.now, input.windowMs);
  if (count > input.runsPerHour) return { ok: false, error: "rate_limited" };
  const runId = crypto.randomUUID();
  await sql.run(`INSERT INTO open_runs (run_id, created_at) VALUES (?, ?)`, runId, input.now);
  return { ok: true, runId };
}

export async function recordWin(sql: Sql, input: WinInput): Promise<WinResult> {
  const counted = await sql.first<{ heroine_id: string }>(
    `SELECT heroine_id FROM counted_runs WHERE run_id = ?`,
    input.runId,
  );
  if (counted) return { ok: true, counted: false, reason: "duplicate", status: 200 };

  const open = await sql.first<{ created_at: number }>(
    `SELECT created_at FROM open_runs WHERE run_id = ?`,
    input.runId,
  );
  if (open) {
    const elapsed = input.now - Number(open.created_at);
    if (elapsed < input.minRunMs) {
      return { ok: false, error: "too_early", status: 429, retryAfterMs: input.minRunMs - elapsed };
    }
  }

  const count = await hits(sql, input.bucket, input.now, input.windowMs);
  if (count > input.winsPerHour) return { ok: false, error: "rate_limited", status: 429 };
  if (!open) return { ok: false, error: "unknown_run", status: 400 };

  try {
    const inserted = await sql.run(
      `INSERT INTO counted_runs (run_id, heroine_id, created_at)
       SELECT ?1, ?2, ?3
       WHERE EXISTS (
         SELECT 1 FROM open_runs
         WHERE run_id = ?1 AND (?3 - created_at) >= ?4
       )`,
      input.runId,
      input.heroineId,
      input.now,
      input.minRunMs,
    );
    if (!inserted.changes) return { ok: true, counted: false, reason: "duplicate", status: 200 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique|constraint/i.test(message)) {
      return { ok: true, counted: false, reason: "duplicate", status: 200 };
    }
    throw error;
  }

  const row = await sql.first<{ wins: number }>(
    `INSERT INTO heroine_wins (heroine_id, wins) VALUES (?1, 1)
     ON CONFLICT(heroine_id) DO UPDATE SET wins = wins + 1
     RETURNING wins`,
    input.heroineId,
  );
  await sql.run(`DELETE FROM open_runs WHERE run_id = ?`, input.runId);
  return { ok: true, counted: true, wins: Number(row?.wins ?? 1), status: 200 };
}

export interface RankRow {
  id: string;
  wins: number;
  share: number;
}

export async function getRanking(sql: Sql): Promise<{ total: number; entries: RankRow[] }> {
  const rows = await sql.all<{ heroine_id: string; wins: number }>(
    `SELECT heroine_id, wins FROM heroine_wins WHERE wins > 0 ORDER BY wins DESC, heroine_id ASC`,
  );
  const total = rows.reduce((sum, row) => sum + Number(row.wins), 0);
  return {
    total,
    entries: rows.map((row) => ({
      id: row.heroine_id,
      wins: Number(row.wins),
      share: total ? Math.round((Number(row.wins) / total) * 1000) / 10 : 0,
    })),
  };
}
