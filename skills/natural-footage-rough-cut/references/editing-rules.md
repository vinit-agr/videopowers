# Editing rules (read in full before writing edit.json)

You are a world-class editor cutting a natural-speaking talking-head video.
The speaker improvised from prompt cards; your job is the cut they would
make themselves if they had a day: every point said once, in its best
complete take, flowing.

## What the speaker was working from

`natural_script.md`: `## N.` sections (= chapters), `### Card Nx` cards (one
card = one thought, usually several sentences), free bullets (said in their
own words, often with additions), `> 🔒` fixed lines (numbers, sources,
quotes, intro/close: said nearly word for word). Ignore the `<details>`
Primer (read before recording, not on camera) and italic `*(…)*` notes.

## How the footage behaves

- Takes for one card may span part files; a part may end one section and
  start the next; a section may be recorded again in a later part.
- The retake signal is **a pause, then a restart that opens with the same
  words** (transcript hint `RESTART of #n`), though the rest is often
  reworded. The speaker does NOT say "again".
- Abandoned attempts end mid-thought (hint `CUT-OFF`: `…`, `--`, `qu-`).
- Sometimes a whole card restarts from the top after a long pause.

## Decisions

1. **Keep the last attempt that is complete and fluent.** For each thought,
   search backwards from the end. Complete = the thought reaches its end.
   Fluent = no restart or stumble inside it.
2. **Exception:** if that last attempt gets a 🔒 fact wrong (number, name,
   source, quote) and an earlier complete attempt gets it right, keep the
   earlier one **and make it a judgment call** (`kind: "earlier-attempt"`).
3. **One attempt can span pauses.** A thought said in pieces with silence
   between is one attempt: keep its pieces as consecutive spans.
4. **Never build a sentence from two different attempts.** Splicing words
   from attempt A onto attempt B is forbidden, no exceptions. Only pieces of
   one attempt said across pauses are joined (rule 3). If no single attempt
   is usable, keep the most complete one and make it a call.
5. **Cut a point repeated straight away** (the sentence just before, or so),
   even when both are fluent: "So that sounds fine, right? It's just three
   days away, right?" after "So that might just sound fine, right? Because
   they're just three days away" → keep one (the later, cleaner one by
   default).
6. **Keep callbacks:** a point returned to later in the video is not a repeat.
7. **Keep additions beyond the card** when they're part of a fluent
   sentence. The card is an outline, not a limit.
8. **Fillers/stutters:** don't pre-trim single "um"/"uh" inside a fluent
   sentence — build drops fillers automatically only at span edges or next
   to a pause. You *may* start a span after a stutter's first word ("So, so
   watch" → start at the second "so"). An attempt full of fumbles loses to a
   cleaner attempt at the same thought.
9. **Keep lead-ins attached** ("Now, finally the center says, 'We can set
   the appointment on Friday.'"). Losing the setup of a quote or a number is
   a lost point.
10. **When unsure, keep and make it a call.** Losing content is worse than a
    stray retake. Use calls for: earlier attempt used; unsure it's a repeat;
    unsure where one attempt ends and the next begins; unsure which card a
    stretch belongs to.
11. **Order:** sections in `natural_script.md` order; within a section, cards
    in card order; within a card, spoken order.
12. Section intros/transitions said off-card (e.g. "So in the last video…")
    belong to the section they open.

## 🔒 check

For every fixed line in every recorded section: what was actually said in
the kept span (or null), and status `exact` | `facts-ok` (wording differs,
facts right) | `wrong` | `missing`. Use the transcript's "🔒 fixed-line
candidates" list as a starting point, but check the *kept* attempt.

## edit.json

Word indices come from `transcript.md` (`p<part> #<first>–#<last>`, and
`[i]` markers inside the text every 5 words). Spans are inclusive.

```json
{
  "version": 1,
  "sections": [
    { "section": 1, "spans": [
      { "part": 1, "from": 179, "to": 236, "card": "1a", "note": "second run of the card" },
      { "part": 1, "from": 300, "to": 330, "card": "1a" }
    ]},
    { "section": 2, "spans": [] }
  ],
  "calls": [
    { "id": 1, "kind": "earlier-attempt", "reason": "Last attempt says 'pretty much half'; the 🔒 says 'nearly half'. Used the earlier complete one.",
      "kept": { "part": 1, "from": 360, "to": 382 },
      "alternatives": [ { "part": 2, "from": 40, "to": 62, "label": "last attempt" } ] }
  ],
  "locks": [
    { "section": 1, "card": "1a", "line": "Not a week later. Just 3 days.", "said": null, "status": "missing" }
  ],
  "removed": [
    { "part": 1, "from": 0, "to": 15, "why": "first run of card 1a, abandoned", "keptInstead": { "part": 1, "from": 179, "to": 236 } }
  ],
  "missing": [ { "section": 1, "card": "1a", "what": "🔒 Not a week later. Just 3 days." } ]
}
```

- `kind`: `earlier-attempt` | `repeat` | `boundary` | `card` | `other`.
- `reason` is shown on the marker and the reel card: one or two plain sentences.
- `line` must be the fixed line exactly as parsed (copy it from transcript.md's candidates list).
- `removed`: every removed attempt, with what superseded it (the report shows them).

## Before building

Run `build --dry-run`, read the "cut text" top to bottom as a viewer, and
fix: repeated thoughts, half sentences, lost lead-ins, wrong order, missing
cards. Warnings from validation must be resolved or be deliberate.
