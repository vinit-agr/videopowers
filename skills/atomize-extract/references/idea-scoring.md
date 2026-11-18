# Idea scoring

How every candidate is scored. The same six points guide generation (`idea-generation.md`) and scoring. The rubric here is general. What the company has learned from real post results lives in the workspace scoring notes.

## The six points

Use them in this order.

| # | Point | Role |
|---|---|---|
| 1 | Stands alone: a complete thought, no video needed. "The topic changed too quickly" fails. | gate |
| 2 | Stops the right person | hook |
| 3 | One clear thought or story with tension that keeps them reading | retain |
| 4 | Something they can use or check in their own work | reward |
| 5 | True: numbers, quotes and sources are accurate (mostly checked against the script) | gate |
| 6 | Fits a ladder step | tag |

## Priority

When points pull against each other, judge in this order:

1. Is it worth stopping for?
2. Do the hook, retain and reward work?
3. Is every number, quote and story accurate? Correct it if not.
4. If the facts can't support the story, drop that version and find a story the facts do support.

Accuracy is the floor, not the goal. A true but boring idea is still a bad idea.

## Rubric

- Points 1 and 5 are pass or fail. A fail on either drops the candidate.
- Points 2, 3 and 4 are scored 1 to 5 each, judged for the candidate's persona. Write a one-line reason for each score.
- Story and usefulness come first. A real story, or a takeaway the reader can use, scores higher than a bare fact.
- Total = hook + retain + reward, out of 15.
- Bar: 10 of 15, with no single score below 3. Never lower the bar.
- Point 6 is a tag (step and bucket), not a score.
- A repeat flag (see `picking.md`) lowers the score shown: take 1 point off the hook, since a familiar idea stops fewer people, and write the flag in `repeat_flag`. The flag is never a block on its own.
- On the card, the scores go in `scores` as `{stands_alone, hook, retain, reward, true, total}`. The short reasons go in the `why` column of `candidates.md` and in the card's `why_picked`.

## What earns a high score

- A specific number or name beats a general claim.
- Curiosity: a gap the reader wants closed.
- Proof close to the claim.
- Native to the platform: it reads like a post, not a slide from the video.
- Useful today.
- Document, don't create: what the team actually saw or said beats a made-up angle.

## Idea types

An optional tag on each candidate. No minimum. They help the scoring notes learn what works.

- surprising number
- myth vs evidence
- real quote or story
- how-to
- objection
- comparison
- who-it's-not-for
- opinion

Use these exact words in `idea_type`; `gate.py cards` rejects any other value.

## Workspace scoring notes

Read the file at the `scoring notes` key in `videopowers.md` on every run, before scoring. It holds what real post results and past feedback have taught. Where it disagrees with this rubric, the notes win, except the bar (10 of 15, none below 3), which never changes. Never write company-specific lessons into this file; add them to the scoring notes.
