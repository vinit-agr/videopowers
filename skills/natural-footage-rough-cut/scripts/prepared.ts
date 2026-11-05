// prepared.ts — the shape of prepare.json (shared by prepare, edit validation and build).
import type { MediaInfo } from "./types.js";
import type { Section } from "./natural-script.js";

export interface PreparedWord {
  /** Index of the word within its part (stable ID used by edit.json spans). */
  i: number;
  text: string;
  start: number;
  end: number;
}

export interface PreparedPart {
  /** 1-based part number (part1.mp4 → 1). */
  part: number;
  file: string;
  path: string;
  info: MediaInfo;
  words: PreparedWord[];
}

export interface Prepared {
  project: string;
  parts: PreparedPart[];
  sections: Section[];
}
