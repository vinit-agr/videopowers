// script.ts — parse a video script written in the pipeline's script.md
// convention:
//
//   beat      = a `## HEADING` section that contains at least one **Say:** block
//               (sections without Say blocks — production notes — are ignored)
//   paragraph = one blank-line-separated block inside a Say block
//   sentence  = a `.` `?` `!` `…`-terminated run inside a paragraph
//
// Only **Say:** text is spoken; everything else (Show directions, tables,
// production notes) is invisible. Shared convention across videopowers
// skills (footage-rough-cut upstream, mg-layout downstream).

import { readFileSync } from "node:fs";

export interface ScriptSentence {
  index: number;
  beatIndex: number;
  paragraphIndex: number;
  text: string;
  tokens: string[];
}

export interface ScriptBeat {
  index: number;
  title: string;
  sentences: ScriptSentence[];
}

export interface ScriptModel {
  beats: ScriptBeat[];
  sentences: ScriptSentence[];
  /** First `# ` heading of the file, if any — the video's title. */
  title: string | null;
}

/** Lowercase word tokens, punctuation stripped (apostrophes kept). */
export function normTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/[^a-z0-9']+/)
    .filter(Boolean);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
}

export function splitSentences(paragraph: string): string[] {
  const out: string[] = [];
  let buf = "";
  for (const ch of paragraph) {
    buf += ch;
    if (/[.?!…]/.test(ch)) continue;
    if (/\s/.test(ch) && /[.?!…]['")\]]*\s$/.test(buf)) {
      const s = buf.trim();
      if (s) out.push(s);
      buf = "";
    }
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

export function parseScript(markdown: string): ScriptModel {
  const lines = markdown.split("\n");
  interface RawBeat { title: string; paragraphs: string[][] }
  const rawBeats: RawBeat[] = [];
  let beat: RawBeat | null = null;
  let inSay = false;
  let para: string[] = [];
  let title: string | null = null;

  const endParagraph = () => {
    if (beat && para.length > 0) beat.paragraphs.push(para);
    para = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s/.test(trimmed)) {
      endParagraph();
      inSay = false;
      beat = { title: trimmed.replace(/^##\s+/, ""), paragraphs: [] };
      rawBeats.push(beat);
      continue;
    }
    if (/^#\s/.test(trimmed)) {
      if (title === null) title = trimmed.replace(/^#\s+/, "");
      endParagraph();
      inSay = false;
      continue;
    }
    if (trimmed === "---") {
      endParagraph();
      inSay = false;
      continue;
    }
    const label = trimmed.match(/^\*\*([A-Za-z][A-Za-z /-]*):\*\*/);
    if (label) {
      endParagraph();
      inSay = label[1]!.toLowerCase() === "say";
      const rest = trimmed.slice(label[0].length).trim();
      if (inSay && rest) para.push(rest);
      continue;
    }
    if (!inSay || !beat) continue;
    if (trimmed === "") {
      endParagraph();
    } else {
      para.push(trimmed);
    }
  }
  endParagraph();

  const beats: ScriptBeat[] = [];
  const sentences: ScriptSentence[] = [];
  let paragraphIndex = 0;
  for (const rb of rawBeats) {
    if (rb.paragraphs.length === 0) continue; // no Say blocks → not a beat
    const b: ScriptBeat = { index: beats.length, title: rb.title, sentences: [] };
    for (const p of rb.paragraphs) {
      const text = stripMarkdown(p.join(" "));
      for (const s of splitSentences(text)) {
        const tokens = normTokens(s);
        if (tokens.length === 0) continue;
        const sentence: ScriptSentence = {
          index: sentences.length,
          beatIndex: b.index,
          paragraphIndex,
          text: s,
          tokens,
        };
        sentences.push(sentence);
        b.sentences.push(sentence);
      }
      paragraphIndex++;
    }
    if (b.sentences.length > 0) beats.push(b);
  }
  beats.forEach((b, i) => {
    b.index = i;
    for (const s of b.sentences) s.beatIndex = i;
  });
  return { beats, sentences, title };
}

export function loadScript(path: string): ScriptModel {
  return parseScript(readFileSync(path, "utf8"));
}
