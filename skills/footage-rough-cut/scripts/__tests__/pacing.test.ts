import { describe, expect, it } from "vitest";
import { pacingPreset } from "../pacing.js";

describe("pacingPreset", () => {
  it("tightens the gap threshold and padding as it goes tight→loose", () => {
    const tight = pacingPreset("tight");
    const medium = pacingPreset("medium");
    const loose = pacingPreset("loose");
    expect(tight.gapThreshold).toBeLessThan(medium.gapThreshold);
    expect(medium.gapThreshold).toBeLessThan(loose.gapThreshold);
    expect(tight.padTrail).toBeLessThan(loose.padTrail);
  });
});
