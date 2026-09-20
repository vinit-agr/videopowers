import type { Phrase, Word } from "../types.js";

/** Build a spoken word. */
export function w(text: string, start: number, end: number): Word {
  return { text, start, end, type: "word" };
}

/** Build a phrase from words. */
export function phrase(words: Word[]): Phrase {
  return {
    words,
    start: words[0]!.start,
    end: words[words.length - 1]!.end,
    text: words.map((x) => x.text).join(" "),
  };
}

/** Build a phrase from a space-separated string, 1s per word starting at `t0`. */
export function line(text: string, t0 = 0): Phrase {
  const words = text.split(" ").map((tok, i) => w(tok, t0 + i, t0 + i + 0.5));
  return phrase(words);
}
