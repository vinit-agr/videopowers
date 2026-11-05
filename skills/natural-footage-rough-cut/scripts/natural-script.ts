// natural-script.ts — parse natural_script.md (sections → cards → bullets + 🔒 fixed lines).
//
// Format: "## N. Title (about …)" sections, a "**The point:**" line, an optional
// <details> primer (ignored: it is read before recording, not said on camera),
// "### Card Nx: title" cards, "- " bullets (free lines) and "> 🔒 " fixed lines.
// Italic "*(…)*" notes are notes to the speaker and are ignored.

export interface Card {
  id: string;
  title: string;
  bullets: string[];
  locks: string[];
}

export interface Section {
  number: number;
  title: string;
  point: string;
  cards: Card[];
}

/** Markdown → plain spoken text: links become their label, emphasis markers go. */
function plain(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseNaturalScript(md: string): Section[] {
  const sections: Section[] = [];
  let section: Section | null = null;
  let card: Card | null = null;
  let inDetails = false;

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (/<details/i.test(line)) inDetails = true;
    if (inDetails) {
      if (/<\/details>/i.test(line)) inDetails = false;
      continue;
    }

    const h2 = /^## (.*)$/.exec(line);
    if (h2) {
      const m = /^(\d+)\.\s+(.*?)(?:\s*\(about[^)]*\))?\s*$/.exec(h2[1]!);
      section = m ? { number: Number(m[1]), title: m[2]!.trim(), point: "", cards: [] } : null;
      if (section) sections.push(section);
      card = null;
      continue;
    }
    if (!section) continue;

    const h3 = /^### Card\s+([0-9]+[a-z]?)\s*:\s*(.*)$/i.exec(line);
    if (h3) {
      card = { id: h3[1]!, title: plain(h3[2]!), bullets: [], locks: [] };
      section.cards.push(card);
      continue;
    }

    const point = /^\*\*The point:\*\*\s*(.*)$/.exec(line);
    if (point) {
      section.point = plain(point[1]!);
      continue;
    }
    if (!card) continue;

    const lock = /^>\s*🔒\s*(.*)$/.exec(line);
    if (lock) {
      card.locks.push(plain(lock[1]!));
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) card.bullets.push(plain(bullet[1]!));
  }
  return sections;
}
