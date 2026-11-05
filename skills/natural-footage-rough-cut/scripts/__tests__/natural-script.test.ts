import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseNaturalScript } from "../natural-script.js";

const REAL = "/Users/vinit/Tars/Content-Creation/feynman/projects/BH-5-clone-of-everyday-they-wait-for-clinician-using-natural-script/natural_script.md";

describe("parseNaturalScript on the BH-5 natural script", () => {
  const sections = parseNaturalScript(readFileSync(REAL, "utf8"));

  it("finds the 12 numbered sections and skips 'How to use this file'", () => {
    expect(sections.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(sections[0]!.title).toBe("Hook");
  });

  it("reads cards, the point, and fixed lines with links and bold stripped", () => {
    const s1 = sections[0]!;
    expect(s1.point).toMatch(/^a 3-day wait costs you nearly half/);
    expect(s1.cards.map((c) => c.id)).toEqual(["1a", "1b"]);
    expect(s1.cards[0]!.locks[1]).toBe("Not a week later. Just 3 days.");
    expect(s1.cards[0]!.locks[0]).toBe(
      "If it's for tomorrow, about 7 out of 10 people show up. If it's 3 days later, only about 4 out of 10.",
    );
    const all = sections.flatMap((s) => s.cards.flatMap((c) => c.locks));
    expect(all.some((l) => l.includes("]("))).toBe(false);
    expect(all.some((l) => l.includes("**"))).toBe(false);
  });

  it("keeps bullets but never primer text or italic notes", () => {
    const bullets = sections.flatMap((s) => s.cards.flatMap((c) => c.bullets));
    expect(sections[0]!.cards[0]!.bullets[0]).toMatch(/^Picture this/);
    expect(bullets.some((b) => /Primer|script\.md says/.test(b))).toBe(false);
  });

  it("parses the close card's three fixed lines", () => {
    expect(sections[11]!.cards[0]!.id).toBe("12");
    expect(sections[11]!.cards[0]!.locks).toHaveLength(3);
  });
});

describe("parseNaturalScript edge cases", () => {
  it("ignores a fixed line that sits inside the primer", () => {
    const md = "## 1. A\n\n<details>\n<summary>x</summary>\n\n> 🔒 hidden\n\n- hidden bullet\n</details>\n\n### Card 1: t\n\n- shown\n";
    const [s] = parseNaturalScript(md);
    expect(s!.cards[0]!.bullets).toEqual(["shown"]);
    expect(s!.cards[0]!.locks).toEqual([]);
  });
});
