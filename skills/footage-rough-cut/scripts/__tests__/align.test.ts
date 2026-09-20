import { describe, expect, it } from "vitest";
import { alignToScript, matchInSpan, type SourcePhrase } from "../align.js";
import { parseScript } from "../script.js";
import type { Phrase, Word } from "../types.js";

function mkPhrase(text: string, start: number, end: number): Phrase {
  const tokens = text.split(/\s+/).filter(Boolean);
  const dt = (end - start) / Math.max(1, tokens.length);
  const words: Word[] = tokens.map((t, i) => ({
    text: t,
    start: start + i * dt,
    end: start + (i + 1) * dt,
    type: "word" as const,
  }));
  return { words, start, end, text };
}

const SCRIPT = parseScript(`## BEAT 1
**Say:**
The model is not the product. The harness is what actually matters.

Researchers found a six times difference between harnesses.

## BEAT 2
**Say:**
Let's talk about the horse. A wild horse is powerful but useless.
`);

function sp(text: string, start: number, end: number, part = 0): SourcePhrase {
  return { phrase: mkPhrase(text, start, end), part };
}

describe("matchInSpan", () => {
  it("scores an exact fragment ~1.0 inside a longer span", () => {
    const r = matchInSpan(["the", "harness", "is"], ["well", "the", "harness", "is", "what", "matters"]);
    expect(r.similarity).toBeGreaterThan(0.95);
    expect(r.winStart).toBe(1);
  });
  it("scores unrelated text low", () => {
    const r = matchInSpan(["completely", "different", "words"], ["the", "harness", "matters"]);
    expect(r.similarity).toBeLessThan(0.35);
  });
});

describe("alignToScript", () => {
  it("keeps a clean read with no drops", () => {
    const r = alignToScript(
      [
        sp("The model is not the product.", 0, 2),
        sp("The harness is what actually matters.", 3, 5),
        sp("Researchers found a six times difference between harnesses.", 6, 9),
      ],
      SCRIPT,
    );
    expect(r.kept).toHaveLength(3);
    expect(r.retakeClusters).toBe(0);
  });

  it("drops the earlier of two takes of the same sentence (exact)", () => {
    const r = alignToScript(
      [
        sp("The model is not the product.", 0, 2),
        sp("The harness is what actually matters.", 3, 5),
        sp("The harness is what actually matters.", 8, 10),
      ],
      SCRIPT,
    );
    expect(r.kept).toHaveLength(2);
    expect(r.phrases[1]!.dropped).toBe(true);
  });

  it("drops a PARAPHRASED earlier take (both match the same script sentence)", () => {
    const r = alignToScript(
      [
        sp("The model is not the product.", 0, 2),
        sp("The harness is what matters, um, what really matters.", 3, 6),
        sp("The harness is what actually matters.", 8, 10),
      ],
      SCRIPT,
    );
    expect(r.phrases[1]!.dropped).toBe(true);
    expect(r.kept.map((p) => p.phrase.start)).toEqual([0, 8]);
  });

  it("keeps two half-sentence fragments (continuation, not retake)", () => {
    const r = alignToScript(
      [
        sp("The model is not the product.", 0, 2),
        sp("The harness is what", 3, 4.5),
        sp("actually matters.", 5, 6),
      ],
      SCRIPT,
    );
    expect(r.kept).toHaveLength(3);
  });

  it("keeps an off-script ad-lib after a KEPT phrase", () => {
    const r = alignToScript(
      [
        sp("The model is not the product.", 0, 2),
        sp("By the way smash that subscribe button folks.", 3, 5),
        sp("The harness is what actually matters.", 6, 8),
      ],
      SCRIPT,
    );
    expect(r.kept).toHaveLength(3);
    expect(r.phrases[1]!.span).toBeNull();
  });

  it("drops ad-lib debris right after a dropped take", () => {
    const r = alignToScript(
      [
        sp("The harness is what act—", 0, 1.5),
        sp("ugh hold on start again", 2, 3),
        sp("The harness is what actually matters.", 4, 6),
      ],
      SCRIPT,
    );
    expect(r.phrases[0]!.dropped).toBe(true);
    expect(r.phrases[1]!.dropped).toBe(true);
    expect(r.kept).toHaveLength(1);
  });

  it("applies keep-last ACROSS parts (crash-restart overlap)", () => {
    const r = alignToScript(
      [
        sp("Researchers found a six times difference between harnesses.", 50, 53, 0),
        sp("Researchers found a six times difference between harnesses.", 0, 3, 1),
        sp("Let's talk about the horse.", 4, 6, 1),
      ],
      SCRIPT,
    );
    expect(r.phrases[0]!.dropped).toBe(true);
    expect(r.kept.map((p) => p.part)).toEqual([1, 1]);
  });

  it("does NOT merge two different-but-similar script sentences", () => {
    const script2 = parseScript(`## B
**Say:**
The model is the brain of the agent. The model is the brain, but not the hands.
`);
    const r = alignToScript(
      [
        sp("The model is the brain of the agent.", 0, 2),
        sp("The model is the brain, but not the hands.", 3, 5),
      ],
      script2,
    );
    expect(r.kept).toHaveLength(2);
    expect(r.retakeClusters).toBe(0);
  });
});
