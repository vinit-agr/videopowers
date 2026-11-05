import { describe, expect, it } from "vitest";
import { reelAction } from "../build.js";

describe("reelAction (review I3)", () => {
  it("builds the reel whenever there are judgment calls, whatever --to says", () => {
    expect(reelAction(["xml"], 2)).toBe("build");
    expect(reelAction(["resolve"], 1)).toBe("build");
    expect(reelAction(["xml", "mp4"], 3)).toBe("build");
  });
  it("removes a stale reel when there are no calls", () => {
    expect(reelAction(["xml", "mp4"], 0)).toBe("remove");
  });
});
