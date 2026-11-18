# The script format

`script.md` is read by the speaker on camera and parsed by code downstream
(`footage-rough-cut` aligns the takes to it; `mg-setup` makes one section
per beat). The parser is `scripts/shared/script.ts` at the plugin root.
Follow this format exactly; a slip doesn't raise an error, it silently
drops or merges text.

## Shape

```markdown
# <Video title>

Outline v0.<n> · <N> words · about <M> min at <W> wpm · speaker: <name>

## Hook

**Say:** <1–3 sentences: one take.>

<1–3 sentences: the next take.>

## <Chapter 1 title>

**Say:** …

## Close

**Say:** …

## Numbers and sources

| Number as said | Source |
|---|---|
```

- One `# ` title.
- A **header line** above the first beat: outline version, spoken words,
  minutes at the workspace's words per minute, speaker. If the script was
  written without a speaker file, add "· no speaker file: craft and niche
  only".
- **One `## ` beat per outline element, in outline order:** the hook, each
  chapter, the close. A video with 4 chapters has 6 beats. Downstream, the
  number of beats must match the number of sections in the edit.
- Spoken words go only inside `**Say:**` blocks.
- `## Numbers and sources` comes last and has no Say block, so it's never
  spoken. Every number said in the script appears there with its source.
- The human writes `Locked` as the first line when it's ready to record.
  That line sits above the title and is never spoken.

## Paragraphs: one take each

A paragraph is one take: the speaker reads it, looks at the camera and says
it. Its length follows the workspace's `recording method`:

| Recording method | Sentences per paragraph |
|---|---|
| `short takes` (default) | 1–3 |
| `teleprompter` | 2–5 |

- Each paragraph makes sense on its own when said after a cut. It never
  starts mid-thought ("…and that's why", "Which means").
- Paragraphs are separated by **one blank line**. Lines joined by a single
  line break are one paragraph.

## Parser rules

The parser can't warn you, so these are rules:

1. The label is exactly `**Say:**`: bold, colon inside. `**Say**:` or a bare
   `Say:` isn't a label: as a beat's only label, the whole beat disappears;
   after a real Say block, it's spoken aloud as "Say: …".
2. A line inside a Say block never starts with a bold word and colon
   (`**First:**`, `**Note:**`). The parser reads that as a new block, and
   drops everything from there to the next `**Say:**` line.
3. Spoken text runs until the next `**Label:**` line, `#` or `##` heading, or
   a `---` line. So anything that isn't spoken (a staging note, a table, a
   list) goes after a `**Show:**` or `**Note:**` line, never loose inside a
   Say block. No `###` headings, HTML comments, tables or bullet lists in
   Say text.
4. A sentence ends at any `.` `?` `!` or `…` followed by a space. So never
   put one of those inside a sentence: write `9 am` (not `9 a.m.`),
   `versus` (not `vs.`), `for example` (not `e.g.`), `number 3` (not
   `No. 3`), `US` (not `U.S.`). A speaker who says "i.e." aloud gets
   `i.e.,` with the comma, which doesn't end the sentence. No "1. " numbered lines, and no `…` in the
   middle of a sentence.
5. An open item is a marker inside the Say text:
   `[⚠ speaker: <what is needed>]`. The text inside never contains `.` `?`
   `!` or `…`. A script with an open marker can't be locked.

## Example

```markdown
# Three reasons good cooks leave in the first month

Outline v0.3 · 70 words · about 0.4 min at 170 wpm · speaker: sam

## Hook

**Say:** If you run a small kitchen, you've lost a good cook in their first month.

It wasn't the pay. Here are the three reasons that come up again and again.

## The schedule nobody can see

**Say:** The first reason is the schedule. New cooks don't see their shifts until the weekend before.

So they can't plan their lives, and they leave for a kitchen where they can.

**Show:** a phone with a schedule posted on Sunday night.

## Close

**Say:** Post next week's schedule today. [⚠ speaker: one line on what you saw at your own kitchen]

See you next week.

## Numbers and sources

| Number as said | Source |
|---|---|
| (none in this example) | |
```

This example parses as 3 beats. The open marker means it can't be locked
yet.

## The reading files

`script.md` is the source of truth for the code downstream. The speaker
reads, and usually edits, a plainer copy. Spoken words must stay identical
across all of them; `scripts/read-aloud.ts check` proves it (see SKILL.md,
*The reading files*).

| File | For | Made by |
|---|---|---|
| `read-aloud.md` | Reading a script word for word on camera. The file the speaker edits by hand | `read-aloud.ts build`, then link lines added by hand |
| `teleprompter.md` | A teleprompter app (voice-follow or scrolling) | `read-aloud.ts teleprompter`, from `read-aloud.md` |
| `natural_script.md` | Speaking from prompt cards, not word for word | Written by hand from `script.md` |

### `read-aloud.md`

````markdown
# <Video title>

## Hook

```
<first sentence of take 1>
<second sentence of take 1>
```

[<Source name: the number, in words>](<url or file>)

```
<take 2>
```

## <Chapter 1 title>
…
````

- **Say text only.** No Show or Note lines and no Numbers and sources. An
  open marker stays as it is, so it can't be missed.
- **One code block per take** (one Say paragraph, including the follow-on
  paragraphs of a Say block). **One sentence per line** inside it, so the
  speaker's eye finds the next sentence fast.
- **`## ` headings** match the script's beats.
- **Link lines** go between blocks, right after the block that says the
  number: `[<Source name>: <the number, in words>](<url or file>)`, the
  same shape as the example above. They're for the speaker to check a
  number while reading; they're never spoken. A rebuild keeps a block's
  link lines only if its words didn't change.
- The speaker may write numbered lines here ("1. Can I find out…"). In
  `script.md` they become "Number 1." or "First," (parser rule 4), and the
  same words go back into `read-aloud.md`, so the check passes.

### `teleprompter.md`

Spoken words only, for an app that shows plain text or Markdown at a narrow
width: no title, no headings, no code fences, no links. One take per
paragraph, one sentence per line, a blank line between takes. No line may
start with `-`, `*`, `+`, `#`, `>` or "1." (a Markdown viewer turns those
into lists, headings or quotes); the tool warns if one does. Rebuild it
every time `read-aloud.md` changes; it is never edited by hand.

### `natural_script.md`

For speakers who talk from prompt cards (the `natural-footage-rough-cut`
skill parses it: sections `## N.`, cards `### Card Nx`, free bullets,
`> 🔒` fixed lines).

```markdown
# <Video title>. Natural script (beat cards)

<One line: made from script.md, which round; edits go back into script.md first.>

## How to use this file
1. Read the section's primer out loud twice.
2. Record one card at a time. Bullets are free: say them in your own words. 🔒 lines are fixed: say every number, name and quote exactly.
3. If you stumble, pause, say "again", and restart that thought.

---

## 1. Hook

**The point:** <one or two sentences: what this section must land.>

📖 **Primer: read this out loud twice**

<The section's Say text, copied word for word from script.md, one take per paragraph.>

### Card 1a: <what this card covers>
- <a free line, in short words>
- …

> 🔒 <a fixed line: a number, a name, a quote or the offer, word for word>
```

- One `## N.` section per script beat, in order; 2–4 cards per section,
  one card per 1–3 takes.
- **🔒 lines** hold everything that must be exact: numbers with their
  source, names, quotes, the self-introduction's credentials, the offer.
  Everything else is a free bullet.
- The primer is copied, never reworded; if `script.md` changes, the primer
  is copied again.
