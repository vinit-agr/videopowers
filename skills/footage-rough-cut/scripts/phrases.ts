import type { Phrase, Word } from "./types.js";

/** Build a phrase from a non-empty list of words. */
function makePhrase(words: Word[]): Phrase {
  const first = words[0]!;
  const last = words[words.length - 1]!;
  return {
    words,
    start: first.start,
    end: last.end,
    text: words.map((w) => w.text).join(" "),
  };
}

/**
 * Group words into phrases, breaking wherever the gap before a word is at or
 * above `gapThreshold`. Non-word tokens (spacing / audio events) are dropped.
 */
export function toPhrases(words: Word[], gapThreshold: number): Phrase[] {
  const spoken = words.filter((w) => w.type === "word");
  const phrases: Phrase[] = [];
  let current: Word[] = [];

  for (const w of spoken) {
    const prev = current[current.length - 1];
    if (prev && w.start - prev.end >= gapThreshold) {
      phrases.push(makePhrase(current));
      current = [];
    }
    current.push(w);
  }
  if (current.length > 0) phrases.push(makePhrase(current));
  return phrases;
}
