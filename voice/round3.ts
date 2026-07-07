#!/usr/bin/env tsx
/**
 * Round 3: (a) voice-design briefs steered by measurements of the reference
 * (mid-range ~105-110 Hz, brisk even tempo, no dramatic pauses), and
 * (b) Polish narration voices from the public Voice Library rendered through
 * the production TTS path. Voice Library use is allowed by the PRD; cloning
 * a real lektor is not and is not done here.
 */
import { resolve } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { designVoicePreviews, tts } from "../pipeline/src/elevenlabs.js";

const OUT = resolve(import.meta.dirname, "candidates");
const TEST_TEXT =
  "Nie wiem, kim jesteś. Nie wiem, czego chcesz. Jeśli szukasz okupu, nie mam pieniędzy. Ale mam pewne umiejętności. Umiejętności, które zdobywałem przez całą karierę. Jeśli puścisz moją córkę, na tym się skończy. Nie będę cię szukał. Ale jeśli tego nie zrobisz — będę cię szukał. Znajdę cię. I zabiję. Powodzenia.";

const DESCRIPTIONS = [
  // steered by reference analysis: mid-range pitch, brisk, businesslike
  "Polish male voice-over translator reading film dialogue over a movie on television. Medium pitch around 105 hertz, NOT deep, NOT bass — an ordinary, slightly nasal mid-range office voice. Brisk, even, businesslike tempo with no dramatic pauses, no emphasis on any word, completely level intonation from start to finish. He has read this text a thousand times and finds it neither interesting nor moving. Dry close-mic recording.",
  "An unremarkable middle-aged Polish man reading sentences aloud at a steady clip, like dictating meeting minutes. Medium-high male pitch, thin and matter-of-fact, zero gravitas, zero drama. Every sentence ends with the same falling tone. No acting whatsoever — pure information delivery, fast but calm, uniform loudness, plain room, close microphone.",
];

async function main() {
  const mPath = resolve(OUT, "manifest.json");
  const m = JSON.parse(readFileSync(mPath, "utf8"));

  for (let d = 0; d < DESCRIPTIONS.length; d++) {
    console.log(`[r3] design ${d + 1}/2…`);
    const previews = await designVoicePreviews(DESCRIPTIONS[d], TEST_TEXT, 38);
    previews.forEach((p, i) => {
      const file = `r3-candidate-${d + 1}${String.fromCharCode(97 + i)}.mp3`;
      writeFileSync(resolve(OUT, file), Buffer.from(p.audioBase64, "base64"));
      m.candidates.push({ id: p.generatedVoiceId, file, description: d });
      console.log(`  ${file} (${p.generatedVoiceId})`);
    });
  }

  // Voice Library: Polish, narration-ish, male
  const res = await fetch(
    "https://api.elevenlabs.io/v1/shared-voices?language=pl&gender=male&page_size=8",
    { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! } }
  );
  if (res.ok) {
    const json = (await res.json()) as {
      voices: { voice_id: string; public_owner_id: string; name: string; category: string; use_case?: string }[];
    };
    console.log(`[r3] voice library hits: ${json.voices.length}`);
    for (const v of json.voices.slice(0, 4)) {
      // add to my voices then render through production path
      const add = await fetch(
        `https://api.elevenlabs.io/v1/voices/add/${v.public_owner_id}/${v.voice_id}`,
        {
          method: "POST",
          headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
          body: JSON.stringify({ new_name: `lib-${v.name}` }),
        }
      );
      if (!add.ok) {
        console.log(`  skip ${v.name}: ${add.status}`);
        continue;
      }
      const { voice_id } = (await add.json()) as { voice_id: string };
      const file = `lib-${v.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.mp3`;
      await tts(TEST_TEXT, {
        voiceId: voice_id,
        modelId: "eleven_multilingual_v2",
        stability: 1.0,
        outFile: resolve(OUT, file),
      });
      m.candidates.push({ id: `LIB:${voice_id}`, file, description: 9 });
      console.log(`  rendered ${file} (voice ${voice_id})`);
    }
  } else {
    console.log(`[r3] voice library search failed: ${res.status}`);
  }

  // reference for ear comparison at the top
  m.candidates.unshift({ id: "REFERENCE (real lektors — listen only, never cloned)", file: "../reference.mp3", description: 99 });
  writeFileSync(mPath, JSON.stringify(m, null, 2));
  console.log("[r3] done — refresh compare.html");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
