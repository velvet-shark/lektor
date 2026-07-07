#!/usr/bin/env tsx
/** Save the picked Voice Design preview as the permanent Lektor voice. */
import { createVoiceFromPreview } from "../pipeline/src/elevenlabs.js";

const generatedVoiceId = process.argv[2];
if (!generatedVoiceId) {
  console.error("usage: pnpm tsx voice/save-voice.ts <generated_voice_id>");
  process.exit(1);
}

const id = await createVoiceFromPreview(
  generatedVoiceId,
  "The Lektor",
  "Deadpan Polish lektor (szeptanka) voice — Voice Design, not a clone of any real person."
);
console.log(`LEKTOR_VOICE_ID=${id}`);
console.log("Put this in .env.local / Vercel / Fly secrets — one-line config swap.");
