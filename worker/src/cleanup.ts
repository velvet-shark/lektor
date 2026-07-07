import { pathToFileURL } from "node:url";

/**
 * 24h auto-delete (PRD §4): remove R2 uploads/results for jobs older than
 * 24h, scrub their URLs in the DB and mark meta.deleted=true.
 * Runs hourly inside main.ts and standalone via `tsx src/cleanup.ts`.
 */

export const JOB_TTL_HOURS = 24;

export interface ExpirableJob {
  id: string;
  meta: Record<string, unknown>;
}

/** True when a job created at `createdAt` has outlived the TTL. Pure — unit tested. */
export function isExpired(createdAt: Date, now: Date, ttlHours = JOB_TTL_HOURS): boolean {
  return now.getTime() - createdAt.getTime() > ttlHours * 3600_000;
}

/**
 * All R2 keys belonging to a job: the upload (meta.input_key, uploads/*)
 * and both result variants (results/<id>.mp4, results/<id>-wm.mp4).
 * Pure — unit tested.
 */
export function keysForJob(job: ExpirableJob): string[] {
  const keys: string[] = [];
  const inputKey = job.meta?.input_key;
  if (typeof inputKey === "string" && inputKey.length > 0) keys.push(inputKey);
  keys.push(`results/${job.id}.mp4`, `results/${job.id}-wm.mp4`);
  return keys;
}

export interface CleanupDeps {
  /** query old, not-yet-scrubbed jobs and scrub them */
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  deleteObject: (key: string) => Promise<void>;
  log?: (msg: string) => void;
}

export interface CleanupResult {
  jobs: number;
  deletedKeys: string[];
  failedKeys: string[];
}

const SELECT_EXPIRED = `
  select id, meta from jobs
  where created_at < now() - interval '${JOB_TTL_HOURS} hours'
    and (meta->>'deleted') is distinct from 'true'
  order by created_at asc
  limit 500`;

// input_url is NOT NULL in the schema, so it is scrubbed to '' instead of null.
const SCRUB_JOB = `
  update jobs
  set input_url = '',
      result_url = null,
      meta = meta || '{"deleted": true, "download_url": null}'::jsonb,
      updated_at = now()
  where id = $1`;

/** Core cleanup pass with injected I/O so the logic is unit-testable. */
export async function runCleanup(deps: CleanupDeps): Promise<CleanupResult> {
  const log = deps.log ?? ((m: string) => console.log(m));
  const { rows } = await deps.query(SELECT_EXPIRED);
  const result: CleanupResult = { jobs: 0, deletedKeys: [], failedKeys: [] };

  for (const row of rows) {
    const job: ExpirableJob = {
      id: String(row.id),
      meta: (row.meta ?? {}) as Record<string, unknown>,
    };
    for (const key of keysForJob(job)) {
      try {
        await deps.deleteObject(key);
        result.deletedKeys.push(key);
        log(`[cleanup] deleted r2 object ${key} (job ${job.id})`);
      } catch (err) {
        result.failedKeys.push(key);
        log(`[cleanup] FAILED to delete ${key} (job ${job.id}): ${(err as Error).message}`);
      }
    }
    await deps.query(SCRUB_JOB, [job.id]);
    result.jobs++;
    log(`[cleanup] scrubbed job ${job.id} (input_url/result_url cleared, meta.deleted=true)`);
  }

  log(
    `[cleanup] pass complete: ${result.jobs} job(s), ${result.deletedKeys.length} object(s) deleted, ${result.failedKeys.length} failure(s)`
  );
  return result;
}

/** Cleanup against the real DB + R2 — used by main.ts and the CLI entry below. */
export async function runCleanupOnce(): Promise<CleanupResult> {
  const { getPool } = await import("./db.js");
  const { deleteObject } = await import("./storage.js");
  const pool = getPool();
  return runCleanup({
    query: (sql, params) => pool.query(sql, params as unknown[] | undefined),
    deleteObject,
  });
}

// standalone entry: `tsx src/cleanup.ts`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void (async () => {
    const { closePool } = await import("./db.js");
    try {
      await runCleanupOnce();
    } finally {
      await closePool();
    }
  })().catch((err) => {
    console.error("[cleanup] failed:", err);
    process.exitCode = 1;
  });
}
