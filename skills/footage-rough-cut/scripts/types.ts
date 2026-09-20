// Shared types for the voice-cleanup pipeline.

export type WordType = "word" | "spacing" | "audio_event";

/** A single token from ElevenLabs Scribe with word-level timing (seconds). */
export interface Word {
  text: string;
  start: number;
  end: number;
  type: WordType;
}

/** A run of words bounded by silence — the unit of retake/filler reasoning. */
export interface Phrase {
  words: Word[];
  start: number;
  end: number;
  text: string;
}

/** A half-open time interval [start, end) in seconds. */
export interface Interval {
  start: number;
  end: number;
}

export type Silence = Interval;

export interface MediaInfo {
  width: number;
  height: number;
  fps: number;
  /** Raw ffprobe r_frame_rate rational (e.g. "60/1"); "" when audio-only. */
  fpsRational: string;
  hasVideo: boolean;
  hasAudio: boolean;
  duration: number;
}

/** One kept slice of the source that survives into the output. */
export interface Range {
  start: number;
  end: number;
  /** Words spoken within this range (for subtitle generation). */
  words: Word[];
  note: string;
}

export interface Edl {
  source: string;
  ranges: Range[];
  totalDuration: number;
}

export type Pacing = "tight" | "medium" | "loose";
export type Quality = "native" | "1080p";
export type FillerMode = "safe" | "aggressive";
export type Take = "last";

export interface PacingPreset {
  /** Inter-word gap (s) at/above which a phrase boundary is cut. */
  gapThreshold: number;
  /** Padding added before the first kept word of a range (s). */
  padLead: number;
  /** Padding added after the last kept word of a range (s). */
  padTrail: number;
}

export interface Config {
  input: string;
  output: string;
  /** True when -o was passed (audio-only inputs otherwise default to .m4a). */
  outputWasExplicit: boolean;
  removeSilences: boolean;
  removeFillers: boolean;
  fillerMode: FillerMode;
  /** Override list for edge fillers; null keeps the built-in list. */
  fillerWords: string[] | null;
  take: Take;
  pacing: Pacing;
  quality: Quality;
  crf: number;
  preset: string;
  normalize: boolean;
  lang: string | null;
  srt: boolean;
  vtt: boolean;
  json: boolean;
  dryRun: boolean;
  cacheDir: string;
  apiKey: string | null;
  // Project (rough-cut) mode
  to: string[];
  scriptPath: string | null;
  partsDir: string | null;
  outDir: string | null;
  seqName: string | null;
  budgets: PauseBudgets;
}

// ---------------------------------------------------------------------------
// Rough-cut (project mode) types
// ---------------------------------------------------------------------------

/** How two adjacent kept phrases relate in the script's hierarchy. */
export type BoundaryType = "intra" | "sentence" | "concept" | "beat";

/** Pause budgets (seconds of air kept at each boundary type). */
export interface PauseBudgets {
  /** Air kept between sentences inside one paragraph. */
  sentence: number;
  /** Air kept between paragraphs (concepts) inside one beat. */
  concept: number;
  /** Duration of the inserted black-screen gap between beats. */
  beat: number;
}

/** One source recording (part) of a multi-part project. */
export interface PartSource {
  /** 0-based index in recording order. */
  index: number;
  path: string;
  info: MediaInfo;
}

/** A kept slice of one part's footage on the output timeline. */
export interface ClipSegment {
  kind: "clip";
  /** Index into the project's parts array. */
  part: number;
  start: number;
  end: number;
  words: Word[];
  note: string;
  /** Script beat this clip belongs to (-1 when unknown). */
  beatIndex: number;
}

/** Inserted black video + silence (beat boundary). */
export interface BlackSegment {
  kind: "black";
  duration: number;
  /** Beat that STARTS after this gap (for chapter markers). */
  beatIndex: number;
}

export type Segment = ClipSegment | BlackSegment;

/** The rough cut: an ordered list of segments over multiple sources. */
export interface CutPlan {
  parts: PartSource[];
  segments: Segment[];
  fps: number;
  width: number;
  height: number;
  totalDuration: number;
}

/** Project-mode additions to Config (single-file fields remain unchanged). */
