---
name: atomize-extract
description: Use when a finished pillar video should become LinkedIn micro content - stage 1 of atomization. Part 1 finds, scores and picks post ideas (3 per profile plus backups), writes the idea cards, the article plan and a review page, then stops for review. Part 2 (`<slug> visuals`) makes the post visuals and the article images. Post and article text come later from atomize-create. Also for re-running stage 1 or a test run.
---

# atomize-extract (stage 1)

Turn one pillar video into post ideas worth stopping for, each with a visual, plus the plan for one newsletter article. Judgment comes first: ideas are generated and scored, the user reviews them on one page, and only then are visuals made. Story and usefulness come first; accuracy is the floor underneath.

Run commands from the content workspace (the folder that holds `videopowers.md`, or any folder inside it). `KIT` = the `kit` folder in this skill's folder and `REF` = this skill's `references` folder: write them as absolute paths in every command and in every agent prompt, since agents don't know where the skill lives. `MC` = the output folder (see Call).

Needs Python 3.10+ with `pyyaml` and `pillow` (`pip install pyyaml pillow`), and Google Chrome or Chromium for rendering (set `CHROME` to its path if it isn't found).

## Call

- `atomize-extract <slug>`: part 1. Output in `<video folder>/microcontent/`.
- `atomize-extract <slug> visuals`: part 2, after the user's review.
- `atomize-extract <slug> into <folder>`: output in `<video folder>/<folder>/` instead (for example `microcontent-test`). Works with either part.
- `atomize-extract <slug> test run`: a test, always with `into` (default `microcontent-test`). Rows are marked `test`: every `ledger.py add` uses `--status test` in both parts, and `ledger.py drop` gets `--test`. Test rows never overwrite real rows. `ledger.py` refuses a test run on a folder named `microcontent`.

Lookups always get `--exclude-video <slug>`, in a test run and in a normal run, so a re-run never flags its own rows as repeats.

A re-run of either part updates the cards, files and rows in place. A row already in a stage 2 status keeps it.

## Workspace

Everything specific to the company lives in workspace files, found through the keys in `videopowers.md`. Never hard-code a workspace path.

First run: `python3 KIT/paths.py check <slug> --stage 1`. It prints the video folder, creates the notes files and `brand.json` if they are missing, and stops naming any missing required file (profile, framework, accounts, company voice, the video's `script.md` or `said.md`). A missing accounts file or company voice: offer the micro content setup in the workspace guide (`../content-ideation/references/workspace.md`, *Micro content files*), writing them from this skill's `templates/accounts.md` and `templates/voice-writing.md`, then run the check again. A missing profile, framework or script comes from content-ideation and script-writing: stop and tell the user.

**The said file** is what the speaker said on camera: `said.md` in the video folder when it exists (the words of the final cut, for a video recorded without reading the script word for word), else `script.md`. Every `said_in` quote comes from it.

Keys this stage reads:

| Key | What for |
|---|---|
| `profile` | approved proof, never claim, compliance rules, the `products` block |
| `framework` | ladder steps, buckets and their shares |
| `personas` | the personas, one marked main (falls back to `## Default audience`) |
| `accounts` | the profiles (their count sets how many posts), `## Settings` (article author) |
| `company voice` | banned words and characters |
| `brand` | `brand.json`: logo, font, colours, themes |
| `findings`, `posts` | the records, written only through `ledger.py` |
| `scoring notes` | what scoring has learned; read every run |
| `atomize feedback log` | where review feedback goes |

## How the work is split

- **Part 1:** you (the main session) do all of it: read, generate, score, pick, write the cards and the article plan, run the scripts.
- **Part 2:** 2 visual agents, one per format (infographic and carousel), each with `REF/visual-brief.md`. The infographic agent also makes the article cover and figures with `REF/article-brief.md`. Then 1 reviewer agent with `REF/gate-brief.md` for every visual and article image.
- Start agents with the Agent tool. Prompts pass paths only: the brief, the folders, and for a redo the earlier fail reasons. Ask for one JSON line per piece.
- Subagents can't start subagents, so every redo happens from the main session. You never open rendered images yourself.

## Part 1: ideas

1. **Check and read the workspace.** Run `python3 KIT/paths.py check <slug> --stage 1`. Then read the files at the keys above, the scoring notes, and the recent entries in the atomize feedback log. Read `REF/idea-scoring.md`, `REF/idea-generation.md`, `REF/picking.md`, `REF/idea-card.md`, `REF/article-plan.md` and `REF/formats.md`.
2. **Read the pillar.** In the video folder: the said file, `outline.md`, every `research*.md`, and `packaging.md` if present.
3. **Generate 20 to 24 candidates** in one pass, by `REF/idea-generation.md`.
4. **Repeat check.** Run both lookups:
   - `python3 KIT/ledger.py recent-ideas MC --exclude-video <slug>`
   - `python3 KIT/ledger.py finding-recent MC --weeks 6 --exclude-video <slug>`

   Flag candidates close to a recent idea, and note which lead findings are recent (`REF/picking.md`).
5. **Score every candidate** by `REF/idea-scoring.md`.
6. **Pick** by the table in `REF/picking.md`: 3 posts per profile and 1 backup per profile, with the bucket, persona and format spread. Apply the lead finding rule as you pick: a candidate whose lead finding is recent gets another of its findings first, or is skipped. If too few pass, refill only the empty slots, at most 2 rounds, then hand over fewer. If fewer than 2 per profile pass after 2 rounds (under 8 for 4 profiles), stop and ask the user.
7. **Write the cards** in `MC/posts/` and `MC/backups/` by `REF/idea-card.md`, and `MC/candidates.md` with every candidate, its scores and why it won or lost.
8. **Write the article plan** `MC/article/plan.md` by `REF/article-plan.md`.
9. **Check:** first read each card's Hook, Retain, Reward and Ask against its excerpts and the said file: a line that goes beyond them or against them is fixed now, before any visual or post copies it. Then `python3 KIT/gate.py cards MC`. Fix every card and the plan until all pass. The lead finding check here is only the backstop for step 6.
10. **Record:** `python3 KIT/ledger.py add MC --status extracted`. In the 8 to 11 case add `--as-backup` with the leftover post ids, for example `--as-backup P09,P10`. In a test run use `--status test`.
11. **Review page:** `python3 KIT/review.py MC`, then `open MC/review/index.html`. Stop. Tell the user the page is open and that feedback in chat is welcome, using the ids (for example "drop P04, use C14, article title 2").

## Review and feedback

The user reviews in chat, whenever they like, on one page that grows with the run: `MC/review/index.html`, built by `python3 KIT/review.py MC`. After part 1 it shows the ideas; after part 2, every visual too; after stage 2, the posts with copy and download buttons. Rebuild it after every change.

**On a phone:** when the session can publish a web page (for example an artifact tool) and the user wants the page away from the computer, publish `MC/review/index.html` with every file listed in `MC/review/files.json` (published path to source file) and the downloads capability, so the download buttons work there. Republish to the same page after each rebuild.

- Write each piece of feedback into the file at the `atomize feedback log` key: the date, the video, the id and what was said.
- **A changed idea** is rescored. If it falls under the bar, a backup or the next passing candidate replaces it:
  - drop the old post: `python3 KIT/ledger.py drop MC <id> --reason "..."` (`--test` in a test run);
  - a backup moves from `backups/` into `posts/` and keeps its B id;
  - a new candidate gets the next unused P id. Never reuse a dropped id.
- **A change to the look only** (format, theme, layout) is noted in the card's `## Visual plan` for part 2. No rescore.
- A title pick for the article goes into `title_choice` in the plan.
- Then update everything: the cards, `candidates.md`, `python3 KIT/gate.py cards MC`, `python3 KIT/ledger.py add MC --status extracted` (same `--as-backup` list, or `--status test`), and `python3 KIT/review.py MC`. A backup moved into `posts/` comes off the `--as-backup` list and off the `backups:` line in `index.md`.

If the user changes an idea after part 2, rescore it the same way; a change to the look only re-renders. Then finish it as part 2 does: render the visual for every new or changed post, run `python3 KIT/gate.py visuals <folders>` and the visual reviewer, update `index.md` (the table and the `backups:` line), and record again with `python3 KIT/ledger.py add MC --status made` (same `--as-backup` list, `--status test` in a test run). Stage 2 refuses rows left in `extracted`.

## Part 2: visuals

Run only after the user's review of the ideas. Part 2 ends with a second stop: the user checks the visuals before any post text is written.

1. **Check:** `python3 KIT/gate.py cards MC` passes for every card and the plan.
2. **Make the visuals:** 2 visual agents, one per format (infographic and carousel), each with `REF/visual-brief.md` and the post folders of its format. The infographic agent also gets `REF/article-brief.md` and `MC` for the cover and the 2 to 3 figures. Backups get no visual, and neither do leftover posts recorded as backups.
3. **Review:** `python3 KIT/gate.py visuals <post folders>`, and `python3 KIT/gate.py visuals MC/article/cover MC/article/figure-1 MC/article/figure-2` (plus `figure-3` if planned). Then 1 reviewer agent with `REF/gate-brief.md` and every folder. It writes `visual-review.json` in each.
4. **Handle each fail by its reason**, with up to 2 redos. Group each round's fixes into one agent (the visual brief takes a batch), and give it and the reviewer every earlier fail reason with the fix each review suggested, so a later review never fails a change an earlier one asked for.

   | `fail_kind` | Redo |
   |---|---|
   | `thin` | Change the format, keep the idea. Rewrite the card's `format` and `## Visual plan`, run `python3 KIT/gate.py cards MC` and `python3 KIT/ledger.py add MC --status extracted` again to update the row (`--status test` in a test run, same `--as-backup` list). |
   | `render` | Re-render. A template problem goes into the atomize feedback log as a follow-up; never fix a template mid-run. |
   | `fact` | Fix the card from the source, run `python3 KIT/gate.py cards MC`, re-render. |
   | `weak` | No redo. |

   A piece that still fails after 2 redos, or a weak idea: `python3 KIT/ledger.py drop MC <id> --reason "..."` (`--test` in a test run). It moves to `dropped/` with its reasons. Stage 1 never swaps in a backup; stage 2 does.

   An article image that still fails after 2 redos is not dropped: record it and its reasons in `index.md` and tell the user.
5. **Write `MC/index.md`:** a table of the posts (id, idea, format, bucket, product), the backups, the article images, `Said: <the said file>`, and every redo or drop with its reason. No questions or to-dos for the user. It ends with exactly these three lines:

   ```
   backups: <ids>
   visuals: done
   reviewed: <YYYY-MM-DD>
   ```

   `backups:` lists every backup id, comma separated, including leftover posts recorded as backups. Stage 2 reads it, also in a test run where every row reads `test`. Stage 2 refuses to start without these lines.

   Then record: `python3 KIT/ledger.py add MC --status made`, with the same `--as-backup` list as part 1. In a test run use `--status test`.
6. **Show the visuals:** `python3 KIT/review.py MC`, then `open MC/review/index.html` (republish it if the user has it on the phone). Stop. Feedback on a visual is a change to the look: update the card's `## Visual plan`, re-render with the visual brief, run `python3 KIT/gate.py visuals <folders>` and the visual reviewer, and rebuild the page. The user starts stage 2 when the visuals look right.

## Hard rules

- Company-wide filters, the same for every post and the article: nothing from never claim, the compliance rules hold, no customer names, and proof only within the limits the profile file states.
- Banned words and characters from the voice files (the `company voice` key). No em dashes, no emojis.
- No invented quotes, moments, scenes, customers or first-person experiences. Only what the sources and the video say.
- Every number is in its card with a word-for-word excerpt, or in a `said_in` quote, and shown as digits.
- Visuals never name a team member and always carry a source line (an article cover has none).
- Old-layout folders are read-only. `gate.py cards` refuses them; never write into one.

## Finish

After part 2, tell the user in three or four lines: which video, what was made (how many posts of each format, the backups, the article images), where (`MC`), any drops with their reasons, that the review page now shows every visual, and that once they look right the next step is `atomize-create <slug>`.
