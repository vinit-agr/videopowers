# The content workspace

The plugin holds the method. Everything about one company (its products,
niche, buyers, words, speakers and videos) lives in that company's own
repo, in a folder called the **content workspace**. This file defines how
skills find it, the format of every file in it, and the first-run setup.
content-ideation, research-and-outline and script-writing all follow it.

## Finding the workspace

The workspace is the folder that holds `videopowers.md`.

1. Start from the current folder, or from a path the request names ("plan
   the next video in marketing/content").
2. Walk up from there, folder by folder, like git looks for `.git`.
3. Nothing found → search down from the start folder, up to 4 levels deep.
   Skip any folder named `node_modules`, `.git` or `templates`.
4. One found → use it. Several → list them and ask which; never pick. None
   → offer *Setup* (below).

All paths inside `videopowers.md` are relative to the folder that holds it.

## videopowers.md

The workspace's front page. It says where each file lives, so a company can
keep its existing layout. The template is
`templates/videopowers.template.md`.

```markdown
# videopowers workspace

## Paths
- profile: brain/profile.md
- framework: brain/framework.md
- niche words: brain/niche-words.md
- speakers: brain/speakers/
- registry: brain/registry.md
- idea log: brain/idea-log.md
- taste log: brain/taste-log.md
- plans: plans/
- videos: videos/          # one folder per video: videos/<NN>-<slug>/

## Defaults
- default speaker: <name>          # a file in speakers/, without .md
- cadence: <e.g. 1 a week, or 2 a week until 2026-12-01, then 3 a week>
- words per minute: 170
- recording method: short takes    # or: teleprompter
```

A missing entry falls back to the value shown above. A missing default
speaker means: ask.

**Recording method** sets script paragraph length: `short takes` (the
speaker reads a sentence or two from the screen, then says it to camera)
= 1–3 sentences per paragraph; `teleprompter` = 2–5.

## Living and built files

- **Living files** are lists people keep adding to, like an idea log that
  already exists. Skills read them **in place**: `videopowers.md` points at
  the existing file. Nobody has to switch files.
- **Built files** are made by setup from the company's existing material
  (a long strategy document, voice notes). Each starts with
  `Built from: <sources>, <YYYY-MM-DD>`. From then on the built file is the
  source of truth; the originals stay untouched, as history.
- Skills never move, rename or rewrite a company's original files.
- Skills write only to built files and to their own outputs in `plans/` and
  `videos/`. One exception: when the human asks, a skill may **append** rows
  to the idea log. It never changes or deletes existing rows.
- **Human edits always win.** Re-read a file from disk right before writing
  it, and change only the rows or lines you mean to change.
- A **new** idea-log entry is one dated after the last plan in `plans/`
  (every entry, if there is no plan yet) and not already in the registry.
  Match by meaning, not exact words.

## Approval words and status sync

Two human gates and one study gate use a word on the first line:

| File | Word | Means |
|---|---|---|
| `outline.md` | `Approved` | gate 1: the story is right |
| `study/criteria.md` | `Approved` | the study may collect data |
| `script.md` | `Locked` | gate 2: ready to record |

**The rule:** the file's first non-empty line starts with the word, in any
case, optionally followed by a name or date (`Approved — Dana, 12 Nov`).
Only humans write these words. Skills never add them.

**Status sync.** A skill that opens a video folder first reads these words
and moves the registry status forward:
- status `outlined` and `outline.md` Approved → `approved`;
- status `scripted` and `script.md` Locked with no open marker → `locked`.
  An open marker (a `[⚠ …]` inside spoken text) keeps it `scripted`, and
  the skill names the marker.

Any other status is left alone; sync never moves a video backwards. If the
human asks to revise an approved outline or rework a locked script, ask
first. If they say yes, remove the approval line, say so, and set the status
back to `outlined` or `scripted`.

## profile.md

Who the company is and what it may say. Template: `templates/profile.md`.
Sections, in this order:

| Section | Holds |
|---|---|
| Company | One sentence |
| Products | One sentence each |
| Niche | The industry, in the buyers' words |
| Default audience | The roles videos are for (a video names its audience only when it differs) |
| Belief | The one idea every video supports, or "not yet" |
| Approved proof | Numbers, results and credentials you may say publicly, each with where it comes from |
| Never claim | Claims, promises and topics that are off limits |
| Compliance rules | Legal, regulatory or brand rules for content |
| Research rules | What research may and may not do (e.g. read-only; never contact the organizations studied) |
| Next steps and lead magnets | What a viewer can do next, by awareness step |

## framework.md

How ideas are chosen and scored: the awareness ladder and buckets with
target shares, sources, shaping questions, the gate, the scoring rubric,
length types and the company's topic list. Setup copies
`references/framework-default.md` under a `Built from:` line, then fills in
the company's topics (and shares, if its material has them). From then on
the workspace version wins over the plugin default.

## registry.md

One table, one row per idea or video. It's how skills know what exists and
what's missing. Template: `templates/registry.md`. The header row is exactly:

```markdown
| id | title | status | length | bucket / step | type | product | speaker | score | planned for | folder | note |
```

| Column | Meaning |
|---|---|
| id | `idea-<n>` for a candidate; a video number (`7`, unpadded) once a plan picks it |
| title | Current working title |
| status | See below |
| length | `study` · `standard` · `short` (word targets in framework.md) |
| bucket / step | e.g. `options / 3` |
| type | `talk` (one person to camera, the default) or `conversation` (interview or guest) |
| product | Which product it's about, or `none` |
| speaker | A file name in `speakers/`; empty = the default speaker |
| score | The Total, e.g. `12` |
| planned for | A week or a date |
| folder | e.g. `videos/07-job-ads-study/` |
| note | Short notes, appended with ` · ` between them; never overwrite a human's text |

**Statuses**, in order:

| Status | Means | Set by |
|---|---|---|
| `idea` | A candidate | content-ideation, setup |
| `proposed` | In a plan the human hasn't reviewed | content-ideation (plan) |
| `planned` | Kept by the human | content-ideation (review) |
| `researching` | Research or a study is under way; the note says the step | research-and-outline |
| `outlined` | An outline draft exists | research-and-outline |
| `approved` | Gate 1 passed | status sync |
| `scripted` | A script exists | script-writing |
| `locked` | Gate 2 passed | status sync |
| `recorded` | Footage exists | the human |
| `published` | Live | the human |
| `dropped` | Not making it; the reason is in the note | content-ideation (review), the human |

A `conversation` video goes `approved` → `recorded`; it has no script.

**Ids.** When a plan picks a candidate, its row is renumbered in place to
the next free video number, in rank order. Ids are never reused: a dropped
video keeps its number, and its replacement takes the next free one. Video
folder numbers are zero-padded to at least two digits (`07`, `112`).

## idea-log.md

The running list of questions and ideas from the outside world: calls,
replies, comments, and the team's own ideas. Template:
`templates/idea-log.md`.

Minimum columns: `| date | idea or question | source |`. An existing log's
column names may differ ("Question", "Where from"); match them by meaning.
Any other columns are kept and ignored. A status column, if there is one,
is a hint only.

## taste-log.md

Why the human kept, changed or dropped ideas. content-ideation reads it
before every plan, so earlier reasons shape new ideas. Template:
`templates/taste-log.md`.

```markdown
| date | idea | verdict | reason |
```

`verdict` is `keep`, `change` or `drop`.

## niche-words.md

The industry's words: what to say instead of what, and the words buyers
must hear early. Used for titles, first lines, hooks, outlines and scripts.
Template: `templates/niche-words.md`.

```markdown
| say | not | why | must |
```

`must` is either `must` (a legal, compliance or brand rule; it beats even
the speaker's habits) or empty. Then a `## Recall words` list: words to say
early and in full, so the right viewer knows the video is for them.

## speakers/<name>.md

How one person talks on camera. Built by script-writing's speaker setup and
grown by its learning step. Template: `templates/speaker.md`. Sections, in
this order: Stance · Phrases they use · How they open · How they close ·
Numbers · Signposts · Always cut · Never say · Examples (before → after).

## packaging.md

One per video, in its folder. The hand-off between the skills: content-ideation
writes it when the human keeps an idea, research-and-outline refreshes it,
and the late packaging step finishes it. Template: `templates/packaging.md`.

1. The idea block, exactly as in the plan: overview, title and alternates,
   first line, thumbnail concept, tags, length, score, research needed.
2. `## Thumbnail`: the concept, and the mockup in `thumbnail.html` in the
   same folder.
3. `## Changes`: one dated line per change: what changed, which skill, why.

## Video folders

`videos/<NN>-<slug>/`, e.g. `videos/07-job-ads-study/`.

| File | Written by |
|---|---|
| `packaging.md`, `thumbnail.html` | content-ideation (review); refreshed by research-and-outline |
| `research.md` | research-and-outline |
| `study/method.md`, `study/sample.md`, `study/criteria.md`, `study/results.md` (+ raw data beside it) | research-and-outline |
| `outline.md` | research-and-outline |
| `script.md`, `script.generated.md` | script-writing |
| `script-rounds/NN-speaker.md`, `script-rounds/NN-claude.md` | script-writing (NN = round, from `01`) |

## Setup

Run when no `videopowers.md` is found and the human agrees. Ask these one
at a time, in plain words. Use what the existing files already answer and
ask only for the rest.

1. The company and its products, one sentence each, and what a viewer can
   do next (a demo, a free check, a guide).
2. The niche, and who the videos are for (roles).
3. The one belief every video should support. "Not yet" is fine: then
   propose 2–3 candidate beliefs from the material and choose none.
4. Proof you may say publicly, anything you must never claim, and any
   legal or compliance rules for content.
5. Rules for research (e.g. "never contact the organizations we study").
6. Where existing content lives: videos made, scripts, voice notes, idea
   lists, plans.
7. Who speaks on camera, and how often you publish (the cadence).

Facts are never guessed. A question nobody has answered yet gets `waiting: <the question>` in its section, is listed at the end of the
reply, and setup carries on with the rest. Classifications are not facts:
set each registry row's bucket / step, length and product as your best
judgement (the human corrects them), with `check` in the note when unsure.

Then write, in the folder the human names (otherwise next to the existing
content):

| File | How |
|---|---|
| `videopowers.md` | From the template; paths point at existing living files where they exist |
| `profile.md` | From the answers |
| `framework.md` | The default framework + the company's topics (and shares, if its material has them) |
| `registry.md` | One row per existing video folder, id = its number (`1`, not `01`), status from the material (`published`, `recorded`, `scripted`…); if unsure, the best guess with `check` in the note. Each idea from every list, **once**: merge ideas that mean the same; leave out ideas already made as a video. Ideas get `idea` (with `check` in the note if a list says it's planned) |
| `niche-words.md` | From existing material, or empty |
| `taste-log.md` | Empty |
| `idea-log.md` | Only if no idea list exists |

Every file setup creates, empty or not, starts with a `Built from:` line,
except `videopowers.md`. Setup never moves, renames or edits existing files.

**Left out.** Setup ends by listing everything it didn't copy: what kind of
thing, from which file, and why ("internal plan prices, from
pricing-internal.md: internal"). **Describe it; never repeat it.** No
price, name or number from left-out material appears anywhere in the
workspace. The list goes in the reply and in a `## Left out at setup`
section at the end of `videopowers.md`.

Speaker setup is a separate step: script-writing, *Speaker setup*.

## A named example

Tars, which makes chat and voice AI agents for behavioral health providers,
keeps its workspace in its own private repo. Three lines of its profile and
two rows of its niche words give the idea:

```markdown
## Company
Tars builds chat and voice AI agents that answer the people who reach out to a provider.
## Niche
US behavioral health: addiction treatment centers and outpatient mental health clinics.
## Belief
Every person who reaches out deserves an answer, at any hour.
```

| say | not | why | must |
|---|---|---|---|
| inquiries | leads | the word admissions teams use | |
| verification of benefits | insurance check | the term intake teams use | |
