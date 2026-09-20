import { describe, expect, it } from "vitest";
import { removeFillers } from "../fillers.js";
import { phrase, w } from "./helpers.js";

describe("removeFillers", () => {
  it("removes disfluencies anywhere but preserves meaningful words like 'So'", () => {
    const p = phrase([w("So", 0, 0.3), w("um", 0.4, 0.6), w("yes", 0.7, 1.0)]);
    const out = removeFillers([p], { enabled: true, mode: "safe" });
    expect(out.phrases[0]!.text).toBe("So yes");
    expect(out.removed).toBe(1);
  });

  it("removes a trailing edge filler ('you know') in safe mode", () => {
    const p = phrase([w("this", 0, 0.3), w("is", 0.4, 0.6), w("great", 0.7, 1.0), w("you", 1.1, 1.3), w("know", 1.4, 1.6)]);
    const out = removeFillers([p], { enabled: true, mode: "safe" });
    expect(out.phrases[0]!.text).toBe("this is great");
  });

  it("leaves a mid-phrase edge filler in safe mode but removes it in aggressive mode", () => {
    const p = phrase([w("well", 0, 0.3), w("you", 0.4, 0.6), w("know", 0.7, 0.9), w("this", 1.0, 1.3)]);
    expect(removeFillers([p], { enabled: true, mode: "safe" }).phrases[0]!.text).toBe("well you know this");
    expect(removeFillers([p], { enabled: true, mode: "aggressive" }).phrases[0]!.text).toBe("well this");
  });

  it("honors an override edge-filler list", () => {
    const p = phrase([w("so", 0, 0.3), w("hello", 0.4, 0.8)]);
    const out = removeFillers([p], { enabled: true, mode: "safe", edgeWords: ["so"] });
    expect(out.phrases[0]!.text).toBe("hello");
  });

  it("is a no-op when disabled", () => {
    const p = phrase([w("um", 0, 0.3), w("hi", 0.4, 0.6)]);
    expect(removeFillers([p], { enabled: false, mode: "safe" }).phrases[0]!.text).toBe("um hi");
  });
});
