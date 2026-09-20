import type { ChapterInfo, Gap } from "./types.js";

/** kebab-case a title into a code-safe id fragment, capped at 40 chars. */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[’‘']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= 40) return slug || "chapter";
  const cut = slug.slice(0, 40);
  const lastDash = cut.lastIndexOf("-");
  return lastDash > 20 ? cut.slice(0, lastDash) : cut;
}

export class ChapterMismatchError extends Error {
  constructor(
    public beatTitles: string[],
    public gaps: Gap[],
    public durationSec: number,
  ) {
    super(
      `script.md has ${beatTitles.length} beats, but the video has ${gaps.length} black gaps ` +
        `(${gaps.length + 1} chapters). Expected exactly beats − 1 = ${beatTitles.length - 1} gaps. ` +
        `Fix the edit (missing/extra gap) or the script — mg-setup never guesses the mapping.`,
    );
    this.name = "ChapterMismatchError";
  }
}

/**
 * Zip script beats with detected gaps into chapters. Chapter i spans from the
 * end of the previous gap (or 0) to the start of the next gap (or video end).
 * Hard-fails on a count mismatch — the caller prints the side-by-side table.
 */
export function makeChapters(
  beatTitles: string[],
  gaps: Gap[],
  durationSec: number,
  fps: number,
): ChapterInfo[] {
  if (gaps.length + 1 !== beatTitles.length) {
    throw new ChapterMismatchError(beatTitles, gaps, durationSec);
  }
  return beatTitles.map((title, i) => {
    const startSec = i === 0 ? 0 : gaps[i - 1]!.end;
    const endSec = i < gaps.length ? gaps[i]!.start : durationSec;
    const startFrame = Math.round(startSec * fps);
    const endFrame = Math.round(endSec * fps);
    const number = i + 1;
    const nn = String(number).padStart(2, "0");
    return {
      id: `ch${nn}-${slugify(title)}`,
      number,
      title,
      displayName: `${nn} · ${title}`,
      startSec,
      endSec,
      startFrame,
      durationInFrames: endFrame - startFrame,
      gapAfterSec: i < gaps.length ? gaps[i]!.end - gaps[i]!.start : 0,
    };
  });
}
