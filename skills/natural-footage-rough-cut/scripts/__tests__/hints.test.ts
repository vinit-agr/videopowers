import { describe, expect, it } from "vitest";
import { isCutOff, lockCandidates, normWord, restartOf } from "../hints.js";
import type { PreparedWord } from "../prepared.js";

function words(text: string): PreparedWord[] {
  return text.split(" ").map((t, i) => ({ i, text: t, start: i * 0.4, end: i * 0.4 + 0.3 }));
}

describe("isCutOff", () => {
  it("flags Scribe's cut-off endings", () => {
    expect(isCutOff("you will qu-")).toBe(true);
    expect(isCutOff("which have--")).toBe(true);
    expect(isCutOff("And if you're thinking...")).toBe(true);
    expect(isCutOff("to keep the people…")).toBe(true);
  });
  it("leaves finished sentences alone", () => {
    expect(isCutOff("people show up.")).toBe(false);
    expect(isCutOff("sounds fine, right?")).toBe(false);
  });
});

describe("normWord", () => {
  it("lowercases, strips punctuation and spells digits", () => {
    expect(normWord("Three,")).toBe("three");
    expect(normWord("3")).toBe("three");
    expect(normWord("10")).toBe("ten");
  });
});

describe("restartOf", () => {
  const phrases = [
    ["and", "if", "you're", "thinking", "that"],
    ["so", "yes"],
    ["and", "if", "you're", "thinking", "my"],
  ];
  it("points a phrase at the earlier phrase it restarts", () => {
    expect(restartOf(phrases, 2)).toBe(0);
  });
  it("returns null when the opening is new", () => {
    expect(restartOf(phrases, 1)).toBeNull();
  });
  it("only looks back a limited number of phrases", () => {
    expect(restartOf(phrases, 2, 1)).toBeNull();
  });
});

describe("lockCandidates", () => {
  it("finds a fixed line said with digits spelled out", () => {
    const w = words("so not a week later just three days okay");
    const [best] = lockCandidates("Not a week later. Just 3 days.", w, 1);
    expect(best).toBeDefined();
    expect(best!.sim).toBeGreaterThanOrEqual(0.8);
    expect(best!.from).toBe(1);
    expect(best!.to).toBe(7);
  });
  it("returns nothing for a line that was never said", () => {
    expect(lockCandidates("A reminder call made no difference in three studies.", words("hello there friend"), 1)).toEqual([]);
  });
});
