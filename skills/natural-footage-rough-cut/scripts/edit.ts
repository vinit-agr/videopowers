// edit.ts — edit.json: the editor's decisions (written by Claude), and its validation.
import type { Prepared } from "./prepared.js";

/** A run of words in one part: word indices, inclusive. */
export interface Span {
  part: number;
  from: number;
  to: number;
}

export interface KeptSpan extends Span {
  card: string;
  note?: string;
}

export type CallKind = "earlier-attempt" | "repeat" | "boundary" | "card" | "other";

export interface Call {
  id: number;
  kind: CallKind;
  reason: string;
  kept: Span;
  alternatives: Array<Span & { label?: string }>;
}

export interface LockCheck {
  section: number;
  card: string;
  line: string;
  said: string | null;
  status: "exact" | "facts-ok" | "wrong" | "missing";
  note?: string;
}

export interface Removed extends Span {
  why: string;
  keptInstead?: Span;
}

export interface EditFile {
  version: 1;
  /** In natural_script.md order; spans in output order. A section absent or empty = not recorded. */
  sections: Array<{ section: number; spans: KeptSpan[] }>;
  calls: Call[];
  locks: LockCheck[];
  removed: Removed[];
  missing: Array<{ section: number; card: string; what: string }>;
}

export function spanText(span: Span, prep: Prepared): string {
  const part = prep.parts.find((p) => p.part === span.part);
  if (!part) return "";
  return part.words.filter((w) => w.i >= span.from && w.i <= span.to).map((w) => w.text).join(" ");
}

function label(s: Span): string {
  return `p${s.part} #${s.from}–#${s.to}`;
}

function short(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/** Null when the span is well-formed and inside its part's words; otherwise an error naming it. */
function checkSpan(what: string, s: Span, prep: Prepared): string | null {
  if (![s?.part, s?.from, s?.to].every((n) => Number.isInteger(n))) {
    return `${what} ${JSON.stringify(s)}: part, from and to must all be whole numbers`;
  }
  const part = prep.parts.find((p) => p.part === s.part);
  if (!part) return `${what} ${label(s)} refers to part ${s.part}, which doesn't exist`;
  if (s.from > s.to) return `${what} ${label(s)} is reversed (from > to)`;
  if (s.from < 0 || s.to >= part.words.length) {
    return `${what} ${label(s)} is out of range (part ${s.part} has words #0–#${part.words.length - 1})`;
  }
  return null;
}

export function validateEdit(edit: EditFile, prep: Prepared): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const kept: KeptSpan[] = [];

  for (const key of ["sections", "calls", "locks", "removed", "missing"] as const) {
    if (!Array.isArray(edit[key])) errors.push(`edit.json: "${key}" must be a list`);
  }
  if (errors.length) return { errors, warnings };

  for (const sec of edit.sections) {
    for (const s of sec.spans) {
      const err = checkSpan(`section ${sec.section}: span`, s, prep);
      if (err) errors.push(err);
      else kept.push(s);
    }
  }
  edit.calls.forEach((c) => {
    const e1 = checkSpan(`call ${c.id} kept`, c.kept, prep);
    if (e1) errors.push(e1);
    c.alternatives.forEach((a, k) => {
      const e2 = checkSpan(`call ${c.id} alternative ${k + 1}`, a, prep);
      if (e2) errors.push(e2);
    });
  });
  edit.removed.forEach((r, k) => {
    const e1 = checkSpan(`removed ${k + 1}`, r, prep);
    if (e1) errors.push(e1);
    if (r.keptInstead) {
      const e2 = checkSpan(`removed ${k + 1} keptInstead`, r.keptInstead, prep);
      if (e2) errors.push(e2);
    }
  });

  for (let a = 0; a < kept.length; a++) {
    for (let b = a + 1; b < kept.length; b++) {
      const x = kept[a]!;
      const y = kept[b]!;
      if (x.part === y.part && x.from <= y.to && y.from <= x.to) {
        errors.push(
          `kept spans overlap: ${label(x)} "${short(spanText(x, prep))}" and ${label(y)} "${short(spanText(y, prep))}"`,
        );
      }
    }
  }

  const inCut = (s: Span) => kept.some((k) => k.part === s.part && s.from >= k.from && s.from <= k.to);
  for (const c of edit.calls) {
    if (!inCut(c.kept)) warnings.push(`call ${c.id}: its kept span ${label(c.kept)} is not in the cut; no marker will be placed`);
  }

  const recorded = new Set(edit.sections.filter((s) => s.spans.length > 0).map((s) => s.section));
  for (const sec of prep.sections) {
    if (!recorded.has(sec.number)) continue;
    const touched = new Set(edit.sections.find((s) => s.section === sec.number)!.spans.map((s) => s.card));
    for (const card of sec.cards) {
      if (!touched.has(card.id) && !edit.missing.some((m) => m.section === sec.number && m.card === card.id)) {
        warnings.push(`section ${sec.number}: card ${card.id} has no kept span and isn't listed as missing`);
      }
      for (const line of card.locks) {
        if (!edit.locks.some((l) => l.section === sec.number && l.card === card.id && l.line === line)) {
          warnings.push(`section ${sec.number} / ${card.id}: fixed line has no 🔒 check: "${short(line)}"`);
        }
      }
    }
  }
  return { errors, warnings };
}
