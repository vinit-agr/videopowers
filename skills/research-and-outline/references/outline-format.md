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
| Chapter | What it says |
|---|---|
| **1. <title>**<br><br>**Words:** …<br><br>**Proof / numbers:** …<br><br>**Mini hook → reward:** "…" → …; hand-over: "…"<br><br>**Stands alone:** yes · "<clip's first line>" | <The claim, then the points in order, each with a bold label: **Which websites:** …<br><br>**Why it matters:** …> |
| **Body total**: **…** (ch1 … · ch2 …) | |

## Close
<The reward: which chapter lines pay off the promise and every open loop (a note for review; the close itself doesn't recap them)> · <the one thing to do today> · <one next step>
Words: <n>

## Numbers used
| Number | Source |
|---|---|

## Needs from the speaker (⚠)
1. ⚠ <a fact only the speaker can give, and where it's needed>
```

Rules:

- **The hook table** has one row per element used: the five required ones
  (call-out, proof, stakes, open loop, promise) always, plus scene, focus,
  surprise, plan or disqualifier when they fit (`hook-retain-reward.md`).
  Rows go in the order they'll be said. A row may hold the line itself
  (in quotes) or the idea; the closer to final words, the fewer script
  rounds later.
- **The chapters table** has two columns, so it reads on a phone: the
  left holds the labels (title, words, numbers, mini hook, stands alone),
  the right says what the chapter says, as short labelled points. No
  narrow multi-column tables.
- **The speaker's voice:** write the spoken ideas in the person the
  speaker will say them in ("I checked", not "we checked", for work they
  did alone; their speaker file says which).
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
- **A study's method chapter** says, in plain words: where the sample
  came from, what was looked at (which pages, on what devices), how each
  item was scored and that the scoring was written down first, what was
  not done (no forms filled, no calls made, and why: those lines are for
  real people), and one limit line, here or before the close. Leave out
  the numbers of the sampling funnel (searches run, sites dropped); they
  go in *Numbers used* as "not said".
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
video number, a note "part 2 of <id>") and its own folder, with a copy of
`packaging.md` retitled for part 2 and a `## Changes` line. Ask the human
before splitting.
