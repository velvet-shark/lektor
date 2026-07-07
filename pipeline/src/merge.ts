import type { RawWord, Utterance } from "./types.js";

/**
 * PRD §3.1: merge micro-segments (<600ms gap, same speaker) into utterances.
 * Drop non-speech events. Also splits on sentence-ish boundaries when an
 * utterance grows very long, so translation windows stay segment-sized.
 */
export function mergeWords(
  words: RawWord[],
  { maxGapMs = 600, maxUtteranceMs = 12000 }: { maxGapMs?: number; maxUtteranceMs?: number } = {}
): Utterance[] {
  const speech = words.filter((w) => w.type === "word");
  const utterances: Utterance[] = [];
  let cur: Utterance | null = null;

  for (const w of speech) {
    const gap = cur ? w.startMs - cur.endMs : Infinity;
    const sameSpeaker = cur ? cur.speaker === w.speaker : false;
    const tooLong = cur ? w.endMs - cur.startMs > maxUtteranceMs : false;
    const sentenceBreak =
      cur !== null && /[.!?…]$/.test(cur.text.trim()) && gap > 250;

    if (cur && sameSpeaker && gap < maxGapMs && !tooLong && !sentenceBreak) {
      cur.text = `${cur.text} ${w.text}`.replace(/\s+/g, " ").trim();
      cur.endMs = w.endMs;
    } else {
      if (cur && cur.text.trim()) utterances.push(cur);
      cur = {
        i: utterances.length,
        startMs: w.startMs,
        endMs: w.endMs,
        speaker: w.speaker,
        text: w.text.trim(),
      };
    }
  }
  if (cur && cur.text.trim()) utterances.push(cur);
  // re-index after any drops
  return utterances.map((u, i) => ({ ...u, i }));
}
