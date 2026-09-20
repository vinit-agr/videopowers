export interface MediaInfo {
  width: number;
  height: number;
  fps: number;
  duration: number;
  pixFmt: string;
  videoCodec: string;
  hasAudio: boolean;
}

/** One detected black gap (a chapter marker) in the final cut. */
export interface Gap {
  start: number;
  end: number;
}

export interface ChapterInfo {
  /** Machine id, e.g. "ch03-beat-2-rough-cut" — stable, code-safe. */
  id: string;
  /** 1-based chapter number. */
  number: number;
  /** Verbatim `## ` heading from script.md. */
  title: string;
  /** Studio timeline name, e.g. "03 · BEAT 2 — Rough cut". */
  displayName: string;
  startSec: number;
  endSec: number;
  startFrame: number;
  durationInFrames: number;
  /** Black gap after this chapter (0 for the last one). */
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
  chapters: ChapterInfo[];
  input: string;
  generatedAt: string;
}

/** ElevenLabs Scribe word entry (type: word | spacing | audio_event). */
export interface Word {
  text: string;
  start: number;
  end: number;
  type?: string;
}
