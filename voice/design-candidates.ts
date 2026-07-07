#!/usr/bin/env tsx
/**
 * Phase 0 — generate Lektor voice candidates via Voice Design.
 *
 * Runs 2 design calls (3 previews each) = 6 candidates, saves each preview
 * as mp3 + renders the SAME ~20s test segment through each so they can be
 * compared fairly on compare.html. Hard rule: Voice Design ONLY — no real
 * lektor is cloned, ever.
 *
 * Usage: ELEVENLABS_API_KEY=… pnpm tsx voice/design-candidates.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { designVoicePreviews } from "../pipeline/src/elevenlabs.js";

const OUT = resolve(import.meta.dirname, "candidates");
mkdirSync(OUT, { recursive: true });

// Two slightly different flat-lektor briefs → 3 previews each.
const DESCRIPTIONS = [
  "Middle-aged Polish male voice-over narrator, completely flat prosody, low emotional affect, deadpan and slightly detached, sounds like he is reading from a sheet of paper, close-mic studio recording, dry, no reverb, steady even pace. The classic Polish film lektor (szeptanka) style: calm, monotone, unbothered by the drama of what he reads.",
  "Mature Polish man in his fifties reading film dialogue as a voice-over lektor, monotone delivery, minimal intonation, emotionally neutral, professional broadcast narrator from 1990s Polish television, close microphone, warm low-mid timbre, unhurried, never excited, slight paper-reading quality.",
];

// The SAME Polish test text for every candidate (100–1000 chars required).
export const TEST_TEXT =
  "Nie wiem, kim jesteś. Nie wiem, czego chcesz. Jeśli szukasz okupu, nie mam pieniędzy. Ale mam pewne umiejętności. Umiejętności, które zdobywałem przez całą karierę. Jeśli puścisz moją córkę, na tym się skończy. Nie będę cię szukał. Ale jeśli tego nie zrobisz — będę cię szukał. Znajdę cię. I zabiję. Powodzenia.";

async function main() {
  const manifest: { id: string; file: string; description: number }[] = [];
  for (let d = 0; d < DESCRIPTIONS.length; d++) {
    console.log(`[voice] design call ${d + 1}/${DESCRIPTIONS.length}…`);
    const previews = await designVoicePreviews(DESCRIPTIONS[d], TEST_TEXT);
    previews.forEach((p, i) => {
      const file = `candidate-${d + 1}${String.fromCharCode(97 + i)}.mp3`;
      writeFileSync(resolve(OUT, file), Buffer.from(p.audioBase64, "base64"));
      manifest.push({ id: p.generatedVoiceId, file, description: d });
      console.log(`  saved ${file} (generated_voice_id=${p.generatedVoiceId})`);
    });
  }
  writeFileSync(
    resolve(OUT, "manifest.json"),
    JSON.stringify({ testText: TEST_TEXT, descriptions: DESCRIPTIONS, candidates: manifest }, null, 2)
  );
  console.log(`\n[voice] ${manifest.length} candidates in ${OUT}. Open voice/compare.html.`);
  console.log("[voice] pick one, then: pnpm tsx voice/save-voice.ts <generated_voice_id>");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
