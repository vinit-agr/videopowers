# Picking

How to choose the posts and backups from the scored candidates, and how to record every choice.

## How many

3 posts per profile, plus 1 backup per profile. Count the profiles in the file at the `accounts` key; never assume a number. Only candidates that pass the bar count.

What stage 1 hands over, by how many candidates pass. The numbers are for 4 profiles; for P profiles, read 4 as P, 8 as 2P, 12 as 3P and 16 as 4P.

| Candidates that pass | Hand over |
|---|---|
| 16 or more | 12 posts + 4 backups |
| 12 to 15 | 12 posts + the rest as backups (0 to 3) |
| 8 to 11 | 8 posts (2 per profile) + the rest as backups |
| under 8 after 2 refill rounds | stop and ask the user |

The bar is never lowered to fill a slot.

In the 8 to 11 case, write every passing candidate as a post card in `posts/` first. The ones beyond the 8 posts keep their P id and folder in `posts/`, and are recorded as backups: name them with `--as-backup` on every `ledger.py add`, for example `python3 KIT/ledger.py add MC --status extracted --as-backup P09,P10`. Stage 2 reads backups from the records, not only from `backups/`.

## Spread

- **Buckets:** keep the shares the file at the `framework` key gives, as far as the material allows.
- **Persona:** the main persona is the main audience. Other personas only when an idea clearly fits them.
- **Formats:** about half infographic and half carousel (about 6 and 6 in 12), so stage 2 can give each profile at least one of each. Loose, not strict. `formats.md` says which idea suits which format.
- No profile tilt. Who gets what is stage 2's job.

## Ties

Between two candidates with the same total, take the one whose bucket or format is short in the picked set.

## Refill

If too few candidates pass, generate more only for the empty slots (the missing buckets or formats), score them, and pick again. At most 2 refill rounds. Then hand over fewer, by the table above, rather than lower the bar.

## Backups

- Backups pass the bar too.
- Each backup differs from the posts: it rests on another finding and, where possible, takes another format. Then a swap in stage 2 doesn't repeat a post.
- Backups get ids `B1`, `B2` and on, in `backups/B<N>-<idea-slug>/`. They get no visual in stage 1.

## Repeat check

Run both lookups before picking, in every run, with this video left out so a re-run doesn't flag its own rows:

```
python3 KIT/ledger.py recent-ideas MC --exclude-video <slug>
python3 KIT/ledger.py finding-recent MC --weeks 6 --exclude-video <slug>
```

- `recent-ideas` lists the last 40 ideas from other videos (it skips test, dropped and unused backup rows). Compare each candidate's idea line with them by meaning. A candidate close to one of them gets a repeat flag: write the close id and idea in `repeat_flag` and lower the shown score as `idea-scoring.md` says. It is a flag, not a block.
- `finding-recent` lists the findings that came first in another video's post in the last 6 weeks. The lead finding of a candidate is the first item in its `findings`. A recent lead finding never comes first in a post. If the candidate has another finding that is not recent, put that one first. If it has none, skip the candidate as a post or backup.
- Compare findings by source and statement, not by id alone: older rows use other id shapes, so the same finding can appear under another id.
- `gate.py cards` fails a card whose lead finding is recent, as a backstop. Apply the rule while picking, so the gate finds nothing.

## candidates.md

Write `MC/candidates.md` with every candidate, picked or not, in one table:

```
| id | idea | hook | retain | reward | total | result | why |
|---|---|---|---|---|---|---|---|
| C01 | Only sending the invoice the same day made a difference to late payments | 4 | 4 | 3 | 11 | P02 | clear guess then answer; one change anyone controls |
| C11 | Software saves time | 2 | 2 | 1 | 5 | not picked | generic, no proof |
```

- `id` is the candidate number (`C01` and on).
- `result` is the P or B id it became, or `not picked`.
- `why` says in a few words why it won or lost. A candidate that failed point 1 or 5 shows the fail in `why`.
- Keep the file up to date after review: a replaced idea changes its `result`.
