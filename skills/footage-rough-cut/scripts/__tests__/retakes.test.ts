import { describe, expect, it } from "vitest";
import { DEFAULT_RETAKE_OPTIONS, keepLastTakes, sameLine, trimRestart } from "../retakes.js";
import { line, phrase, w } from "./helpers.js";

describe("sameLine", () => {
  it("matches exact repeats", () => {
    expect(sameLine(line("thats the wall"), line("thats the wall"), DEFAULT_RETAKE_OPTIONS)).toBe(true);
  });
  it("matches a prefix false start against its completion", () => {
    expect(sameLine(line("get them"), line("get them right now"), DEFAULT_RETAKE_OPTIONS)).toBe(true);
  });
  it("does not match distinct sentences", () => {
    expect(sameLine(line("the cat sat"), line("a dog ran"), DEFAULT_RETAKE_OPTIONS)).toBe(false);
  });
});

describe("trimRestart", () => {
  it("keeps from the last within-phrase restart", () => {
    const p = phrase([
      w("get", 0, 0.2), w("them", 0.3, 0.4), w("right", 0.5, 0.7), w("and", 0.8, 0.9),
      w("get", 1.0, 1.2), w("them", 1.3, 1.4), w("right", 1.5, 1.7), w("now", 1.8, 2.0),
    ]);
    expect(trimRestart(p).text).toBe("get them right now");
  });
  it("leaves a phrase without a restart unchanged", () => {
    expect(trimRestart(line("hello there friend")).text).toBe("hello there friend");
  });
});

describe("keepLastTakes", () => {
  it("collapses a consecutive duplicate to the last take", () => {
    const r = keepLastTakes([line("thats the wall", 0), line("thats the wall", 10)]);
    expect(r.kept).toHaveLength(1);
    expect(r.kept[0]!.start).toBe(10);
    expect(r.clusters).toBe(1);
    expect(r.droppedSpans).toHaveLength(1);
  });

  it("keeps distinct adjacent phrases", () => {
    const r = keepLastTakes([line("the cat sat", 0), line("a dog ran", 5)]);
    expect(r.kept).toHaveLength(2);
    expect(r.clusters).toBe(0);
  });

  it("collapses a false-start chain to the completion", () => {
    const r = keepLastTakes([line("get them", 0), line("get them right", 3), line("get them right now", 6)]);
    expect(r.kept).toHaveLength(1);
    expect(r.kept[0]!.text).toBe("get them right now");
  });

  it("drops a fragmented abandoned take that restarts later (prefix-restart)", () => {
    // Take A fragments into two phrases, then the speaker restarts the line.
    const r = keepLastTakes([
      line("get them right", 0), // abandoned start (incomplete)
      line("and claude code", 2), // its trailing fragment
      line("get them right", 6), // restart of the same line
      phrase([w("and", 8, 8.2), w("claude", 8.3, 8.6), w("code", 8.7, 9.0), w("stops.", 9.1, 9.6)]),
    ]);
    expect(r.kept.map((p) => p.text)).toEqual(["get them right", "and claude code stops."]);
  });

  it("drops punctuation-only blip phrases", () => {
    const blip = phrase([w("...", 5, 5.1)]);
    const r = keepLastTakes([line("hello world", 0), blip, line("goodbye now", 6)]);
    expect(r.kept.map((p) => p.text)).toEqual(["hello world", "goodbye now"]);
  });

  it("collapses a trailed-off restart where the abandoned take has an extra trailing word", () => {
    const r = keepLastTakes([
      line("it will ask you relevant questions to", 0), // abandoned (incomplete, extra "to")
      line("make it more clear", 6), // tail of abandoned take
      phrase([
        w("it", 10, 10.1), w("will", 10.2, 10.3), w("ask", 10.4, 10.5), w("you", 10.6, 10.7),
        w("relevant", 10.8, 11.0), w("questions", 11.1, 11.4), w("now.", 11.5, 12.0),
      ]), // restart, complete
    ]);
    expect(r.kept.map((p) => p.text)).toEqual(["it will ask you relevant questions now."]);
  });

  it("drops a non-adjacent exact-duplicate sentence, keeping the last", () => {
    const r = keepLastTakes([
      line("i follow this process.", 0),
      line("now watch closely.", 3),
      line("i follow this process.", 6),
    ]);
    expect(r.kept.map((p) => p.text)).toEqual(["now watch closely.", "i follow this process."]);
  });

  it("drops a short fragment contained in a neighbouring fuller take", () => {
    const r = keepLastTakes([
      line("to build features on my app", 0), // abandoned fragment
      phrase([
        w("ive", 4, 4.2), w("used", 4.3, 4.5), w("this", 4.6, 4.7), w("workflow", 4.8, 5.1),
        w("to", 5.2, 5.3), w("build", 5.4, 5.6), w("features", 5.7, 6.0), w("on", 6.1, 6.2),
        w("my", 6.3, 6.4), w("app.", 6.5, 7.0),
      ]),
    ]);
    expect(r.kept.map((p) => p.text)).toEqual(["ive used this workflow to build features on my app."]);
  });

  it("keeps a lone complete word that merely reappears inside a neighbouring sentence", () => {
    // "Step two, plan." — the standalone "plan." must survive even though the
    // word "plan" also ends the nearby "...implementation plan." sentence.
    const r = keepLastTakes([
      line("step two,", 0),
      line("plan.", 2),
      line("turn that into a concrete and written implementation plan.", 4),
      line("turn that into a concrete and written implementation plan.", 12),
    ]);
    expect(r.kept.map((p) => p.text)).toEqual([
      "step two,",
      "plan.",
      "turn that into a concrete and written implementation plan.",
    ]);
  });
});
