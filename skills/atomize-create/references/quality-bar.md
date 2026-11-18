# The quality bar

What every post and the article must meet before they are handed over. The reviewer agent checks it (`review-brief.md`); the writers read it too, so they aim at the same bar. The floor is "nothing invented". The goal is a post worth reading.

## Checks

| Check | What it means | Kind |
|---|---|---|
| Stands alone | The reader gets the idea, the evidence and the takeaway without the video. The reviewer writes its 3-line reading of the post before opening the card, then compares. | pass or fail |
| Hook | The opening makes the main persona want to read on, and works without the visual. | pass or fail |
| Nothing invented | Every claim, number, quote and first-person line is in the card (or the article plan) or in the profile's standing facts. | pass or fail |
| Compliance | The company-wide filters: nothing from never claim, the compliance rules hold, no customer names, proof only within the limits in the file at the `profile` key, no banned words. | pass or fail |
| Liked posts | At least as clear, concrete and useful as the liked posts in the profile's voice file, or the company voice file when the profile's has none. | score 1 to 5, fail below 3 |
| Voice fit | How much it sounds like the person or the company page. | placeholder: score and note, never a fail |

A post passes when the four pass or fail checks pass and the liked posts score is 3 or more.

The script gate (`gate.py posts`, `gate.py article`) has already checked the mechanical rules: numbers in the card, banned words, links only in the first comment, hook length, one ask, no leftover placeholder other than the video link token. The reviewer does not redo those, but fails anything it sees that slipped through.

Read the file at the `quality bar` key every run. It holds what the company has learned about quality, and its notes count as part of this bar.

## Voice fit

- Voice fit is a placeholder for now. It is scored and reported, never a reason to fail.
- When the voice file names a rubric (for example a score out of 50), the reviewer scores on that rubric and writes the result in `voice_fit.rubric`. For the others, a short note on how the post sounds against the voice file.
- Reminder for the user: the next step on voice is to agree how to align it. For example, each person marks posts as "sounds like me" or not, and those become the examples in their voice file. Until then, voice fit only informs.

## Redos

- A redo gets every earlier fail reason, from every earlier round, for that post.
- The writer fixes each reason. The reviewer checks that each one is fixed.
- A redo never asks back for something an earlier review asked to remove.
- Up to 2 redos per post and per article. What happens next is in the skill (swap, drop to 2, or stop and ask).

## review.json

The reviewer writes one `review.json` in each post folder, and one in `article/` for the article:

```json
{"post": "P03", "status": "pass", "reading": "line 1\nline 2\nline 3",
 "checks": {"stands_alone": "pass", "hook": "pass", "nothing_invented": "pass", "compliance": "pass",
            "liked_posts": {"score": 4, "note": "as concrete as liked post 2"},
            "voice_fit": {"score": 3, "note": "a little formal for this voice", "rubric": ""}},
 "fail_reasons": []}
```

- `post` is the short id (`A01` for the article). `reading` is the 3-line reading written before opening the card.
- `status` is `fail` when any pass or fail check fails or the liked posts score is under 3. Never fail on voice fit.
- Each fail reason quotes the line, names the check, and says what would fix it.
- `rubric` is the rubric score when the voice file names one, else `""`.
