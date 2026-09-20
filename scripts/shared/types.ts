export type WordType = "word" | "spacing" | "audio_event";

/** ElevenLabs Scribe word entry. Scribe always sets `type`. */
export interface Word {
  text: string;
  start: number;
  end: number;
  type: WordType;
}
