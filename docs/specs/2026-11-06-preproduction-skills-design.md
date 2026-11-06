# Pre-production skills: content-ideation, research-and-outline, script-writing — design

Brainstormed 2026-11-06 with Vinit in a Claude Code session (in the
private Tars content repo, where videos 1–6 for Tars's behavioral health
channel were made). Status: **v0.2, approved by Vinit 2026-11-06.**
Implementation plan: `docs/plans/2026-11-06-preproduction-skills.md`.
Reviewed in three rounds by builder and content-strategy reviewers; their
questions are answered in the text, and the calls Claude made are listed
in §11.

Three new skills cover the front of the pipeline, from "what should we make
this month?" to "a script I can read on camera without changing a word":

```
content-ideation ─► research-and-outline ─► script-writing ─► record ─► rough cut ─► …
   (plan + packaging v1)   (story review = gate 1)   (lock = gate 2)
```

This is **version 1** of each skill. Vinit's intent: get a working base,
use it on real videos, find what breaks, and evolve each skill separately.
The structure must leave room for that (see §8, "Later").

---

## 1. Why

**Ideation is the slow, key step.** Vinit's words: "This is the main and key
work I have to do… coming up with the idea for the long-form pillar video
content and making sure the script is good." The target is 10 pillar videos
in November 2026 and about 18 in December (2 → 3 → 5 a week).

**What went wrong so far (videos 1–6):**
- The thinking that chose and shaped ideas lived in chat sessions and loose
  files (a framework document, a hand-made November plan, an ideas bank). It
  had to be re-explained every session.
- On video 6 the big decisions (which numbers, which sections) were made at
  the script stage. That cost two rewrites and a 3,570-word script; recording
  took 4 hours and didn't finish.
- **Vinit changes 53–68% of generated script sentences before recording, and
  that share is not shrinking** across videos 1→5 (measured 2026-11-06 by
  diffing each generated draft against his edited version, in an
  edit-patterns study kept in the private Tars repo). The same
  edits come back every time because they were never written down as rules.

**Why skills:** a skill captures a process so it gives a reliable,
consistent result every time, and can be refined as problems show up.

## 2. Goals, non-goals, anti-goals

**Goals**
1. `content-ideation`: plan a month (or the next 1–3 videos), or test one
   idea. Every idea comes with an overview, a title, a first line, a
   thumbnail concept with a rough HTML mockup, and a score with reasons.
   Ideas are spread across the buyer's awareness ladder.
2. `research-and-outline`: turn one chosen idea into an approved story
   outline, with the research that supports it. Simple, clear, surprising,
   with something the viewer can use the same day.
3. `script-writing`: turn the approved outline into a `script.md` the
   speaker can read on camera **as it is, with no edits**. Learn from any
   edits that still happen.
4. **Works for any company, niche and speaker.** The plugin holds only the
   method. Everything about a company, its niche and its speakers lives in
   that company's own content folder.

**Non-goals (v1)**
- Prompt cards (`natural_script.md`) for recording in your own words. Noted
  for later; `natural-footage-rough-cut` already consumes them.
- Blog posts, podcasts, LinkedIn posts, atomization into short clips. The
  outline prepares for atomization (§5.4) but doesn't do it.
- Conversation videos beyond prep and a question-flow outline (§5.1): no
  host script, no rough-cut support for unscripted footage yet.
- Live demand data (VidIQ, YouTube or LinkedIn trends) and learning from how
  posted content performed. Placeholders only (§8).
- Final packaging after recording (chapters with timestamps, final
  description). That stays with `packaging-kit`, still a placeholder.

**Anti-goals** (failure even if it technically works)
- **Tars or behavioral health baked into the plugin.** If a co-founder or
  another company can't use it by writing their own profile, it failed.
- **Complex stories.** "If it's not simple, it's not going to help anyone,
  no matter how great the idea is." Complexity gets split into part 1 and
  part 2, never crammed.
- **Big decisions after the outline is approved.** At script stage only the
  wording changes.
- **Invented facts.** No number, claim, customer result or personal story
  that isn't in the research, the profile's approved proof, or the speaker's
  own words. Gaps are marked for the speaker to fill.
- **Clever over clear.** Literary lines, neat symmetric summaries and
  teasers that sound written, not said.

**Public repo (Vinit, 2026-11-06):** this plugin is public on GitHub. Tars
and behavioral health may appear as a **named worked example**, but nothing
private: no prices or offer details, no customer names or results, no
copy of Tars's framework file, no internal compliance notes. Examples in
the plugin's reference files are short and illustrative.

## 3. Generic method, company-specific knowledge

### 3.1 The content workspace

A company's content lives in a folder in its own repo: the **content
workspace**. Skills find it by its front-page file, `videopowers.md`:
1. walk up from the current directory (like git finds `.git`);
2. if none, search down from the current directory, up to 4 levels deep
   (people often run Claude from the repo root, above the content folder);
3. one found → use it. Several → ask which. None → offer setup (§3.3).
A path given in the request ("in marketing/content") always wins.

`videopowers.md` is the workspace's front page. It says where everything is,
so the skills work with an **existing** repo layout without moving files:

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
- default speaker: vinit
- cadence: 2 a week until 2026-11-13, then 3 a week
- words per minute: 170
```

Missing entries fall back to the defaults above.

**Structured files, one source of truth.** The skills read and write the
workspace files in fixed formats (tables with known columns, headings with
known names), defined once in content-ideation's
`references/workspace.md`. Skills never have to parse free-form documents.

Two kinds of existing file are treated differently:
- **Living files** that people keep adding to (the idea log): read **in
  place**. `videopowers.md` points at the existing file; the format only
  asks for a table with a date, the idea or question, and where it came from
  (other columns are kept and ignored). Nobody has to switch files.
- **Reference documents** (a long framework document, a voice file):
  setup **builds new structured files from them**, below.

When a company already has reference material in its own layout, setup
**builds new structured files from it** and leaves the originals untouched. Each new file starts with a
"Built from" line naming its sources and the date. **From then on, the new
file is the source of truth**; the old one is history. Skills only ever
write to the structured files, with one exception: when asked, a skill may
**append** a row to the idea log (never change or delete existing rows).

**What counts as a "new" idea-log entry:** dated after the last plan, and
not already in the registry (matched by meaning, not exact words). A
status column, if the log has one, is read as a hint but never required.

Material that doesn't fit any structured file (e.g. an internal pricing
note) is not copied. Setup lists what it left out, so the human can decide.

### 3.2 What lives where

| Knowledge | Where | Who writes it |
|---|---|---|
| The method: steps, rubrics, outline format, craft rules, thumbnail principles | **Plugin**, each skill's `references/` | Plugin author |
| **Profile:** company, products, niche, audience roles, belief, approved proof, claims that are not allowed, compliance rules, research rules (what research may and may not do), lead magnets / next steps | Workspace `profile.md` | Setup interview, then the company |
| **Framework:** buckets and ladder with target shares, topic list, scoring rubric | Workspace `framework.md`, **seeded from the plugin default**, then edited freely | Setup copies the default; the company edits |
| **Niche words** (script layer 2) | Workspace `niche-words.md` | Setup + learning |
| **Speaker voice** (script layer 3), one file per speaker | Workspace `speakers/<name>.md` | Speaker setup + learning |
| **Registry:** every video and idea and its status | Workspace `registry.md` | Skills update it; humans may edit |
| **Idea log:** questions and ideas from the outside world | Workspace `idea-log.md` | Humans (and skills, when asked) |
| **Taste log:** the reasons a human kept, changed or dropped ideas | Workspace `taste-log.md` | content-ideation, from the human's review |

**Rule:** where the workspace has its own version of something (e.g. its
framework or scoring rubric), the workspace wins over the plugin default.

### 3.3 First run: the setup interview

If no `videopowers.md` is found, any of the three skills offers to set up a
workspace. It asks, one question at a time and in plain words:

1. Company and products, in one sentence each.
2. The niche, and who the videos are for (roles).
3. The one belief every video should support (can be "not yet"; ideation
   then proposes 2–3 candidates).
4. Proof you're allowed to say publicly; anything you must never claim.
5. Rules for research (e.g. "never contact the organizations we study").
6. Where existing content lives, if any (videos made, scripts, voice notes,
   idea lists).
7. Who speaks on camera.

It writes `videopowers.md` and `profile.md`. For the framework, it starts
from the plugin default and fills in the company's own topics, shares and
belief from any existing material. It builds `registry.md` from existing
video folders and plan or idea lists (each idea once, even if it's in
several lists; unclear status → `idea`, flagged for the human). It never
moves or rewrites existing files (§3.1).

Speaker setup is a separate step (§6.5).

### 3.4 The registry

One markdown table, one row per idea or video. It's how ideation knows what
exists and what's missing.

| Column | Meaning |
|---|---|
| id | Video number once planned (`7`), or `idea-<n>` before |
| title | Current working title |
| status | `idea` (a candidate) · `proposed` (in a plan, not yet reviewed) · `planned` (kept by the human) · `researching` (research or a study under way; the note says which step, e.g. "study gate: criteria sent") · `outlined` · `approved` (gate 1) · `scripted` · `locked` (gate 2) · `recorded` · `published` · `dropped`. A `conversation` video goes `approved` → `recorded`, skipping the script statuses. |
| length | `study` · `standard` · `short` (sets the word target, §5.5) |
| bucket / step | From the framework (e.g. `options / 3`) |
| type | `talk` (one person to camera, the default) or `conversation` (interview or guest) |
| product | Which product it's about, or `none` |
| speaker | Who is on camera (a `speakers/` file name); empty = the default speaker |
| score | Total, e.g. `10` |
| planned for | Week or date |
| folder | `videos/07-chat-questions/` |
| note | One line (e.g. drop reason) |

Skills update the status as they run. A human edit always wins.

## 4. content-ideation

### 4.1 Three ways to use it, one engine

| Mode | The user says | It returns |
|---|---|---|
| **Plan** | "Plan the month: 10 videos, 1 already made." / "Plan the next video." | N ideas, balanced and ranked, scheduled by the cadence |
| **Test** | "Is this idea worth making?" + the idea | The score, a verdict, a better angle if needed, packaging v1 |
| (Review) | The human's keep / change / drop list with reasons | Registry and taste log updated; replacements for drops |

"Plan the next video" is plan mode with N = 1–3.

### 4.2 The plan engine

Inputs: the workspace profile, framework, registry, idea log, taste log and
niche words (so titles and first lines use the buyer's own words, and
compliance-required words, from the start).

1. **Balance view.** Count recent and planned videos by bucket and product.
   Compare with the framework's target shares. The emptiest buckets get
   filled first.
2. **Generate about twice as many candidates as needed** (2N), from:
   - the framework's topic list;
   - the idea log (new questions first);
   - the five sources (Hormozi): far past (the company's history), recent
     past (documenting real work), present (idea log), trending, and
     manufactured (our own studies);
   - for any bucket, the buyer questions (Sheridan's Big 5: cost, problems,
     versus, reviews, best).
3. **Shape each candidate with the five questions:** bucket and step;
   source; who and which moment; who will we send it to and why would they
   reply; what should they do next (one step up the ladder, often a lead
   magnet from the profile).
4. **Gate:** does it serve the viewer and the belief? If it's mainly about
   the company itself, it becomes a short post, not a pillar.
5. **Write packaging v1** (title, first line, thumbnail concept), then
   **score** with the framework's rubric (default below), with one line of
   reason per measure.
6. **Pick N, balance first:** share the N slots out by the buckets' target
   shares (counting videos already made or planned this period), then fill
   each bucket's slots with its best-scoring ideas that pass the threshold.
   Score ranks ideas **within** a bucket, never across buckets; otherwise
   problem-bucket ideas (lower on sales use) would always lose to buying
   ideas. If a bucket has no idea above the threshold, say so and offer
   the best "fix the angle" options instead of silently filling it. Then
   check variety of product.
7. **Schedule** the N by the cadence in `videopowers.md`, putting cheap
   ideas (no research) where weeks are tight, and research-heavy ones where
   research can start early.
8. **Write the plan** (§4.4) and the thumbnail mockups (§4.5). Add every
   picked idea to the registry as `proposed`, every unpicked one as `idea`.
   Unpicked candidates keep their full block (packaging and score) in a
   "Not picked" section at the end of the plan file, so replacements don't
   have to start again.

**Every video has two jobs (Vinit, 2026-11-06):** help **unknown**
prospects find us (people at a buyer's organization who've never heard of
us; YouTube's algorithm only shows a video to more of them if the title and
thumbnail earn clicks), and help sales move **known** prospects forward
(sent before or after a call). Most videos lean one way. The score makes
the lean visible.

**Default scoring rubric** (plugin default; the workspace may change it).
Five measures, each 1–3.

| | 1 | 2 | 3 |
|---|---|---|---|
| **Pain:** do buyers feel it? | Nice to know | A known problem | Costs them people or money this month |
| **Only us:** could a competitor say exactly this? | Anyone could | Our angle on a common topic | Our own data, research or experience |
| **Click:** would a stranger in the niche, scrolling, click this title and thumbnail? | Unlikely; it's vague or insider | Maybe; clear but not surprising | Yes: a number, a surprise or a question they need answered |
| **Sales use:** would sales send it to a prospect? | Rarely | Sometimes | Before most calls, or as a reason to reach out |
| **Cost:** how much work? | Days of research | About a day | Hours; we already know it |

Three numbers are shown for each idea:
- **Reach** = Pain + Only us + Click (3–9): how well it finds unknown
  prospects.
- **Sales** = Pain + Only us + Sales use (3–9): how well it moves known
  prospects.
- **Total** = all five (5–15).

The idea is labelled **leans reach** (Reach ≥ Sales + 2), **leans sales**
(Sales ≥ Reach + 2) or **both**. The plan shows the month's mix, so it
serves both jobs.

**Total 12–15:** make it. **10–11:** make it if it fills an empty bucket or
the mix needs its lean. **9 or less:** fix the angle or drop it. (These
thresholds are a starting guess; adjust after the first month.)

Click is scored on the title and the thumbnail concept, so packaging v1 is
written before scoring. A low Click with a high Sales score is often fixed
by a better title, not by dropping the idea.

**Default framework** (seeded into the workspace on setup): the belief; four
buckets over Schwartz's seven awareness steps (problem 1–2, options 3–4,
us 5, buying 6–7) with starting target shares (about ⅓, ¼, ¼, ⅙); the five
shaping questions; the gate; the rubric; Hormozi's three lead-magnet types
(reveal a problem, a sample, one step). Written generically from Tars's
framework document; the Tars-specific topic list stays in Tars's
workspace.

### 4.3 Test mode

For one idea: run steps 3–5 above, place it on the balance view, and answer
plainly: make it / make it if it fills a gap / fix the angle / drop. If
"fix", propose 1–2 better angles and score them too. Always return packaging
v1 for the best version.

### 4.4 What each idea looks like in the plan

The plan is one file, `plans/<YYYY-MM>.md` (or `plans/next-<date>.md`):
first a table of all N ranked by score, with bucket, product and week; then
one block per idea:

```markdown
### 8. Contact form, live chat, chatbot or chat AI agent?   ·   score 12
**Overview.** (3–5 sentences: the story, who it's for, the moment, what they
can do after watching.)
**Title:** … (plus 1–2 alternates)
**First line:** "…"
**Thumbnail:** concept in one line → mockup in thumbnails.html#8
**Tags:** options / step 3 · versus · chat · marketing + admissions, at a
website redesign · send to: … · next step: …
**Score:** Total 12 · Reach 7 · Sales 7 · leans: both
Pain 2 (…) · Only us 2 (…) · Click 3 (…) · Sales use 3 (…) · Cost 2 (…)
**Research needed:** none / light / days, and what kind
```

Audience is named only when it differs from the profile's default audience.

### 4.5 Thumbnail mockups (packaging v1)

No image generation. One self-contained HTML file per plan
(`plans/<YYYY-MM>-thumbnails.html`) showing every idea's thumbnail at
1280×720, scaled down, with:
- a **speaker placeholder**: a silhouette or box, labelled with the
  expression wanted ("surprised", "skeptical", "pointing at the number");
- the **thumbnail text**, 2–4 words, which adds to the title, never repeats
  it;
- one visual element (a number, two things compared, a screen);
- the same layout shown at small size, to check it reads on a phone.

The principles live in the plugin (`references/thumbnails.md`). The builder
writes them from current research on what makes YouTube thumbnails get
clicks (one focal point, high contrast, a face with emotion, few words,
curiosity gap with the title). LinkedIn video covers are noted as untested.

### 4.6 The review loop

Vinit reads the plan and replies per idea: keep / change / drop, with a
reason. The skill:
- updates the registry: kept → `planned`; dropped → `dropped` with the
  reason in `note`;
- for each kept idea, creates its video folder with **`packaging.md`**: the
  idea's whole block from the plan (overview, titles, first line, thumbnail
  concept, tags, score) plus its thumbnail mockup. This file is the hand-off
  to research-and-outline, and later to `packaging-kit`;
- for a kept idea that needs a study, says so and offers to start
  research-and-outline now, so the study gate isn't left waiting;
- appends each reason to `taste-log.md` with the date and the idea;
- generates replacements for drops (from the unpicked candidates first);
- **reads the taste log at the start of every plan**, so earlier reasons
  shape new ideas.

## 5. research-and-outline

One skill, not two: the research exists only to serve the story. "If there
is no compelling story, we don't have a good video."

**In:** one video folder whose registry status is `planned` (or
`researching`, to resume), with its `packaging.md`.
**Out:** `research.md` (if research was needed) and an approved
`outline.md` in the video's folder; `packaging.md` refreshed.

**Resuming:** research and studies can take days across sessions. The
skill reads the registry note and the files in the folder to see where it
stopped, and picks up from there.

### 5.1 Steps

1. **A first guess at the story, in one breath.** The shape depends on the
   awareness step, using the framework's step map ("what the video must
   do"):
   - problem (1–2): "You think A. Actually B is happening, and it costs you
     C. Here's what to do today."
   - options (3–4): "There are N ways to fix this. Here's what each really
     costs, who it suits, and the bar any of them must clear."
   - us (5): "Here's our product doing the hard thing, the proof, and who
     it isn't for."
   - buying (6–7): "Here's what to take to the person who signs" / "here's
     the offer, plainly."
   No invented contrarian takes: if there's no real "actually", don't fake
   one.
2. **Choose the kind of research**, one or more:
   - **Desk research:** studies, data, reports. Every number gets a source.
   - **Our own study:** collecting data ourselves (e.g. reading 60 websites
     against fixed criteria). In v1 the skill runs the study itself with
     background agents, within the research rules. **Study gate**, run by
     this skill: it writes `study/method.md`, `study/sample.md` and
     `study/criteria.md`, and nothing is collected until the human writes
     "Approved" on `criteria.md` (so the criteria can't be chosen to fit the
     results). Results go to `study/results.md` with the raw data beside
     it. Because studies take days, ideation offers to start this as soon as
     the idea is kept (§4.6), before gate 1.
   - **Conversation prep:** for an interview or guest video: who to invite
     and why, the questions, and an outreach message **drafted for a person
     to send**. A `conversation` video gets a different outline: the guest
     and why them; a question flow, with what each answer should reach; the
     host's opener and close as bullet points. It gets **no script** in
     v1.
   - **None:** the knowledge is the company's own; the outline lists what
     the speaker must supply.
   The profile's research rules always apply (e.g. read-only, never contact
   the organizations studied, never send outreach).
3. **Research to prove or kill the guess.** The main job is finding the
   **surprise**: the fact that makes the viewer stop. If the evidence says
   the guess is wrong, the story changes.
4. **Simplicity check:** one problem and one fix. More than about three big
   ideas, or over the length target → propose a split into part 1 and
   part 2.
5. **Write the outline** (§5.2).
6. **Refresh packaging:** check the title, first line and thumbnail in
   `packaging.md` against the story. If the story moved, update them there
   (and the mockup), and say why at the top of the outline.
7. **Story review (gate 1).** The human reads the outline. Changes go draft
   by draft (v0.1, v0.2…). When it's right, the human writes **"Approved"**
   at the top. Registry → `approved`.

Big research can run in the background (subagents). Long research goes in
`research.md`; the outline carries only what the story uses.

### 5.2 The outline: one page

```markdown
# Video N: <title>. Outline v0.x (story review)
Tags (bucket, step, product, who and moment, send to, next step) · target
length · belief.

## The story in one breath
## The surprise
## Hook
| Element | Line or idea |  ← call-out · surprise · proof · stakes ·
                                open loop · promise · plan · disqualifier
## Chapters
| # | Chapter | Words | Claim | Proof / numbers | Mini hook → reward | Stands alone? + clip's first line |
## Close
The reward (pays off the promise and every open loop) · the one thing to do
today · one next step (CTA)
## Numbers used (each with its source)
## Needs from the speaker (⚠)   ← facts only they can give; never guessed
```

### 5.3 Hook, retain, reward

From Hormozi's *$100M Leads* (hook → retain → reward is one "content unit";
a long video is several units chained), plus the hook structure Vinit
approved on video 6.

- **Hook:** a checklist of eight elements, not a fixed formula:
  call-out (who it's for, in their words) · surprise · proof (a number or
  credential) · stakes · open loop · promise (what they'll know by the end)
  · plan (one line) · disqualifier (who it's not for).
  - **Required:** call-out, proof, stakes, open loop, promise. The others
    are used when they fit.
  - **Order can change by step.** A problem video (steps 1–2) may open on a
    moment the viewer recognises and put the call-out second. A
    disqualifier can move to the end of the hook or out of it.
  - **Length:** about 150–200 spoken words (about a minute). Over that, cut.
  - Never a table of contents on its own.
- **Retain:** curiosity is the driver. Devices: lists (flexible), steps
  (ordered, more explicit reward), stories. Each chapter opens a question the
  viewer wants answered. A list of what's coming is used only when it helps.
- **Reward:** match or beat the promise; high value per second; every open
  loop paid off; one thing they can do the same day.

### 5.4 Mini hook-retain-reward per chapter (for atomization)

Where it comes naturally, a chapter is its own small unit: it opens with its
own question (hook), holds attention through the chapter (retain), pays off
before the next chapter (reward), then hands over with a small hook. This
keeps people watching and makes each such chapter easy to cut into a
stand-alone clip (30–90 s), post or carousel later.

It's **not forced**: chapters like "who is speaking" don't have one. The
outline marks each chapter "stands alone: yes / no". For each yes it gives
the clip's own first line and checks the chapter never leans on earlier
context ("as I said before").

### 5.5 Length targets (defaults, workspace may change)

| Length type | Used for | Words | At 170 wpm |
|---|---|---|---|
| `study` | Our own study or a data-heavy video | 1,800–2,200 | 11–13 min |
| `standard` | Most videos: problem, buyer question, versus, "us" | 1,500–1,800 | 9–11 min |
| `short` | Buying-stage videos (a business case, the offer) | 1,000–1,400 | 6–8 min |

Ideation sets the length type in the registry; the outline can change it
and says so.

## 6. script-writing

**In:** an `approved` outline, `research.md`, and the three layers.
**Out:** `script.md`, which the speaker reads on camera with no edits.

### 6.1 Three layers

| Layer | Holds | Where | Example (Tars) |
|---|---|---|---|
| **1. Craft** | How any good spoken script is written | Plugin: `references/craft.md` | Strong sentence endings (the payload last); a peak in each section; long sentence then short; no lazy repeats of the same word; signposts said out loud; written for the ear |
| **2. Niche** | The industry's words: "say this, not that", and recall words to say early and clearly | Workspace `niche-words.md` | "inquiries", not "leads"; "verification of benefits", not "insurance check"; say "addiction treatment center" and "outpatient mental health clinic" in full, early |
| **3. Speaker** | How this person talks | Workspace `speakers/<name>.md` | Full sentences, never clipped; "Let's say you run…"; "Point number 1"; his sign-off |

**When layers disagree:** speaker beats niche, niche beats craft. (If the
speaker says "funnel", it stays, even if the niche file avoids it.)
**Exception:** a niche entry marked **must** (legal, compliance or brand
rules, e.g. a word that matters for regulation) beats the speaker. So do
the profile's banned claims.

**Where craft rules come from:** outside research on writing for the ear
(spoken scripts, speeches, YouTube), plus any lesson from a speaker's edits
that would be right **for any speaker in any niche**. A rule that is one
person's habit (sentence length, a signpost phrase, a sign-off) goes in
that speaker's file, never in craft. Craft examples are written fresh and
generic, not copied from any company.

**For v1, the builder seeds `craft.md` from both sources:** outside
research, and the general lessons in Vinit's 19 rules
(the edit-patterns study in the Tars repo), rewritten as general rules
with new examples. For instance, "finish every phrase" and "end each fact
with what it means for the viewer" hold for anyone; "Point number 1" and
"Till then, thank you for watching" are Vinit's and wait for his speaker
file in phase 2. This is the plugin author applying the §6.4 note himself.

**Outline and ideation use layer 2 too** (titles, first lines and hooks in
the buyer's words), so script-writing never has to change approved words.

### 6.2 Steps

1. Check the outline is `approved`. If not, stop and say so.
2. Load the three layers and the profile's rules (approved proof, banned
   claims, words to avoid).
3. Draft section by section, following the outline's chapters, words
   budget, mini hooks and numbers. **No new numbers, claims or sections.**
   If the outline has open ⚠ items, leave a clear marker
   (`[⚠ speaker: …]`) instead of guessing.
4. **Self-check, line by line, before the human sees it:** one pass per
   layer, each with its checklist (craft, niche, speaker), plus: every
   number matches the outline; every open loop is paid off; length within
   target; the hook elements are all there.
5. Write `script.md` in the pipeline's format (§6.3) and save an untouched
   copy as `script.generated.md` for learning later.
6. Registry → `scripted`. The human reads it aloud; if it's right, they
   write **"Locked"** at the top (gate 2). Registry → `locked`.

**Rounds are allowed.** The speaker may edit, then ask Claude to rework a
part, then edit again. To keep each author's changes apart, every Claude
pass saves snapshots in `script-rounds/`:
- before Claude touches the file: `NN-speaker.md` (the speaker's version so
  far; skipped in round 1);
- after Claude's pass: `NN-claude.md`.

Claude always works on top of the speaker's latest version from disk, never
over it. A rework asked for at script stage may change wording only; a
change to numbers, claims or sections goes back to the outline (gate 1).

### 6.3 Format

The existing convention that `footage-rough-cut` and `mg-setup` parse
(`scripts/shared/script.ts`): one `# ` title, beats as `## ` headings,
spoken words only inside `**Say:**` blocks, staging in `**Show:**` notes.
**Each outline chapter, plus the hook and the close, becomes exactly one
`## ` beat**, in outline order (downstream, `mg-setup` expects beats to
match the cut's sections).

**Written for short takes (Vinit's recording method in v1):** he reads a
sentence or a short paragraph from the screen, looks at the camera and says
it. So each `**Say:**` paragraph is **1–3 sentences**: one take, one
thought, easy to hold in your head. A paragraph must make sense on its own
when said after a cut, so it never starts mid-thought ("…and that's why").
The workspace can set a different method (e.g. teleprompter) in
`videopowers.md`, which changes the paragraph length.

Known side effect, accepted for v1: `footage-rough-cut` leaves a slightly
longer pause (0.35 s) at each paragraph break than between sentences
(0.15 s), so short paragraphs mean more of those pauses. Check it in the
phase 2 test; don't change `footage-rough-cut` now.
A header block (above the first beat) gives the outline version, word count
and minutes. A "Numbers and sources" section at the end (no Say block, so
the parser ignores it).

### 6.4 Learning from edits

When the speaker has edited `script.md` (run `script-writing learn` on that
video, or automatically at the start of the next script):

1. Compare only the speaker's own changes: each `NN-claude.md` against the
   next `NN-speaker.md` (or the current `script.md` for the last round),
   sentence by sentence. Claude's reworks are never counted as edits.
2. Report **two numbers** and log both in the registry `note`:
   - **first draft → final:** share of `script.generated.md` sentences that
     differ in the locked `script.md`. This is the main success measure
     (baseline from videos 1–5: 53–68%; target near 0%);
   - **speaker edits per round:** share changed by the speaker in each
     round (baseline: mostly 11–34% a round). Fewer rounds is also success.
3. Group the edits into patterns. Sort each into a layer: a general craft
   lesson, a niche word, or how this speaker talks.
4. Propose new or changed rules, each with a before → after example from
   the diff. **The human approves them**; then they're written into the
   right file. The plugin's craft file is never edited from a company's
   workspace; craft lessons are proposed as a note for the plugin author.

### 6.5 Speaker setup (one time per speaker)

Reads whatever exists from that person: past scripts with their edits,
transcripts of their videos or calls, posts they wrote. Drafts
`speakers/<name>.md`: their stance, their phrases, how they open and close,
how they say numbers, their signposts, what they always cut. The speaker
reviews it. For Vinit, the start is his voice notes plus the 19 rules in
the edit-patterns study. As in §3.1, the new speaker file becomes the
source of truth and learning writes only to it.

## 7. Changes to the plugin

| Change | Detail |
|---|---|
| New skill `content-ideation` | `SKILL.md`, `references/framework-default.md`, `references/thumbnails.md`, `references/workspace.md` (setup interview + file formats), `templates/` for plan, registry, profile, thumbnails HTML |
| `outline-shaping` → renamed **`research-and-outline`** | Replaces the placeholder. `references/outline-format.md`, `references/hook-retain-reward.md`, `references/research-kinds.md` |
| `script-writing` built | Replaces the placeholder. `references/craft.md`, `references/learning.md`, `references/speaker-setup.md` |
| `packaging-kit` | Stays a placeholder for the late phase (chapters, final description). Its description changes to say phase 1 now lives in content-ideation and is refreshed in research-and-outline. |
| README | Pipeline diagram and skills table updated |
| `plugin.json` | Version bump (cache refresh needs it) |

The three skills are **instruction-only** (no code), except an optional
small diff helper for §6.4 if sentence-level diffing by hand proves
unreliable. The workspace file formats are shared; they're described once in
content-ideation's `references/workspace.md` and the other two skills point
to it.

**Tars's own workspace** (not in this repo): after the skills are built,
run setup in the content folder of the Tars repo. It points at the
existing files (the voice notes, the idea log, the video folders and the
framework document) and builds the registry from videos
1–9 and the hand-made November plan. That's the first test.

## 8. Later (keep in mind, don't build now)

- **Demand signals:** VidIQ, YouTube search and trends, LinkedIn, limited to
  the niche, as an extra input to ideation's step 2 and a measure in the
  score.
- **Performance feedback:** once posts have results, record them in the
  registry and feed them into ideation.
- **Keyword intelligence:** v1 loads the niche words file everywhere; later,
  learn which words the buyers actually search and say (from search data,
  calls and comments) and grow the file from that.
- **Prompt cards** (`natural_script.md`) from a locked script.
- **Other formats:** blog post, podcast, LinkedIn post; for conversation
  videos, a host script and a rough cut for unscripted footage.
- **Atomization** from the outline's "stands alone" chapters.
- **A firmer hook framework** (Vinit wants to grow the video 6 structure).
- **packaging-kit late phase.**

## 9. Build order and how we'll test v1

**Phase 1, this plan:** build the three skills in this repo, update README
and `plugin.json`, commit. Done when each skill reads cleanly end to end and
its templates exist.

**Phase 2, a separate step after phase 1 is committed** (in the Tars repo,
with Vinit):
1. Set up the Tars workspace (§7).
2. Run content-ideation in plan mode for the rest of November and compare
   with the hand-made November plan.
3. Take one idea through research-and-outline and script-writing.
4. Measure the share of script sentences Vinit still changes (today 53–68%).

## 10. Decided in the brainstorm

- Every video serves two jobs (found by unknown prospects; sent to known
  ones). The score adds **Click** and shows Reach, Sales and a lean (§4.2).
- Tars may be a named example in this public repo; nothing private (§2).
- Scripts in v1 are for reading short takes from the screen: 1–3 sentence
  paragraphs (§6.3).

- One skill for ideation and packaging v1; one for research and outline;
  one for script writing.
- Ideation's main use is planning a month; also next video and testing one
  idea. Overview of 3–5 sentences, title, thumbnail idea plus HTML mockup,
  score with ranking.
- Research and outline are one skill; the research serves the story.
- Outline = opener, chapters, close; mini hook-retain-reward per chapter
  where natural, for atomization.
- Script v1 aims at a script readable on camera with no edits; three layers
  (craft, niche, speaker); natural_script, blog and podcast later.
- Plugin stays generic; company, niche and speaker knowledge live in the
  company's repo.

## 11. Calls made by Claude (for Vinit to check)

- The workspace marker file `videopowers.md` and the file names in §3.
- Registry statuses and columns (§3.4).
- 2N candidates before picking N (§4.2).
- The approval words "Approved" (gate 1) and "Locked" (gate 2).
- `script.generated.md` as the untouched copy (the Tars repo used
  `script_copy.md` for a different purpose: a backup before Claude edits).
- Craft lessons from a company's edits go to the plugin author as a note,
  never auto-edited into the plugin.
- `packaging-kit` stays for the late phase rather than being deleted.
- Setup builds new structured files from existing material; the new files
  become the source of truth and the originals are left as history (§3.1).
- Script rounds are allowed, with snapshots in `script-rounds/` so learning
  counts only the speaker's edits (§6.2, §6.4).
- This plan builds the skills only; setting up the Tars workspace and the
  test are phase 2 (§9).
- Workspace found by walking up, then down 4 levels (§3.1).
- Living files (idea log) read in place; reference documents rebuilt (§3.1).
- Registry gets `type` and `speaker` columns (§3.4).
- Bucket balance first, score ranks within a bucket (§4.2).
- The one-breath story shape varies by awareness step (§5.1).
- Own studies run by agents in v1, behind a study gate (§5.1).
- Conversation videos get a question-flow outline and no script (§5.1).
- Hook: five required elements, three optional, order flexible, about
  150–200 words (§5.3).
- Niche "must" entries beat the speaker; craft rules must hold for any
  speaker (§6.1).
- One `## ` beat per outline chapter, plus hook and close (§6.3).
- Two success numbers, logged together (§6.4).
- Statuses `proposed` and `researching`, and a `length` column (§3.4).
- Each kept idea gets `packaging.md` in its video folder: the hand-off
  between the three skills (§4.6). Unpicked ideas stay in the plan file.
- The study gate is run by research-and-outline, in a `study/` folder,
  started right after the idea is kept (§5.1).
- Length types `study`, `standard`, `short`; `short` is 1,000–1,400 words
  for buying-stage videos (§5.5).
- Skills may append to the idea log when asked; "new" = after the last
  plan and not in the registry (§3.1).
- `craft.md` is seeded from research plus the general part of Vinit's 19
  rules (§6.1).
- Short paragraphs add more 0.35 s pauses in `footage-rough-cut`; accepted,
  checked in phase 2 (§6.3).
