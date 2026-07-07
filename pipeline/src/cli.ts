#!/usr/bin/env tsx
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { runPipeline } from "./run.js";
import { DEFAULT_CONSTANTS } from "./scheduler.js";

const { values } = parseArgs({
  options: {
    input: { type: "string", short: "i" },
    output: { type: "string", short: "o" },
    voice: { type: "string", short: "v" },
    model: { type: "string", default: process.env.TTS_MODEL ?? "eleven_v3" },
    delay: { type: "string", default: String(DEFAULT_CONSTANTS.delayMs) },
    watermark: { type: "boolean" },
    "work-dir": { type: "string" },
  },
});

if (!values.input || !values.output) {
  console.error(
    "usage: pnpm cli -i input.mp4 -o output.mp4 [-v voiceId] [--model eleven_v3] [--delay 700]"
  );
  process.exit(1);
}

const voiceId = values.voice ?? process.env.LEKTOR_VOICE_ID;
if (!voiceId) {
  console.error("no voice: pass -v or set LEKTOR_VOICE_ID");
  process.exit(1);
}

const workDir =
  values["work-dir"] ?? resolve(".work", String(Date.now() % 1e9));

runPipeline({
  input: resolve(values.input),
  output: resolve(values.output),
  workDir,
  voiceId,
  modelId: values.model,
  constants: { ...DEFAULT_CONSTANTS, delayMs: Number(values.delay) },
  watermark: Boolean(values.watermark),
  onProgress: (s) => console.log(`[lektor] ${s}…`),
})
  .then((r) => {
    console.log(`\n[lektor] done → ${r.output}`);
    console.log(`[lektor] ${r.segments} segments, ${r.recondensed} re-condensed, lang=${r.languageCode}`);
    console.log(`\n${r.scheduleLog}`);
  })
  .catch((e) => {
    console.error(`[lektor] failed: ${e.message}`);
    process.exit(1);
  });
