# Pre-production skills (content-ideation, research-and-outline, script-writing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Because the deliverables are skills, also follow superpowers:writing-skills (RED baseline → GREEN with skill → REFACTOR).

**Goal:** Build phase 1 of the spec: three instruction-only skills in the videopowers plugin (content-ideation, research-and-outline, script-writing), their reference files and templates, the packaging-kit description change, README and version bump. Commit each skill separately and push to `origin/main`.

**Architecture:** Each skill is a `SKILL.md` (the steps, short) plus `references/` (rules and formats, read on demand). Every company-specific fact lives in a **content workspace** in the company's own repo, found through `videopowers.md`. Workspace file formats and blank templates are defined once, in content-ideation (`references/workspace.md`, `templates/`), and the other two skills point there. No code is added to the repo. Testing uses throwaway fixtures and helper scripts outside the repo.

**Tech Stack:** Markdown skills for a Claude Code plugin; one self-contained HTML template (no external assets); the existing TypeScript parser `scripts/shared/script.ts`, run with `skills/footage-rough-cut/node_modules/.bin/tsx`, for verification only.

**Spec:** `docs/specs/2026-11-06-preproduction-skills-design.md` (v0.2, approved by Vinit 2026-11-06). Section numbers below (§) refer to it. Read it before any task.

## Global Constraints

- **Public repo.** Nothing private from Tars: no prices or offer details, no customer names or results, no internal people, no copy of Tars's framework file, no internal compliance notes, no private file paths. Tars and behavioral health may appear only as a **short, illustrative named example** (§2). Gate: the denylist grep returns nothing on every file this plan creates or changes.
- **The denylist lives outside the repo** (it names private terms, so it can't be committed). For this build it is `$S/private-denylist.txt` and `$S/denylist.re` (one extended regex). A builder in a new session asks the plugin author for it. `check.sh` fails if it is missing.
- **Generic method.** Every rule in the plugin must hold for any company, niche and speaker. One company's or one person's habit belongs in a workspace file.
- **Instruction-only.** No new code, `package.json` or dependencies in the repo.
- **Do not touch** the existing uncommitted changes in `skills/footage-rough-cut/scripts/` (someone else's work in progress). Stage by explicit path only; never `git add -A` or `git add .`.
- **Exact names:** marker file `videopowers.md`; workspace files `profile.md`, `framework.md`, `niche-words.md`, `speakers/<name>.md`, `registry.md`, `idea-log.md`, `taste-log.md`, `plans/`, `videos/<NN>-<slug>/` (where each lives is set by `videopowers.md`; paths are relative to the folder holding it); per-video files `packaging.md`, `thumbnail.html`, `research.md`, `outline.md`, `study/method.md`, `study/sample.md`, `study/criteria.md`, `study/results.md`, `script.md`, `script.generated.md`, `script-rounds/NN-speaker.md`, `script-rounds/NN-claude.md` (NN = round number, two digits from `01`); video folder numbers are zero-padded to at least two digits (`07`, `112`); plan files `plans/<YYYY-MM>.md` + `plans/<YYYY-MM>-thumbnails.html`, or `plans/next-<YYYY-MM-DD>.md` + `plans/next-<YYYY-MM-DD>-thumbnails.html`.
- **Approval words:** the human writes **"Approved"** on `outline.md` (gate 1) and on `study/criteria.md` (study gate), **"Locked"** on `script.md` (gate 2). Rule: the file's **first non-empty line** starts with the word (any case), optionally followed by a name or date. Skills never write these words.
- **Status sync:** any skill that opens a video folder first reads its approval words and updates that video's registry row, forward only: status `outlined` and `outline.md` Approved → `approved`; status `scripted` and `script.md` Locked with no open marker → `locked` (an open marker → stays `scripted`, and the skill names it). Any other status is left alone. Revising an approved outline or reworking a locked script: ask first; if yes, remove the approval line, say so, and set the status back (`outlined` / `scripted`).
- **Open marker:** a `[⚠ …]` inside Say text. Markers elsewhere (Numbers section, header) are notes, not open markers.
- **Registry `note`:** skills append (` · ` between entries), never overwrite a human's text.
- **Registry statuses, exactly:** `idea` · `proposed` · `planned` · `researching` · `outlined` · `approved` · `scripted` · `locked` · `recorded` · `published` · `dropped`. A `conversation` video goes `approved` → `recorded`.
- **Ids:** a candidate is `idea-<n>` (existing `idea` rows are candidates too). When a plan picks a candidate, its row is renumbered in place (never duplicated): it takes the next free video number, in rank order; the plan's `### <id>.` headings and `thumbnails.html#<id>` anchors use that number. A dropped idea keeps its number (ids are never reused); its replacement takes the next free number. Unpicked candidates stay `idea-<n>`.
- **Scoring (default):** Pain, Only us, Click, Sales use, Cost, each 1–3. Reach = Pain + Only us + Click (3–9). Sales = Pain + Only us + Sales use (3–9). Total = all five (5–15). Lean: **leans reach** if Reach ≥ Sales + 2, **leans sales** if Sales ≥ Reach + 2, else **both**. Total 12–15 make it; 10–11 make it if it fills an empty bucket or the mix needs its lean; ≤ 9 fix the angle or drop.
- **Buckets (default):** problem (steps 1–2, about ⅓), options (3–4, about ¼), us (5, about ¼), buying (6–7, about ⅙), over Schwartz's seven awareness steps.
- **Slot sharing (plan step 6):** M = videos already made or planned in the plan's period, existing_b = those in bucket b. need_b = max(0, share_b × (M + N) − existing_b). Scale the need_b to sum to N and round by largest remainder (ties → the bucket with fewer videos in the last 90 days, then the buying end of the ladder). Within each bucket, fill with its best-scoring ideas above the threshold; a bucket with none → `## Gaps`, never silently filled.
- **Length types:** `study` 1,800–2,200 words (11–13 min); `standard` 1,500–1,800 (9–11 min); `short` 1,000–1,400 (6–8 min); at 170 wpm. The **whole** video counts (hook + chapters + close). Ideation sets it; the outline may change it and says so.
- **Hook:** required call-out, proof, stakes, open loop, promise; optional surprise, plan, disqualifier; order may change by step; about 150–200 spoken words; never a table of contents on its own.
- **Layer precedence:** speaker > niche > craft; a niche entry marked **must** and the profile's never-claim list beat the speaker.
- **Script format:** one `# ` title; one `## ` beat per outline chapter plus hook and close, in outline order; spoken words only in `**Say:**` blocks; in short-takes mode each Say paragraph is 1–3 sentences and never starts mid-thought. Open-item marker: `[⚠ speaker: <what is needed>]`, whose text contains no `.` `?` `!` `…`.
- **Outreach** is always drafted for a person to send. Skills never send messages, submit forms, call, log in or pay anywhere.
- **Version:** `.claude-plugin/plugin.json` `version` and the plugin entry in `.claude-plugin/marketplace.json` go from `0.7.0` to `0.8.0` (marketplace `metadata.version` stays).
- **Skill file style:** plain words, short sentences, tables for formats, one short example per rule. Frontmatter `description` (placeholders exempt) starts with "Use when…", lists triggers only (no workflow summary), at most 500 characters.
- **Test runs:** every test prompt gives the fixture copy's absolute path and says "work only inside this folder"; baseline (RED) prompts also say "don't read anything outside this folder". The subagent's working directory is the videopowers repo, so a prompt that doesn't name the folder tests nothing. "No change" checks diff against a copy taken right before the run.

## Review Focus

1. **Workspace discovery:** no `videopowers.md` anywhere → offer setup; two found below the current folder → ask which, never pick; a path in the request → use it. Pinned by T3-D and the stop battery T-STOP.
2. **Parser traps in `script.md`:** text after a Say block stays spoken until a `**Label:**` line, a `#`/`##` heading or `---` (so a plain-text note, table, list, `###` heading or HTML comment inside a beat is spoken); `**Say**:` or a bare `Say:` isn't a label, so the beat silently vanishes; any `.` `?` `!` `…` followed by a space ends a sentence (`a.m. `, `vs. `, `No. `, `e.g. `, `1. `, a mid-sentence `…`); single newlines join lines into one paragraph. Expected: `script-format.md` gives these as rules; `parse-check` flags sentences of 2 words or fewer. Pinned by Task 1 Step 3 and T5-A.
3. **Human edits between Claude passes:** the speaker edited `script.md`, then asks for a rework of one part → snapshot `NN-speaker.md` first, keep every other speaker edit word for word. A human edit to the registry survives a skill's update. Pinned by T5-B and T3-C.
4. **Wrong stage or missing input:** outline not approved; status `idea`; a `conversation` video sent to script-writing; no speaker file. Expected: stop with one plain sentence saying what is missing and which skill or step fixes it (no speaker file → offer speaker setup, or write with craft + niche only if the human says so, and say so in the header). Pinned by T-STOP and T5-C.
5. **Private material in a company's existing files:** setup meets an internal pricing note → not copied into any built file, listed under "Left out". Pinned by T2-A.

---

## File Structure

```
docs/specs/2026-11-06-preproduction-skills-design.md   modify: status line; private paths removed
docs/plans/2026-11-06-preproduction-skills.md          this plan

skills/content-ideation/
  SKILL.md                         modes (plan / next / test / review / setup), plan engine, review loop
  references/workspace.md          discovery, approval words + status sync, every workspace file's format,
                                   setup interview, registry, packaging.md, idea-log append rule
  references/framework-default.md  default framework, seeded into a workspace's framework.md
  references/thumbnails.md         thumbnail principles + checklist, with sources
  templates/videopowers.template.md profile.md registry.md idea-log.md taste-log.md
            niche-words.md speaker.md packaging.md plan.md thumbnails.html
            (the marker template is renamed so discovery never finds the plugin itself)

skills/research-and-outline/       (git mv from skills/outline-shaping/)
  SKILL.md                         in/out, status checks, resume, steps 1–7, gate 1
  references/outline-format.md     talk + conversation outline templates, versions, part 1 / part 2
  references/hook-retain-reward.md hook checklist, retain, reward, per-chapter mini units
  references/research-kinds.md     desk, own study (+ study gate), conversation prep, none; research rules

skills/script-writing/
  SKILL.md                         write / rework / lock / learn / speaker setup
  references/craft.md              layer 1 rules: rule, why, fresh before → after, checklist line
  references/script-format.md      the parsed format, parser rules, header, numbers section, example
  references/learning.md           diff procedure, the two numbers, sorting into layers, proposals
  references/speaker-setup.md      building speakers/<name>.md from past material

skills/packaging-kit/SKILL.md      modify: description and body
README.md                          modify: pipeline diagram, skills table, content workspace section
.claude-plugin/plugin.json         modify: 0.8.0
.claude-plugin/marketplace.json    modify: plugin entry 0.8.0
```

Calls made in this plan (choices the spec left open): `references/script-format.md` added to script-writing (§6.3 needed a home); all workspace templates live in content-ideation's `templates/`; per-video `thumbnail.html` holds the kept idea's mockup; `packaging.md` ends with a `## Changes` log; `videopowers.md` gets `recording method` (`short takes` = 1–3 sentences per Say paragraph, `teleprompter` = 2–5); the approval-word rule, status sync, ids and slot formula in Global Constraints; outline revisions overwrite `outline.md`, bump the version in its title line and add a "Changes from v0.x" line under it; a "change" verdict in review = kept, with the change applied.

Outside the repo (`$S` = the build session's scratchpad + `/vp`, never committed). A new session won't have it: copy it from the build session, or rebuild the helpers and fixtures from Task 1 and Task 2 Step 4, and ask the plugin author for the denylist.

```
$S/private-denylist.txt, $S/denylist.re   private terms (exist)
$S/check.sh                               structural + privacy checks (exists; Task 1 updates it)
$S/parse-check.mts                        runs the real parser on a script.md (exists)
$S/fixtures/raw/                          a company folder before setup (exists)
$S/fixtures/ws/                           a set-up workspace (Task 2)
$S/research/thumbnails.md, ear-writing.md research notes
$S/tests/<scenario>-{baseline,green}.md   test reports
$S/runs/<scenario>-<n>/                   a fresh copy of a fixture per test run
```

---

### Task 1: Test harness, research notes, docs commit

**Files:**
- Outside the repo: `$S/check.sh`, `$S/parse-check.mts`, `$S/fixtures/raw/**`, `$S/research/*.md`
- Create (both untracked until now): `docs/specs/2026-11-06-preproduction-skills-design.md`, `docs/plans/2026-11-06-preproduction-skills.md`

**Interfaces:**
- Produces: `bash $S/check.sh [skill]` (exit 0 = pass; one `FAIL …` line per failure; with a skill name, checks 1–2 run for that skill only). `tsx $S/parse-check.mts <script.md>` printing JSON `{ title, beatCount, beats: [{title, sentences, maxSentencesPerParagraph}], sayWords, openMarkers, beatsWithParagraphOver3, shortSentences, suspectSplits }`.

- [ ] **Step 1: `$S/check.sh`.** Checks:
  1. per skill (`content-ideation`, `research-and-outline`, `script-writing`, `packaging-kit`): `SKILL.md` exists; `name:` equals the folder; `description:` starts with "Use when" (packaging-kit exempt) and is ≤ 500 characters (packaging-kit ≤ 1024);
  2. every backticked `references/…` or `templates/…` path in a SKILL.md (also `../content-ideation/…`) exists, resolved from that skill's folder;
  3. denylist missing → FAIL; else `grep -nEi -f $S/denylist.re` over every file changed since base commit `fb237e6` (`git diff --name-only fb237e6` + `git ls-files --others --exclude-standard`, minus `skills/footage-rough-cut/`) prints nothing;
  4. `grep -rn "outline-shaping"` over `skills/` and `.claude-plugin/` prints nothing (README is checked in Task 6);
  5. plugin.json version = marketplace plugin entry version;
  6. prints `wc -w` of each new SKILL.md (information only).
- [ ] **Step 2: `$S/parse-check.mts`** imports `parseScript` from the repo's `scripts/shared/script.ts`. `openMarkers` counts `[⚠` inside spoken sentences only; `sayWords` = tokens of spoken sentences minus the tokens inside markers; `shortSentences` = spoken sentences of ≤ 2 tokens; `suspectSplits` = sentences ending on an abbreviation or single letter, or followed in the same paragraph by one starting lowercase (signs of a wrong split).
- [ ] **Step 3: Verify parse-check, with the traps.** `$S/tmp-script.md`: a title; a `Locked` first line; a hook beat with 2 paragraphs; a close beat with one `[⚠ speaker: number of restaurants]`; a beat with `**Say**:` (wrong label); a Say paragraph with "Open at 9 a.m. sharp."; a `## Numbers and sources` section with a `[⚠` in a table. Expected: the wrong-label beat is missing from `beats` (`beatCount` 3 of 4); `suspectSplits` lists "Open at 9 a.m."; `openMarkers: 1` (the table's `[⚠` not counted); the numbers section is absent.
- [ ] **Step 4: `$S/fixtures/raw/`** (exists): fictional **Larkspur**, scheduling and payroll software for independent restaurants; `marketing/ideas.md` (6 rows, columns `Date | Question | Source | Owner | Status`, the no-show-cost question twice), `marketing/content-plan-oct.md` (3 ideas: the no-show cost again, the scheduling comparison already made as video 2, a new split-shift schedule idea), two video folders with short scripts, `marketing/dana-voice-notes.md`, `marketing/pricing-internal.md` (prices; must never be copied).
- [ ] **Step 5: Research notes** (two background subagents, read-only web research, sources cited): `$S/research/thumbnails.md`, `$S/research/ear-writing.md`.
- [ ] **Step 6: Spec status and scrub.** Status → "v0.2, approved by Vinit 2026-11-06" plus the plan's path; replace the private repo name and private file paths (§1, §3.1 example path, §4.2 framework file, §6.1, §6.5, §7, §9) with plain descriptions.
- [ ] **Step 7: Privacy check on both docs.** Run: `grep -nEi -f $S/denylist.re docs/specs/2026-11-06-preproduction-skills-design.md docs/plans/2026-11-06-preproduction-skills.md`. Expected: no output.
- [ ] **Step 8: Commit.**
```bash
git add docs/specs/2026-11-06-preproduction-skills-design.md docs/plans/2026-11-06-preproduction-skills.md
git commit -m "docs: design and implementation plan for the pre-production skills"
```

---

### Task 2: Workspace formats, setup interview, default framework

**Files:**
- Create: `skills/content-ideation/references/workspace.md`, `skills/content-ideation/references/framework-default.md`, `skills/content-ideation/templates/videopowers.template.md`, `skills/content-ideation/templates/{profile,registry,idea-log,taste-log,niche-words,speaker,packaging}.md`
- Outside the repo: `$S/fixtures/ws/**`

**Interfaces:**
- Produces the formats every later task uses. Later skills cite "`../content-ideation/references/workspace.md`, section *<name>*". Fixed section names: *Finding the workspace*, *videopowers.md*, *Living and built files*, *Approval words and status sync*, *profile.md*, *framework.md*, *registry.md*, *idea-log.md*, *taste-log.md*, *niche-words.md*, *speakers/<name>.md*, *packaging.md*, *Video folders*, *Setup*.

- [ ] **Step 1: RED baseline T2-A** (done, `$S/tests/T2-A-baseline.md`): without guidance an agent wrote a free-form CLAUDE.md, no registry, no framework, no niche words, kept the duplicate idea twice, no "Built from" lines. It did keep prices out and left originals alone.
- [ ] **Step 2: Write `references/workspace.md`** under the fixed section names:
  - *Finding the workspace*: walk up; else search down 4 levels; one → use it; several → list them and ask; none → offer *Setup*. A path in the request is where the walk-up and search-down start (instead of the current folder). Paths in `videopowers.md` are relative to its folder.
  - *videopowers.md*: the §3.1 block with **generic** values (no person or company): paths as in §3.1, `default speaker: <name>`, `cadence: <e.g. 1 a week>`, `words per minute: 170`, `recording method: short takes`; "missing entries fall back to these defaults" (default speaker: none → ask).
  - *Living and built files*: living files read in place; built files start with `Built from: <sources>, <YYYY-MM-DD>` and are the source of truth from then on; originals never moved or rewritten; skills write only to built files and their own outputs in `plans/` and `videos/`, plus appending idea-log rows when asked; a "new" idea-log entry = dated after the last plan and not in the registry by meaning; human edits always win, so re-read a file from disk right before writing it and change only the rows or lines you mean to.
  - *Approval words and status sync*: the rule and the sync from Global Constraints.
  - *profile.md*: Company · Products · Niche · Default audience (roles) · Belief · Approved proof · Never claim · Compliance rules · Research rules · Next steps and lead magnets.
  - *framework.md*: a copy of `framework-default.md` under a `Built from:` line; the workspace version wins. Every file setup creates, empty or not, starts with `Built from:` (except `videopowers.md`).
  - *registry.md*: header row exactly `| id | title | status | length | bucket / step | type | product | speaker | score | planned for | folder | note |`; every column and status from §3.4; the id rule from Global Constraints.
  - *idea-log.md*: minimum columns `date | idea or question | source`; others kept and ignored; a status column is a hint only.
  - *taste-log.md*: `| date | idea | verdict | reason |`, verdict ∈ `keep` · `change` · `drop`.
  - *niche-words.md*: `| say | not | why | must |` (must = `must` or empty) and `## Recall words`.
  - *speakers/<name>.md*: Stance · Phrases they use · How they open · How they close · Numbers · Signposts · Always cut · Never say · Examples (before → after).
  - *packaging.md*: the idea block (§4.4 fields plus `**Length:**`), then `## Thumbnail` (concept + `thumbnail.html`), then `## Changes` (dated lines: what changed, which skill, why).
  - *Video folders*: `videos/<NN>-<slug>/`, every per-video file and which skill writes it.
  - *Setup*: the 7 questions of §3.3, one at a time; where it writes (the folder the human names, else next to the existing content); writes videopowers.md, profile.md, framework.md (default + the company's topics), registry.md (existing video folders → rows; each idea once across all lists, merged by meaning; unclear status → `idea` with "check" in note), niche-words.md and taste-log.md (empty unless material exists), idea-log.md only if none exists; belief "not yet" → propose 2–3, choose none; ends with a "Left out" list (what, from which file, why), given in the reply and kept as a `## Left out at setup` section at the end of `videopowers.md`; setup also fills the framework's target shares and topics from existing material when it has them; speaker setup is a separate step (script-writing).
  - A short named example: "Tars (behavioral health software)": three profile lines (company, niche, belief) and two niche-word rows ("inquiries" not "leads"; "verification of benefits" not "insurance check"). Nothing else from Tars.
- [ ] **Step 3: Write `references/framework-default.md`** (generic; from §4.2 and §5.1): Belief (how to phrase one); the ladder table `| step | bucket | the viewer | what the video must do | story shape |` (the seven steps; the four §5.1 one-breath shapes); the bucket table `| bucket | steps | target share |`; the slot-sharing formula; Sources (Hormozi's five); Buyer questions (Sheridan's Big 5); the five shaping questions; the gate; the rubric, Reach / Sales / Total, lean and thresholds (Global Constraints); lead-magnet types; Length types table (§5.5); `## Topics` (empty).
- [ ] **Step 4: Write the templates** (blank forms with `<placeholders>` and one example row per table; `templates/videopowers.template.md` with the generic values above; setup copies it to `videopowers.md`). Then build `$S/fixtures/ws/` from them (dates as of 2026-11-06):
  - `videopowers.md` with explicit flat paths (`profile: profile.md`, …, `videos: videos/`), default speaker `dana`, cadence `1 a week`;
  - `profile.md`: Larkspur; default audience owners and general managers; belief "Every shift should be covered without a fight"; approved proof "used by about 300 independent restaurants"; never claim "we guarantee labor-law compliance"; research rules "read-only; never contact the restaurants we study"; next step "free schedule check";
  - `framework.md` = the default + 6 Larkspur topics;
  - `niche-words.md`: `shift` not `slot`; `tip pool` not `tip sharing`; **must**: "we're not tax advisors" whenever taxes come up; recall words "independent restaurant", "front of house", "back of house";
  - `speakers/dana.md`: opens "Here's the thing."; numbers as "about 1 in 4"; signposts "First,… Second,…"; never "folks"; closes "See you next week."; ran a restaurant for 12 years;
  - `registry.md`: `1` published (problem / 1, 2026-09), `2` published (options / 3, 2026-10), `3` published (problem / 2, 2026-10), `4` planned (options / 4, length `standard`, planned for 2026-11-13, `videos/04-tip-pool-software/`), `5` approved (buying / 6, `short`, 2026-11-20, `videos/05-labor-cost-case/`), `6` planned (us / 5, type `conversation`, 2026-11-27, `videos/06-gm-roundtable/`), `7` planned (problem / 2, `study`, 2026-12, `videos/07-job-ads-study/`), `idea-1`…`idea-3` (one each in options, us, buying); row 3's folder `videos/03-overtime-traps/` and note empty;
  - `idea-log.md` (6 rows, 3 dated after 2026-11-01), `taste-log.md` (2 rows, one: "drop — about our own company story, not the viewer"), `plans/2026-11.md` dated 2026-11-01;
  - `videos/04-tip-pool-software/packaging.md` (full block, Research needed: none); `videos/06-gm-roundtable/packaging.md` (guest: a general manager; conversation); `videos/07-job-ads-study/packaging.md` (Research needed: own study of 40 public restaurant job ads);
  - `videos/05-labor-cost-case/`: `outline.md` starting with `Approved`, version v0.2, a hook table, 4 chapters in this order: 1 "Who is speaking" (stands alone: no), 2 overtime, 3 payroll taxes, 4 the business case; a close; `Words:` lines under Hook and Close; budgets 175 + 120 + 3×250 + 150 = 1,195 (inside `short`); numbers used: "26% of shifts change after the schedule is posted" (source), "$1,900 a month" (source), "12 years" (Dana); one open item "⚠ how many restaurants use the overtime alert"; `research.md` that says "slot" twice;
  - `videos/03-overtime-traps/` (learning): `script.generated.md` with 10 Say sentences S1–S10, one per paragraph; `script-rounds/01-claude.md` byte-identical to it; `script-rounds/02-speaker.md` = 01 with S2 and S8 "staff" → "crew" and S5 "Cuts costs." → "It cuts your labor cost."; `script-rounds/02-claude.md` = 02-speaker with only S9 reworded; `script.md` = 02-claude with S3 "slot" → "shift" and a `Locked` first line. Expected: draft → final **50%** (S2, S3, S5, S8, S9); speaker rounds **30%**, **10%**.
- [ ] **Step 5: GREEN T2-A.** Fresh copy `$S/runs/T2-A-green/` of `fixtures/raw/`; the subagent reads `skills/content-ideation/references/workspace.md`, follows *Setup*, and answers its own questions from the files and from: "Larkspur: scheduling and payroll for independent restaurants; videos for owners and general managers; belief: not yet; speaker Dana; put the workspace in marketing/". Pass when:
  - `marketing/videopowers.md` exists, its idea-log path is `ideas.md` (read in place);
  - `diff -r fixtures/raw/marketing runs/T2-A-green/marketing` shows only added files;
  - `grep -rE '\$49|\$129|20%' ` over the new files prints nothing, and "Left out" names `pricing-internal.md`;
  - `registry.md` has 2 video rows (1 and 2, `published` or flagged "check") and exactly 4 idea rows (no-show shift cost, once; servers quitting in 90 days; overtime or one more cook; split-shift schedule from the October plan), none matching a video (the October scheduling comparison is video 2);
  - every built file except `videopowers.md` starts with a `Built from:` line; `videopowers.md` ends with `## Left out at setup`;
  - 2–3 candidate beliefs proposed, none chosen.
- [ ] **Step 6: REFACTOR** wording for each failure (a recipe for wrong shape, a required slot for an omission); re-run T2-A once.
- [ ] **Step 7: Run checks.** Run: `bash $S/check.sh content-ideation`. Expected: "SKILL.md missing" for content-ideation and "outline-shaping still referenced" (until Task 4); no denylist output.
- [ ] **Step 8: Commit.**
```bash
git add skills/content-ideation/references/workspace.md skills/content-ideation/references/framework-default.md skills/content-ideation/templates/
git commit -m "feat(content-ideation): workspace formats, setup interview and default framework"
```

---

### Task 3: content-ideation skill (plan, next, test, review) and thumbnails

**Files:**
- Create: `skills/content-ideation/SKILL.md`, `skills/content-ideation/references/thumbnails.md`, `skills/content-ideation/templates/plan.md`, `skills/content-ideation/templates/thumbnails.html`

**Interfaces:**
- Consumes: Task 2's formats.
- Produces: `plans/<…>.md` (ranked table, mix and balance lines, one block per idea, `## Gaps`, `## Not picked`); `plans/<…>-thumbnails.html` with one `<section class="thumb" id="<id>">` per **picked** idea (Not-picked blocks keep the concept line, no link); registry rows `proposed` (with video numbers) and `idea`; on review `planned` / `dropped`, `videos/<NN>-<slug>/packaging.md` + `thumbnail.html`, taste-log rows. research-and-outline reads `packaging.md`.

- [ ] **Step 1: RED baseline T3-A.** Copy of `fixtures/ws/`, no skill: "Plan December: 4 videos." Save `$S/tests/T3-A-baseline.md`: balance, scoring, lean, packaging, registry, thumbnails, niche words, taste log, invented proof.
- [ ] **Step 2: `references/thumbnails.md`** from `$S/research/thumbnails.md`: 6–10 principles (one line + why each); the checklist used on every mockup (one focal point; a face with the named emotion, or a reason for none; 2–4 words that add to the title and share no phrase of 2+ consecutive words with it; one visual element; readable at 168×94; high contrast); title and thumbnail as one promise; LinkedIn covers "untested, a guess"; sources.
- [ ] **Step 3: `templates/thumbnails.html`**: self-contained (inline CSS and SVG only). Each `section.thumb` = a 1280×720 frame shown at 40% (speaker placeholder: inline SVG silhouette + emotion label; the thumbnail text; a visual-element box), the same frame at 168×94, and a caption (id, title, concept). One filled example section and a comment "copy one section per idea; id = the idea's id".
- [ ] **Step 4: `templates/plan.md`**: header (period, N, already made or planned, date); table of picked ideas sorted by Total for display (selection happens within buckets) `| rank | id | title | bucket / step | length | product | lean | total | week |`; mix line ("leans reach: x · leans sales: y · both: z"); balance line (per bucket: existing + picked vs target); product line (per product: existing + picked); one block per idea; `## Gaps`; `## Not picked` (full blocks). The example block's numbers must agree (its heading score = its Total).
- [ ] **Step 5: `SKILL.md`.** Frontmatter:
```yaml
---
name: content-ideation
description: Use when deciding what videos to make next — planning a month or the next one to three long-form videos, checking whether one video idea is worth making, reviewing a proposed plan idea by idea (keep, change, drop), or when no videopowers.md content workspace exists yet.
---
```
  Body, in order: what it's for (the two jobs, §4.2); *Before anything* (find the workspace per workspace.md, none → *Setup*; status sync; read profile, framework, registry, idea log, taste log, niche words); *Modes* table (§4.1); *Plan* (the 8 steps of §4.2, one to three lines each; step 2 makes exactly 2N candidates and includes every new idea-log entry or says it's already in the registry; step 6 uses the slot formula, then checks product variety (no product left out two periods running unless the profile says so); step 8 sets length type and ids; "plan the next video" = N 1–3, file `plans/next-<date>.md`); *Test* (§4.3; "mainly about the company → a short post, not a pillar"; writes nothing, then offers to add it as an `idea` row); *Review* (§4.6; keep and change → `planned`, change applied to the block and logged in `## Changes`; drop → `dropped` + reason; a kept idea that needs an own study → offer research-and-outline now; replacements from Not picked first, as `proposed` with the next free number); *Writing the idea block* (`templates/plan.md`; overview 3–5 sentences; audience named only if it differs from the profile; titles, first line and hook in the buyer's words from niche-words.md; no claim beyond the profile's approved proof); *Scoring* (the workspace framework; one reason per measure; Reach, Sales, Total, lean; check the arithmetic); *Thumbnails* (copy the template, one section per picked idea, run the checklist; review adds a section for each replacement it proposes); *Later (not in v1)*: demand signals (VidIQ, YouTube search and trends, LinkedIn), performance feedback into the registry, keyword intelligence for niche-words.md (§8); *Common mistakes* (selecting across buckets by score; silently filling a bucket; scoring Click before the title exists; inventing proof; overwriting a human's registry edit; dropping the Not picked blocks).
- [ ] **Step 6: GREEN**, each on a fresh fixture copy, subagent told to use `skills/content-ideation/SKILL.md`:
  - **T3-A "Plan December: 4 videos."** (December: video 7 is planned, problem bucket, so M = 1.) Pass when: `plans/2026-12.md` + `plans/2026-12-thumbnails.html` exist; exactly 8 blocks (4 ranked + 4 Not picked); slots per the formula (need: problem 5/3 − 1 = 0.67, options 1.25, us 1.25, buying 0.83 → scaled ×4/4 = same → 0, 1, 1, 0 floors = 2 left by remainders .83 buying, .67 problem → **problem 1, options 1, us 1, buying 1**), (the fixture has ideas for every bucket, so no Gaps is expected; if one appears, check its threshold reasoning by hand and lower the counts below by one per gap); picked ids 8–11; every block has every field incl. length; every Reach/Sales/Total/lean adds up; no "slot" in any title, first line, overview or thumbnail text; no picked title or overview has "we", "our" or "Larkspur" as its subject; no proof beyond "about 300 independent restaurants"; each of the 3 new idea-log rows is a candidate or named as already in the registry; registry: 8–11 `proposed`, and every Not-picked candidate is an `idea-<n>` row; the HTML has 4 sections with ids 8–11, each with an emotion label, a 168×94 copy and 2–4 words sharing no 2+ word phrase with its title.
  - **T3-B** "Is a video called 'Why we started Larkspur' worth making?" Pass when: it says mainly about the company → a short post, not a pillar; 1–2 viewer-first angles, scored; packaging v1 for the best.
  - **T3-C review** on the T3-A output, after first hand-editing row 10's `planned for` to `2026-12-24`: "keep 8; change 9: make it our own study of 30 public job ads for line cooks; drop 10: too close to video 2." Pass when: 8 and 9 → `planned`, with folders, `packaging.md` and `thumbnail.html`; 9's block reflects the study and has a `## Changes` line; the reply offers to start research-and-outline for 9 now; 10 → `dropped`, reason in `note`, its `planned for` still `2026-12-24`; 3 new taste-log rows (5 in all); a replacement from Not picked proposed as id 12; no id appears twice in the registry.
  - **T3-D** a parent folder holding two copies of the workspace (`a/`, `b/`), prompt "plan the next video" with that parent as the folder. Pass when it lists both and asks, writing nothing.
- [ ] **Step 7: REFACTOR**; re-run failing scenarios only.
- [ ] **Step 8: Checks.** Run: `bash $S/check.sh content-ideation`. Expected: the only FAIL is "outline-shaping still referenced" (until Task 4); SKILL.md ≤ 1,400 words.
- [ ] **Step 9: Commit.**
```bash
git add skills/content-ideation/
git commit -m "feat(content-ideation): plan a month or the next video, test one idea, review loop, packaging v1 with HTML thumbnail mockups"
```

---

### Task 4: research-and-outline (replaces outline-shaping)

**Files:**
- Move: `git mv skills/outline-shaping skills/research-and-outline`
- Rewrite: `skills/research-and-outline/SKILL.md`
- Create: `skills/research-and-outline/references/{outline-format,hook-retain-reward,research-kinds}.md`

**Interfaces:**
- Consumes: workspace formats (Task 2); `packaging.md` (Task 3).
- Produces: `outline.md` (§5.2) whose `## Hook`, each `## Chapters` row and `## Close` map one-to-one, in order, to script beats; `research.md`; `study/*`; registry `researching` / `outlined`; script-writing reads these.

- [ ] **Step 1: RED baseline T4-A.** Copy of `fixtures/ws/`, no skill: "Outline video 4 (tip pool software)." Save `$S/tests/T4-A-baseline.md`: invented numbers or speaker facts; a table-of-contents hook; hook length; more than three big ideas; chapters that can't stand alone; no ⚠ list; registry.
- [ ] **Step 2: `references/hook-retain-reward.md`**: Hormozi's content unit (hook → retain → reward; long video = several chained); the 8 hook elements, each with a one-line test; required vs optional; order by step; 150–200 words; never a table of contents on its own; retain devices and "each chapter opens a question"; reward rules (§5.3); the mini unit and "stands alone" test, including no "as I said before" (§5.4). One generic example hook (fictional niche, 150–200 words, elements labelled) and a one-line Tars named example of a call-out.
- [ ] **Step 3: `references/outline-format.md`**: the talk template as §5.2 (headings in that order; chapters table header exactly `| # | Chapter | Words | Claim | Proof / numbers | Mini hook → reward | Stands alone? + clip's first line |`; the hook table `| Element | Line or idea |` with one row per element used, then a `Words: <n>` line; the close also ends with `Words: <n>`); rules: hook + chapters + close word budgets sum into the length type's range; every number in *Numbers used* with its source; speaker facts in *Needs from the speaker (⚠)*, never guessed; first line under the title says the version and "Changes from v0.x" after the first draft; a packaging line ("packaging unchanged" or what changed and why); the conversation template (guest and why them; `| # | Question | What the answer should reach | Follow-up if short |`; host opener and close as bullets; no script); a part 1 / part 2 split (two outlines, two registry rows, the second `planned`).
- [ ] **Step 4: `references/research-kinds.md`**: desk (every number: source, link, date; prefer primary; say how strong); own study (agents run it within the research rules; gate: write `study/method.md`, `study/sample.md`, `study/criteria.md`, registry `researching` with note "study gate: criteria sent", stop; collect only once `criteria.md` passes the approval-word rule; `study/results.md` + raw data beside it; a second reader re-scores a random tenth); conversation prep (who and why, questions, outreach **drafted for a person to send**); none (list what the speaker supplies); research rules: the profile's rules always apply; never contact, submit, call, log in or pay.
- [ ] **Step 5: `SKILL.md`.** Frontmatter:
```yaml
---
name: research-and-outline
description: Use when a planned video needs its research and a story outline before any script — a desk-research video, a video built on the company's own study, an interview or guest video, splitting a story that has grown too complex, or picking up research or an outline draft that stopped part-way.
---
```
  Body, in order: the principle ("the research serves the story; no compelling story, no video"); *Before anything* (workspace per workspace.md, none → offer content-ideation *Setup*; status sync; the video's row: `planned` → start, `researching` or `outlined` → resume or revise, `approved` → say it's approved and that revising sends it back to `outlined`, ask first; anything else → stop and say which skill comes first; read `packaging.md`, research rules, niche words); *Resuming* (registry note + the folder; continue from the first missing piece); *Steps* 1–7 of §5.1, short, pointing at the references; length type from the registry, changed only with a reason in the outline; registry → `outlined` when a draft is written; *Common mistakes* (faking an "actually"; a contents-list hook; numbers without sources; guessing a speaker fact; collecting study data before approval; forcing a mini hook on "who is speaking"; going over the length range instead of splitting).
- [ ] **Step 6: GREEN**, fresh copies, the skill named:
  - **T4-A "Outline video 4."** Pass when: headings in template order; hook rows for call-out, proof, stakes, open loop, promise are non-empty and the hook budget is 150–200; hook + chapters + close budgets sum to 1,500–1,800; every number in the hook table, the Claim and Proof cells and the close appears in *Numbers used* with a source, or in ⚠; no proof beyond the profile; every chapter row says stands alone yes or no, with a first line for each yes; the packaging line exists and any change to `packaging.md` has a `## Changes` line; `outline.md` does not start with "Approved"; registry → `outlined`, not `approved`.
  - **T4-B "Start the research for video 7."** Pass when: the 3 study files exist; no `results.md`; registry `researching` with the gate note; the reply asks for "Approved" on `criteria.md`. Then a second run, same folder, "carry on with video 7": stops again because `criteria.md` isn't approved. (Collection itself is tested in phase 2 on real data.)
  - **T4-D "Outline video 6."** Pass when: the conversation outline (question-flow table, opener and close bullets, no Say blocks, no script) and an outreach draft that says it's for a person to send.
- [ ] **Step 7: REFACTOR**; re-run failing scenarios only.
- [ ] **Step 8: Checks.** Run: `bash $S/check.sh research-and-outline`. Expected: exit 0; SKILL.md ≤ 1,200 words.
- [ ] **Step 9: Commit** (the rename is staged by `git mv`).
```bash
git add skills/research-and-outline
git commit -m "feat(research-and-outline): replaces the outline placeholder — research that serves the story, study gate, hook-retain-reward outline with stand-alone chapters"
```

---

### Task 5: script-writing

**Files:**
- Rewrite: `skills/script-writing/SKILL.md`
- Create: `skills/script-writing/references/{craft,script-format,learning,speaker-setup}.md`

**Interfaces:**
- Consumes: an approved `outline.md` (Task 4); workspace `niche-words.md`, `speakers/<name>.md`, `profile.md`.
- Produces: `script.md`, `script.generated.md`, `script-rounds/NN-*.md`; `parseScript(script.md).beats.length` = outline chapters + 2; registry `scripted` / `locked`; learning report, numbers in the registry note, proposed rules.

- [ ] **Step 1: RED baseline T5-A.** Copy of `fixtures/ws/`, no skill: "Write the script for video 5 from its outline. Dana reads it on camera, a few sentences at a time." Save `$S/tests/T5-A-baseline.md` + parse-check output: beats; paragraphs over 3 sentences; numbers not in the outline; "slot"; tax must-line; Dana's opener and sign-off; the ⚠ item guessed; length.
- [ ] **Step 2: `references/craft.md`** from `$S/research/ear-writing.md` plus the general lessons of the edit study (finish every phrase; name the thing in full the first time; numbers with a unit and a direction word, rounded; signposts said out loud; literal over clever, no neat symmetric summaries or teasers; end a fact with what it means for the viewer; the viewer is "you", the people they serve are third person; no self-doubt lines or asides about method; hedge claims about the viewer's business, not the main argument; gentle words for sensitive topics; the speaker's self-introduction and personal opinions come only from the speaker file or the outline; a marker only if neither has them). Each rule: one line, why, a fresh generic before → after, a checklist line. First line of the file: "Every rule here holds for any speaker in any niche; one speaker's habits go in their speaker file."
- [ ] **Step 3: `references/script-format.md`**: the §6.3 format; header block (`Outline v0.x · N words · about M min at W wpm · speaker: <name>`) above the first beat; one `## ` beat per outline element in order; paragraph length by recording method; paragraphs never start mid-thought; **parser rules** (Review Focus 2, each as a rule: the label is exactly `**Say:**`; a Say line never starts with `**Word:**` (any bold word and colon starts a new block and drops the rest); every non-spoken block inside a beat starts with a `**Show:**` or `**Note:**` line; no `###`, tables, lists or HTML comments in Say text; no `.` `?` `!` `…` followed by a space inside a sentence, so write `9 am`, `versus`, `for example`; one blank line between paragraphs, never single newlines inside a paragraph you mean to split); the marker form; `## Numbers and sources` at the end with no Say block; one complete 3-beat example.
- [ ] **Step 4: `references/learning.md`**: §6.4; matching (split as the parser does; changed unless the normalised words are identical; a moved but identical sentence is unchanged; sentences added or removed count as changed); formulas: draft → final = changed generated sentences ÷ generated sentences; round k = changed sentences of `NN-claude` ÷ sentences of `NN-claude`; registry note `edits: draft→final 50% · rounds 30%, 10%` (written without asking; it's a measurement); sorting each pattern: "true for any speaker in any niche?" → craft; "true for any speaker in this niche?" → niche; else → speaker; a pattern a file already covers → reported as a self-check miss, not a new rule; proposals as before → after from the diff; the human approves before any niche or speaker file changes; craft proposals = a note for the plugin author, the plugin never edited from a workspace.
- [ ] **Step 5: `references/speaker-setup.md`**: §6.5 inputs; the draft in the *speakers/<name>.md* format; every rule backed by a quoted example from the material; the speaker reviews it; `Built from:` line; from then on learning writes only there. Named example line: for Tars, the start was the founder's voice notes plus the rules from his edit study.
- [ ] **Step 6: `SKILL.md`.** Frontmatter:
```yaml
---
name: script-writing
description: Use when an approved video outline needs a script.md the speaker can read on camera without changes, when a script needs a rework after the speaker's edits, when the speaker's edits to a generated script should be learned (script-writing learn), or when a new speaker needs a voice file.
---
```
  Body, in order: the aim; the three layers and precedence (§6.1, with the must and never-claim exceptions); *Before anything*, in this order (workspace, none → offer content-ideation *Setup*; status sync; type `conversation` → stop, no script in v1; outline fails the approval-word rule → stop and say so; no speaker file → offer speaker setup, or craft + niche only if the human says so, noted in the header); *Learn first* (automatic, never blocking: any video with registry status `locked` or later, a `script.generated.md` and no `edits:` in its registry note gets its two numbers measured and logged; proposals are listed after the new script, for approval); *Write* (§6.2 steps 2–6: no new numbers, claims or chapters; markers for open items; the self-check in four passes — craft checklist; niche: every "not" word absent unless the speaker file uses it, every must line present where its topic comes up, recall words early; speaker; then numbers match the outline **by value**, open loops paid, length in range, hook elements present; run the parser rules; save `script.md`, `script.generated.md`, `script-rounds/01-claude.md`; registry → `scripted`); *Rework* (snapshot `NN-speaker.md` from disk first, change only what was asked, keep every other speaker edit, write `NN-claude.md`; numbers, claims or chapters → back to the outline); *Lock* (status sync; open markers listed); *Learn* (`references/learning.md`); *Speaker setup* (`references/speaker-setup.md`); *Later (not in v1)*: prompt cards (`natural_script.md`), blog / podcast / LinkedIn formats, host scripts for conversation videos (§8); *Common mistakes*.
- [ ] **Step 7: GREEN**, fresh copies:
  - **T5-A** (Step 1's task, with the skill). Run parse-check. Pass when: `beatCount` = 4 chapters + 2 = 6; `beatsWithParagraphOver3` and `suspectSplits` empty (`shortSentences` read by hand); `sayWords` 1,000–1,400; every number in Say matches an outline number by value (26% may be "about 1 in 4"); `grep -ci slot script.md` = 0; the Say text near the payroll-tax chapter contains "we're not tax advisors"; the first spoken sentence is "Here's the thing." and the last "See you next week."; no "folks"; `openMarkers` ≥ 2: the overtime-alert item, and the cost of one more cook (the outline's close promises it but gives no number — the baseline invented $1,250); `cmp script.md script.generated.md` equal; `script-rounds/01-claude.md` exists; registry `scripted`; video 3's note gains `edits: draft→final 50% · rounds 30%, 10%` (automatic learning), and no niche or speaker file changed.
  - **T5-B rework**: on the T5-A output, replace the first spoken sentence of beat 3 (chapter 2, overtime) and the last spoken sentence of beat 5 (chapter 4) with fixed sentences recorded in the test file, then ask "rework the close, it's too long". Pass when: `cmp script-rounds/02-speaker.md` with the hand-edited file equal; both fixed sentences found by `grep -F`; only the close beat and the header line differ between `02-speaker.md` and `script.md`; `02-claude.md` = `script.md`; `script.generated.md` unchanged.
  - **T5-C gates** on the T5-A output: (c) add `Locked` as the first line, prompt "lock video 5" → registry stays `scripted`, the reply names the open marker; (d) replace the marker with the number now given in the outline, prompt "lock video 5" → registry `locked`.
  - **T5-D "script-writing learn for video 3."** Pass when: it reports 50%, and 30%, 10%; S9 isn't counted as a speaker edit; "staff → crew" proposed for the speaker or niche file with the reason; S5 classed craft and reported as a self-check miss (craft.md already has "finish every phrase"); "slot → shift" a self-check miss (niche-words.md has it); no niche, speaker or plugin file changed; the registry note holds `draft→final 50% · rounds 30%, 10%`.
  - **T-STOP battery** (one subagent, each case on its own fresh copy; after setting up the case, copy it again as `<case>-before`, run, then `diff -r` against `<case>-before` must show no change except as noted): research-and-outline "Outline idea-2" → stops, points to content-ideation (plan or test, then review); script-writing with `Approved` removed from video 5's outline → stops; script-writing "write the script for video 6" → stops (conversation); script-writing with `speakers/dana.md` deleted → asks (setup, or craft + niche only); content-ideation on a folder with no `videopowers.md` → offers setup; content-ideation "plan the next video in `<path>/b`" from a parent with `a/` and `b/` → uses `b`, doesn't ask (writes into `b` only).
- [ ] **Step 8: Format example parses.** Extract the example from `script-format.md` to `$S/format-example.md`; run parse-check. Expected: `beatCount` 3, `openMarkers` 1 (the example shows a marker on purpose), `shortSentences` and `suspectSplits` empty.
- [ ] **Step 9: REFACTOR**; re-run failing scenarios only.
- [ ] **Step 10: Checks.** Run: `bash $S/check.sh script-writing`. Expected: exit 0; SKILL.md ≤ 1,200 words.
- [ ] **Step 11: Commit.**
```bash
git add skills/script-writing/
git commit -m "feat(script-writing): scripts to read on camera without edits — craft, niche and speaker layers, rounds with snapshots, learning from edits"
```

---

### Task 6: packaging-kit description, README, version bump

**Files:**
- Modify: `skills/packaging-kit/SKILL.md`, `README.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`

- [ ] **Step 1: packaging-kit** (stays a placeholder). Description: `"IN DEVELOPMENT — not built yet; if invoked, tell the user this skill is still under development and stop. Will produce the late packaging after recording: chapters with timestamps and the final description. Early packaging (titles, first line, thumbnail concept and mockup) now lives in content-ideation and is refreshed in research-and-outline."` Body: the planned responsibility reads the video's `packaging.md` and adds chapters and the final description.
- [ ] **Step 2: README.** Pipeline diagram:
```
ideation ─► research + outline ─► script ─► record ─► rough cut ─► FINAL CUT (you, in Resolve) ─► packaging (late)
(+ packaging v1)  (gate 1: Approved)  (gate 2: Locked)                     │
                         render ◄─ polish ◄─ visuals ◄─ layout ◄─ setup ◄──┘
```
  Skills table: add `content-ideation` first (pre-production · plan a month or the next video, test an idea, packaging v1 with thumbnail mockups · **built**); replace the old outline row with `research-and-outline` (pre-production · planned idea → research + approved story outline, with a study gate · **built**); `script-writing` → **built** (approved outline + craft, niche and speaker layers → a script to read without edits; learns from edits); `packaging-kit` → "late packaging: chapters and final description (early packaging lives in content-ideation)". New section "The content workspace": the plugin holds the method; a company's profile, framework, words, speakers and registry live in its own repo, found by `videopowers.md`; the first run offers setup; Tars (behavioral health) is the worked example.
- [ ] **Step 3: Versions** → `0.8.0` in both manifests.
- [ ] **Step 4: Checks.** Run: `bash $S/check.sh && ! grep -n "outline-shaping" README.md`. Expected: exit 0.
- [ ] **Step 5: Commit.**
```bash
git add skills/packaging-kit/SKILL.md README.md .claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "docs: README pipeline and skills table for the pre-production skills; packaging-kit is late-phase only; v0.8.0"
```

---

### Task 7: Whole-branch review, privacy pass, push

- [ ] **Step 1: Whole-branch review.** A fresh subagent reads the spec, this plan and `git diff fb237e6..HEAD -- . ':!skills/footage-rough-cut'`, and reports: spec requirements with no home; contradictions between the three skills (a status, file name, section name or format used differently); anything company-specific in the plugin; any rule a non-Tars company couldn't follow. Fix confirmed findings in `fix(preproduction): review findings`.
- [ ] **Step 2: Final privacy pass.** Run: `git diff --name-only --diff-filter=d fb237e6..HEAD | grep -v footage-rough-cut | xargs grep -nEi -f $S/denylist.re`. Expected: no output. Then `git grep -n "Tars" -- skills/content-ideation skills/research-and-outline skills/script-writing README.md`: each hit is a short named example. Then `git grep -nEi "admission|treatment cent|rehab|intake|inquir|verification of benefits|behavioral health|clinic" -- skills/content-ideation skills/research-and-outline skills/script-writing`: every hit sits in a line that names Tars as the example; craft, hook and format examples use fictional or generic businesses.
- [ ] **Step 3: Unrelated work untouched.** Run: `git status --short`. Expected: the same 7 `M skills/footage-rough-cut/scripts/…` lines as before Task 1, nothing else.
- [ ] **Step 4: Push.** Run: `git push origin main`. Expected: the new commits on `origin/main`.
