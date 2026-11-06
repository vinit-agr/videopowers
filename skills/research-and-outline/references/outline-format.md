# The outline

One page. It's where every big decision about the video is made: the story,
the surprise, the numbers, the chapters. After the human approves it, the
script changes only the wording. Write it in the buyers' words from
`niche-words.md`.

## The talk outline (`outline.md`)

Headings in exactly this order:

```markdown
# Video <id>: <title>. Outline v0.<n> (story review)
<For v0.2 and later: "Changes from v0.<n-1>: …".> <Packaging: "unchanged", or what changed and why.>

Tags: <bucket> / step <n> · <source> · <product> · <who, at what moment> · send to: <who> · next step: <step> · length: <type> (<words range>) · belief: <belief>

## The story in one breath
<One or two sentences, in the shape for this awareness step (framework.md).>

## The surprise
<The fact that makes the viewer stop, with its source. "None" is allowed; never fake one.>

## Hook
| Element | Line or idea |
|---|---|
| Call-out | … |
| Proof | … |
| Stakes | … |
| Open loop | … |
| Promise | … |
Words: <n>

## Chapters
| # | Chapter | Words | Claim | Proof / numbers | Mini hook → reward | Stands alone? + clip's first line |
|---|---|---|---|---|---|---|
| 1 | … | … | … | … | … | yes · "…" |

## Close
<The reward: how it pays off the promise and every open loop> · <the one thing to do today> · <one next step>
Words: <n>

## Numbers used
| Number | Source |
|---|---|

## Needs from the speaker (⚠)
1. ⚠ <a fact only the speaker can give, and where it's needed>
```

Rules:

- **The hook table** has one row per element used: the five required ones
  (call-out, proof, stakes, open loop, promise) always, plus surprise,
  plan or disqualifier when they fit (`hook-retain-reward.md`).
- **Word budgets:** hook + every chapter + close add up to a number inside
  the video's length range (framework.md, *Length types*). Over the range →
  propose a split (below) rather than squeeze.
- **One chapter = one script beat.** The hook, each chapter row and the
  close each become exactly one `## ` beat in the script, in this order. So
  chapters are the real sections of the video, not sub-points.
- **Every number** in the hook, the Claim and Proof cells and the close
  appears in *Numbers used* with its source. A number without a source
  goes under *Needs from the speaker* or is cut.
- **Facts only the speaker has** (their story, their results, their
  opinion) go under *Needs from the speaker (⚠)*. Never guess them.
- **No claim beyond the profile.** Approved proof only; nothing from its
  *Never claim* list.
- **Mini hook → reward:** "—" where there isn't one (e.g. "Who is
  speaking"). Don't force it.
- **Stands alone?** `yes` with the clip's own first line, or `no`.
- **Versions.** Revise in place: overwrite `outline.md`, raise the version
  in the title line, and say what changed on the line under it. The
  registry note says the current version.

## The conversation outline

For a video whose registry `type` is `conversation`. No script follows it
in this version of the plugin.

```markdown
# Video <id>: <title>. Conversation outline v0.<n> (story review)
<Packaging line, as above.>

Tags: … · length: <type> · belief: …

## The guest, and why them
<Who, what they know that the viewer needs, why they'd say yes.>

## The story in one breath
## The promise to the viewer

## Question flow
| # | Question | What the answer should reach | Follow-up if short |
|---|---|---|---|

## Host opener (bullets)
- …

## Host close (bullets)
- The one thing to do today; the next step.

## Needs from the speaker (⚠)
```

- The **host opener** follows the hook rules (`hook-retain-reward.md`):
  call-out, proof, stakes, open loop and promise, as bullets. Its first
  bullet plays the part of the first line in the packaging check.
- Questions and bullets use the buyers' words from `niche-words.md`.
- A conversation video goes from `planned` (or `researching`, if the prep
  takes several sessions) to `outlined`.

The invitation to the guest is drafted in `research.md` under
`## Outreach draft`, clearly marked **for a person to send**.

## Splitting into part 1 and part 2

When the story has more than about three big ideas, or won't fit the length
range: propose two videos. Each gets its own outline with its own promise
and reward; part 1 must be worth watching alone. In the registry, the
current row becomes part 1; part 2 gets a new row (`planned`, the next free
video number, a note "part 2 of <id>"). Ask the human before splitting.
