// videopowers:mg-visuals — helpers every chapter component uses, so agents
// place graphics with the SAME geometry and timing feel as FootageStage
// instead of reinventing either.
import { Easing, interpolate } from "remotion";
import wordsJson from "../data/words.json";
import { SHOTS, type Shot } from "../layout/shots";
import { contentBoxes, type Rect } from "../layouts/geometry";
import { VIDEO } from "../video.config";

export type { Rect, Shot };

/** Matches FootageStage's layout-transition length — enters feel native. */
export const ENTER_FRAMES = 15;

export function shotById(id: string): Shot {
  const s = SHOTS.find((x) => x.id === id);
  if (!s) throw new Error(`mg-visuals: unknown shot id "${id}"`);
  return s;
}

export function chapterShots(chapterId: string): Shot[] {
  return SHOTS.filter((s) => s.chapterId === chapterId);
}

/** The shot's content box (OVERLAY may have several — pick by index). */
export function shotBox(shot: Shot, index = 0): Rect {
  const boxes = contentBoxes(shot);
  const box = boxes[index] ?? boxes[0];
  if (!box) throw new Error(`mg-visuals: shot "${shot.id}" (${shot.kind}) has no content box`);
  return box;
}

/** Frame anchored by a layout.yaml build word on this shot. */
export function buildFrame(shot: Shot, word: string): number {
  const b = shot.builds.find((x) => x.word === word);
  if (!b) {
    throw new Error(
      `mg-visuals: shot "${shot.id}" has no build "${word}" (has: ${shot.builds.map((x) => x.word).join(", ") || "none"})`,
    );
  }
  return b.frame;
}

interface TimedWord {
  text: string;
  start: number;
  type: string;
}

const WORDS: TimedWord[] = (wordsJson as TimedWord[]).filter((w) => w.type === "word");

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);

/**
 * Frame where a spoken phrase starts, searching at/after `fromFrame`
 * (pass the shot's startFrame to disambiguate repeated phrases).
 * Matching is case/punctuation-insensitive. Throws when not found —
 * an anchor that doesn't exist is a brief bug, not a soft miss.
 */
export function wordFrame(phrase: string, fromFrame = 0): number {
  const target = normalize(phrase);
  if (target.length === 0) throw new Error("mg-visuals: empty anchor phrase");
  const fromSec = fromFrame / VIDEO.fps;
  for (let i = 0; i < WORDS.length - target.length + 1; i++) {
    const w = WORDS[i]!;
    if (w.start < fromSec) continue;
    let ok = true;
    for (let j = 0; j < target.length; j++) {
      if (normalize(WORDS[i + j]!.text)[0] !== target[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return Math.round(w.start * VIDEO.fps);
  }
  throw new Error(`mg-visuals: phrase "${phrase}" not spoken at/after frame ${fromFrame}`);
}

/**
 * 0→1 eased progress for an element entering ON its anchor frame —
 * the same cubic in/out feel FootageStage uses for layout moves.
 */
export function enterProgress(frame: number, anchorFrame: number, durationFrames = ENTER_FRAMES): number {
  return interpolate(frame - anchorFrame, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
}
