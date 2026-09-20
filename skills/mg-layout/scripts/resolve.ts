import { findAnchor, spokenWords, type SpokenWord } from "./anchors.js";
import { parseTag } from "./tags.js";
import type {
  BeatSheet,
  LayoutSpec,
  Problem,
  ResolvedShot,
  Word,
  YamlShot,
} from "./types.js";

const FULLFACE_SPEC: LayoutSpec = {
  kind: "FULLFACE", content: "none", cells: [], side: null, facePct: null, shape: null,
};
const CHAPTER_SPEC: LayoutSpec = {
  kind: "CHAPTER", content: "graphics", cells: [], side: null, facePct: null, shape: null,
};

/** If the first yaml shot starts within this of the chapter start, snap it. */
const SNAP_SEC = 1.0;

export interface Resolution {
  shots: ResolvedShot[];
  problems: Problem[];
}

/**
 * Turn the yaml (chapterId → shots) into a frame-resolved, gap-free shot
 * timeline: anchors located in words.json with a forward cursor, implicit
 * FULLFACE leads where a chapter opens before its first anchored shot, and
 * chapter-card shots generated inside every black gap (introducing the NEXT
 * chapter). Structural problems are collected, not thrown — the linter
 * decides what blocks.
 */
export function resolveShots(
  yamlChapters: Record<string, YamlShot[]>,
  sheet: BeatSheet,
  words: Word[],
): Resolution {
  const problems: Problem[] = [];
  const spoken = spokenWords(words);
  const out: ResolvedShot[] = [];
  const fps = sheet.fps;
  const toFrame = (sec: number) => Math.round(sec * fps);
  const knownIds = new Set(sheet.chapters.map((c) => c.id));

  for (const id of Object.keys(yamlChapters)) {
    if (!knownIds.has(id)) {
      problems.push({ level: "error", where: id, message: `unknown chapter id (not in beat-sheet.json)` });
    }
  }

  const seenShotIds = new Set<string>();

  for (let ci = 0; ci < sheet.chapters.length; ci++) {
    const chapter = sheet.chapters[ci]!;
    const yamlShots = yamlChapters[chapter.id] ?? [];
    if (yamlShots.length === 0) {
      problems.push({ level: "warning", where: chapter.id, message: "no shots in layout.yaml — whole chapter runs as FULLFACE" });
    }

    interface Pending {
      yaml: YamlShot;
      id: string;
      spec: LayoutSpec | null;
      startSec: number | null;
    }
    const pending: Pending[] = [];
    let cursor = chapter.startSec;

    for (const ys of yamlShots) {
      const id = `${chapter.id.split("-")[0]}-${ys.shot}`; // ch03-s02
      if (seenShotIds.has(id)) {
        problems.push({ level: "error", where: id, message: "duplicate shot id" });
      }
      seenShotIds.add(id);

      let spec: LayoutSpec | null = null;
      try {
        spec = parseTag(ys.layout);
      } catch (e) {
        problems.push({ level: "error", where: id, message: (e as Error).message });
      }

      let startSec: number | null;
      if (ys.anchor.trim() === "start") {
        startSec = cursor === chapter.startSec ? chapter.startSec : null;
        if (startSec === null) {
          problems.push({ level: "error", where: id, message: `anchor "start" is only valid for a chapter's first shot` });
        }
      } else {
        startSec = findAnchor(spoken, ys.anchor, cursor, chapter.endSec);
        if (startSec === null) {
          problems.push({
            level: "error",
            where: id,
            message: `anchor not found in ${chapter.id} after ${cursor.toFixed(1)}s: "${ys.anchor}"${nearbyHint(spoken, cursor, chapter.endSec)}`,
          });
        }
      }
      if (startSec !== null) cursor = startSec;
      pending.push({ yaml: ys, id, spec, startSec });
    }

    // Boundaries: each shot runs to the next resolvable start.
    const resolvable = pending.filter((p) => p.startSec !== null && p.spec !== null);
    for (let i = 0; i < resolvable.length; i++) {
      const p = resolvable[i]!;
      let startSec = p.startSec!;
      if (i === 0 && startSec - chapter.startSec <= SNAP_SEC) startSec = chapter.startSec;
      const endSec = i + 1 < resolvable.length ? resolvable[i + 1]!.startSec! : chapter.endSec;

      if (i === 0 && startSec > chapter.startSec) {
        out.push(makeShot(`${chapter.id.split("-")[0]}-s00-lead`, chapter.id, "auto-lead", "[FULLFACE]", FULLFACE_SPEC,
          "(chapter start)", chapter.startSec, startSec, toFrame, null, [], [], null, null));
      }

      const builds = (p.yaml.builds ?? []).map((b) => {
        const sec = findAnchor(spoken, b, startSec, endSec);
        if (sec === null) {
          problems.push({ level: "error", where: p.id, message: `build word not found inside the shot: "${b}"` });
          return null;
        }
        return { word: b, sec, frame: toFrame(sec) };
      }).filter((b): b is { word: string; sec: number; frame: number } => b !== null);

      out.push(makeShot(p.id, chapter.id, "yaml", p.yaml.layout, p.spec!, p.yaml.anchor, startSec, endSec, toFrame,
        p.yaml.purpose ?? null, p.yaml.subjects ?? [], builds, p.yaml.note ?? null, null));
    }

    if (resolvable.length === 0) {
      out.push(makeShot(`${chapter.id.split("-")[0]}-s00-lead`, chapter.id, "auto-lead", "[FULLFACE]", FULLFACE_SPEC,
        "(chapter start)", chapter.startSec, chapter.endSec, toFrame, null, [], [], null, null));
    }

    // Chapter card inside the black gap, introducing the NEXT chapter.
    if (chapter.gapAfterSec > 0 && ci + 1 < sheet.chapters.length) {
      const next = sheet.chapters[ci + 1]!;
      out.push(makeShot(`${chapter.id.split("-")[0]}-card`, chapter.id, "chapter-card", "[CHAPTER CARD]", CHAPTER_SPEC,
        "(black gap)", chapter.endSec, chapter.endSec + chapter.gapAfterSec, toFrame,
        `chapter card introducing "${next.title}"`, [], [], null, next.displayName));
    }
  }

  out.sort((a, b) => a.startSec - b.startSec);
  return { shots: out, problems };
}

function makeShot(
  id: string, chapterId: string, origin: ResolvedShot["origin"], tag: string, spec: LayoutSpec,
  anchorText: string, startSec: number, endSec: number, toFrame: (s: number) => number,
  purpose: string | null, subjects: string[], builds: ResolvedShot["builds"], note: string | null,
  cardTitle: string | null,
): ResolvedShot {
  const startFrame = toFrame(startSec);
  return {
    id, chapterId, origin, tag, spec, anchorText, startSec, endSec, startFrame,
    durationInFrames: Math.max(1, toFrame(endSec) - startFrame),
    purpose, subjects, builds, note, cardTitle,
  };
}

/** A few transcript words around the cursor, to make anchor errors fixable. */
function nearbyHint(spoken: SpokenWord[], fromSec: number, untilSec: number): string {
  const nearby = spoken.filter((w) => w.start >= fromSec && w.start < Math.min(untilSec, fromSec + 12));
  if (nearby.length === 0) return "";
  return `\n    transcript there: "${nearby.slice(0, 18).map((w) => w.norm).join(" ")}…"`;
}
