export interface RawWord {
  text: string;
  startMs: number;
  endMs: number;
  speaker: string | null;
  type: "word" | "spacing" | "audio_event";
}

/** A merged utterance ready for translation. */
export interface Utterance {
  i: number;
  startMs: number;
  endMs: number;
  speaker: string | null;
  text: string;
}

export interface TranslatedUtterance extends Utterance {
  pl: string;
}

export interface TtsResult {
  i: number;
  file: string;
  durationMs: number;
}
