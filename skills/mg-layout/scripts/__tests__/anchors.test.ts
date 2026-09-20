import { describe, expect, it } from "vitest";
import { findAnchor, spokenWords } from "../anchors.js";
import type { Word } from "../types.js";

const words: Word[] = [
  { text: "So", start: 10, end: 10.2 },
  { text: " ", start: 10.2, end: 10.3, type: "spacing" },
  { text: "a", start: 10.3, end: 10.4 },
  { text: "rough", start: 10.4, end: 10.7 },
  { text: "cut", start: 10.7, end: 11.0 },
  { text: "is…", start: 11.0, end: 11.3 },
  { text: "a", start: 20.0, end: 20.1 },
  { text: "rough", start: 20.1, end: 20.4 },
  { text: "cut,", start: 20.4, end: 20.8 },
];
const spoken = spokenWords(words);

describe("findAnchor", () => {
  it("matches consecutive words, punctuation-insensitively", () => {
    expect(findAnchor(spoken, "a rough cut is", 0, 100)).toBe(10.3);
  });
  it("forward cursor picks the next occurrence", () => {
    expect(findAnchor(spoken, "a rough cut", 12, 100)).toBe(20.0);
  });
  it("respects the until bound and reports miss as null", () => {
    expect(findAnchor(spoken, "a rough cut", 12, 19)).toBeNull();
    expect(findAnchor(spoken, "never spoken words", 0, 100)).toBeNull();
  });
});
