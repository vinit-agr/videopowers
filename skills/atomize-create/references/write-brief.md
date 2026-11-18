# Brief: write one profile's posts

You write every post for one profile, in that profile's voice. The visuals already exist. Your posts are copied and posted as they are, so each must be right. You hold one voice for the whole run; never write for another profile.

Run commands from the content workspace. `KIT`, `REF` and `XREF` are the absolute paths the main session gives you in the prompt.

## You are given

Paths only:
- the profile id and its post folders (`posts/<id>-<profile id>-<idea slug>/`);
- its voice files, found through the accounts file (the `voice` column; `company` means the company voice);
- the company voice file (the `company voice` key in `videopowers.md`) and the company-wide filters (the file at the `profile` key);
- the match reasons for its posts (`MC/match.json`, under `scores`);
- for a redo, every earlier fail reason per post;
- if this profile is the article author, `MC/article/` as well.

## Read

1. The profile's section in the file at the `accounts` key: its role line, its standing facts and its rules. Follow them.
2. The profile's voice file. Do what it says to read, skip or do, in the order it gives. When it names a rubric, keep it in mind; when it says to draft several versions and keep the best, do that inside this run.
3. The company voice file: the base rules, the banned words, the post shape and the liked posts.
4. The file at the `profile` key: approved proof, never claim, compliance rules.
5. `REF/quality-bar.md` and the file at the `quality bar` key: the bar the reviewer will hold you to.
6. In each post folder: `card.md` (idea, numbers, excerpts, real moments, `said_in` quotes, hook, retain, reward, ask), `slots.json` and `report.json` (the headline you must not repeat, the source line, the files to upload).

## Write post.md

Write `post.md` in each post folder, exactly in this format:

````
---
piece: <video slug>-<id>
account: <profile id>
format: <infographic | carousel>
caption_shape: <the shape you chose, in a few words>
hook_type: <the hook type you chose, in a few words>
---
# <video slug>-<id> · <profile name> · <format>

Upload: <the file names from report.json "files", comma separated, in order>
Document title: <carousels only: 3 to 8 words, the hook as a title>

## Post
```text
<the caption>
```

## First comment
```text
The full video: {{VIDEO_POST_URL}}
Sources: <short citations with links>
```

## Alt text
- Image 1: <what the image shows, with its numbers, one or two sentences>
````

- **Shape and hook:** read the idea, then pick the caption shape and the hook type that suit it, in line with the card's hook, retain and reward. No rotation, and no rule against repeating a shape. Note what you chose in `caption_shape` and `hook_type`; the scoring notes learn from them later.
- **First comment:** line 1 is always `The full video: {{VIDEO_POST_URL}}`, with the token left as it is. Add line 2, `Sources: ...`, only when the visual's source line doesn't already carry the links.
- **Alt text:** one line per image or slide, in order.
- Drop the `Document title:` line for anything but a carousel.

## Rules

- **Voice.** Follow the account's section in the accounts file and the voice file.
  - A person whose voice is `company` writes in the company voice in first person: "I", and "we" for the company, with no personal stories, until their own voice file exists.
  - The company page (role line starting with "company") writes "we", never "I".
- **Start from the card's Ask.** Change it only if the post needs it. If it changes and the visual is a carousel, edit the `ask` slide in `slots.json` so its question matches the caption's final question word for word, then re-render: `python3 KIT/render.py <post folder>/slots.json`. For a person, the carousel's last slide `cta` reads "Tell me in the comments." Change nothing else on the visual.
- **Every claim and every number** is in the card, numbers as digits, nothing rounded differently. No added facts, however plausible.
- **Quotes** only from the card's `real_moments` or `said_in`, word for word.
- **No invented first-person material:** no scenes, customers, conversations or experiences that are not in the card or the profile's standing facts.
- **The hook** (everything before the first blank line) is under 210 characters, at most 3 lines, and is not the visual's headline.
- **One ask,** at the end. No other question to the reader in the caption.
- No links, hashtags, emojis or em dashes in the caption. Links go in the first comment.
- No label line saying who built what, beyond the profile's standing facts.
- The company-wide filters: nothing from never claim, the compliance rules hold, no customer names, banned words from the company voice and the profile's voice file.
- Alt text for every image.

When the profile's posts are done, self-check with `python3 KIT/gate.py posts MC --allow-token` and fix every line it reports for your folders.

**The article.** If you are the article author's writer, write the article after your posts, with `REF/article-write-brief.md`, in the same voice.

## Redo

- You get every earlier fail reason for each post. Fix each one.
- Never bring back something an earlier review asked to remove.
- Rewrite only the posts you are given; leave the others as they are.

## Return

One JSON line per post (and one for the article if you wrote it), nothing else:
`{"piece": "P03", "status": "pass", "paths": ["<post folder>/post.md"], "fail_reasons": []}`
Use `"status": "fail"` with the reasons if you could not make a post meet the rules.
