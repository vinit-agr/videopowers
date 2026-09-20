import { describe, expect, it } from "vitest";
import { toPhrases } from "../phrases.js";
import { w } from "./helpers.js";

describe("toPhrases", () => {
  it("splits on gaps at/above the threshold", () => {
    const words = [
      w("hello", 0, 0.4),
      w("there", 0.5, 0.9), // 0.1s gap → same phrase
      w("friend", 1.6, 2.0), // 0.7s gap → new phrase
    ];
    const phrases = toPhrases(words, 0.3);
    expect(phrases).toHaveLength(2);
    expect(phrases[0]!.text).toBe("hello there");
    expect(phrases[1]!.text).toBe("friend");
  });

  it("drops non-word tokens", () => {
    const words = [
      w("a", 0, 0.2),
      { text: "(noise)", start: 0.2, end: 0.3, type: "audio_event" as const },
      w("b", 0.35, 0.5),
    ];
    expect(toPhrases(words, 0.3)[0]!.text).toBe("a b");
  });
});
