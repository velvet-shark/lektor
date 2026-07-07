#!/usr/bin/env tsx
/**
 * Round 4 — informed by proper analysis of the Knapik segment (analysis only;
 * never cloned): the real lektor is NOT low/robotic-flat. He is mid-range
 * (~110 Hz), naturally intoned but with uniform repetitive sentence melody,
 * brisk and continuous (few pauses), zero acting. Previous attempts failed
 * by being deep, slow and literally monotone.
 */
import { resolve } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { designVoicePreviews, tts } from "../pipeline/src/elevenlabs.js";

const OUT = resolve(import.meta.dirname, "candidates");
const TEST_TEXT =
  "Nie wiem, kim jesteś. Nie wiem, czego chcesz. Jeśli szukasz okupu, nie mam pieniędzy. Ale mam pewne umiejętności. Umiejętności, które zdobywałem przez całą karierę. Jeśli puścisz moją córkę, na tym się skończy. Nie będę cię szukał. Ale jeśli tego nie zrobisz — będę cię szukał. Znajdę cię. I zabiję. Powodzenia.";

const DESCRIPTIONS = [
  "Professional Polish television voice-over reader (lektor filmowy) reading translated film dialogue over a movie. Natural male voice around 110 Hz, medium pitch, clear and fully natural timbre — NOT deep, NOT bass, NOT robotic. Brisk, continuous, fluent delivery with almost no pauses, always moving forward to keep up with the film. Every sentence gets the same calm falling melody. He never acts, never performs emotions, never raises his voice — he just reads, detached and reliable, over the film. Close-mic, dry, clean broadcast sound.",
  "Seasoned Polish film narrator reading dialogue quickly and evenly, one line after another without stopping. Ordinary natural mid-range male voice, slightly rough with age, fluent rapid articulation, uniform repetitive intonation pattern, completely unimpressed by the content. No drama, no emphasis, no pauses for effect — steady conveyor-belt reading, professional and effortless. Sounds exactly like Polish television voice-over from the 1990s. Studio close microphone.",
];

async function main() {
  const mPath = resolve(OUT, "manifest.json");
  const m = JSON.parse(readFileSync(mPath, "utf8"));

  for (let d = 0; d < DESCRIPTIONS.length; d++) {
    console.log(`[r4] design ${d + 1}/2…`);
    const previews = await designVoicePreviews(DESCRIPTIONS[d], TEST_TEXT, 38);
    previews.forEach((p, i) => {
      const file = `r4-candidate-${d + 1}${String.fromCharCode(97 + i)}.mp3`;
      writeFileSync(resolve(OUT, file), Buffer.from(p.audioBase64, "base64"));
      m.candidates.push({ id: p.generatedVoiceId, file, description: d });
      console.log(`  ${file} (${p.generatedVoiceId})`);
    });
  }

  // Voice Library: literal lektor search
  const res = await fetch(
    "https://api.elevenlabs.io/v1/shared-voices?search=lektor&page_size=10",
    { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! } }
  );
  if (res.ok) {
    const json = (await res.json()) as {
      voices: { voice_id: string; public_owner_id: string; name: string; language?: string }[];
    };
    console.log(`[r4] 'lektor' library hits: ${json.voices.length}`);
    for (const v of json.voices.slice(0, 5)) {
      const add = await fetch(
        `https://api.elevenlabs.io/v1/voices/add/${v.public_owner_id}/${v.voice_id}`,
        {
          method: "POST",
          headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
          body: JSON.stringify({ new_name: `lek-${v.name}` }),
        }
      );
      if (!add.ok) { console.log(`  skip ${v.name}: ${add.status}`); continue; }
      const { voice_id } = (await add.json()) as { voice_id: string };
      const slug = v.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const file = `lek-${slug}.mp3`;
      await tts(TEST_TEXT, {
        voiceId: voice_id,
        modelId: "eleven_multilingual_v2",
        stability: 0.8, // Knapik has natural movement; 1.0 goes creaky-robotic
        outFile: resolve(OUT, file),
      });
      m.candidates.push({ id: `LIB:${voice_id}`, file, description: 9 });
      console.log(`  rendered ${file} (voice ${voice_id})`);
    }
  } else {
    console.log(`[r4] library search failed ${res.status}`);
  }

  writeFileSync(mPath, JSON.stringify(m, null, 2));
  console.log("[r4] done — refresh compare.html");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
