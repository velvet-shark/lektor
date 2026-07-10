import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import type { Placement, DuckWindow } from "./scheduler.js";

const WATERMARK_PNG = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../assets/watermark.png"
);

const run = promisify(execFile);

/**
 * PRD §3.5 — the ffmpeg mix.
 * - Original ducked to ~30% under lektor lines, 180ms fades on the volume
 *   automation (smoothed enable windows), everything else full volume.
 * - Lektor segments delayed into position with adelay (+ atempo where the
 *   scheduler asked for it), then amix with normalize=0.
 * - Master loudnorm I=-14 TP=-1.5, video stream copied (-c:v copy).
 */

export interface MixOptions {
  videoIn: string;
  out: string;
  duckLevel?: number; // 0.3 per PRD
  fadeMs?: number; // 180 per PRD
  /** burn the corner watermark PNG into the video (downloads only) */
  watermark?: boolean;
  /** 90s VHS-era treatment on the lektor track (default true): band-limit,
   * light compression, short slapback echo — the TV chain the voice lived in */
  lofi?: boolean;
}

/**
 * The 90s TV chain: telephone-adjacent band, squashed dynamics, hint of room.
 * Level-preserving: the original tuning lost ~13dB (compressor threshold too
 * low, echo in_gain 0.7), leaving the lektor quieter than the ducked original
 * on loud user uploads. This chain lands segments at ~-16dB mean / -1dB peak,
 * ~12dB above the ducked original.
 */
export const LOFI_CHAIN =
  "highpass=f=150,lowpass=f=6500," +
  "acompressor=threshold=-24dB:ratio=2:attack=5:release=120:makeup=6," +
  "aecho=0.9:0.2:16:0.12," +
  "volume=9dB";

export function buildFilterGraph(
  placements: Placement[],
  windows: DuckWindow[],
  { duckLevel = 0.25, fadeMs = 180, lofi = true }: { duckLevel?: number; fadeMs?: number; lofi?: boolean } = {}
): { filter: string; lektorInputs: string[] } {
  const fade = fadeMs / 1000;
  // Static volume automation (predictable > sidechain): for each lektor window
  // a ramp that is 1 inside [from,to] and fades to 0 over `fade` seconds on
  // both edges; the original is attenuated to duckLevel wherever any window
  // is active. ffmpeg's max() is binary, so fold the ramps pairwise.
  const ramps = windows.map((w) => {
    const a = (w.fromMs / 1000).toFixed(3);
    const b = (w.toMs / 1000).toFixed(3);
    return `min(max((t-(${a}-${fade}))/${fade},0),1)*min(max(((${b}+${fade})-t)/${fade},0),1)`;
  });
  const folded = ramps.length ? ramps.reduce((acc, r) => `max(${acc},${r})`) : "0";
  const duckExpr = windows.length === 0 ? "1" : `1-(1-${duckLevel})*${folded}`;

  const parts: string[] = [];
  parts.push(`[0:a]volume='${duckExpr}':eval=frame[dub]`);

  const lektorLabels: string[] = [];
  placements.forEach((p, idx) => {
    const input = idx + 1; // input 0 = video, 1..N = lektor segment files
    const chain: string[] = [];
    if (p.atempo > 1.0) chain.push(`atempo=${p.atempo}`);
    if (lofi) chain.push(LOFI_CHAIN);
    chain.push(`adelay=${p.atMs}|${p.atMs}`);
    chain.push("apad=pad_dur=0.1");
    parts.push(`[${input}:a]${chain.join(",")}[l${idx}]`);
    lektorLabels.push(`[l${idx}]`);
  });

  const mixInputs = ["[dub]", ...lektorLabels].join("");
  parts.push(
    `${mixInputs}amix=inputs=${placements.length + 1}:normalize=0:duration=first[premix]`
  );
  parts.push(`[premix]loudnorm=I=-14:TP=-1.5[mix]`);

  return { filter: parts.join(";"), lektorInputs: placements.map((p) => p.file) };
}

export async function mix(
  placements: Placement[],
  windows: DuckWindow[],
  opts: MixOptions
): Promise<void> {
  const { filter, lektorInputs } = buildFilterGraph(placements, windows, opts);
  const args = ["-y", "-i", opts.videoIn];
  for (const f of lektorInputs) args.push("-i", f);

  if (opts.watermark) {
    // watermark forces a video re-encode — used only for download variants.
    // PNG overlay instead of drawtext (drawtext is missing from some ffmpeg builds).
    const wmInput = lektorInputs.length + 1;
    args.push("-i", WATERMARK_PNG);
    args.push(
      "-filter_complex",
      `${filter};[0:v][${wmInput}:v]overlay=W-w-12:H-h-10[v]`,
      "-map", "[v]", "-map", "[mix]",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20"
    );
  } else {
    args.push("-filter_complex", filter, "-map", "0:v", "-map", "[mix]", "-c:v", "copy");
  }
  args.push("-c:a", "aac", "-b:a", "192k", opts.out);

  await run("ffmpeg", args, { maxBuffer: 64 * 1024 * 1024 });
}

export async function probeDurationMs(file: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  return Math.round(parseFloat(stdout.trim()) * 1000);
}
