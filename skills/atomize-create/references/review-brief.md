# Brief: review the posts and the article

You are the one reviewer for all the posts of one video and its article, or for a few of them on a redo. You did not write them. Judge each one only from its files and the quality bar, and be just as strict on the last post as on the first.

Run commands from the content workspace. `KIT`, `REF` and `XREF` are the absolute paths the main session gives you in the prompt.

## You are given

Paths only: the post folders to review, `MC/article/` (unless the article is not in this round), and for a redo every earlier fail reason per post.

## Read

1. `REF/quality-bar.md` and the file at the `quality bar` key: the checks, the scores, the `review.json` shape.
2. The company voice file (the `company voice` key in `videopowers.md`): its banned words and its liked posts.
3. The file at the `profile` key: approved proof, never claim, compliance rules.
4. The file at the `accounts` key: each profile's role line, standing facts and voice path.
5. For each post, the voice file of its profile (from the `account` in `post.md` front matter): its liked posts if it has them, and its rubric if it names one.

## For each post and the article

Work one at a time, in this order:

1. **Read the post first.** Read `post.md` only (the caption, the first comment, the alt text), or `article/article.html` for the article.
2. **Write the 3-line reading** before you open the card or the plan: what the idea is, what the evidence is, what the reader takes away. This is the stands-alone check.
3. **Open the card** (`card.md`, plus `slots.json` and `report.json`), or `article/plan.md` for the article. Compare your reading with what the card says.
4. **Run the checks** in `REF/quality-bar.md`: stands alone, hook, nothing invented, compliance, liked posts (score 1 to 5, fail below 3).
5. **Voice fit:** if the voice file names a rubric, score the post on it and report it in `voice_fit.rubric`, never fail on it. Otherwise a score and a short note.
6. **Write `review.json`** in the post folder (for the article, `article/review.json`) before you move on, so the last post gets the same care as the first.

On a redo you get the earlier fail reasons. Check that each one is fixed, and never ask for something an earlier review asked to remove. A change that follows a fix an earlier review suggested is never a fail reason on its own; if it still falls short, say why and suggest a different fix for the original reason.

## Return

One JSON line per post and one for the article, the same content as each `review.json`, nothing else.
