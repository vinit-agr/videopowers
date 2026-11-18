# Idea generation

How to find the candidates for one pillar video. Scoring comes after, in `idea-scoring.md`.

## One pass

- Generate 20 to 24 candidates in one pass, guided by the six points in `idea-scoring.md`: each should stand alone, stop the right person, keep them reading, give them something, be true and fit a ladder step.
- Aim wide. Cover the whole pillar, every bucket in the framework file and each format, so picking has real choices.
- One candidate is one idea. Never two candidates for the same idea in different formats.
- Number them `C01`, `C02` and on. Keep the numbers through scoring, picking and `candidates.md`.

**Personas.** Read them from the file at the `personas` key: its `## Personas` section, where one persona is marked main. If there is no `## Personas` section, read `## Default audience` in the same file as the main persona. Most candidates are for the main persona. Use another persona only when the idea clearly fits it.

## Each candidate

Write each candidate in your notes with:

- **Idea line:** the whole idea in one sentence.
- **Persona:** who it is for.
- **Step and bucket:** the ladder step and bucket from the file at the `framework` key.
- **Idea type:** optional, one of the types in `idea-scoring.md`.
- **Source line:** where it comes from: a script line, or a research finding with its file.
- **customer_story:** true when the idea is told from a customer conversation or a sales call, else false. It is not a block; stage 2 uses it for matching.

## Sources

- Use this pillar's own files first: the said file (`said.md` if present, else `script.md`), `outline.md`, every `research*.md`, and `packaging.md` if present.
- Findings from other videos' research files are allowed where they fit, at most one borrowed finding per idea. A borrowed source has a `file` that starts with `../`.
- Never do new outside research.
- You may expand an idea from general understanding, but add no new facts.
- Each finding gets an id (format in `idea-card.md`). Before you name a new one, look in the file at the `findings` key. If the same finding is already there, reuse its id. Compare by source and statement, not by id alone: older rows use other id shapes.

## Ideas without numbers

Opinions, stories and the team's own views are welcome. Back each one with the pillar line where the speaker said it: put the file and the quote, word for word, in the card's `said_in`. A card with no numbers and no excerpts must have `said_in`, or `gate.py cards` fails it.
