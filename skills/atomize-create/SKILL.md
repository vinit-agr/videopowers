---
name: atomize-create
description: Use after atomize-extract to make a video's LinkedIn posts and newsletter article - stage 2 of atomization. Scores each post idea against each profile in the accounts file, finds the best allocation, has one writer per profile write the posts (and the article) in that voice and one reviewer check them against the quality bar, then hands them over ready to post. Also for adding the video link later, rewriting one profile, a full rematch, or a test run.
---

# atomize-create (stage 2)

Take the ideas and visuals from stage 1, decide which profile posts each one, write every post and the newsletter article in the right voice, check them, and hand them over ready to post. The user copies and posts them as they are: nothing may need a review, a choice or a fix. The user reviewed the ideas and the visuals in stage 1; calling this skill is the go-ahead. The user does not review who gets what.

Run commands from the content workspace (the folder that holds `videopowers.md`, or any folder inside it). `KIT` = the `kit` folder of the sibling `atomize-extract` skill (`../atomize-extract/kit` from this skill's folder), `REF` = this skill's `references` folder, `XREF` = `atomize-extract`'s `references` folder: write them as absolute paths in every command and in every agent prompt, since agents don't know where the skills live. `MC` = the video's microcontent folder, the one stage 1 wrote (see Call).

## Call

- `atomize-create <slug> [<LinkedIn video post URL>]`: the full run. Output stays in `<video folder>/microcontent/`.
- `atomize-create <slug> into <folder>`: work on `<video folder>/<folder>/` instead (for example a test copy). Works with every call below.
- `atomize-create <slug> test run`: a test, always with `into` (default `microcontent-test`; if that folder does not exist, copy `microcontent/` there first). Pass `--test` to every `create.py` command and to `ledger.py set-status` and `ledger.py drop`. Rows stay `test`, and real rows of the same video are never touched. The kit refuses `--test` on a folder named `microcontent`.
- `atomize-create <slug> link <URL>`: only adds the video link to finished files (see The link).
- `atomize-create <slug> rewrite <profile>`: rewrite one profile's posts (see Re-running).
- `atomize-create <slug> rematch`: match again from the scores (see Re-running).

**The video link** is the native LinkedIn post of the pillar video, never a YouTube link. It comes from the call, from `MC/video-link.txt`, or from a line `LinkedIn video post: <url>` in the video's `packaging.md`. If none has it, do everything anyway: the files keep `{{VIDEO_POST_URL}}`, and you tell the user the one command to run later.

Old-layout folders (`pieces`, `spares` or a copied ready folder) are read-only and not supported. `create.py check` refuses them.

## Workspace

Everything specific to the company lives in workspace files, found through the keys in `videopowers.md`. Never hard-code a workspace path.

First run: `python3 KIT/paths.py check <slug> --stage 2`. It prints the video folder, creates the notes files if they are missing, and names any missing required file (profile, accounts, company voice). If it names one, stop and tell the user: stage 1 (`atomize-extract`) sets them up.

Keys this stage reads:

| Key | What for |
|---|---|
| `profile` | approved proof, never claim, compliance rules |
| `product facts` | what each product does, for the writers' facts check |
| `accounts` | the profiles: role lines, voice paths, standing facts, rules; `## Settings` (posts per profile, article author) |
| `company voice` | base rules, banned words, liked posts |
| `findings`, `posts` | the records, written only through the kit |
| `matching rules` | what matching has learned; read before scoring |
| `quality bar` | what the quality checks have learned; read by writers and the reviewer |
| `atomize feedback log` | where the user's feedback goes |
| `videos` | the video folders |

Each profile's voice files are found through the `voice` column of the accounts file. `company` means the company voice.

## How the work is split

- **You (the main session):** read, score the fit, run every script, start the agents, and handle every redo, swap and drop. You never open rendered images yourself.
- **Writers:** one writer agent per profile, all started in parallel (4 for 4 profiles), each with `REF/write-brief.md`. Each writes all its profile's posts in one voice. The article author's writer also writes the article after its posts, with `REF/article-write-brief.md`. No separate article writer.
- **Reviewer:** 1 reviewer agent for all posts and the article, with `REF/review-brief.md`, against the checks in `REF/quality-bar.md`.
- **Redos:** the redos for one profile go into one writer run, and each round's reviews into one reviewer run.
- Start agents with the Agent tool. Prompts pass paths only: the brief, the folders, the voice files and, for a redo, every earlier fail reason. Ask for one JSON line per piece. Subagents cannot start subagents.

## Steps

1. **Check stage 1 is done:** `python3 KIT/create.py check MC` (`--test` in a test run). It needs `index.md` with its `backups:`, `visuals: done` and `reviewed:` lines, a `card.md` and a passing `visual-review.json` in every post folder, `article/plan.md` with its cover and figures, and post rows in `made`. If it prints anything, stop and tell the user why. Then read the files at the keys above, the matching notes, the quality bar notes, the recent entries in the atomize feedback log, `REF/matching.md` and `REF/quality-bar.md`.

2. **Score the fit.** Read `REF/matching.md` and every post's `card.md`. Give each post and each profile a score from 1 to 5 with a one-line reason, and write them to `scores` in `MC/match.json`. Backups are not scored now.

3. **Match:** `python3 KIT/create.py match MC` (`--test` in a test run). It finds the best allocation, writes it to `match.json`, renames each post folder to `<id>-<profile id>-<idea slug>`, and sets the rows to `matched`. It prints the totals. If it refuses (a missing score, an unknown profile, a wrong post count), fix the scores and run it again.

4. **Write.** Start the writers in parallel, one per profile, with `REF/write-brief.md`: the profile id, its post folders, its voice files, the company voice, the profile file and `MC/match.json` for its match reasons. Give the article author's writer `MC/article/` and `REF/article-write-brief.md` too. Say in the prompt that a writer may edit the carousel's `ask` slide in `slots.json` and re-render, as the brief allows; never tell writers to leave `slots.json` alone. When they return, record the written posts: `python3 KIT/ledger.py set-status MC --ids <ids> --status written` with the short ids, for example `--ids P01,P02,P03` (`--test` in a test run).

5. **Script checks:** `python3 KIT/gate.py posts MC --allow-token` and `python3 KIT/gate.py article MC --allow-token`. A post or the article that fails here goes back to its writer with the reasons before the review (this counts as a redo).

6. **Review:** start 1 reviewer agent with `REF/review-brief.md`, every post folder and `MC/article/`. It writes `review.json` in each post folder and in `article/`.

7. **Fix failures** by When posts fail, until every post and the article pass, or the run stops and asks.

8. **Hand over:** `python3 KIT/create.py handover MC` (`--test` in a test run). When the link is already known, add `--link <URL>`; without it, the script also looks in `video-link.txt` and `packaging.md`. It writes `MC/handover.md` (each profile's posts in suggested order, the article, posts kept for later, swaps and drops) and `MC/article/publish.md`, fills the link where it has one, and sets the rows to `ready`, or `waiting-for-link` when the link is missing. It also rebuilds the review page `MC/review/index.html`: each post with its profile, the document title for carousels, the post and the first comment (each with a copy button), the visual to download, and the article. If any profile has fewer passing posts than the per-profile count (after drops), it gives every profile 2 and keeps the rest as extras.

9. **Tell the user** in a few lines: where the review page and `handover.md` are (republish the page if the user has it on the phone, as `atomize-extract` says under Review and feedback), how many posts each profile got, any swaps or drops with their reasons, and, if the link is missing, the command `atomize-create <slug> link <URL>`. Nothing to review.

## When posts fail

A post fails when the script gate or the reviewer fails it. A failed post is never handed over.

1. **Redo, up to 2 times.** A new run of the profile's writer rewrites it, with every earlier fail reason from every round and the fix each review suggested. Group all of one profile's redos into one run. The reviewer then checks only the redone posts, with the earlier reasons. Run the script checks again after each redo.
2. **Swap in a backup** when a post still fails after 2 redos: `python3 KIT/create.py swap MC <failed> <backup>` (`--test` in a test run), for example `swap MC P04 B2`. The backup goes to the profile whose post failed and keeps its id; nothing else is rematched. The failed post moves to `dropped/`. Backups come from the `backups:` line in `index.md`.
   - **Add the backup's fit scores** for every profile to `scores` in `match.json` right after the swap. Any later `match --rematch` refuses without them.
   - **Make the backup visuals in one batch:** one visual agent with `XREF/visual-brief.md` and every swapped-in backup folder (it renders with `python3 KIT/render.py <folder>/slots.json`), then `python3 KIT/gate.py visuals <folders>`, then one reviewer with `XREF/gate-brief.md`. Redo a failed visual by that brief's fail kinds, up to 2 times.
   - Then write the backups (the profile's writer), set them to `written`, run the script checks and review them, on the same ladder: 2 redos, then the next backup.
   - If `handover` already ran, run it again once the swapped-in backup passes, so `handover.md` and the rows show the swap.
3. **Drop to 2 per profile** when backups run out or fail: drop the failed post with `python3 KIT/ledger.py drop MC <id> --reason "..."` (`--test` in a test run). `create.py handover` then gives every profile 2 posts, keeps each profile's 2 best (liked-posts score, then fit score, then id) and lists the other passing posts as kept for later.
4. **Never fewer than 2 per profile.** If a profile cannot reach 2 passing posts, stop and ask the user, with every fail reason. `handover` refuses in that case too.

**The article:** up to 2 redos by the author's writer, reviewed again each time. If it still fails, stop and ask the user, with the fail reasons. There is no backup article.

Write each piece of user feedback into the file at the `atomize feedback log` key: the date, the video, the id and what was said.

## Re-running

- **A plain re-run** (`atomize-create <slug>` again) keeps the match: `create.py match MC` leaves an existing allocation as it is. Rewrite only the posts without a passing `review.json`, then review them, run the script checks and hand over again. `handover` overwrites `handover.md` and updates the same rows.
- **`rewrite <profile>`** rewrites every post of one profile, for example after its voice file changes. Start that profile's writer for all its folders (and the article too when the profile is the article author), set the rows to `written`, run the script checks, review those posts, and run `handover` again.
- **`rematch`** matches again from the scores: update `scores` in `match.json` first if the profiles or the cards changed (every allocated post, swapped-in backups included, needs a score for every profile), then run `python3 KIT/create.py match MC --rematch` (`--test` in a test run). Only posts whose profile changed lose their `post.md` and `review.json` and go back to `matched`; the folders are renamed. Write, check and review those, then run `handover` again.

## The link

When the video goes up after the hand-over, run `python3 KIT/create.py link MC <URL>` (`--test` in a test run). It fills the link in every `post.md`, the article files and `handover.md`, saves it to `video-link.txt`, re-runs `gate.py posts` and `gate.py article`, when both pass moves this video's `waiting-for-link` rows to `ready`, and rebuilds the review page. Nothing is rewritten. A second link replaces the first everywhere.

Prefer `create.py link` for adding the link later: `create.py handover --link` fills the link but does not re-run the script checks.

## Hard rules

- One idea, one post, one profile. No reworded copies of the same post across profiles.
- Nothing invented: every claim, number and quote is in the card (or the article plan) or the profile's standing facts. No invented scenes, customers, conversations or first-person experiences.
- The company-wide filters, the same for every profile and the article: nothing from never claim, the compliance rules hold, no customer names, proof only within the limits in the profile file, banned words from the company voice and each voice file, no em dashes, no emojis. No profile is ever blocked from a post.
- Links only in the first comment. One ask per post; no disclosure line.
- Voice fit is reported, never a reason to fail.
- No scheduling: `handover.md` lists who posts what; the user picks the days.
- Old-layout folders are read-only; never write into one.
