import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline } from "@lektor/pipeline";
import { getPool, closePool, type JobRow } from "./db.js";
import { getObjectToFile, putObjectFromFile, publicUrl } from "./storage.js";
import { probeFile, validateInput } from "./validate.js";
import { runCleanupOnce } from "./cleanup.js";

const exec = promisify(execFile);

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 3000);
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_JOBS ?? 3);
const CLEANUP_INTERVAL_MS = 3600_000; // hourly
const PORT = Number(process.env.PORT ?? 8080);

// pipeline ships the watermark PNG next to its sources
const WATERMARK_PNG = resolve(
  dirname(fileURLToPath(import.meta.resolve("@lektor/pipeline"))),
  "../assets/watermark.png"
);

function voiceId(): string {
  const v = process.env.LEKTOR_VOICE_ID;
  if (!v) throw new Error("LEKTOR_VOICE_ID not set");
  return v;
}

/** Map pipeline progress states to job.status values (schema check constraint). */
export function statusForProgress(state: string): string | null {
  if (state.startsWith("transcrib")) return "transcribing";
  if (state.startsWith("translat")) return "translating";
  if (state.startsWith("summoning") || state.startsWith("re-condensing")) return "summoning";
  if (state.startsWith("mixing")) return "mixing";
  return null;
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NO_SPEECH")) return "No speech detected in this clip";
  return "Something went wrong while processing this clip";
}

const active = new Set<string>();

async function setStatus(jobId: string, status: string): Promise<void> {
  await getPool()
    .query(`update jobs set status = $2, updated_at = now() where id = $1`, [jobId, status])
    .catch((err) => console.error(`[job ${jobId}] status update failed:`, err.message));
}

/** Atomically claim up to `limit` queued jobs (oldest first). */
async function claimJobs(limit: number): Promise<JobRow[]> {
  const { rows } = await getPool().query<JobRow>(
    `update jobs
     set status = 'transcribing', started_at = now(), updated_at = now()
     where id in (
       select id from jobs
       where status = 'queued'
       order by created_at asc
       limit $1
       for update skip locked
     )
     returning id, input_url, meta`,
    [limit]
  );
  return rows;
}

async function fetchInput(job: JobRow, dest: string): Promise<void> {
  const inputKey = job.meta?.input_key;
  if (typeof inputKey === "string" && inputKey.length > 0) {
    await getObjectToFile(inputKey, dest);
    return;
  }
  // fallback: signed/public URL
  const res = await fetch(job.input_url);
  if (!res.ok) throw new Error(`input download failed: ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

/** Burn the corner watermark into an already-mixed result (download variant). */
async function renderWatermarked(input: string, output: string): Promise<void> {
  await exec(
    "ffmpeg",
    [
      "-y", "-i", input, "-i", WATERMARK_PNG,
      "-filter_complex", "[0:v][1:v]overlay=W-w-12:H-h-10[v]",
      "-map", "[v]", "-map", "0:a",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
      "-c:a", "copy",
      output,
    ],
    { maxBuffer: 64 * 1024 * 1024 }
  );
}

async function processJob(job: JobRow): Promise<void> {
  const pool = getPool();
  const workDir = await mkdtemp(join(tmpdir(), `lektor-${job.id}-`));
  console.log(`[job ${job.id}] claimed, workdir ${workDir}`);

  try {
    const input = join(workDir, "input.mp4");
    await fetchInput(job, input);

    // server-side input constraints: ≤90s, must have audio
    const invalid = validateInput(await probeFile(input));
    if (invalid) {
      console.log(`[job ${job.id}] rejected: ${invalid}`);
      await pool.query(
        `update jobs set status = 'error', error = $2, finished_at = now(), updated_at = now()
         where id = $1`,
        [job.id, invalid]
      );
      return;
    }

    const output = join(workDir, "result.mp4");
    const result = await runPipeline({
      input,
      output,
      workDir,
      voiceId: voiceId(),
      onProgress: (state) => {
        const status = statusForProgress(state);
        console.log(`[job ${job.id}] ${state}`);
        if (status) void setStatus(job.id, status);
      },
    });

    // watermarked download variant (same mix, watermark burned in)
    const wmOutput = join(workDir, "result-wm.mp4");
    await renderWatermarked(output, wmOutput);

    const resultKey = `results/${job.id}.mp4`;
    const wmKey = `results/${job.id}-wm.mp4`;
    await putObjectFromFile(resultKey, output, "video/mp4");
    await putObjectFromFile(wmKey, wmOutput, "video/mp4");

    const metaPatch = {
      download_url: publicUrl(wmKey),
      schedule_log: result.scheduleLog,
      language: result.languageCode,
      segments: result.segments,
      recondensed: result.recondensed,
    };
    await pool.query(
      `update jobs
       set status = 'done', result_url = $2, error = null,
           meta = meta || $3::jsonb,
           finished_at = now(), updated_at = now()
       where id = $1`,
      [job.id, publicUrl(resultKey), JSON.stringify(metaPatch)]
    );
    console.log(`[job ${job.id}] done → ${publicUrl(resultKey)}`);
  } catch (err) {
    console.error(`[job ${job.id}] failed:`, err);
    await pool
      .query(
        `update jobs set status = 'error', error = $2, finished_at = now(), updated_at = now()
         where id = $1`,
        [job.id, friendlyError(err)]
      )
      .catch((e) => console.error(`[job ${job.id}] error update failed:`, e.message));
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function tick(): Promise<void> {
  const free = MAX_CONCURRENT - active.size;
  if (free <= 0) return;
  let jobs: JobRow[];
  try {
    jobs = await claimJobs(free);
  } catch (err) {
    console.error("[poll] claim failed:", (err as Error).message);
    return;
  }
  for (const job of jobs) {
    active.add(job.id);
    processJob(job)
      .catch((err) => console.error(`[job ${job.id}] unhandled:`, err))
      .finally(() => active.delete(job.id));
  }
}

function startHealthServer(): void {
  const server = createServer(async (_req, res) => {
    try {
      const { rows } = await getPool().query<{ queued: string }>(
        `select count(*)::text as queued from jobs where status = 'queued'`
      );
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, queued: Number(rows[0].queued), active: active.size }));
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: (err as Error).message }));
    }
  });
  server.listen(PORT, () => console.log(`[health] listening on :${PORT}`));
}

function main(): void {
  voiceId(); // fail fast on missing config
  console.log(
    `[worker] starting: poll ${POLL_INTERVAL_MS}ms, max ${MAX_CONCURRENT} concurrent jobs`
  );
  startHealthServer();

  const pollTimer = setInterval(() => void tick(), POLL_INTERVAL_MS);
  void tick();

  // hourly 24h auto-delete pass (also runs once at startup)
  const cleanupTimer = setInterval(
    () => void runCleanupOnce().catch((err) => console.error("[cleanup] failed:", err.message)),
    CLEANUP_INTERVAL_MS
  );
  void runCleanupOnce().catch((err) => console.error("[cleanup] failed:", err.message));

  const shutdown = () => {
    console.log("[worker] shutting down");
    clearInterval(pollTimer);
    clearInterval(cleanupTimer);
    void closePool().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
