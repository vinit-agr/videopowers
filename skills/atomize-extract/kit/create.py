"""Stage 2 (atomize-create) kit: the stage 1 check, the matching solver and the match command.

    create.py check MC [--test]
    create.py match MC [--rematch] [--test]
    create.py swap MC <failed> <backup> [--test]
    create.py handover MC [--link URL] [--test]
    create.py link MC <URL> [--test]

The solver gives each profile exactly per_profile posts. It maximises, in
order: the fit sum, the format-spread bonus, then the fit total of
profiles[0], profiles[1], and so on. A tie on all of these goes to the
smallest allocation vector (posts in id order, profiles as table indexes).
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

KIT = Path(__file__).resolve().parent
sys.path.insert(0, str(KIT))
import accounts as acc  # noqa: E402
import cards  # noqa: E402
import ledger  # noqa: E402
import paths  # noqa: E402

BONUS = {2: 1}
MAX_PER_PROFILE = 5  # card ids run P01-P15 plus B1-B5  # distinct formats in one profile's posts -> spread bonus


def solve(fit, formats, profiles, per_profile):
    posts = sorted(fit)
    if len(posts) != per_profile * len(profiles):
        raise ValueError(f"{len(posts)} posts for {len(profiles)} profiles x {per_profile}")
    bit = {f: 1 << i for i, f in enumerate(sorted(set(formats.values())))}
    n = len(profiles)
    # state: per profile (count, format mask) -> (additive vector, allocation)
    layer = {tuple((0, 0) for _ in profiles): ((0,) * (n + 1), ())}
    for post in posts:
        b = bit[formats[post]]
        nxt = {}
        for state, (vec, asg) in layer.items():
            for j, prof in enumerate(profiles):
                c, m = state[j]
                if c == per_profile:
                    continue
                s = fit[post][prof]
                ns = state[:j] + ((c + 1, m | b),) + state[j + 1:]
                nv = list(vec)
                nv[0] += s
                nv[j + 1] += s
                nv = tuple(nv)
                na = asg + (j,)
                cur = nxt.get(ns)
                if cur is None or nv > cur[0] or (nv == cur[0] and na < cur[1]):
                    nxt[ns] = (nv, na)
        layer = nxt

    def rank(item):
        state, (vec, asg) = item
        bonus = sum(BONUS.get(bin(m).count("1"), 0) for _, m in state)
        return (tuple(-x for x in (vec[0], bonus) + vec[1:]), asg)

    _, (_, asg) = min(layer.items(), key=rank)
    return {p: profiles[j] for p, j in zip(posts, asg)}


def totals(allocation, fit, formats, profiles):
    by_account = {a: 0 for a in profiles}
    seen = {a: set() for a in profiles}
    for post, acc in allocation.items():
        by_account[acc] += fit[post][acc]
        seen[acc].add(formats[post])
    spread = sum(BONUS.get(len(s), 0) for s in seen.values())
    return {"fit": sum(by_account.values()), "spread": spread, "by_account": by_account}


# ---------- check ----------

NO_BACKUPS = ("", "none", "-", "n/a")  # words on the backups: line that mean no backups
LATER = ("made", "matched", "written", "ready", "waiting-for-link", "extra", "handed-over", "scheduled", "posted")


def read_index(mc: Path) -> dict:
    """The three closing lines of index.md."""
    out = {"visuals_done": False, "reviewed": None, "backups": []}
    f = Path(mc) / "index.md"
    if not f.is_file():
        return out
    for line in f.read_text().splitlines():
        key, _, val = line.partition(":")
        val = val.strip()
        if key == "backups":
            out["backups"] = [b.strip() for b in val.split(",") if b.strip().lower() not in NO_BACKUPS]
        elif key == "visuals":
            out["visuals_done"] = val == "done"
        elif key == "reviewed":
            out["reviewed"] = val or None
    return out


def _stage1_posts(mc: Path, backups: list[str]) -> list[Path]:
    """Every P or B folder in posts/ whose id is not on the backups line (a backup promoted at stage 1 review counts)."""
    base = Path(mc) / "posts"
    if not base.is_dir():
        return []
    return sorted(d for d in base.iterdir()
                  if d.is_dir() and re.match(r"^[PB]\d+-", d.name) and d.name.split("-")[0] not in backups)


def check_stage1(mc: Path, test: bool = False) -> list[str]:
    mc = Path(mc)
    old = [n for n in ("pieces", "spares", "ready") if (mc / n).exists()]
    if old:
        return [f"old layout ({'/, '.join(old)}/): read-only, not supported"]
    errs: list[str] = []
    idx = mc / "index.md"
    text = idx.read_text() if idx.is_file() else ""
    if not idx.is_file():
        errs.append("index.md missing")
    else:
        if not re.search(r"^backups:", text, re.M):
            errs.append("index.md has no 'backups:' line")
        if not read_index(mc)["visuals_done"]:
            errs.append("index.md has no 'visuals: done' line (part 2 of stage 1 is not finished)")
        if not read_index(mc)["reviewed"]:
            errs.append("index.md has no 'reviewed: <date>' line (the review is not finished)")
    backups = read_index(mc)["backups"]
    posts = _stage1_posts(mc, backups)
    if not posts:
        errs.append("no post folders in posts/")
    for d in posts:
        pid = d.name.split("-")[0]
        if not (d / "card.md").is_file():
            errs.append(f"{pid}: no card.md")
        vr = d / "visual-review.json"
        try:
            ok = vr.is_file() and json.loads(vr.read_text()).get("status") == "pass"
        except (ValueError, AttributeError):
            ok = False
        if not ok:
            errs.append(f"{pid}: visual-review.json missing or not pass")
    plan = mc / "article" / "plan.md"
    if not plan.is_file():
        errs.append("article/plan.md missing")
    else:
        try:
            figs = cards.plan_figures(cards.load_plan(plan))
        except (ValueError, OSError) as e:
            figs = []
            errs.append(f"article/plan.md: {e}")
        for sub in ["cover", *figs]:
            if not (mc / "article" / sub / "report.json").is_file():
                errs.append(f"article/{sub}/report.json missing")
    if not test:
        pp = paths.atomize_paths(mc)["posts"]
        slug = paths.video_slug(mc.parent)
        rows = {r["post_id"]: r["status"] for r in ledger.read_table(pp, ledger.POST_COLUMNS)}
        wanted = [(d.name.split("-")[0], LATER) for d in posts] + [(b, ("backup", "dropped") + LATER) for b in backups]
        for pid, ok in wanted:
            st = rows.get(f"{slug}-{pid}")
            if st is None:
                errs.append(f"{pid}: no row in posts.csv (run ledger.py add MC --status made)")
            elif st not in ok:
                hint = " (run ledger.py add MC --status made)" if st == "extracted" else ""
                errs.append(f"{pid}: row status is {st!r}, expected {' or '.join(ok[:2])}{hint}")
    return errs


# ---------- match ----------

def _read_match(mc: Path) -> dict:
    f = Path(mc) / "match.json"
    if not f.is_file():
        return {}
    try:
        data = json.loads(f.read_text())
    except ValueError as e:
        raise ValueError(f"match.json is not valid JSON: {e}")
    return data if isinstance(data, dict) else {}


def _score_errors(scores: dict, posts: list[str], accounts: list[str]) -> list[str]:
    errs = []
    for p in posts:
        row = scores.get(p)
        row = row if isinstance(row, dict) else {}
        for a in accounts:
            cell = row.get(a)
            if not isinstance(cell, dict):
                errs.append(f"{p}/{a}: missing")
                continue
            s = cell.get("score")
            if isinstance(s, bool) or not isinstance(s, int) or not 1 <= s <= 5:
                errs.append(f"{p}/{a}: score must be a whole number from 1 to 5, got {s!r}")
            if not str(cell.get("reason") or "").strip():
                errs.append(f"{p}/{a}: reason is empty")
        errs += [f"{p}/{a}: unknown account" for a in row if a not in accounts]
    return errs


def move_post_dir(src: Path, dest: Path) -> None:
    """Rename a post folder and point the paths in its report.json at the new folder."""
    src.rename(dest)
    rep = dest / "report.json"
    if not rep.is_file():
        return
    r = json.loads(rep.read_text())
    for key in ("files", "slides"):
        if isinstance(r.get(key), list):
            r[key] = [str(dest / Path(f).name) if Path(f).parent.name == src.name else f for f in r[key]]
    rep.write_text(json.dumps(r, indent=2))


def match(mc: Path, rematch: bool = False, test: bool = False) -> dict:
    mc = Path(mc).resolve()
    errs = check_stage1(mc, test)
    if errs:
        raise ValueError("\n".join(errs))
    data = _read_match(mc)
    old_alloc = data.get("allocation") or {}
    if old_alloc and not rematch:
        return data
    p = paths.atomize_paths(mc)
    profiles = [a["id"] for a in acc.load_accounts(p["accounts"])]
    posts = sorted(old_alloc) if old_alloc else [d.name.split("-")[0] for d in _stage1_posts(mc, read_index(mc)["backups"])]
    gone = [pid for pid in posts if paths.find_post_dir(mc, pid, ("posts",)) is None]  # dropped after the match
    posts = [pid for pid in posts if pid not in gone]
    per = acc.settings(p["accounts"])["posts_per_profile"]
    if len(posts) == per * len(profiles):
        pass
    elif len(posts) % len(profiles) == 0 and 2 <= len(posts) // len(profiles) <= MAX_PER_PROFILE:
        per = len(posts) // len(profiles)  # the user kept more or fewer posts than the setting
    else:
        note = f" (no longer in posts/: {', '.join(gone)})" if gone else ""
        raise ValueError(f"{len(posts)} posts for {len(profiles)} profiles: need the same number for each, "
                         f"2 to {MAX_PER_PROFILE}{note}")
    scores = data.get("scores") or {}
    errs = _score_errors(scores, posts, profiles)
    formats = {}
    for pid in posts:
        d = paths.find_post_dir(mc, pid, ("posts",))
        fmt = str(cards.load(d / "card.md").get("format") or "").strip() if d else ""
        if not fmt:
            errs.append(f"{pid}: no format in card.md")
        formats[pid] = fmt
    if errs:
        raise ValueError("\n".join(errs))
    fit = {pid: {a: scores[pid][a]["score"] for a in profiles} for pid in posts}
    alloc = solve(fit, formats, profiles, per)
    # folders: <id>-<account>-<idea slug>; a changed account loses the written post and its review
    changed = []
    for pid in posts:
        d = paths.find_post_dir(mc, pid, ("posts",))
        before = paths.folder_account(d.name, profiles)
        if before != alloc[pid] and (before is not None or not old_alloc):
            changed.append(pid)
        if before is not None and before != alloc[pid]:
            for n in ("post.md", "review.json"):
                (d / n).unlink(missing_ok=True)
        target = d.with_name(f"{pid}-{alloc[pid]}-{paths.idea_slug(d.name, profiles)}")
        if target != d:
            move_post_dir(d, target)
    out = {k: v for k, v in data.items() if k not in ("scores", "per_profile", "allocation", "totals", "swaps")}
    out.update({"scores": {pid: {a: scores[pid][a] for a in profiles} for pid in posts}, "per_profile": per,
                "allocation": alloc, "totals": totals(alloc, fit, formats, profiles), "swaps": data.get("swaps") or []})
    (mc / "match.json").write_text(json.dumps(out, indent=2) + "\n")
    slug = paths.video_slug(mc.parent)
    for pid in posts:
        ids = [f"{slug}-{pid}"]
        if pid in changed or test:
            ledger.set_status(p["posts"], ids, "matched", test=test, account=alloc[pid])
        else:
            ledger.set_status(p["posts"], ids, _keep(p["posts"], ids[0]), account=alloc[pid])
    return out


def _keep(posts_csv: Path, full_id: str) -> str:
    """The status a row already holds (a rematch leaves unchanged posts as they are)."""
    return next((r["status"] for r in ledger.read_table(posts_csv, ledger.POST_COLUMNS) if r["post_id"] == full_id), "matched")


# ---------- swap ----------

def swap(mc: Path, failed_id: str, backup_id: str, test: bool = False) -> Path:
    """Replace a post that failed review with a backup for the same profile. Returns the backup's new folder."""
    mc = Path(mc).resolve()
    data = _read_match(mc)
    alloc = data.get("allocation") or {}
    if failed_id not in alloc:
        raise ValueError(f"{failed_id} is not in the allocation (run create.py match first)")
    if backup_id not in read_index(mc)["backups"]:
        raise ValueError(f"{backup_id} is not a backup (index.md 'backups:' line)")
    if backup_id in alloc:
        raise ValueError(f"{backup_id} is already allocated")
    if any((mc / "dropped").glob(f"{backup_id}-*")):
        raise ValueError(f"{backup_id} is in dropped/")
    p = paths.atomize_paths(mc)
    full = f"{paths.video_slug(mc.parent)}-{backup_id}"
    if not test:
        row = next((r for r in ledger.read_table(p["posts"], ledger.POST_COLUMNS) if r["post_id"] == full), None)
        if row is None or row["status"] != "backup":
            raise ValueError(f"{backup_id}: posts.csv row is {row['status'] if row else 'missing'!r}, expected 'backup'")
    src = paths.find_post_dir(mc, backup_id, ("backups", "posts"))
    if src is None:
        raise ValueError(f"no folder for {backup_id} in backups/ or posts/")
    account = alloc[failed_id]
    profiles = [a["id"] for a in acc.load_accounts(p["accounts"])]
    dest = mc / "posts" / f"{backup_id}-{account}-{paths.idea_slug(src.name, profiles)}"
    if dest.exists():
        raise ValueError(f"{dest} already exists")
    ledger.drop_post(mc, failed_id, f"swapped for {backup_id}", test)
    lead = (cards.load(src / "card.md").get("findings") or [""])[0] if (src / "card.md").is_file() else ""
    move_post_dir(src, dest)
    data["allocation"] = {k: v for k, v in alloc.items() if k != failed_id}
    data["allocation"][backup_id] = account
    data["swaps"] = (data.get("swaps") or []) + [
        {"failed": failed_id, "backup": backup_id, "account": account, "date": date.today().isoformat()}]
    (mc / "match.json").write_text(json.dumps(data, indent=2) + "\n")
    ledger.set_status(p["posts"], [full], "matched", test=test, account=account)
    if lead and not test and lead in {f["finding_id"] for f in ledger.read_table(p["findings"], ledger.FINDING_COLUMNS)}:
        ledger.upsert_findings([{"finding_id": lead, "last_led_date": date.today().isoformat()}], p["findings"])
    return dest

# ---------- link, pick_best, handover ----------

TOKEN = "{{VIDEO_POST_URL}}"


def find_link(mc: Path, link: str | None = None) -> str | None:
    """The argument, else video-link.txt, else 'LinkedIn video post: <url>' in the video's packaging.md."""
    mc = Path(mc)
    if link and link.strip():
        return link.strip()
    f = mc / "video-link.txt"
    if f.is_file() and f.read_text().strip():
        return f.read_text().strip()
    pk = mc.parent / "packaging.md"
    if pk.is_file():
        m = re.search(r"LinkedIn video post:\s*(\S+)", pk.read_text())
        if m:
            return m.group(1)
    return None


def fill_link(mc: Path, url: str) -> list[Path]:
    """Put url where the token is, and where the previous url from video-link.txt is. Returns the files changed."""
    mc = Path(mc)
    f = mc / "video-link.txt"
    prev = f.read_text().strip() if f.is_file() else ""
    targets = (sorted(mc.glob("posts/*/post.md")) + sorted(mc.glob("backups/*/post.md"))
               + [mc / "article" / "article.html", mc / "article" / "publish.md", mc / "handover.md"])
    changed = []
    for t in targets:
        if not t.is_file():
            continue
        text = t.read_text()
        new = text.replace(TOKEN, url)
        if prev and prev != url:
            new = new.replace(prev, url)
        if new != text:
            t.write_text(new)
            changed.append(t)
    f.write_text(url + "\n")
    return changed


def _liked(review: dict) -> int:
    try:
        return int(review["checks"]["liked_posts"]["score"])
    except (KeyError, TypeError, ValueError):
        return 0


def pick_best(posts: list[str], reviews: dict[str, dict], fit: dict[str, int], keep: int) -> tuple[list[str], list[str]]:
    """Best first: liked-posts score, then fit score (both high first), then post id. Returns (kept, extras)."""
    order = sorted(posts, key=lambda p: (-_liked(reviews.get(p, {})), -fit.get(p, 0), p))
    return order[:keep], order[keep:]


def _review(d: Path) -> dict:
    try:
        r = json.loads((d / "review.json").read_text())
    except (OSError, ValueError):
        return {}
    return r if isinstance(r, dict) else {}


def _first_line(post_md: Path) -> str:
    m = re.search(r"^## Post\s*\n```text\n(.*?)\n```", post_md.read_text(), re.S | re.M)
    return m.group(1).strip().splitlines()[0] if m and m.group(1).strip() else ""


def _field(post_md: Path, key: str) -> str:
    m = re.search(rf"^{key}:[ \t]*(.*)$", post_md.read_text(), re.M)
    return m.group(1).strip() if m else ""


def _article_title(html_file: Path) -> str:
    m = re.search(r'<p data-field="title">(.*?)</p>', html_file.read_text(), re.S)
    return re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else ""


PUBLISH = """# Publish the article: {slug}

Images are in `article/cover/` and `article/figure-N/` (one folder per figure).

1. Open `article/article.html` (in the video's microcontent folder) in a browser.
2. On LinkedIn: Write article, choose the newsletter. Paste the title, upload the cover from `article/cover/`, then copy everything below the publish block into the editor.
3. At each `[Image: ...]` line, upload that file from `article/figure-N/` and delete the line.
4. Paste the SEO description from the publish block, and use the share text as the post text when you publish.
"""


def handover(mc: Path, link: str | None = None, test: bool = False) -> Path:
    mc = Path(mc).resolve()
    data = _read_match(mc)
    alloc = data.get("allocation") or {}
    if not alloc:
        raise ValueError("match.json has no allocation (run create.py match first)")
    p = paths.atomize_paths(mc)
    accounts = acc.load_accounts(p["accounts"])
    ids = [a["id"] for a in accounts]
    names = {a["id"]: a["name"] for a in accounts}
    per = data.get("per_profile") or acc.settings(p["accounts"])["posts_per_profile"]
    scores = data.get("scores") or {}
    dirs = {pid: paths.find_post_dir(mc, pid, ("posts",)) for pid in alloc}
    dirs = {pid: d for pid, d in dirs.items() if d is not None}  # no longer in posts/: dropped
    bad = [pid for pid, d in sorted(dirs.items())
           if not (d / "post.md").is_file() or _review(d).get("status") != "pass"]
    if bad:
        raise ValueError(f"no post.md or no passing review.json for {', '.join(bad)}: swap or drop first")
    art = mc / "article"
    if not (art / "article.html").is_file() or _review(art).get("status") != "pass":
        raise ValueError("article: needs article/article.html and a passing article/review.json")
    reviews = {pid: _review(d) for pid, d in dirs.items()}
    by = {a: sorted(pid for pid in dirs if alloc[pid] == a) for a in ids}
    kept, extras = {}, []
    if any(len(v) < per for v in by.values()):
        short = {a: len(v) for a, v in by.items() if len(v) < 2}
        if short:
            raise ValueError("fewer than 2 passing posts for " + ", ".join(f"{a} ({n})" for a, n in short.items())
                             + ": stop and ask")
        for a in ids:
            fit = {pid: (scores.get(pid, {}).get(a, {}) or {}).get("score", 0) for pid in by[a]}
            kept[a], ex = pick_best(by[a], reviews, fit, 2)
            extras += ex
    else:
        kept = by
    for a in ids:  # suggested order
        kept[a] = sorted(kept[a], key=lambda pid: (-_liked(reviews[pid]), pid))
    lines = [f"# Hand-over: {paths.video_slug(mc.parent)}", ""]
    firsts = {}
    for a in ids:
        lines += [f"## {names[a]} ({len(kept[a])} posts)", ""]
        for pid in kept[a]:
            pm = dirs[pid] / "post.md"
            firsts[pid] = _first_line(pm)
            lines.append(f'posts/{dirs[pid].name}/ \u00b7 {_field(pm, "format")} \u00b7 upload: {_field(pm, "Upload")} \u00b7 "{firsts[pid]}"')
        lines.append("")
    lines += ["## Article", "", "Steps and images: `article/publish.md`", "", "## Kept for later", ""]
    lines += [f"posts/{dirs[pid].name}/ ({names[alloc[pid]]})" for pid in sorted(extras)] or ["None."]
    lines += ["", "## Swaps and drops", ""]
    swaps = data.get("swaps") or []
    notes = [f"{s['failed']} swapped for {s['backup']} ({s.get('date', '')})" for s in swaps]
    swapped = {s.get("failed") for s in swaps}
    for d in sorted((mc / "dropped").glob("*/")) if (mc / "dropped").is_dir() else []:
        if d.name.split("-")[0] in swapped:
            continue  # already listed as a swap
        r = d / "reason.txt"
        notes.append(f"dropped/{d.name}/: {r.read_text().strip() if r.is_file() else 'no reason written'}")
    lines += [f"- {n}" for n in notes] or ["None."]
    out = mc / "handover.md"
    out.write_text("\n".join(lines) + "\n")
    (art / "publish.md").write_text(PUBLISH.format(slug=paths.video_slug(mc.parent)))
    url = find_link(mc, link)
    if url:
        fill_link(mc, url)
    slug = paths.video_slug(mc.parent)
    today = date.today().isoformat()
    status = "ready" if url else "waiting-for-link"
    author = acc.settings(p["accounts"])["article_author"]
    handed = [(pid, firsts[pid], alloc[pid]) for a in ids for pid in kept[a]]
    handed.append(("A01", _article_title(art / "article.html"), author))
    for pid, first, account in handed:
        full = f"{slug}-{pid}"
        if test:
            ledger.set_status(p["posts"], [full], status, test=True, first_line=first)
        else:
            ledger.set_status(p["posts"], [full], status, first_line=first, handed_over_date=today, account=account)
    if extras and not test:
        ledger.set_status(p["posts"], [f"{slug}-{pid}" for pid in extras], "extra")
    return out


def link(mc: Path, url: str, test: bool = False) -> int:
    """Fill the link everywhere, run both gates; if both pass, this video's waiting-for-link rows become ready."""
    mc = Path(mc).resolve()
    fill_link(mc, url)
    code = 0
    for mode in ("posts", "article"):
        r = subprocess.run([sys.executable, str(KIT / "gate.py"), mode, str(mc)], capture_output=True, text=True)
        sys.stdout.write(r.stdout)
        sys.stderr.write(r.stderr)
        code |= r.returncode
    if code or test:
        return code
    p = paths.atomize_paths(mc)
    slug = paths.video_slug(mc.parent)
    waiting = [r["post_id"] for r in ledger.read_table(p["posts"], ledger.POST_COLUMNS)
               if r["video"] == slug and r["status"] == "waiting-for-link"]
    if waiting:
        ledger.set_status(p["posts"], waiting, "ready")
    return 0


def rebuild_review(mc: Path) -> None:
    """Refresh the review page after a hand-over or a link; a failure here never fails the command."""
    import review
    try:
        print(review.build_review(mc))
    except (OSError, ValueError) as e:
        print(f"review page not rebuilt: {e}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="create.py", description="atomize-create kit")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check")
    c.add_argument("mc")
    c.add_argument("--test", action="store_true")
    m = sub.add_parser("match")
    m.add_argument("mc")
    m.add_argument("--rematch", action="store_true")
    m.add_argument("--test", action="store_true")
    w = sub.add_parser("swap")
    w.add_argument("mc")
    w.add_argument("failed")
    w.add_argument("backup")
    w.add_argument("--test", action="store_true")
    h = sub.add_parser("handover")
    h.add_argument("mc")
    h.add_argument("--link")
    h.add_argument("--test", action="store_true")
    k = sub.add_parser("link")
    k.add_argument("mc")
    k.add_argument("url")
    k.add_argument("--test", action="store_true")
    a = ap.parse_args(argv)
    try:
        mc = ledger._resolve_mc(a.mc)
    except (ValueError, OSError) as e:
        print(e)
        return 1
    if a.test and mc.name == "microcontent":
        print(f"a test run never writes into {mc}: copy it to a test folder (for example microcontent-test) and pass that")
        return 1
    if a.cmd == "link":
        try:
            rc = link(mc, a.url, a.test)
        except (ValueError, OSError) as e:
            print(e)
            return 1
        rebuild_review(mc)
        return rc
    if a.cmd == "handover":
        try:
            out = handover(mc, a.link, a.test)
        except (ValueError, OSError) as e:
            print(e)
            return 1
        print(out)
        rebuild_review(mc)
        return 0
    if a.cmd == "swap":
        try:
            d = swap(mc, a.failed, a.backup, a.test)
        except (ValueError, OSError) as e:
            print(e)
            return 1
        print(f"{a.backup} replaces {a.failed}: {d}")
        return 0
    if a.cmd == "check":
        errs = check_stage1(mc, a.test)
        for e in errs:
            print(e)
        return 1 if errs else 0
    try:
        out = match(mc, a.rematch, a.test)
    except ValueError as e:
        print(e)
        return 1
    print(json.dumps(out["totals"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
