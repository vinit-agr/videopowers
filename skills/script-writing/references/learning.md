# Learning from the speaker's edits

The aim is a script the speaker reads with no changes. Whatever they still
change is a lesson. This step measures how much they change, finds the
patterns, and proposes rules so the next draft already has them.

**When it runs:** on request ("script-writing learn for video 3"), and
automatically at the start of every new script: any video whose registry
status is `locked` or later, that has a `script.generated.md`, and whose
registry note has no `edits:` yet, gets measured and logged. Automatic
learning never blocks the new script; its proposals are listed after it.

## What to compare

Count only the **speaker's** changes, never Claude's own reworks.

| Round | Claude's version | The speaker's version |
|---|---|---|
| 1 | `script-rounds/01-claude.md` (= `script.generated.md`) | `script-rounds/02-speaker.md`, or `script.md` if there was only one round |
| k | `script-rounds/<k>-claude.md` | `script-rounds/<k+1>-speaker.md`, or `script.md` for the last round |

Round numbers are two digits: `01`, `02`, … `10`.

If `script-rounds/` is missing (the speaker edited `script.md` directly
after the first draft), there is one round: `script.generated.md` against
`script.md`.

## How to match sentences

1. Take the spoken text only (Say blocks), and split it into sentences the
   way the parser does (`script-format.md`, parser rule 4).
2. Normalise each sentence: lower case, punctuation removed.
3. A sentence of Claude's version is **unchanged** if the same normalised
   sentence appears anywhere in the speaker's version (a moved sentence is
   not a change). Otherwise it is **changed**: edited, split, merged or
   deleted.

## The two numbers

- **First draft → final:** changed sentences of `script.generated.md`, as
  compared with the locked `script.md`, ÷ all sentences of
  `script.generated.md`. This is the main measure; the target is near 0%.
  It includes everything that changed, whoever changed it.
- **Speaker edits per round:** for each round, changed sentences of
  Claude's version ÷ all its sentences. Fewer rounds, and smaller ones, is
  also success.

Append both to the video's registry note, without asking (it's a
measurement): `edits: draft→final 50% · rounds 30%, 10%`.

## Sorting the patterns

Group the speaker's changes into patterns (the same kind of edit, more than
once, or once but clearly deliberate). Sort each with two questions:

1. **True for any speaker in any niche?** → **craft**.
2. Else, **true for any speaker in this niche?** → **niche** (a word the
   industry uses, a term to avoid).
3. Else → **speaker** (how this person talks).

Before proposing anything, check the files. A pattern that `craft.md`, the
workspace `niche-words.md` or the speaker file already covers is a
**self-check miss**: report it as one ("the draft broke niche rule 'shift,
not slot'"), not as a new rule.

## Proposals

For each new pattern, propose one rule, with a before → after taken from
the diff:

```markdown
**Speaker:** open a result with "Here's what we found", not "The data shows".
- Before: "The data shows most orders arrive after 6 pm."
- After: "Here's what we found. Most orders arrive after 6 pm."
```

- **The human approves** each one. Only then write it into the workspace
  file: `niche-words.md` or `speakers/<name>.md`.
- **Craft proposals** are never written into the plugin from a company's
  workspace. List them as a note for the plugin's author: the rule, why it
  holds for any speaker in any niche, and the example.

## The report

1. The two numbers, and how they compare with the speaker's earlier videos
   (from the registry notes).
2. Self-check misses, by layer.
3. New patterns, sorted, as proposals.
4. Craft notes for the plugin author, if any.
