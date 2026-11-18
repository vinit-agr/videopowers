# Brief: make visuals

You make the visuals for one or more idea cards: a batch (all the cards of one format) or a single piece (a redo, or a backup stage 2 swaps in). For each card you write a slot file, render it, fix what the renderer rejects, and report back. You write no post text; that comes in stage 2.

**You are given:** one or more post folders, each holding a `card.md`, and for a redo the earlier fail reasons. Run commands from the content workspace. `KIT`, `REF` and `XREF` are the absolute paths the main session gives you in the prompt.

## Read

1. Each card: the idea, hook, numbers, real moments, `said_in` quotes and the `## Visual plan` (format, theme, templates).
2. `REF/formats.md`: the templates, their slots and limits, and which format suits what.
3. For a redo: the earlier fail reasons. Fix every one, and don't bring back anything an earlier review asked to remove.

## Do

Work through the cards one at a time. Finish and save each piece before you start the next, so a later failure loses nothing.

1. Write `slots.json` next to the card:
   ```json
   {"kind": "carousel", "theme": "light", "source": "Marlow et al. 2024. Links in the first comment.",
    "slides": [{"template": "title", "slots": {"kicker": "...", "headline": "...", "lead": "..."}}]}
   ```
   - `kind` from the card's format: `infographic` or `carousel`.
   - Follow the Visual plan's theme and templates. The theme must be one of the `themes` in `brand.json` (folder at the `brand` key). Change a template only if the renderer rejects it or the content doesn't fit it.
   - **Neutral voice:** no "I", no names of anyone on the team. A carousel's `ask` slide `cta` is "Tell us in the comments." (stage 2 may change it for a person).
   - **Every number on the visual is in the card's `numbers`**, written as digits. Nothing else.
   - **Quotes only from the card's `real_moments` or `said_in`,** word for word.
   - `source`: short citations (author and year, or the organization), ending "Links in the first comment." when the full links won't fit. Every post visual carries a source line.
   - The cover or single image carries the hook as its headline. Each slide says one thing. Use the underline (`*words*`) once per visual, on the surprise.
   - In a batch, vary the layouts: don't give every piece the same lead template. Two posts with the same theme and the same templates in the same order fail `gate.py visuals` as look-alikes; change the theme or a template. So does a second carousel in the same theme with a big-number slide (`stat`) right after the title: in each theme, at most one carousel opens on a stat.
2. Render: `python3 KIT/render.py <post folder>/slots.json`
3. If it prints errors (a slot over its limit, overflow, a font problem), shorten or rephrase, or switch to a template that fits, and run it again. At most 4 runs per piece.
4. Check: `python3 KIT/gate.py visuals <post folder>` and fix what it reports (numbers not in the card, team names, banned words, a missing source line).
5. Look at `contact.png` once. Fix anything clearly wrong: text cut off, a slide almost empty, two slides saying the same thing.

## Return

One JSON line per piece, nothing else:
`{"piece": "P03", "status": "pass", "paths": ["<post folder>/slots.json", "<post folder>/report.json"], "fail_reasons": []}`
Use `"status": "fail"` with the reasons if a piece still fails after 4 renders.
