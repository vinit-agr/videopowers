import { describe, expect, it } from "vitest";
import { reelSegments, type CardSpec } from "../reel.js";
import type { EditFile } from "../edit.js";
import type { Prepared } from "../prepared.js";

const info = { width: 1920, height: 1080, fps: 30, fpsRational: "30/1", hasVideo: true, hasAudio: true, duration: 60 };
const words = "a b c d e f g h".split(" ").map((text, i) => ({ i, text, start: 10 + i, end: 10.5 + i }));
const prep: Prepared = { project: "/p", parts: [{ part: 1, file: "part1.mp4", path: "/p/part1.mp4", info, words }], sections: [] };
const calls: EditFile["calls"] = [
  { id: 1, kind: "earlier-attempt", reason: "r1", kept: { part: 1, from: 0, to: 1 }, alternatives: [{ part: 1, from: 4, to: 5 }, { part: 1, from: 6, to: 7 }] },
  { id: 2, kind: "repeat", reason: "r2", kept: { part: 1, from: 2, to: 3 }, alternatives: [] },
];

describe("reelSegments", () => {
  const cards: CardSpec[] = [];
  const segs = reelSegments(calls, prep, new Map([[1, 90], [2, 300]]), 30, (c) => {
    cards.push(c);
    return `/tmp/card${cards.length}.png`;
  });

  it("per call: title card, 'Kept' card + clip, then a card + clip per alternative", () => {
    expect(segs.map((s) => s.kind)).toEqual([
      "image", "image", "clip", "image", "clip", "image", "clip", // call 1
      "image", "image", "clip", // call 2
    ]);
  });

  it("titles say which call, how many, and where it sits in the cut", () => {
    expect(cards[0]!.title).toBe("Call 1 of 2");
    expect(cards[0]!.subtitle).toContain("0:03.0 in the cut");
    expect(cards[0]!.body).toBe("r1");
    expect(cards.map((c) => c.title)).toContain("Alternative 2");
  });

  it("pads each clip by 0.3 s of real footage", () => {
    const kept = segs[2]!;
    expect(kept.kind === "clip" && kept.start).toBeCloseTo(9.7, 5);
    expect(kept.kind === "clip" && kept.end).toBeCloseTo(11.8, 5);
  });
});

import { cardText } from "../reel.js";

describe("cardText", () => {
  it("replaces the lock emoji the card font can't draw, and drops other emoji", () => {
    expect(cardText("the 🔒 line says 'nearly half' 👉")).toBe("the locked line says 'nearly half'");
  });
});
