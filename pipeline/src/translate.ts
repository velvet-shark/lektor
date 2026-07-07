import Anthropic from "@anthropic-ai/sdk";
import type { Utterance, TranslatedUtterance } from "./types.js";

/** PRD §3.2 — the lektor register prompt, verbatim. */
export const LEKTOR_SYSTEM_PROMPT = `You translate film dialogue into Polish for a classic single-voice lektor
(szeptanka) voice-over. Rules:
- Register: neutral, slightly formal, emotionally flat. Never exclamatory.
- CONDENSE: lektor reads ~20-30% fewer syllables than the original. Cut
  filler, repetitions, names in direct address. Keep meaning, drop flourish.
- All speakers are read by ONE voice: do not mark speakers; make each line
  understandable without knowing who speaks.
- Interjections/screams: translate to a brief flat report if needed
  ("Nie!") or drop when the visual carries it.
- Profanity: soften one notch, in the classic lektor way.
- Numbers/units: localize naturally.
- Output JSON only: [{i, pl}] matching input segment indices.`;

const MODEL = process.env.TRANSLATE_MODEL ?? "claude-sonnet-5";

export async function translateUtterances(
  utterances: Utterance[],
  client = new Anthropic()
): Promise<TranslatedUtterance[]> {
  const input = utterances.map((u) => ({ i: u.i, text: u.text }));
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: LEKTOR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(input) }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const parsed = parseJsonArray(text);
  const byIndex = new Map(parsed.map((p) => [p.i, p.pl]));
  return utterances.map((u) => {
    const pl = byIndex.get(u.i);
    if (!pl) throw new Error(`translation missing for segment ${u.i}`);
    return { ...u, pl };
  });
}

/** PRD §3.4 rule 2: second pass for segments flagged by the scheduler. */
export async function recondense(
  lines: { i: number; pl: string }[],
  client = new Anthropic()
): Promise<Map<number, string>> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      LEKTOR_SYSTEM_PROMPT +
      "\nThese lines came out too long to fit their timing window. Shorten each by ~30% while keeping the meaning. Same output format.",
    messages: [{ role: "user", content: JSON.stringify(lines) }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return new Map(parseJsonArray(text).map((p) => [p.i, p.pl]));
}

function parseJsonArray(text: string): { i: number; pl: string }[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`no JSON array in translation response: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}
