import { describe, it, expect } from "vitest";
import {
  schedule,
  duckWindows,
  assertConstants,
  DEFAULT_CONSTANTS,
  type ScheduleSegment,
} from "../src/scheduler.js";

const seg = (i: number, startMs: number, endMs: number, ttsDurationMs: number): ScheduleSegment => ({
  i,
  startMs,
  endMs,
  ttsDurationMs,
  file: `seg-${i}.mp3`,
});

describe("scheduler — PRD §3.4", () => {
  it("rule 1: lektor starts delayMs after the original line", () => {
    const p = schedule([seg(0, 1000, 3000, 1500)], 10000);
    expect(p[0].atMs).toBe(1000 + DEFAULT_CONSTANTS.delayMs);
    expect(p[0].atempo).toBe(1);
    expect(p[0].needsRecondense).toBe(false);
  });

  it("rule 3: never starts before the original line (delay always positive)", () => {
    const p = schedule([seg(0, 0, 2000, 1000)], 5000);
    expect(p[0].atMs).toBeGreaterThanOrEqual(0 + 600);
  });

  it("fits comfortably: no atempo, no overlap", () => {
    const p = schedule(
      [seg(0, 0, 2000, 1000), seg(1, 5000, 7000, 1500)],
      20000
    );
    expect(p[0].atempo).toBe(1);
    expect(p[0].overlapNextMs).toBe(0);
    expect(p[1].atMs).toBe(5700);
  });

  it("rule 2a: too long for window → atempo up to 1.12", () => {
    // window = next.start(5000) − at(700) − 300 = 4000; tts 4300 → atempo 1.075
    const p = schedule([seg(0, 0, 3000, 4300), seg(1, 5000, 6000, 500)], 20000);
    expect(p[0].atempo).toBeCloseTo(4300 / 4000, 3);
    expect(p[0].atempo).toBeLessThanOrEqual(1.12);
    expect(p[0].overlapNextMs).toBe(0);
    expect(p[0].needsRecondense).toBe(false);
  });

  it("rule 2b: atempo capped at 1.12, then overlaps next start ≤800ms", () => {
    // window = 4000; tts 5200 → needs 1.3× but cap 1.12 → dur 4643, end 5343 → overlap 343
    const p = schedule([seg(0, 0, 3000, 5200), seg(1, 5000, 6000, 500)], 20000);
    expect(p[0].atempo).toBe(1.12);
    expect(p[0].durationMs).toBe(Math.round(5200 / 1.12));
    expect(p[0].overlapNextMs).toBe(700 + Math.round(5200 / 1.12) - 5000);
    expect(p[0].overlapNextMs).toBeLessThanOrEqual(800);
    expect(p[0].needsRecondense).toBe(false);
  });

  it("rule 2c: beyond 800ms overlap → flagged for re-condense", () => {
    // window = 4000; tts 6200 → at 1.12 dur 5536, end 6236 → overlap 1236 > 800
    const p = schedule([seg(0, 0, 3000, 6200), seg(1, 5000, 6000, 500)], 20000);
    expect(p[0].atempo).toBe(1.12);
    expect(p[0].overlapNextMs).toBeGreaterThan(800);
    expect(p[0].needsRecondense).toBe(true);
  });

  it("one voice: next line waits for the previous to finish (start pushed)", () => {
    // seg0 lektor: at 700, dur 5000 → ends 5700 past seg1's desired 5000+700=5700 → equal, ok
    // make it end later: dur 6000 → ends 6700 → seg1 starts 6700 not 5700
    const p = schedule(
      [seg(0, 0, 4800, 6000), seg(1, 5000, 9000, 1000)],
      30000
    );
    const end0 = p[0].atMs + p[0].durationMs;
    expect(p[1].atMs).toBe(Math.max(5000 + 700, end0));
    expect(p[1].atMs).toBeGreaterThanOrEqual(end0);
  });

  it("pushed start still never precedes its own original line", () => {
    const p = schedule(
      [seg(0, 0, 4800, 6000), seg(1, 5000, 9000, 1000)],
      30000
    );
    expect(p[1].atMs).toBeGreaterThanOrEqual(5000);
  });

  it("rule 4: silence between segments produces no placements and gapped duck windows", () => {
    const p = schedule(
      [seg(0, 0, 2000, 1000), seg(1, 10000, 12000, 1000)],
      30000
    );
    const d = duckWindows(p);
    expect(d).toHaveLength(2);
    // silence from ~1700+1000=2700 to 10700 is untouched
    expect(d[0].toMs).toBeLessThan(3000);
    expect(d[1].fromMs).toBe(10700);
  });

  it("last segment window is bounded by clip end", () => {
    // clip ends at 6000; seg starts 4000 → at 4700, window = 6000−4700−300 = 1000
    const p = schedule([seg(0, 4000, 5800, 1400)], 6000);
    expect(p[0].atempo).toBeCloseTo(1.12, 3); // 1400/1000 = 1.4 → capped at 1.12
    // at 1.12× it ends at 4700+1250=5950, inside the clip → no recondense needed
    expect(p[0].atMs + p[0].durationMs).toBeLessThanOrEqual(6000);
    expect(p[0].needsRecondense).toBe(false);
  });

  it("last segment running far past clip end → flagged", () => {
    // at 4700, window 1000, tts 3000 → dur 2679, end 7379 → overlap vs clip end 1379 > 800
    const p = schedule([seg(0, 4000, 5800, 3000)], 6000);
    expect(p[0].needsRecondense).toBe(true);
  });

  it("duck windows merge when lektor lines are back-to-back", () => {
    const p = schedule(
      [seg(0, 0, 2000, 1400), seg(1, 2200, 4000, 1000)],
      20000
    );
    const d = duckWindows(p, 1000);
    expect(d).toHaveLength(1);
  });

  it("empty input → empty schedule", () => {
    expect(schedule([], 10000)).toEqual([]);
    expect(duckWindows([])).toEqual([]);
  });

  it("constants outside PRD ranges are rejected", () => {
    expect(() => assertConstants({ ...DEFAULT_CONSTANTS, delayMs: 500 })).toThrow();
    expect(() => assertConstants({ ...DEFAULT_CONSTANTS, delayMs: 1000 })).toThrow();
    expect(() => assertConstants({ ...DEFAULT_CONSTANTS, maxAtempo: 1.2 })).toThrow();
    expect(() => assertConstants({ ...DEFAULT_CONSTANTS, maxOverlapMs: 900 })).toThrow();
  });

  it("deterministic: same input → identical output", () => {
    const segs = [seg(0, 0, 3000, 2500), seg(1, 4000, 8000, 3000), seg(2, 9000, 12000, 4000)];
    expect(schedule(segs, 15000)).toEqual(schedule(segs, 15000));
  });
});
