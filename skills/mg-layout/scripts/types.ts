export type ContentKind = "none" | "graphics" | "media";
export type LayoutKind = "FULLFACE" | "OVERLAY" | "SPLIT" | "BUBBLE" | "FULLGRAPHICS" | "CHAPTER";

export interface LayoutSpec {
  kind: LayoutKind;
  content: ContentKind;
  /** Overlay panel cells / Bubble cell (3×3 grid, 1–9). */
  cells: number[];
  /** Split only: which side the face docks on. */
  side: "left" | "right" | null;
  /** Split only: face width as % of frame width. */
  facePct: number | null;
  /** Bubble only. */
  shape: "circle" | "rect" | null;
}

/** One shot as written in layout.yaml. */
export interface YamlShot {
  shot: string;
  layout: string;
  anchor: string;
  purpose?: string;
  subjects?: string[];
  builds?: string[];
  note?: string;
}

export interface BeatSheetChapter {
  id: string;
  number: number;
  title: string;
  displayName: string;
  startSec: number;
  endSec: number;
  startFrame: number;
  durationInFrames: number;
  gapAfterSec: number;
}

export interface BeatSheet {
  slug: string;
  title: string;
  fps: number;
  width: number;
  height: number;
  durationSec: number;
  durationInFrames: number;
  chapters: BeatSheetChapter[];
}

export interface Word {
  text: string;
  start: number;
  end: number;
  type?: string;
}

export interface ResolvedBuild {
  word: string;
  sec: number;
  frame: number;
}

export type ShotOrigin = "yaml" | "auto-lead" | "chapter-card";

export interface ResolvedShot {
  id: string;
  chapterId: string;
  origin: ShotOrigin;
  tag: string;
  spec: LayoutSpec;
  anchorText: string;
  startSec: number;
  endSec: number;
  startFrame: number;
  durationInFrames: number;
  purpose: string | null;
  subjects: string[];
  builds: ResolvedBuild[];
  note: string | null;
  /** Chapter cards only: the title text the card introduces. */
  cardTitle: string | null;
}

export interface Problem {
  level: "error" | "warning";
  where: string;
  message: string;
}
