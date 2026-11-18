import { describe, expect, it } from "vitest";
import { parseScript } from "../../../../scripts/shared/script.ts";
import { buildReadAloud, check, parseReadAloud, teleprompter } from "../read-aloud.ts";

const SCRIPT = `# Three reasons good cooks leave

Outline v0.3 · 40 words · speaker: sam

## Hook

**Say:** If you run a small kitchen, you've lost a good cook. It wasn't the pay.

Here are the three reasons.

**Show:** a kitchen at night.

## Close

**Say:** Post next week's schedule today.

## Numbers and sources

| Number as said | Source |
|---|---|
`;

describe("build", () => {
  it("makes one block per take, one sentence per line, under the beat headings", () => {
    const ra = buildReadAloud(parseScript(SCRIPT));
    expect(ra).toBe(
      [
        "# Three reasons good cooks leave",
        "",
        "## Hook",
        "",
        "```",
        "If you run a small kitchen, you've lost a good cook.",
        "It wasn't the pay.",
        "```",
        "",
        "```",
        "Here are the three reasons.",
        "```",
        "",
        "## Close",
        "",
        "```",
        "Post next week's schedule today.",
        "```",
        "",
      ].join("\n"),
    );
  });

  it("keeps link lines after blocks whose words didn't change", () => {
    const old = parseReadAloud(
      "# T\n\n## Hook\n\n```\nHere are the three reasons.\n```\n\n[Study: three reasons](https://example.com)\n",
    );
    const ra = buildReadAloud(parseScript(SCRIPT), old);
    expect(ra).toContain("Here are the three reasons.\n```\n\n[Study: three reasons](https://example.com)\n");
  });

  it("drops link lines when the block's words changed", () => {
    const old = parseReadAloud("# T\n\n```\nHere are the 3 reasons.\n```\n\n[Study](https://example.com)\n");
    expect(buildReadAloud(parseScript(SCRIPT), old)).not.toContain("[Study]");
  });
});

describe("check", () => {
  it("passes when the words match, ignoring punctuation, case and line breaks", () => {
    const ra = parseReadAloud(buildReadAloud(parseScript(SCRIPT)));
    expect(check(parseScript(SCRIPT), ra).same).toBe(true);
  });

  it("points at the changed words", () => {
    const edited = buildReadAloud(parseScript(SCRIPT)).replace("It wasn't the pay.", "It wasn't the money at all.");
    const r = check(parseScript(SCRIPT), parseReadAloud(edited));
    expect(r.same).toBe(false);
    expect(r.scriptAt).toContain("[pay]");
    expect(r.readAloudAt).toContain("[money at all]");
  });

  it("catches a speaker's numbered line that script.md says differently", () => {
    const script = SCRIPT.replace("Here are the three reasons.", "Number 1. The schedule.");
    const ra = parseReadAloud("```\nIf you run a small kitchen, you've lost a good cook.\nIt wasn't the pay.\n```\n```\n1. The schedule.\n```\n```\nPost next week's schedule today.\n```\n");
    expect(check(parseScript(script), ra).same).toBe(false);
  });
});

describe("teleprompter", () => {
  it("keeps spoken lines only, a blank line between takes", () => {
    const ra = parseReadAloud(
      "# T\n\n## Hook\n\n```\nLine one.\nLine two.\n```\n\n[Source](https://x.y)\n\n```\nLine three.\n```\n",
    );
    expect(teleprompter(ra)).toEqual({ text: "Line one.\nLine two.\n\nLine three.\n", warnings: [] });
  });

  it("warns about lines a Markdown viewer would turn into a list", () => {
    const ra = parseReadAloud("```\n1. The schedule.\n- a dash line\n```\n");
    expect(teleprompter(ra).warnings).toHaveLength(2);
  });
});
