# Matching posts to profiles

The main session gives every post a fit score for every profile. `create.py match` then finds the allocation with the best total, with the same number of posts for each profile. Nobody is ever blocked from a post: a poor fit is a low score, never a rule.

Run commands from the content workspace. `KIT`, `REF` and `XREF` are the absolute paths the main session gives you in the prompt. `MC` = the video's microcontent folder.

## Fit score

- Read each post's `card.md`: the idea, the real moments, the `said_in` quotes, the idea type (including `customer_story`).
- Give each post and each profile a score from 1 to 5, with a one-line reason.
- The one criterion: **can this person tell it in the first person?** A score of 5 means the idea sounds like their own experience or job; 1 means it would sound borrowed in their mouth.
- The default 3 is for when nothing tells the profiles apart. Most research posts end up at 3 for everyone, and that is fine.
- Score whole numbers only. Every pair needs a score and a reason, or `match` refuses and names the missing pairs.

Examples of the reasoning:

- A story from a sales call or a customer conversation (`customer_story`) suits the profiles whose role line says they sell or talk to customers. It can suit someone in marketing who also talks to customers. It never suits the company page well: give it a low score, not a block.
- Research findings, product proof and summaries suit anyone, including the company page.
- There is no rule by content type. Judge each card by who can tell it.

## Role lines

- Each profile's role line comes from the table in the file at the `accounts` key (the `role` column), and its standing facts from that profile's section in the same file.
- Use only what the role line and the standing facts say. No other preferences per person, and no rules carried over from earlier runs.
- The company page is the profile whose role line starts with "company". It speaks as "we", so first-person stories suit it least.

## Format spread

- Each profile ideally gets at least one post of each format (infographic and carousel), falling back to repeats.
- The spread is loose. It never beats a clearly better fit. The solver only uses it to break ties on the fit sum.
- Never change a score to force a spread. Score fit alone; the script adds the spread.

## How the total is compared

The script compares allocations in this order:

1. The highest sum of fit scores.
2. Among equal fit sums, the highest spread bonus: each profile adds 1 when its posts cover both formats.
3. Then the higher fit total for each profile in the order of the accounts table (the last profile takes what is left).

The count per profile comes from `## Settings` in the accounts file (posts per profile). When stage 1 handed over a different even number (2 per profile, or more after the user keeps backups as posts, up to 5), `match` gives that many each. Backups are not scored here.

## Workspace matching notes

Read the file at the `matching rules` key before scoring. It holds what the company has learned about matching (for example a profile that reads a certain kind of idea better). Follow it the same way as the role lines: it moves scores, it never blocks a profile.

## Output

Write the scores into `MC/match.json` before running `match`:

```json
{"scores": {"P01": {"<profile id>": {"score": 4, "reason": "sales calls are their week; can tell it as their own"}}}}
```

- One entry per post and per profile id in the accounts table. The posts are every folder in `posts/` whose id is not on the `backups:` line in `index.md`, so a backup moved into `posts/` at the stage 1 review keeps its B id and is scored like a P post.
- `python3 KIT/create.py match MC` adds `per_profile`, `allocation`, `totals` and `swaps`, renames the post folders to `<id>-<profile id>-<idea slug>`, and sets the rows to `matched`.
- A backup swapped in later needs its own scores added under `scores` before any `match --rematch`.
- The card never changes during matching, and the user does not review the allocation.
