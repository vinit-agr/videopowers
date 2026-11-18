"""Builds a small, self-contained content workspace for tests (never the real one)."""
from __future__ import annotations

import json
import re
import textwrap
from pathlib import Path

from PIL import Image

RESEARCH = textwrap.dedent("""\
    # Research
    Marlow and colleagues followed **235 people** who called an outpatient dental clinic.
    > Of 235 people who called, only the days until the appointment predicted attendance.
    One person said: “Maybe I won't feel like I need help next week.”
    A dental practice in Orlando stopped requiring forms and let people walk in;
    bookings went from 10 to 20 a week. See [the report](https://example.org/r).
    """)

POST = textwrap.dedent("""\
    ---
    piece: fixture-video-{id}
    account: {account}
    format: {fmt}
    caption_shape: story
    hook_type: number-first
    ask_type: own-number
    ---
    # fixture-video-{id} · {account} · {fmt}

    Upload: {upload}
    Document title: Who shows up

    ## Post
    ```text
    {caption}
    ```

    ## First comment
    ```text
    The full video, with every study linked: {{{{VIDEO_POST_URL}}}}
    ```

    ## Alt text
    - Image 1: A list of things about a caller.
    """)

CAPTION = "235 people called an dental clinic. One thing predicted who showed up.\n\nIt was not age. It was the days until the appointment.\n\nHow many days from yes to the first appointment at your practice?"




TWELVE = tuple(f"P{i:02d}" for i in range(1, 13))
_FORMATS = ("infographic", "carousel")
_BUCKETS = ("problem", "options", "us", "buying")

CARD_V2 = textwrap.dedent("""\
    ---
    id: {id}
    idea: "Only the days until the appointment predicted who showed up."
    format: {fmt}
    bucket: {bucket}
    persona: owner
    step: 2
    idea_type: surprising number
    product: none
    points_to_offer: false
    customer_story: false
    scores: {{stands_alone: pass, hook: 4, retain: 4, reward: 3, true: pass, total: 11}}
    repeat_flag: ""
    why_picked: "A clean number the owner can act on."
    findings: [{finding}]
    numbers:
      - {{value: "235", source: s1}}
      - {{value: "doubled", source: s1, derived: "10 to 20 bookings"}}
    sources:
      - {{id: s1, title: "Marlow et al.", year: 1995, link: "https://example.org/f", tier: T1, file: "research.md"}}
    excerpts:
      - {{source: s1, text: "Of 235 people who called, only the days until the appointment predicted attendance."}}
      - {{source: s1, text: "bookings went from 10 to 20 a week"}}
    real_moments:
      - {{source: s1, text: "\\"Maybe I won't feel like I need help next week.\\""}}
    said_in: []
    ---
    ## Hook
    6 things about a caller. Only 1 predicted who showed up.

    ## Retain
    The guess, the answer.

    ## Reward
    The one thing a practice can change.

    ## Ask
    How many days from yes to the first appointment?

    ## Proof
    235 people called an outpatient dental clinic (Marlow et al., 1995).

    ## Visual plan
    {fmt}, light theme.
    """)

PLAN_V2 = textwrap.dedent("""\
    ---
    id: A01
    format: article
    mention: [sam]
    title_choice: ""
    numbers:
      - {value: "235", source: s1}
    sources:
      - {id: s1, title: "Marlow et al.", year: 1995, link: "https://example.org/f", tier: T1, file: "research.md"}
    excerpts:
      - {source: s1, text: "Of 235 people who called, only the days until the appointment predicted attendance."}
    ---
    ## Title options
    1. Who shows up after a call
    2. The days between yes and the first visit

    ## Subtitle options
    1. What 235 callers say about waiting

    ## Why this structure
    A guess first, then the answer.

    ## Sections
    ### 1. The guess
    Purpose: let the reader guess what predicts attendance.
    Beats: the list of caller traits.
    Uses: s1
    Figure: figure-1

    ### 2. The answer
    Purpose: show the one thing that predicted attendance.
    Beats: the days until the appointment.
    Uses: s1
    Figure: figure-2

    ## Close
    Count the days from yes to the first appointment.
    """)

_DETAILS = textwrap.dedent("""\
    # Details
    ## Products
    ```products
    chat
    voice
    both
    none
    ```

    ## Default audience
    Owners and office managers at dental practices.

    ## Approved proof
    - A practice reached $2M with the product.

    ## Never claim
    - Customer names.
    """)

_FRAMEWORK = textwrap.dedent("""\
    # Framework
    | Bucket | Steps | Target share |
    |---|---|---|
    | problem | 1-2 | 30% |
    | options | 3 | 25% |
    | us | 4 | 25% |
    | buying | 5 | 20% |
    """)

_ACCOUNTS_V2 = textwrap.dedent("""\
    # Accounts
    ## Accounts
    | id | name | role | voice |
    |---|---|---|---|
    | alex | Alex Rivera | founder | workspace/profiles/alex/voice-writing.md |
    | sam | Sam Lee | sales | workspace/profiles/sam/voice-writing.md |
    | jordan | Jordan | sales | company |
    | acme | Acme | company page; research and summaries | company |

    ## Settings
    - posts per profile: 3
    - article author: alex
    """)

_VOICE_V2 = textwrap.dedent("""\
    # Company voice
    ```banned-words
    game-changer
    leverage
    leads
    closure
    ```
    ```banned-chars
    —
    EMOJI
    ```
    ```allowed-numbers
    24/7
    ```

    ## Liked posts
    ```text
    235 people called an dental clinic. One thing predicted who showed up.
    ```
    """)

_VIDEOPOWERS_V2 = (
    "# videopowers workspace\n\n## Paths\n- profile: workspace/org/details.md\n- framework: workspace/org/framework.md\n"
    "- product facts: workspace/org/product-facts.md\n- videos: videos/\n\n"
    "## Atomize\n- accounts: workspace/profiles/accounts.md\n- company voice: workspace/profiles/acme/voice-writing.md\n"
    "- brand: workspace/brand/\n- ledger: workspace/records/ledger.csv\n- findings: workspace/records/findings.csv\n"
    "- posts: workspace/records/posts.csv\n- personas: workspace/org/details.md\n"
    "- scoring notes: workspace/learning/scoring-notes.md\n- matching rules: workspace/learning/matching-notes.md\n"
    "- quality bar: workspace/learning/quality-bar-notes.md\n"
    "- atomize feedback log: workspace/learning/atomize-feedback-log.md\n"
    "- final-cut words: videos/<video>/mg/**/words*.json\n")


def _write_slides(d: Path, fmt: str) -> None:
    n = {"infographic": 1, "carousel": 5}[fmt]
    slides = []
    for i in range(1, n + 1):
        p = d / f"slide-{i:02d}.png"
        Image.new("RGB", (40, 50), "white").save(p)
        slides.append(str(p))
    files = slides
    if fmt == "carousel":
        pdf = d / "carousel.pdf"
        Image.new("RGB", (40, 50), "white").save(pdf)
        files = [str(pdf)]
    report = {"ok": True, "errors": [], "overflow": [], "font_ok": True, "files": files, "slides": slides,
              "text": "Things about a caller\n235 people called\nMarlow et al. 1995",
              "headline": "6 things about a caller. Only 1 predicted who showed up.", "source": "Marlow et al. 1995"}
    (d / "report.json").write_text(json.dumps(report))
    (d / "slots.json").write_text(json.dumps({"kind": fmt, "theme": "light", "source": "Marlow et al. 1995", "slides": [{"template": "stat"}] * n}))


def _write_item(d: Path, pid: str, fmt: str, bucket: str, finding: str) -> None:
    d.mkdir(parents=True)
    (d / "card.md").write_text(CARD_V2.format(id=pid, fmt=fmt, bucket=bucket, finding=finding))
    _write_slides(d, fmt)
    (d / "visual-review.json").write_text(json.dumps({"post": pid, "status": "pass", "checks": {}, "fail_reasons": []}))


def make_tree(root: Path, posts=TWELVE, backups=("B1", "B2", "B3", "B4"), plan: bool = True,
                 index_backups: tuple | None = None) -> Path:
    """Content root `root/content` in the v2 layout. No records files, no notes files, no brand.json."""
    c = Path(root) / "content"
    (c / "videopowers.md").parent.mkdir(parents=True, exist_ok=True)
    (c / "videopowers.md").write_text(_VIDEOPOWERS_V2)
    files = {
        "workspace/org/details.md": _DETAILS,
        "workspace/org/framework.md": _FRAMEWORK,
        "workspace/profiles/accounts.md": _ACCOUNTS_V2,
        "workspace/profiles/acme/voice-writing.md": _VOICE_V2,
        "workspace/profiles/alex/voice-writing.md": "# Alex\n",
        "workspace/profiles/sam/voice-writing.md": "# Sam\n\n```banned-words\nAlex\n```\n",
    }
    for rel, text in files.items():
        f = c / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(text)
    (c / "workspace" / "brand").mkdir(parents=True, exist_ok=True)
    v = c / "videos" / "01-fixture-video"
    v.mkdir(parents=True)
    (v / "research.md").write_text(RESEARCH)
    (v / "script.md").write_text("# Script\n\nAt night, nobody picks up the phone.\n")
    mc = v / "microcontent"
    for i, pid in enumerate(posts):
        fmt, bucket = _FORMATS[i % 2], _BUCKETS[i % 4]
        _write_item(mc / "posts" / f"{pid}-idea-{pid.lower()}", pid, fmt, bucket, "F-marlow-1995-days")
    for i, b in enumerate(backups):
        fmt, bucket = _FORMATS[i % 2], _BUCKETS[i % 4]
        _write_item(mc / "backups" / f"{b}-idea-{b.lower()}", b, fmt, bucket, f"F-marlow-1995-{b.lower()}")
    if plan:
        a = mc / "article"
        a.mkdir(parents=True)
        (a / "plan.md").write_text(PLAN_V2)
        for sub in ("cover", "figure-1", "figure-2"):
            d = a / sub
            d.mkdir()
            png = d / "image.png"
            Image.new("RGB", (40, 50), "white").save(png)
            (d / "report.json").write_text(json.dumps({
                "ok": True, "errors": [], "overflow": [], "font_ok": True, "files": [str(png)], "slides": [str(png)],
                "text": "235 people called\nMarlow et al. 1995", "headline": "235 people called", "source": "Marlow et al. 1995"}))
            (d / "slots.json").write_text(json.dumps({"kind": "infographic", "theme": "light", "source": "Marlow et al. 1995", "slides": [{"template": "stat"}]}))
    ib = backups if index_backups is None else index_backups
    (mc / "index.md").write_text(f"# Microcontent\n\nbackups: {', '.join(ib)}\nvisuals: done\nreviewed: 2026-11-20\n")
    rows = ["| id | idea | hook | retain | reward | total | result | why |", "|---|---|---|---|---|---|---|---|"]
    results = list(TWELVE) + ["B1", "B2", "B3", "B4"] + ["not picked", "not picked"]
    for n, res in enumerate(results, 1):
        rows.append(f"| C{n:02d} | idea {n} | 4 | 4 | 3 | 11 | {res} | fixture |")
    (mc / "candidates.md").write_text("# Candidates\n\n" + "\n".join(rows) + "\n")
    return c


def write_post(mc: Path, pid: str, account: str, caption: str = CAPTION) -> Path:
    from_dir = None
    for sub in ("posts", "backups"):
        hits = sorted((Path(mc) / sub).glob(f"{pid}-*")) if (Path(mc) / sub).is_dir() else []
        if hits:
            from_dir = hits[0]
            break
    if from_dir is None:
        raise FileNotFoundError(pid)
    fmt = {"infographic": "infographic", "carousel": "carousel"}[
        next(l.split(":", 1)[1].strip() for l in (from_dir / "card.md").read_text().splitlines() if l.startswith("format:"))]
    report = json.loads((from_dir / "report.json").read_text())
    upload = ", ".join(Path(f).name for f in report["files"])
    p = from_dir / "post.md"
    p.write_text(POST.format(id=pid, account=account, fmt=fmt, caption=caption, upload=upload))
    return p


def write_article(mc: Path, body: str | None = None) -> Path:
    """article/article.html that passes gate.cmd_article on the v2 tree (needs the plan and the rendered figures)."""
    a = Path(mc) / "article"
    if body is None:
        body = ("<p>Of 235 people who called, only the days until the appointment predicted attendance.</p>"
                "<p>Marlow and colleagues followed them in 1995 and the pattern held.</p>"
                "<p>[Image: figure-1/slide-01.png]</p>"
                "<p>How many days from yes to the first appointment at your practice?</p>"
                "<p>The full video: {{VIDEO_POST_URL}}</p>")
    p = a / "article.html"
    p.write_text('<section id="publish-info"><p data-field="title">Who shows up after a call</p>'
                 f'<p data-field="seo">{"x" * 150}</p><p data-field="share">Who shows up after a call.</p></section>{body}')
    return p


def write_review(folder: Path, status: str = "pass", liked: int = 4) -> Path:
    review = {"post": Path(folder).name.split("-")[0], "status": status, "reading": "line 1\nline 2\nline 3",
              "checks": {"stands_alone": "pass", "hook": "pass", "nothing_invented": "pass", "compliance": "pass",
                         "liked_posts": {"score": liked, "note": "fixture"},
                         "voice_fit": {"score": 4, "note": "fixture", "rubric": "fixture"}},
              "fail_reasons": [] if status == "pass" else ["fixture"]}
    p = Path(folder) / "review.json"
    p.write_text(json.dumps(review))
    return p


def write_scores(mc: Path, overrides: dict | None = None, default: int = 3) -> Path:
    mc = Path(mc)
    idx = (mc / "index.md").read_text()
    backups = set()
    for line in idx.splitlines():
        if line.startswith("backups:"):
            backups = {b.strip() for b in line.split(":", 1)[1].split(",") if b.strip()}
    accounts = ["alex", "sam", "jordan", "acme"]
    scores = {}
    for d in sorted((mc / "posts").iterdir()):
        if not re.match(r"^[PB]\d+-", d.name):
            continue
        pid = d.name.split("-")[0]
        if pid in backups:
            continue
        scores[pid] = {a: {"score": (overrides or {}).get(pid, {}).get(a, default), "reason": "fixture"} for a in accounts}
    p = mc / "match.json"
    p.write_text(json.dumps({"scores": scores}))
    return p
