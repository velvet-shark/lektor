import { mkdirSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, join, basename } from "node:path";
import { scribe, tts } from "./elevenlabs.js";
import { mergeWords } from "./merge.js";
import { translateUtterances, recondense } from "./translate.js";
import {
  schedule,
  duckWindows,
  formatScheduleLog,
  DEFAULT_CONSTANTS,
  type SchedulerConstants,
  type ScheduleSegment,
} from "./scheduler.js";
import { mix, probeDurationMs } from "./mix.js";
import type { TranslatedUtterance } from "./types.js";

const run = promisify(execFile);

export interface PipelineOptions {
  input: string;
  output: string;
  workDir: string;
  voiceId: string;
  modelId?: string;
  constants?: SchedulerConstants;
  watermark?: boolean;
  onProgress?: (state: string) => void;
}

export interface PipelineResult {
  output: string;
  scheduleLog: string;
  segments: number;
  recondensed: number;
  languageCode: string;
}

/**
 * The full lektor pipeline (PRD §3): transcribe → merge → translate →
 * TTS per segment → schedule (§3.4, with re-condense loop) → mix (§3.5).
 */
export async function runPipeline(o: PipelineOptions): Promise<PipelineResult> {
  const progress = o.onProgress ?? (() => {});
  const constants = o.constants ?? DEFAULT_CONSTANTS;
  mkdirSync(o.workDir, { recursive: true });

  // 0. extract mono audio for STT
  progress("transcribing");
  const sttWav = join(o.workDir, "stt-input.wav");
  await run("ffmpeg", ["-y", "-i", o.input, "-vn", "-ac", "1", "-ar", "16000", sttWav]);
  const clipEndMs = await probeDurationMs(o.input);

  // 1. scribe_v2
  const { words, languageCode } = await scribe(sttWav, basename(o.input) + ".wav");

  // 2. merge into utterances
  const utterances = mergeWords(words);
  if (utterances.length === 0) throw new Error("NO_SPEECH");

  // 3. translate
  progress("translating");
  let translated = await translateUtterances(utterances);

  // 4+5. TTS + schedule, with one re-condense pass for flagged segments
  progress("summoning the lektor");
  let ttsSegments = await synthesizeAll(translated, o);
  let placements = schedule(ttsSegments, clipEndMs, constants);

  const flagged = placements.filter((p) => p.needsRecondense);
  let recondensedCount = 0;
  if (flagged.length > 0) {
    progress("re-condensing long lines");
    const shorter = await recondense(
      flagged.map((p) => ({ i: p.i, pl: translated.find((t) => t.i === p.i)!.pl }))
    );
    translated = translated.map((t) =>
      shorter.has(t.i) ? { ...t, pl: shorter.get(t.i)! } : t
    );
    recondensedCount = shorter.size;
    const redo = await synthesizeAll(
      translated.filter((t) => shorter.has(t.i)),
      o,
      "r"
    );
    ttsSegments = ttsSegments.map((s) => redo.find((r) => r.i === s.i) ?? s);
    placements = schedule(ttsSegments, clipEndMs, constants);
  }

  // schedule log — acceptance criterion
  const log = formatScheduleLog(ttsSegments, placements, constants);
  writeFileSync(join(o.workDir, "schedule.log"), log);

  // 6. mix
  progress("mixing");
  await mix(placements, duckWindows(placements), {
    videoIn: o.input,
    out: o.output,
    watermark: o.watermark,
  });

  return {
    output: o.output,
    scheduleLog: log,
    segments: utterances.length,
    recondensed: recondensedCount,
    languageCode,
  };
}

async function synthesizeAll(
  translated: TranslatedUtterance[],
  o: PipelineOptions,
  suffix = ""
): Promise<ScheduleSegment[]> {
  const out: ScheduleSegment[] = [];
  for (let k = 0; k < translated.length; k++) {
    const t = translated[k];
    const file = resolve(o.workDir, `seg-${t.i}${suffix}.mp3`);
    await tts(t.pl, {
      voiceId: o.voiceId,
      modelId: o.modelId,
      previousText: k > 0 ? translated[k - 1].pl : undefined,
      nextText: k + 1 < translated.length ? translated[k + 1].pl : undefined,
      outFile: file,
    });
    out.push({
      i: t.i,
      startMs: t.startMs,
      endMs: t.endMs,
      ttsDurationMs: await probeDurationMs(file),
      file,
    });
  }
  return out;
}
