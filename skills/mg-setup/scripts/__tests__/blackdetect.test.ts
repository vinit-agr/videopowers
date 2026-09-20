import { describe, expect, it } from "vitest";
import { parseBlackdetect } from "../blackdetect.js";

describe("parseBlackdetect", () => {
  it("parses gaps out of noisy ffmpeg stderr", () => {
    const stderr = [
      "frame= 1404 fps=155 q=-0.0 size=N/A time=00:00:46.80 bitrate=N/A speed=5.16x",
      "[blackdetect @ 0x600003e48000] black_start:47.166667 black_end:49.166667 black_duration:2",
      "frame= 3625 fps=156 …    [blackdetect @ 0x600003e48000] black_start:117.866667 black_end:119.866667 black_duration:2",
      "[blackdetect @ 0x600003e48000] black_start:594.333333 black_end:596.233333 black_duration:1.9",
    ].join("\n");
    const gaps = parseBlackdetect(stderr);
    expect(gaps).toHaveLength(3);
    expect(gaps[0]).toEqual({ start: 47.166667, end: 49.166667 });
    expect(gaps[2]!.end).toBeCloseTo(596.233333);
  });

  it("returns sorted gaps and tolerates no matches", () => {
    expect(parseBlackdetect("no gaps here")).toEqual([]);
    const gaps = parseBlackdetect(
      "black_start:100 black_end:102 black_duration:2\nblack_start:10 black_end:12 black_duration:2",
    );
    expect(gaps.map((g) => g.start)).toEqual([10, 100]);
  });
});
