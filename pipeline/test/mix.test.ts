import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFilterGraph, mix, probeDurationMs } from "../src/mix.js";
import { schedule, duckWindows, type ScheduleSegment } from "../src/scheduler.js";

const seg = (i: number, startMs: number, endMs: number, ttsDurationMs: number): ScheduleSegment => ({
  i, startMs, endMs, ttsDurationMs, file: "",
});

describe("buildFilterGraph — PRD §3.5", () => {
  it("ducks to 0.3 with fold-safe max() and loudnorm master", () => {
    const placements = schedule([seg(0, 0, 2000, 1000), seg(1, 5000, 7000, 1000)], 20000);
    const { filter } = buildFilterGraph(placements, duckWindows(placements));
    expect(filter).toContain("volume=");
    expect(filter).toContain("loudnorm=I=-14:TP=-1.5");
    expect(filter).toContain("amix=inputs=3:normalize=0");
    expect(filter).toContain("adelay=700|700");
    expect(filter).toContain("adelay=5700|5700");
    // binary max only: no max( with 3 args (no double commas at same depth)
    expect(filter).not.toMatch(/max\([^()]*,[^()]*,[^()]*\)/);
  });

  it("applies atempo only when scheduler asks", () => {
    const placements = schedule([seg(0, 0, 2000, 6000), seg(1, 5000, 7000, 500)], 20000);
    const { filter } = buildFilterGraph(placements, duckWindows(placements));
    expect(filter).toContain("atempo=1.12");
  });

  it("no windows → passthrough volume 1", () => {
    const { filter } = buildFilterGraph([], []);
    expect(filter).toContain("volume='1'");
  });
});

describe("mix — synthetic end-to-end (real ffmpeg, no APIs)", () => {
  it("mixes beeps over a tone video, video stream copied", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lektor-mix-"));
    const video = join(dir, "in.mp4");
    const beep = join(dir, "beep.mp3");
    const out = join(dir, "out.mp4");
    // 10s test video: color bars + 220Hz tone
    execFileSync("ffmpeg", ["-y",
      "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25:duration=10",
      "-f", "lavfi", "-i", "sine=frequency=220:duration=10",
      "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", video]);
    // 1.5s beep as the "lektor line"
    execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=880:duration=1.5", beep]);

    const segments: ScheduleSegment[] = [
      { i: 0, startMs: 1000, endMs: 3000, ttsDurationMs: 1500, file: beep },
      { i: 1, startMs: 6000, endMs: 8000, ttsDurationMs: 1500, file: beep },
    ];
    const placements = schedule(segments, 10000);
    await mix(placements, duckWindows(placements), { videoIn: video, out });

    expect(existsSync(out)).toBe(true);
    const dur = await probeDurationMs(out);
    expect(dur).toBeGreaterThan(9000);
    expect(dur).toBeLessThan(11500);
  }, 60000);

  it("watermark variant re-encodes video", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lektor-wm-"));
    const video = join(dir, "in.mp4");
    const beep = join(dir, "beep.mp3");
    const out = join(dir, "out.mp4");
    execFileSync("ffmpeg", ["-y",
      "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25:duration=4",
      "-f", "lavfi", "-i", "sine=frequency=220:duration=4",
      "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", video]);
    execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=880:duration=1", beep]);
    const placements = schedule(
      [{ i: 0, startMs: 500, endMs: 1500, ttsDurationMs: 1000, file: beep }],
      4000
    );
    await mix(placements, duckWindows(placements), {
      videoIn: video, out, watermark: true,
    });
    expect(existsSync(out)).toBe(true);
  }, 60000);
});
