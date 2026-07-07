import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Server-side input constraints (PRD §4): duration ≤ 90s, must have audio. */
export const MAX_DURATION_S = 90;

export interface ProbeInfo {
  durationS: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

/** Parse `ffprobe -of json -show_format -show_streams` output. Pure — unit tested. */
export function parseProbe(json: string): ProbeInfo {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("ffprobe returned unparseable output");
  }
  const p = parsed as {
    format?: { duration?: string };
    streams?: { codec_type?: string; duration?: string }[];
  };
  const streams = p.streams ?? [];
  const fromFormat = p.format?.duration ? parseFloat(p.format.duration) : NaN;
  const fromStreams = Math.max(
    0,
    ...streams.map((s) => (s.duration ? parseFloat(s.duration) : 0)).filter((d) => !isNaN(d))
  );
  const durationS = !isNaN(fromFormat) && fromFormat > 0 ? fromFormat : fromStreams;
  return {
    durationS,
    hasAudio: streams.some((s) => s.codec_type === "audio"),
    hasVideo: streams.some((s) => s.codec_type === "video"),
  };
}

/** Returns a friendly error string, or null when the input is acceptable. Pure — unit tested. */
export function validateInput(info: ProbeInfo, maxDurationS = MAX_DURATION_S): string | null {
  if (!info.hasVideo) return "This file does not contain a video stream";
  if (!info.hasAudio) return "This clip has no audio track";
  if (!(info.durationS > 0)) return "Could not read the clip duration";
  if (info.durationS > maxDurationS)
    return `Clip is too long: ${Math.round(info.durationS)}s (max ${maxDurationS}s)`;
  return null;
}

/** Probe a local file with ffprobe. */
export async function probeFile(filePath: string): Promise<ProbeInfo> {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-of", "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  return parseProbe(stdout);
}
