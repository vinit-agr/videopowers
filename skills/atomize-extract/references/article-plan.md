# The article plan

The whole pillar becomes one newsletter article. Stage 1 plans it here and makes its images in part 2. Stage 2 writes the text, because writing in a person's voice happens there.

## Who publishes

- The author is the `article author` setting in the `## Settings` section of the file at the `accounts` key. One newsletter has one author.
- Other profiles may be tagged in the first lines: list their ids in `mention`.
- `ledger.py add` records the plan as post `A01` with that author.
- The same article may later go out as a blog post, so the plan never depends on one platform.

## The plan file

Write `MC/article/plan.md`:

```markdown
---
id: A01
format: article
mention: []            # profile ids to tag in the first lines, e.g. [<id>]
title_choice: ""       # filled when the user picks a title in the review; if empty, the writer picks
numbers: [...]         # same rules as a card: every number with a word-for-word excerpt
sources: [...]
excerpts: [...]
---
## Title options
1. ... (at most 60 characters)
2. ...

## Subtitle options
1. ...

## Why this structure
One or two lines: how the article is built for reading, and how it differs from the video's order.

## Sections
### 1. <working heading>
Purpose: what this section does for the reader.
Beats: paragraph 1 ...; paragraph 2 ...; what figure-1 shows.
Uses: s1 ("81%"), s3 (quote)
Figure: figure-1

## Close
What the reader can do this week, and one closing question.
```

- `Purpose:`, `Beats:`, `Uses:` and `Figure:` each sit on one line; the parser reads only that line. Write all the beats of a section on its `Beats:` line.
- `Figure:` holds only the folder name: `figure-1`, `figure-2` or `figure-3`. Say what the figure shows in that section's beats. A section with no figure has no `Figure:` line.
- `numbers`, `sources` and `excerpts` follow the card rules in `idea-card.md`.
- `sources` lists every study or page the article will name, each with its plain name in `title` and its `link`, not only the ones behind the figures. The article names each in the text and ends with a Sources list built from them. Every id on a `Uses:` line must be in `sources`; `gate.py cards` checks it.

## Rules

- Built for reading, not copied from the video's order. Reorder, merge or drop sections as the reader needs.
- Neutral words, not the author's voice. Stage 2 adds the voice.
- Every number and quote the article will use is in the plan with its word-for-word excerpt, so stage 2 writes only from checked material.
- At least 2 title options, each at most 60 characters, and at least 1 subtitle option.
- `## Why this structure` and `## Close` are not empty. Every section has a purpose and beats.
- Aim for an article of 900 to 1,500 words.
- `gate.py cards MC` checks the plan like a card: its fields, its figures, its excerpts against the source files, and banned words.

## Images

- The article gets a cover and 2 to 3 figures. The figures come from the plan's `Figure:` lines, each named once.
- They are made in part 2 by the infographic agent with `article-brief.md`, and reviewed with the post visuals.
