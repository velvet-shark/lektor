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
  "Middle-aged Polish male voice reading text in a completely monotone, expressionless way. Absolutely no intonation changes, constant flat pitch throughout, like reading a phone book or a shopping list aloud. Zero emotional engagement with the content — he does not act, does not perform, does not react to meaning. Bored, detached, mechanical pacing, even rhythm, close microphone, dry studio sound. Even dramatic sentences are read with total indifference.",
  "Polish male voice-over reader, deliberately dull and affectless delivery. Monotonous, uniform pitch with no melody, no emphasis on any word, no pauses for effect. Sounds tired and completely uninterested, like a clerk reading regulations aloud for the hundredth time. Flat, steady, emotionless, robotic cadence but a natural human timbre, low-mid register, close-mic, no reverb.",
];

// The SAME Polish test text for every candidate (100–1000 chars required).
export const TEST_TEXT =
  "Nie wiem, kim jesteś. Nie wiem, czego chcesz. Jeśli szukasz okupu, nie mam pieniędzy. Ale mam pewne umiejętności. Umiejętności, które zdobywałem przez całą karierę. Jeśli puścisz moją córkę, na tym się skończy. Nie będę cię szukał. Ale jeśli tego nie zrobisz — będę cię szukał. Znajdę cię. I zabiję. Powodzenia.";

async function main() {
  const manifest: { id: string; file: string; description: number }[] = [];
  for (let d = 0; d < DESCRIPTIONS.length; d++) {
    console.log(`[voice] design call ${d + 1}/${DESCRIPTIONS.length}…`);
    const previews = await designVoicePreviews(DESCRIPTIONS[d], TEST_TEXT, 38);
    previews.forEach((p, i) => {
      const file = `r2-candidate-${d + 1}${String.fromCharCode(97 + i)}.mp3`;
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
