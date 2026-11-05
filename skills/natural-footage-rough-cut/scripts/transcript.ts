// transcript.ts — render prepare.json as the readable transcript the editor works from.
import { isCutOff, lockCandidates, normWord, restartOf } from "./hints.js";
import type { Prepared, PreparedWord } from "./prepared.js";

export const PHRASE_GAP = 0.5;

/** Split one part's words into phrases at pauses ≥ PHRASE_GAP. */
export function splitPhrases(words: PreparedWord[], gap = PHRASE_GAP): PreparedWord[][] {
  const out: PreparedWord[][] = [];
  let cur: PreparedWord[] = [];
  for (const w of words) {
    const last = cur[cur.length - 1];
    if (last && w.start - last.end >= gap) {
      out.push(cur);
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) out.push(cur);
  return out;
}

function clock(t: number): string {
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(1).padStart(4, "0")}`;
}

/** Phrase text with an [i] index marker every 5 words, so spans can be cut inside a phrase. */
function indexed(words: PreparedWord[]): string {
  return words.map((w, k) => (k % 5 === 0 ? `[${w.i}]${w.text}` : w.text)).join(" ");
}

export function formatTranscript(prep: Prepared): string {
  const out: string[] = [
    `# Transcript — ${prep.project}`,
    "",
    "Each line is one phrase (split at pauses ≥ 0.5 s): `p<part> #<first>–#<last>` word range, time in the part file, pause before it, hints.",
    "Hints: CUT-OFF = ends abandoned (…, --, cut-off word). RESTART of #n = opens with the same words as the phrase starting at word n.",
    "`[i]` marks word index i inside the text (every 5th word). edit.json spans use these word indices (inclusive).",
    "",
  ];
  for (const p of prep.parts) {
    out.push(`## Part ${p.part} — ${p.file} (${clock(p.info.duration)})`, "");
    const phrases = splitPhrases(p.words);
    const norm = phrases.map((ph) => ph.map((w) => normWord(w.text)).filter(Boolean));
    let prevEnd: number | null = null;
    phrases.forEach((ph, k) => {
      const first = ph[0]!;
      const last = ph[ph.length - 1]!;
      const tags: string[] = [];
      if (prevEnd !== null) tags.push(`pause ${(first.start - prevEnd).toFixed(1)}s`);
      const text = ph.map((w) => w.text).join(" ");
      if (isCutOff(text)) tags.push("CUT-OFF");
      const r = restartOf(norm, k);
      if (r !== null) tags.push(`RESTART of #${phrases[r]![0]!.i}`);
      out.push(`- \`p${p.part} #${first.i}–#${last.i}\` ${clock(first.start)} ${tags.length ? `(${tags.join(", ")})` : ""}`.trimEnd());
      out.push(`  ${indexed(ph)}`);
      prevEnd = last.end;
    });
    out.push("");
  }

  out.push("## 🔒 fixed-line candidates", "", "Where each fixed line was probably said (best matches; similarity 0–1).", "");
  for (const s of prep.sections) {
    for (const c of s.cards) {
      for (const lock of c.locks) {
        out.push(`- **${s.number} / ${c.id}**: ${lock}`);
        const cands = prep.parts
          .flatMap((p) => lockCandidates(lock, p.words, p.part))
          .sort((a, b) => b.sim - a.sim)
          .slice(0, 3);
        if (cands.length === 0) out.push("  - (no match: probably not said)");
        for (const c2 of cands) {
          const part = prep.parts.find((p) => p.part === c2.part)!;
          const said = part.words.filter((w) => w.i >= c2.from && w.i <= c2.to).map((w) => w.text).join(" ");
          out.push(`  - p${c2.part} #${c2.from}–#${c2.to} sim ${c2.sim}: "${said}"`);
        }
      }
    }
  }
  return out.join("\n") + "\n";
}
