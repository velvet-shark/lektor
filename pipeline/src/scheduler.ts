/**
 * The lektor timing scheduler — PRD §3.4, implemented exactly.
 *
 * Rules:
 * 1. Lektor line starts LEKTOR_DELAY_MS (600–900ms) after the original line
 *    starts — the original is briefly heard first; that's the signature.
 * 2. If the Polish audio is longer than the segment window
 *    (next segment start − this segment start − 300ms), first speed up with
 *    atempo up to 1.12×; if still long, let it overlap the next segment's
 *    start by up to 800ms; beyond that, flag for re-condensing (second LLM
 *    pass: "shorten by ~30%").
 * 3. Never start a lektor line before its original line.
 * 4. Gaps with no dialogue: untouched full-volume original (the scheduler
 *    simply places nothing there; ducking windows are derived from
 *    placements only).
 *
 * Deterministic: (segments, durations, constants) → placement list.
 */

export interface ScheduleSegment {
  /** segment index */
  i: number;
  /** original line start, ms into the video */
  startMs: number;
  /** original line end, ms into the video */
  endMs: number;
  /** duration of the rendered Polish TTS audio at 1.0× tempo, ms */
  ttsDurationMs: number;
  /** path/id of the TTS audio file */
  file: string;
}

export interface Placement {
  i: number;
  file: string;
  /** where the lektor line is placed on the timeline, ms */
  atMs: number;
  /** ffmpeg atempo factor applied (1.0 = untouched), ≤ MAX_ATEMPO */
  atempo: number;
  /** effective duration after atempo, ms */
  durationMs: number;
  /** ends past the allowed overlap → needs a re-condense (shorter translation) pass */
  needsRecondense: boolean;
  /** how far past the next segment's original start this line runs, ms (0 if none) */
  overlapNextMs: number;
}

export interface SchedulerConstants {
  /** rule 1: lektor starts this long after the original line, 600–900 */
  delayMs: number;
  /** rule 2: max atempo speed-up */
  maxAtempo: number;
  /** rule 2: max run-over past the next segment's original start */
  maxOverlapMs: number;
  /** rule 2: margin subtracted from the segment window */
  windowMarginMs: number;
}

export const DEFAULT_CONSTANTS: SchedulerConstants = {
  delayMs: 700,
  maxAtempo: 1.12,
  maxOverlapMs: 800,
  windowMarginMs: 300,
};

/** Validates constants stay inside the PRD's authentic ranges. */
export function assertConstants(c: SchedulerConstants): void {
  if (c.delayMs < 600 || c.delayMs > 900)
    throw new Error(`delayMs must be 600–900, got ${c.delayMs}`);
  if (c.maxAtempo > 1.12)
    throw new Error(`maxAtempo must be ≤1.12, got ${c.maxAtempo}`);
  if (c.maxOverlapMs > 800)
    throw new Error(`maxOverlapMs must be ≤800, got ${c.maxOverlapMs}`);
}

/**
 * @param segments  utterances sorted by startMs
 * @param clipEndMs total duration of the video, ms
 */
export function schedule(
  segments: ScheduleSegment[],
  clipEndMs: number,
  constants: SchedulerConstants = DEFAULT_CONSTANTS
): Placement[] {
  assertConstants(constants);
  const { delayMs, maxAtempo, maxOverlapMs, windowMarginMs } = constants;

  const placements: Placement[] = [];
  let prevLektorEndMs = 0; // one voice: a line can never start before the previous one ended

  for (let k = 0; k < segments.length; k++) {
    const seg = segments[k];
    const nextStartMs = k + 1 < segments.length ? segments[k + 1].startMs : clipEndMs;

    // Rules 1 + 3: start after the original line, after the previous lektor line.
    const atMs = Math.max(seg.startMs + delayMs, prevLektorEndMs);

    // Rule 2: the window the Polish audio should fit in.
    const windowMs = Math.max(0, nextStartMs - atMs - windowMarginMs);

    let atempo = 1.0;
    let durationMs = seg.ttsDurationMs;
    if (durationMs > windowMs) {
      atempo = Math.min(maxAtempo, windowMs > 0 ? durationMs / windowMs : maxAtempo);
      durationMs = Math.round(seg.ttsDurationMs / atempo);
    }

    const endMs = atMs + durationMs;
    // Overlap is measured against the next segment's ORIGINAL start (PRD wording:
    // "overlap the next segment start by up to 800ms").
    const overlapNextMs = Math.max(0, endMs - nextStartMs);
    const needsRecondense = overlapNextMs > maxOverlapMs;

    placements.push({
      i: seg.i,
      file: seg.file,
      atMs,
      atempo: Number(atempo.toFixed(4)),
      durationMs,
      needsRecondense,
      overlapNextMs,
    });

    prevLektorEndMs = endMs;
  }

  return placements;
}

/**
 * Ducking windows for the ffmpeg mix (§3.5): one enable-window per lektor
 * line. Everything outside these windows is full-volume original (rule 4).
 */
export interface DuckWindow {
  fromMs: number;
  toMs: number;
}

export function duckWindows(placements: Placement[], mergeGapMs = 250): DuckWindow[] {
  const windows: DuckWindow[] = [];
  for (const p of placements) {
    const from = p.atMs;
    const to = p.atMs + p.durationMs;
    const last = windows[windows.length - 1];
    if (last && from - last.toMs <= mergeGapMs) {
      last.toMs = Math.max(last.toMs, to);
    } else {
      windows.push({ fromMs: from, toMs: to });
    }
  }
  return windows;
}

/** Human-readable schedule log — an acceptance criterion (per-clip schedule logged). */
export function formatScheduleLog(
  segments: ScheduleSegment[],
  placements: Placement[],
  constants: SchedulerConstants
): string {
  const lines = [
    `# lektor schedule (delay=${constants.delayMs}ms maxAtempo=${constants.maxAtempo} maxOverlap=${constants.maxOverlapMs}ms margin=${constants.windowMarginMs}ms)`,
    `seg | orig_start | lektor_at | delay | atempo | dur_ms | overlap_next | recondense`,
  ];
  for (let k = 0; k < placements.length; k++) {
    const p = placements[k];
    const s = segments[k];
    lines.push(
      `${String(p.i).padStart(3)} | ${String(s.startMs).padStart(10)} | ${String(p.atMs).padStart(9)} | ${String(p.atMs - s.startMs).padStart(5)} | ${p.atempo.toFixed(3)} | ${String(p.durationMs).padStart(6)} | ${String(p.overlapNextMs).padStart(12)} | ${p.needsRecondense ? "YES" : "no"}`
    );
  }
  return lines.join("\n");
}
