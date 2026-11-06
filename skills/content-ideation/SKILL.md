---
name: content-ideation
description: Use when deciding what videos to make next — planning a month or the next one to three long-form videos, checking whether one video idea is worth making, reviewing a proposed plan idea by idea (keep, change, drop), or when no videopowers.md content workspace exists yet.
---

# content-ideation

Chooses the long-form videos worth making, and writes **packaging v1** for
each: an overview, a title, a first line, a thumbnail concept with an HTML
mockup, and a score with reasons. First stage of the pipeline:

```
content-ideation ─► research-and-outline ─► script-writing ─► record ─► …
```

Every video has two jobs: help **unknown** prospects find the company
(the title and thumbnail must earn the click) and help sales move **known**
prospects forward (sent before or after a call). The score shows which way
each idea leans, so a plan serves both.

## Before anything

1. Find the workspace: `references/workspace.md`, *Finding the workspace*.
   None → offer *Setup* from that file, and stop until it's done.
2. Status sync (*Approval words and status sync* in workspace.md).
3. Read: profile, framework, registry, idea log, taste log, niche words.
   Re-read the registry from disk right before you write to it.

## Modes

| The user says | Mode | Writes |
|---|---|---|
| "Plan December: 10 videos, 1 already made" | Plan | `plans/<YYYY-MM>.md`, `plans/<YYYY-MM>-thumbnails.html`, registry rows |
| "Plan the next video" (N = 1–3) | Plan | `plans/next-<YYYY-MM-DD>.md`, `plans/next-<YYYY-MM-DD>-thumbnails.html`, registry rows |
| "Is this idea worth making?" | Test | Nothing, until the user says "add it" |
| A keep / change / drop reply to a plan | Review | Registry, video folders, taste log, replacements |

## Plan

**N** is the number of new picks. A total ("10 videos, 1 already made";
"4 videos in December" when one is already planned for December) means N =
the total minus videos already made or planned in the period. Say which
reading you used at the top of the plan.

1. **Balance view.** Count videos made or planned in the period, by bucket
   and by product. Compare with the framework's target shares.
2. **Candidates: at least 2N.** Draw from the framework's topics; the idea
   log, new entries first (every new entry becomes a candidate, or the plan
   says why not: already in the registry, or ruled out by the profile); existing `idea` rows in the registry;
   Hormozi's five sources; Sheridan's Big 5. Read the taste log first: its
   reasons rule out whole kinds of idea.
3. **Shape** each with the framework's five questions.
4. **Gate.** Mainly about the company itself → a short post, not a pillar;
   replace it.
5. **Packaging v1, then score.** Write the block (below). Score with the
   workspace framework: one line of reason per measure, then Reach, Sales,
   Total and lean. Check the arithmetic.
6. **Pick N, balance first.** Share the N slots between buckets with the
   framework's slot formula. Fill each bucket with its best ideas that
   pass the threshold; the score ranks ideas **within** a bucket only. A
   bucket with nothing above the threshold → write it under `## Gaps` with
   1–2 fix-the-angle options; never fill it silently. Then check product
   variety.
7. **Schedule** by the cadence in `videopowers.md`: cheap ideas where weeks
   are tight, research-heavy ones where research can start early. If the
   period has fewer slots than M + N, say so at the top of the plan and ask
   whether to cut N or add slots; never move a human's date.
8. **Write.** The plan from `templates/plan.md`; the mockups (below). In the
   registry: each pick becomes `proposed` and is renumbered in place to the
   next free video number, in rank order; each unpicked candidate is an
   `idea-<n>` row. Fill every empty column (length, bucket / step, type,
   product, score); if you reworded a title, update the registry title too.
   Rank ties go to the higher Reach, then the earlier ladder step.
   Unpicked candidates keep their full block under `## Not picked`.

Then tell the user where the plan is, and ask for keep / change / drop on
each pick, with a reason.

## Test

For one idea: run Plan steps 3–5, place it on the balance view (this month
and next), and answer plainly with one verdict: **make it** / **make it if
it fills a gap** / **fix the angle** / **drop** / **a short post, not a
pillar** (the gate failed; don't score it). If the taste log already holds
a verdict on the same idea, quote it. For "fix" and "short post", propose
1–2 viewer-first angles and score them. Always give packaging v1 for the
best version, with the thumbnail as a concept only (no mockup). Write
nothing; offer to add it as an `idea` row.

## Review

The user replies per idea: keep, change (with what) or drop (with why).

- **Keep** and **change** → `planned`. For a change, apply it to the block
  first and log it in `## Changes`.
- For each kept idea, create `videos/<NN>-<slug>/` with `packaging.md`
  (`templates/packaging.md`: the whole block, the thumbnail concept, and a
  first `## Changes` line) and `thumbnail.html` (its mockup section, in a
  copy of the template).
- A kept idea that needs **its own study** → say so, and offer to start
  research-and-outline now, so the study's criteria gate doesn't wait.
- **Drop** → `dropped`, with the reason appended to `note`. The id is never
  reused.
- Append one row per verdict to the taste log: date, idea, verdict, reason.
- Propose a replacement for each drop, for the same bucket: from `## Not
  picked` first; if none there fits, a new candidate. It becomes `proposed`
  with the next free video number, and gets its own mockup section.
- An idea with no verdict stays `proposed`; ask about it at the end.
- A human's edits to the registry stay as they are. Change only the cells
  this review is about.

## Writing the idea block

Use the block in `templates/plan.md`, every field:

- **Overview**, 3–5 sentences: the story, who it's for, the moment, what
  they can do after watching. Name the audience only if it differs from the
  profile's default audience.
- **Title** and 1–2 alternates; **first line**; and the hook's idea, all in
  the buyers' own words from `niche-words.md` (no word from its "not"
  column; `must` rows always apply).
- No number, result or claim beyond the profile's approved proof. The
  speaker's own background, as written in their speaker file, may be used.
  If an idea needs a fact you don't have, mark it `⚠` in the block.
- **Research needed:** none / light / days, and what kind.
- **Length:** `study`, `standard` or `short` (framework *Length types*).

## Thumbnails

Copy `templates/thumbnails.html`. One `section.thumb` per picked idea,
`id` = its id. Fill the 2–4 words, the visual element and the speaker's
emotion. Run the checklist in `references/thumbnails.md` on each one.
Not-picked blocks give the concept only, with no mockup link.

## Later (not in v1)

- **Demand signals:** VidIQ, YouTube search and trends, LinkedIn, limited to
  the niche, as an extra source in step 2 and a measure in the score.
- **Performance feedback:** results of published videos recorded in the
  registry and fed back into planning.
- **Keyword intelligence:** grow `niche-words.md` from the words buyers
  actually search and say.

## Common mistakes

| Mistake | Instead |
|---|---|
| Picking the top N by Total across all buckets | Share slots by bucket first; the score ranks within a bucket |
| Filling a bucket with an idea below the threshold | List it under `## Gaps` with fix-the-angle options |
| Scoring Click before the title and thumbnail exist | Packaging v1 first, then score |
| A pillar about the company's own story | The gate: make it a short post |
| A number or customer result that isn't in the profile | Approved proof only; mark gaps `⚠` |
| Overwriting a human's registry edit | Re-read from disk; change only your cells |
| Dropping unpicked candidates | Keep their full blocks under `## Not picked` |
| Reusing a dropped idea's number | Ids are never reused |
