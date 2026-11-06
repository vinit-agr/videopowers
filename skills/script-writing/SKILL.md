---
name: script-writing
description: Use when an approved video outline needs a script.md the speaker can read on camera without changes, when a script needs a rework after the speaker's edits, when the speaker's edits to a generated script should be learned (script-writing learn), or when a new speaker needs a voice file.
---

# script-writing

Turns an **approved outline** into a `script.md` the speaker reads on camera
**as it is, with no edits**, and learns from any edits that still happen.

```
content-ideation ─► research-and-outline ─► script-writing ─► record ─► rough cut ─► …
                                           (gate 2: the human writes "Locked")
```

At this stage only the **wording** changes. The story, numbers, claims and
chapters were decided in the outline.

## Three layers

| Layer | Holds | Where |
|---|---|---|
| 1. Craft | How any good spoken script is written | `references/craft.md` (this plugin) |
| 2. Niche | The industry's words: say this, not that; recall words to say early | workspace `niche-words.md` |
| 3. Speaker | How this person talks | workspace `speakers/<name>.md` |

**When layers disagree:** speaker beats niche, niche beats craft. If the
speaker says a word the niche file avoids, it stays. **Two exceptions beat
the speaker:** a niche row marked `must`, and the profile's *Never claim*
list.

## Before anything

For *Write*, in this order (for *Rework*, steps 1–3 and 5; for *Learn* and
*Speaker setup*, steps 1–2). First, what the video's status asks for:

| Status | Do |
|---|---|
| `approved` | *Write* |
| `scripted` | *Rework* (never write over the speaker's `script.md` or `script.generated.md`) |
| `locked` or later | Stop: say it's locked; a change needs *Rework*, step 1 |
| earlier than `approved` | Stop: the outline comes first (research-and-outline) |

1. Find the workspace: `../content-ideation/references/workspace.md`,
   *Finding the workspace*. None → offer its *Setup*.
2. Status sync (same file).
3. The video's registry `type` is `conversation` → stop: no script for
   conversation videos in this version; the conversation outline is the
   plan for the recording.
4. `outline.md` doesn't start with `Approved` (the approval-word rule) →
   stop, and say the outline needs the human's approval first
   (research-and-outline).
5. The speaker (registry `speaker`, else the default speaker) has no file
   → stop and offer *Speaker setup*. Only if the human says to go ahead
   without one: use craft + niche only, and say so in the header.
6. **Learn first,** automatically and without blocking: any video with
   status `locked` or later, a `script.generated.md`, and no `edits:` in its
   registry note gets measured (`references/learning.md`). List its
   proposals after the new script.

## Write

1. Load the three layers, the outline and `research.md` (for context only;
   the outline decides what's said), plus the profile's *Approved proof*,
   *Never claim* and *Compliance rules*.
2. **Draft beat by beat**, following the outline: one `## ` beat for the
   hook, each chapter and the close, with the outline's word budgets, mini
   hooks and numbers. Format: `references/script-format.md`.
3. **No new numbers, claims, stories or chapters.** That includes numbers
   you could calculate from the outline's numbers, and the speaker's
   personal stories and opinions. If the story needs something the outline
   doesn't give, leave a marker, `[⚠ speaker: <what is needed>]`, and list
   it in your reply. Every open ⚠ item of the outline stays a marker.
4. **Self-check, line by line, before the human sees it.** Four passes:
   - **Craft:** the check line of every rule in `references/craft.md`.
   - **Niche:** no word from the "not" column, unless the speaker file uses
     it; every `must` row honoured in each chapter where its topic comes
     up (once per chapter is enough); recall words said in full in the hook
     or the first chapter.
   - **Speaker:** their openings, closes, numbers, signposts; nothing from
     *Never say*.
   - **The outline:** every number matches the outline by value (said the
     speaker's way: 26% may be "about 1 in 4"); every open loop is paid
     off; the hook's elements are all there; spoken words (markers not
     counted) inside the length range.
   Then the parser rules in `references/script-format.md`.
5. **Save** `script.md`, an identical `script.generated.md` (never edited
   again), and `script-rounds/01-claude.md`. Registry → `scripted`.
6. Tell the human: words and minutes, the open markers, and what to do
   next: read it aloud; write `Locked` as its first line when it's right.

## Rework

The speaker has edited `script.md` and asks for a change ("the close is too
long"). First: a change to numbers, claims or chapters isn't a rework; it
goes back to the outline (research-and-outline, gate 1). A locked script:
ask first; if yes, remove the `Locked` line, say so, and set the registry
back to `scripted`.

1. Read `script.md` from disk. Save it as `script-rounds/<NN>-speaker.md`
   (NN = the next round number) **before touching anything**.
2. Change only what was asked, on top of their version. Every other edit of
   theirs stays word for word.
3. Keep the spoken words inside the length range (say so if the request
   can't be met inside it), and update the header line. A marker the
   speaker removed is their call: mention it, don't restore it.
4. Save the result as `script.md` and `script-rounds/<NN>-claude.md`.

## Lock

The human writes `Locked` as the first line. Status sync moves the registry
to `locked` only if no open marker is left; otherwise it stays `scripted`,
and you name each remaining marker.

When it locks, read what replaced each marker and report, without editing:
a new number (propose adding it to *Numbers and sources* with the speaker
as its source; edit only if they agree, then re-check the lock), an open loop still unpaid, a line repeated, a
broken parser rule. The human's `Locked` stands; you only report.

## Learn

"script-writing learn for video N", or automatically (above): measure the
speaker's edits, find the patterns, propose rules for the human to approve.
`references/learning.md`.

## Speaker setup

A new speaker, or none on file: `references/speaker-setup.md`.

## Later (not in v1)

- Prompt cards (`natural_script.md`) made from a locked script, for
  speakers who talk from bullet points.
- Other formats: a blog post, a podcast script, a LinkedIn post.
- A host script for conversation videos.

## Common mistakes

| Mistake | Instead |
|---|---|
| Calculating a new number to complete the story | A marker; the number goes back to the outline |
| Writing the speaker's story or opinion for them | Only from the speaker file or the outline; else a marker |
| Dropping an open ⚠ item | It stays a marker until the human fills it |
| Long paragraphs for a short-takes speaker | 1–3 sentences, each one take |
| `9 a.m.`, `e.g.`, `**First:**` inside Say text | The parser rules in `references/script-format.md` |
| Reworking over the speaker's edits | Snapshot their version first; change only what was asked |
| Writing `Locked` yourself | Only the human writes it |
| Changing the plugin's craft file from a workspace | Craft lessons go to the plugin author as a note |
