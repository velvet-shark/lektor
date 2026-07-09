export const PROCESSING_STATUSES = [
  "transcribing",
  "translating",
  "summoning",
  "mixing",
] as const;

export type QueueQuery = (
  sql: string,
  params?: unknown[]
) => Promise<{ rows: Record<string, unknown>[] }>;

/**
 * A container can disappear mid-render. Recover only on worker startup and use
 * a generous age so a slow but live render is never duplicated.
 */
export async function recoverStaleJobs(
  query: QueueQuery,
  staleAfterMinutes = 30
): Promise<string[]> {
  const { rows } = await query(
    `update jobs
     set status = 'queued', started_at = null, updated_at = now(),
         meta = meta || jsonb_build_object('recovered_at', now()::text)
     where status = any($1::text[])
       and started_at < now() - ($2 * interval '1 minute')
     returning id`,
    [[...PROCESSING_STATUSES], staleAfterMinutes]
  );
  return rows.map((row) => String(row.id));
}

/** Return in-flight work to the queue before a planned shutdown. */
export async function requeueActiveJobs(
  query: QueueQuery,
  jobIds: string[]
): Promise<string[]> {
  if (jobIds.length === 0) return [];
  const { rows } = await query(
    `update jobs
     set status = 'queued', started_at = null, updated_at = now(),
         meta = meta || jsonb_build_object('requeued_at', now()::text)
     where id = any($1::uuid[])
       and status = any($2::text[])
     returning id`,
    [jobIds, [...PROCESSING_STATUSES]]
  );
  return rows.map((row) => String(row.id));
}
