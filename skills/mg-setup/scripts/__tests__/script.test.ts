import { describe, expect, it } from "vitest";
import { parseScript } from "../script.js";

const md = `# My Video Title

## COLD OPEN

**Say:** Hello there. This is the open.

**Show:** something visual

## BEAT 1 — The middle

**Say:**
First thought.

Second thought after a blank line.

## Production notes

No say blocks here, so this is not a beat.
`;

describe("parseScript", () => {
  it("extracts title, beats with Say blocks only, and sentences", () => {
    const model = parseScript(md);
    expect(model.title).toBe("My Video Title");
    expect(model.beats.map((b) => b.title)).toEqual(["COLD OPEN", "BEAT 1 — The middle"]);
    expect(model.beats[0]!.sentences.map((s) => s.text)).toEqual(["Hello there.", "This is the open."]);
    expect(model.beats[1]!.sentences).toHaveLength(2);
  });

  it("keeps paragraph boundaries as separate paragraph indices", () => {
    const model = parseScript(md);
    const [a, b] = model.beats[1]!.sentences;
    expect(a!.paragraphIndex).not.toBe(b!.paragraphIndex);
  });
});
