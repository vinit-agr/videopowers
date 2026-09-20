import { describe, expect, it } from "vitest";
import { normTokens, parseScript, splitSentences } from "../script.js";

const SAMPLE = `# Script — "Demo"

Preamble that is not spoken.

## COLD OPEN (0:00–0:30)

**Show:** \`[FULLFACE]\` something visual.

**Say:**
Hello there. This is the opening — with two sentences.

And a second paragraph here.

---

## BEAT 1 (0:30–1:00) — the idea

**Say:**
First idea sentence. Second one?

**Show:** \`[SPLIT]\` cutaway.

**Say:**
After the cutaway, a new thought.

## Production notes

Not spoken at all. No say blocks here.
`;

describe("parseScript", () => {
  const m = parseScript(SAMPLE);

  it("keeps only sections with Say blocks as beats", () => {
    expect(m.beats.map((b) => b.title)).toEqual([
      "COLD OPEN (0:00–0:30)",
      "BEAT 1 (0:30–1:00) — the idea",
    ]);
  });

  it("splits sentences and assigns beat indices", () => {
    expect(m.sentences.map((s) => s.text)).toEqual([
      "Hello there.",
      "This is the opening — with two sentences.",
      "And a second paragraph here.",
      "First idea sentence.",
      "Second one?",
      "After the cutaway, a new thought.",
    ]);
    expect(m.sentences.map((s) => s.beatIndex)).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it("separates paragraphs at blank lines AND at Say-block boundaries", () => {
    const paras = m.sentences.map((s) => s.paragraphIndex);
    expect(paras[0]).toBe(paras[1]); // same paragraph
    expect(paras[1]).not.toBe(paras[2]); // blank line
    expect(paras[3]).toBe(paras[4]); // same Say block
    expect(paras[4]).not.toBe(paras[5]); // Show between Say blocks
  });

  it("strips markdown from spoken text", () => {
    const m2 = parseScript(`## B\n**Say:**\nThis is **bold** and *starred* text.\n`);
    expect(m2.sentences[0]!.text).toBe("This is bold and starred text.");
  });
});

describe("splitSentences", () => {
  it("splits on . ? ! and …", () => {
    expect(splitSentences("One. Two? Three! Four… Five")).toEqual([
      "One.", "Two?", "Three!", "Four…", "Five",
    ]);
  });
  it("keeps ellipsis runs inside one sentence when not followed by space-break", () => {
    expect(splitSentences("Wait for it... done.")).toEqual(["Wait for it...", "done."]);
  });
});

describe("normTokens", () => {
  it("lowercases and strips punctuation but keeps apostrophes", () => {
    expect(normTokens("It's a — Test, right?")).toEqual(["it's", "a", "test", "right"]);
  });
});
