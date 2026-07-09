import { writeFileSync } from "node:fs";
import type { RawWord } from "./types.js";
import { logSpend } from "./spend.js";

/**
 * Thin ElevenLabs REST client — only the three surfaces we use.
 * Param names verified against live docs at build time; see
 * docs/api-verification.md. Every call logs to SPEND.md.
 */

const BASE = "https://api.elevenlabs.io";

function apiKey(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY not set");
  return k;
}

async function api(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "xi-api-key": apiKey(), ...(init.headers ?? {}) },
    signal: init.signal ?? AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${path} → ${res.status}: ${body.slice(0, 500)}`);
  }
  return res;
}

// ---------- STT: scribe_v2 (PRD §3.1) ----------

export interface ScribeOptions {
  languageCode?: string; // e.g. "en"; omit for auto-detect
  numSpeakers?: number;
}

export async function scribe(
  audioFile: string | Blob,
  fileName: string,
  opts: ScribeOptions = {}
): Promise<{ words: RawWord[]; languageCode: string; text: string }> {
  const form = new FormData();
  form.set("model_id", "scribe_v2");
  form.set("timestamps_granularity", "word");
  form.set("diarize", "true");
  form.set("tag_audio_events", "false");
  if (opts.languageCode) form.set("language_code", opts.languageCode);
  if (opts.numSpeakers) form.set("num_speakers", String(opts.numSpeakers));

  let blob: Blob;
  if (typeof audioFile === "string") {
    const { readFileSync } = await import("node:fs");
    blob = new Blob([readFileSync(audioFile)]);
  } else {
    blob = audioFile;
  }
  form.set("file", blob, fileName);

  const res = await api("/v1/speech-to-text", { method: "POST", body: form });
  const json = (await res.json()) as {
    language_code: string;
    text: string;
    words: {
      text: string;
      start: number;
      end: number;
      type: "word" | "spacing" | "audio_event";
      speaker_id?: string;
    }[];
  };

  // scribe_v2 batch: $0.22/hour (docs/api-verification.md)
  const durationMin =
    json.words.length > 0 ? (json.words[json.words.length - 1].end ?? 0) / 60 : 0;
  logSpend("stt/scribe_v2", fileName, `${durationMin.toFixed(2)} min`, (durationMin / 60) * 0.22);

  return {
    languageCode: json.language_code,
    text: json.text,
    words: json.words.map((w) => ({
      text: w.text,
      startMs: Math.round(w.start * 1000),
      endMs: Math.round(w.end * 1000),
      speaker: w.speaker_id ?? null,
      type: w.type,
    })),
  };
}

// ---------- TTS (PRD §3.3) ----------

export interface TtsOptions {
  voiceId: string;
  modelId?: string; // eleven_v3 default, eleven_multilingual_v2 fallback
  previousText?: string;
  nextText?: string;
  stability?: number;
  outFile: string;
}

export async function tts(text: string, opts: TtsOptions): Promise<string> {
  const modelId = opts.modelId ?? process.env.TTS_MODEL ?? "eleven_v3";
  const body: Record<string, unknown> = {
    text,
    model_id: modelId,
    // flat prosody is the aesthetic: high stability, no style exaggeration
    voice_settings: { stability: opts.stability ?? 0.9, similarity_boost: 0.75, style: 0 },
  };
  if (opts.previousText) body.previous_text = opts.previousText;
  if (opts.nextText) body.next_text = opts.nextText;

  const res = await api(
    `/v1/text-to-speech/${opts.voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(opts.outFile, buf);

  // $0.10/1k chars for v3 & multilingual_v2, $0.05/1k for flash_v2_5 (api-verification.md)
  const perChar = modelId === "eleven_flash_v2_5" ? 0.00005 : 0.0001;
  logSpend(`tts/${modelId}`, opts.outFile, `${text.length} chars`, text.length * perChar);
  return opts.outFile;
}

// ---------- Voice Design (Phase 0) ----------

export interface VoicePreview {
  generatedVoiceId: string;
  audioBase64: string;
}

export async function designVoicePreviews(
  voiceDescription: string,
  sampleText: string,
  guidanceScale?: number
): Promise<VoicePreview[]> {
  const res = await api("/v1/text-to-voice/design", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      voice_description: voiceDescription,
      text: sampleText,
      model_id: "eleven_ttv_v3",
      // higher = stick closer to the description (flatness) at some audio-quality cost
      ...(guidanceScale !== undefined ? { guidance_scale: guidanceScale } : {}),
    }),
  });
  const json = (await res.json()) as {
    previews: { generated_voice_id: string; audio_base_64: string }[];
  };
  logSpend("voice-design/previews", voiceDescription.slice(0, 60), `${json.previews.length} previews`, 0.03);
  return json.previews.map((p) => ({
    generatedVoiceId: p.generated_voice_id,
    audioBase64: p.audio_base_64,
  }));
}

export async function createVoiceFromPreview(
  generatedVoiceId: string,
  name: string,
  description: string
): Promise<string> {
  const res = await api("/v1/text-to-voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      voice_name: name,
      voice_description: description,
      generated_voice_id: generatedVoiceId,
    }),
  });
  const json = (await res.json()) as { voice_id: string };
  logSpend("voice-design/create", name, "1 voice", 0);
  return json.voice_id;
}
