# The idea card

One card per idea: `posts/P<NN>-<idea-slug>/card.md` for posts, `backups/B<N>-<idea-slug>/card.md` for backups. The YAML front matter holds what the scripts read. The prose sections hold what the visual maker and the stage 2 writer need. `gate.py cards` checks every card before anything else is made.

## Rules

- **Hook, Retain and Reward first, Proof underneath.** The card is built for the idea; accuracy is the floor under it.
- **Excerpts are copied, never paraphrased.** Copy the sentence from the source file exactly (markdown, quote marks and line breaks may differ; words may not). A long excerpt may skip a middle part with `...`, as long as each kept part is at least 12 characters.
- **Every number** the post will show is in `numbers`, with its source, and appears in one of that source's excerpts. A figure you work out ("doubled", "9 in 10") gets `derived:` saying what it comes from.
- **The prose sections add no facts.** Hook, Retain, Reward and Ask use only what the excerpts, real moments and `said_in` quotes say, and never say the opposite of the said file. The visual and the post copy them, so a slip here spreads.
- **Folder names** are the id and a short idea slug. Never start the slug with a profile id from the accounts file; stage 2 adds the profile later.
- **Stage 1 never sets an account.** Stage 2 writes `post.md` beside the card and never changes the card.

## Fields

| Field | What it holds |
|---|---|
| `id` | `P01` to `P15` for posts, `B1` to `B5` for backups |
| `idea` | the whole idea in one sentence |
| `persona` | who it is for, from the `personas` key |
| `idea_type` | optional, one of the types in `idea-scoring.md` |
| `step`, `bucket` | the ladder step (a whole number) and bucket from the `framework` key |
| `format` | `infographic` or `carousel` |
| `product` | one of the values in the fenced `products` block of the `profile` file |
| `points_to_offer` | true when the fix the post points to is something the company sells. A tag only; it adds no line to the post |
| `customer_story` | true when the idea is told from a customer conversation or a sales call. Stage 2 uses it for matching |
| `scores` | `{stands_alone, hook, retain, reward, true, total}`, as `idea-scoring.md` says |
| `repeat_flag` | optional; the close earlier idea when the repeat check flags one, else `""` |
| `why_picked` | one line: why this idea won |
| `findings` | finding ids. The first item is the lead finding |
| `numbers` | `{value, source, derived?}` for every number shown |
| `sources` | `{id, title, year, link, tier, file}`; `file` is relative to the video folder, `../` for a borrowed finding |
| `excerpts` | `{source, text}`, word for word from the source file |
| `real_moments` | `{source, text}`, quotes or scenes from the sources, word for word, with the speaker as the source describes them. Never invent one |
| `said_in` | `{file, quote}`, the pillar line where the speaker said it, word for word. Required when `numbers` and `excerpts` are both empty |

**Finding ids** look like `F-<first author>-<year>-<word>`, all lower case, for example `F-marlow-2024-reminders`. The author word must appear in the source title. A finding backed only by the video uses `F-<video slug>-<word>`. Reuse an id already in the `findings` file for the same finding (`idea-generation.md`).

**Prose sections**, all required: `## Hook`, `## Retain`, `## Reward`, `## Ask`, `## Proof`, `## Visual plan`. The Visual plan names the format, the theme and the templates in order. Alternate the themes in id order across the posts of each format, so neighbours never look alike.

## Example

A made-up example, for a fictional company that sells bookkeeping software to dental practices.

```markdown
---
id: P02
idea: "Of 5 things dental practices tried against late invoices, only sending the invoice the same day made a difference."
persona: owner
idea_type: surprising number
step: 2
bucket: problem
format: carousel
product: none
points_to_offer: false
customer_story: false
scores: {stands_alone: pass, hook: 4, retain: 4, reward: 3, true: pass, total: 11}
repeat_flag: ""
why_picked: "Clear guess-then-answer; the reward is one change any practice can make."
findings: [F-marlow-2024-same-day]
numbers:
  - {value: "5", source: s1, derived: "the 5 changes the survey asked about"}
sources:
  - {id: s1, title: "Marlow et al., Late payments in small dental practices", year: 2024, link: "...", tier: T2, file: "research.md"}
excerpts:
  - {source: s1, text: "practices that sent the invoice on the day of treatment were paid on time far more often than those that waited."}
real_moments: []
said_in: []
---
## Hook
5 fixes for late invoices. Only 1 made a difference.

## Retain
The guesses (reminders? a late fee? card on file?), then the answer, then why the first day matters.

## Reward
You can't choose who pays late. You can send the invoice before the patient leaves.

## Ask
How many days pass between a visit and its invoice at your practice?

## Proof
Marlow 2024, a survey of practices. Excerpts above. No outside research.

## Visual plan
carousel, theme light: title, list (5 fixes, one marked yes), quote, steps, ask.
```
