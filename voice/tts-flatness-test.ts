#!/usr/bin/env tsx
/**
 * Render the SAME test text through the PRODUCTION TTS path with different
 * model/stability combos — the previews over-act; this is what the product
 * actually sounds like. Files land in voice/candidates/ for compare.html.
 */
import { resolve } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { tts } from "../pipeline/src/elevenlabs.js";

const TEST_TEXT =
  "Nie wiem, kim jesteś. Nie wiem, czego chcesz. Jeśli szukasz okupu, nie mam pieniędzy. Ale mam pewne umiejętności. Umiejętności, które zdobywałem przez całą karierę. Jeśli puścisz moją córkę, na tym się skończy. Nie będę cię szukał. Ale jeśli tego nie zrobisz — będę cię szukał. Znajdę cię. I zabiję. Powodzenia.";

const VOICE = process.env.LEKTOR_VOICE_ID!;
const OUT = resolve(import.meta.dirname, "candidates");

const COMBOS: { name: string; modelId: string; stability: number }[] = [
  { name: "tts-v3-robust", modelId: "eleven_v3", stability: 1.0 },
  { name: "tts-mlv2-s095", modelId: "eleven_multilingual_v2", stability: 0.95 },
  { name: "tts-mlv2-s100", modelId: "eleven_multilingual_v2", stability: 1.0 },
];

async function main() {
  for (const c of COMBOS) {
    const file = resolve(OUT, `${c.name}.mp3`);
    await tts(TEST_TEXT, {
      voiceId: VOICE,
      modelId: c.modelId,
      stability: c.stability,
      outFile: file,
    });
    console.log(`rendered ${c.name}.mp3`);
  }
  // append to manifest so compare.html shows them
  const mPath = resolve(OUT, "manifest.json");
  const m = JSON.parse(readFileSync(mPath, "utf8"));
  for (const c of COMBOS)
    m.candidates.push({ id: `PROD:${c.name}`, file: `${c.name}.mp3`, description: 2 });
  writeFileSync(mPath, JSON.stringify(m, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
