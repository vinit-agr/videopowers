#!/usr/bin/env python3
"""The records: posts.csv (one row per post idea) and findings.csv (one row per finding), in the workspace.
Written only by the skills. A target is a video's microcontent folder (MC) or a video (slug or folder).

    ledger.py add MC --status extracted|made|test [--as-backup P11,P12]
    ledger.py recent-ideas <MC|video> [--n 40] [--exclude-video SLUG]
    ledger.py finding-recent <MC|video> [--weeks 6] [--exclude-video SLUG]
    ledger.py set-status MC --ids P01,P02 --status written [--test]
    ledger.py drop MC <id> --reason TEXT [--test]
    ledger.py purge MC --status test
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

KIT = Path(__file__).resolve().parent
sys.path.insert(0, str(KIT))
import paths  # noqa: E402

# ---------------------------------------------------------------- v2 records tables

LISTS = json.loads((KIT / "lists.json").read_text())
STATUSES: list[str] = LISTS["statuses"]
POST_COLUMNS = ["post_id", "video", "idea", "idea_type", "persona", "step", "bucket", "product", "findings", "format",
                "template", "theme", "account", "status", "first_line", "date", "handed_over_date", "posted_date", "url", "results"]
FINDING_COLUMNS = ["finding_id", "statement", "source_title", "year", "link", "file", "first_video", "videos_used",
                   "posts_used", "last_led_date"]
SEP = "; "
OVERWRITABLE = ("", "extracted", "made", "backup", "test")


def read_table(path: Path, columns: list[str]) -> list[dict]:
    p = Path(path)
    if not p.exists():
        return []
    with p.open(newline="") as f:
        return [{c: (r.get(c) or "") for c in columns} for r in csv.DictReader(f)]


def write_table(rows: list[dict], path: Path, columns: list[str]) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=p.parent, suffix=".csv")
    with os.fdopen(fd, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=columns)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in columns})
    os.replace(tmp, p)


def _check_status(status: str) -> None:
    if status not in STATUSES:
        raise ValueError(f"unknown status {status!r}; use one of {', '.join(STATUSES)}")


def _cell(v) -> str:
    return SEP.join(str(x) for x in v) if isinstance(v, (list, tuple)) else str(v)


def upsert_posts(rows: list[dict], path: Path) -> None:
    for n in rows:
        if n.get("status"):
            _check_status(n["status"])
    table = read_table(path, POST_COLUMNS)
    index = {r["post_id"]: r for r in table}
    for n in rows:
        pid = n["post_id"]
        if pid in index:
            old = index[pid]
            if n.get("status") == "test" and old["status"] not in ("", "test"):
                continue  # a test run never overwrites a real row
            for k, v in n.items():
                if k in POST_COLUMNS and v not in (None, ""):
                    old[k] = _cell(v)
        else:
            r = {c: _cell(n.get(c) or "") for c in POST_COLUMNS}
            table.append(r)
            index[pid] = r
    write_table(table, path, POST_COLUMNS)


def _union(a: str, b: str) -> str:
    out = [x for x in a.split(SEP) if x]
    out += [x for x in b.split(SEP) if x and x not in out]
    return SEP.join(out)


def upsert_findings(rows: list[dict], path: Path) -> None:
    table = read_table(path, FINDING_COLUMNS)
    index = {r["finding_id"]: r for r in table}
    for n in rows:
        fid = n["finding_id"]
        if fid not in index:
            r = {c: "" for c in FINDING_COLUMNS}
            r["finding_id"] = fid
            table.append(r)
            index[fid] = r
        old = index[fid]
        for k in ("statement", "source_title", "year", "link", "file", "first_video"):
            v = _cell(n.get(k) or "")
            if v and (k != "first_video" or not old[k]):
                old[k] = v
        for k in ("videos_used", "posts_used"):
            old[k] = _union(old[k], _cell(n.get(k) or ""))
        if "last_led_date" in n:
            old["last_led_date"] = _cell(n["last_led_date"] or "")
    write_table(table, path, FINDING_COLUMNS)


def set_status(path: Path, post_ids: list[str], status: str, test: bool = False, **fields) -> int:
    """Set status and fields on the rows named. In a test run only rows already marked test change,
    their status stays test, and only the fields are written. Returns the number of rows changed."""
    _check_status(status)
    bad = [k for k in fields if k not in POST_COLUMNS or k in ("post_id", "status")]
    if bad:
        raise ValueError(f"cannot set field(s): {', '.join(bad)}")
    table = read_table(path, POST_COLUMNS)
    wanted = set(post_ids)
    changed = 0
    for r in table:
        if r["post_id"] not in wanted or (test and r["status"] != "test"):
            continue
        if not test:
            r["status"] = status
        for k, v in fields.items():
            r[k] = _cell(v)
        changed += 1
    if changed:
        write_table(table, path, POST_COLUMNS)
    return changed


def purge(path: Path, status: str = "test", video: str | None = None) -> int:
    table = read_table(path, POST_COLUMNS)
    keep = [r for r in table if not (r["status"] == status and (video is None or r["video"] == video))]
    if len(keep) != len(table):
        write_table(keep, path, POST_COLUMNS)
    return len(table) - len(keep)


def _source_for(fid: str, card: dict) -> dict | None:
    m = re.match(r"^F-(.+?)-(\d{4})-", fid)
    if not m:
        return None
    author, year = m.group(1).lower(), m.group(2)
    for s in card.get("sources") or []:
        if str(s.get("year")) == year and author in str(s.get("title", "")).lower():
            return s
    return None


def finding_rows(card: dict, video: str, post_id: str, today: str) -> list[dict]:
    """One row per finding id on the card. The first (the lead) also gets last_led_date = today."""
    out = []
    for i, fid in enumerate(card.get("findings") or []):
        src = _source_for(fid, card)
        said = [s for s in card.get("said_in") or [] if isinstance(s, dict)]
        quote = next((str(s.get("quote") or s.get("text") or "") for s in said if (s.get("quote") or s.get("text"))), "")
        if src:
            ex = next((str(e.get("text", "")) for e in card.get("excerpts") or [] if e.get("source") == src.get("id")), "")
            fields = {"source_title": src.get("title", ""), "year": src.get("year", ""), "link": src.get("link", ""),
                      "file": src.get("file", "")}
        else:
            ex = ""
            fields = {"source_title": "", "year": "", "link": "", "file": next((str(s.get("file", "")) for s in said if s.get("file")), "")}
        row = {"finding_id": fid, "statement": ex or quote or str(card.get("idea", "")), "first_video": video,
               "videos_used": video, "posts_used": post_id, **{k: str(v) for k, v in fields.items()}}
        if i == 0:
            row["last_led_date"] = today
        out.append(row)
    return out


def _article_idea(plan: dict) -> str:
    # Own parse of the first numbered title (B1's load_plan does the full plan check).
    for line in (plan.get("prose") or {}).get("Title options", "").splitlines():
        m = re.match(r"^\s*\d+[.)]\s+(.+)$", line)
        if m:
            return m.group(1).strip()
    return ""


def _post_row(card: dict, slug: str, folder: Path, status: str, account: str = "") -> dict:
    slots = {}
    sp = folder / "slots.json"
    if sp.exists():
        slots = json.loads(sp.read_text())
    return {
        "post_id": f"{slug}-{card['id']}", "video": slug, "idea": card.get("idea", ""), "idea_type": card.get("idea_type", ""),
        "persona": card.get("persona", ""), "step": card.get("step", ""), "bucket": card.get("bucket", ""),
        "product": card.get("product", ""), "findings": card.get("findings") or [], "format": card.get("format", ""),
        "template": ",".join(s.get("template", "") for s in slots.get("slides", []) if s.get("template")),
        "theme": slots.get("theme", ""), "account": account, "status": status,
    }


def add(mc: Path, status: str, as_backup: tuple[str, ...] = (), posts_path=None, findings_path=None) -> int:
    """Write a posts row for every card in posts/ and backups/ and for the article plan (A01).
    `extracted` also writes findings rows and locks each post's lead finding; `made` leaves findings alone;
    `test` writes posts rows only. Rows already in a later status keep it. Returns rows written."""
    import accounts
    import cards
    if status not in ("extracted", "made", "test"):
        raise ValueError("add needs status extracted, made or test")
    mc = Path(mc).resolve()
    p = paths.atomize_paths(mc)
    pp = Path(posts_path) if posts_path else p["posts"]
    fp = Path(findings_path) if findings_path else p["findings"]
    slug = paths.video_slug(mc.parent)
    today = dt.date.today().isoformat()
    backup_status = "test" if status == "test" else "backup"
    items = []  # (card, folder, is_backup)
    for sub in ("posts", "backups"):
        for cp in sorted((mc / sub).glob("*/card.md")):
            c = cards.load(cp)
            items.append((c, cp.parent, sub == "backups" or c["id"] in as_backup))
    plan = mc / "article" / "plan.md"
    article = None
    if plan.exists():
        article = cards.load(plan)
        article.setdefault("id", "A01")
        article["format"] = "article"
        article["idea"] = _article_idea(article)
    existing = {r["post_id"]: r for r in read_table(pp, POST_COLUMNS)}
    current = {k: r["status"] for k, r in existing.items()}
    rows, frows = [], []
    for c, folder, is_backup in items:
        row = _post_row(c, slug, folder, backup_status if is_backup else status)
        rows.append(row)
        for fr in finding_rows(c, slug, row["post_id"], today):
            if is_backup:
                fr.pop("last_led_date", None)
            frows.append(fr)
    if article is not None:
        author = accounts.settings(p["accounts"])["article_author"]
        rows.append(_post_row(article, slug, plan.parent, status, author))
        frows += [{k: v for k, v in fr.items() if k != "last_led_date"} for fr in finding_rows(article, slug, f"{slug}-A01", today)]
    kept = []
    for row in rows:
        old = current.get(row["post_id"], "")
        if status == "test" and old not in ("", "test"):
            continue  # a test run never touches a real row
        if old not in OVERWRITABLE:
            row["status"] = old  # a stage 2 status is never moved back
        if not (existing.get(row["post_id"]) or {}).get("date"):
            row["date"] = today  # keep the original extraction date on a re-run
        kept.append(row)
    rows = kept
    if not rows:
        return 0
    upsert_posts(rows, pp)
    if status == "extracted":
        upsert_findings(frows, fp)
    return len(rows)


def _lead(row: dict) -> str:
    return row["findings"].split(SEP)[0] if row["findings"] else ""


def recent_ideas(posts_path: Path, n: int = 40, exclude_video: str | None = None) -> list[dict]:
    rows = [r for r in read_table(posts_path, POST_COLUMNS)
            if r["status"] not in ("test", "dropped", "backup") and r["video"] != exclude_video]
    return rows[-n:]


def finding_recent(findings_path: Path, posts_path: Path, weeks: int = 6, today: str | None = None,
                   exclude_video: str | None = None) -> list[dict]:
    now = dt.date.fromisoformat(today) if today else dt.date.today()
    cutoff = now - dt.timedelta(weeks=weeks)
    leads_elsewhere = None
    if exclude_video:
        leads_elsewhere = {_lead(r) for r in read_table(posts_path, POST_COLUMNS)
                           if r["video"] != exclude_video and r["status"] not in ("test", "dropped")}
    out = []
    for f in read_table(findings_path, FINDING_COLUMNS):
        if not f["last_led_date"] or dt.date.fromisoformat(f["last_led_date"]) < cutoff:
            continue
        if leads_elsewhere is not None and f["finding_id"] not in leads_elsewhere:
            continue
        out.append(f)
    return out


def recent_first_lines(posts_path: Path, last: int = 200, exclude_video: str | None = None) -> list[str]:
    rows = [r for r in read_table(posts_path, POST_COLUMNS)
            if r["first_line"] and r["status"] != "test" and r["video"] != exclude_video]
    return [r["first_line"] for r in rows[-last:]]


def drop_post(mc: Path, post_id: str, reason: str, test: bool = False) -> Path:
    """post_id is the short id (P03, B2). Moves the folder to mc/dropped/, writes reason.txt, sets the row
    dropped and clears the lead finding's last_led_date of a P post (neither in a test run). Shared by both stages."""
    import cards
    mc = Path(mc).resolve()
    src = paths.find_post_dir(mc, post_id)
    if src is None or src.name == "article":
        raise FileNotFoundError(f"no folder for {post_id} in posts/ or backups/ under {mc}")
    p = paths.atomize_paths(mc)
    full = f"{paths.video_slug(mc.parent)}-{post_id}"
    lead = ""
    if (src / "card.md").exists() and post_id.startswith("P"):
        found = cards.load(src / "card.md").get("findings") or []
        lead = found[0] if found else ""
    dest = mc / "dropped" / src.name
    if dest.exists():
        raise FileExistsError(f"{dest} already exists")
    dest.parent.mkdir(exist_ok=True)
    shutil.move(str(src), str(dest))
    (dest / "reason.txt").write_text(reason.strip() + "\n")
    if not test:
        set_status(p["posts"], [full], "dropped")
        if lead:
            known = {f["finding_id"] for f in read_table(p["findings"], FINDING_COLUMNS)}
            if lead in known:
                upsert_findings([{"finding_id": lead, "last_led_date": ""}], p["findings"])
    return dest


def _resolve_mc(target: str) -> Path:
    t = Path(target)
    if t.is_dir() and (t.name.startswith("microcontent") or any((t / x).exists() for x in ("posts", "backups", "index.md"))):
        return t.resolve()
    vd = paths.video_dir(target, Path.cwd())
    return vd / "microcontent"


def _has_cards(mc: Path) -> bool:
    return any(mc.glob("posts/*/card.md")) or any(mc.glob("backups/*/card.md")) or (mc / "article" / "plan.md").exists()


def _full_ids(ids: list[str], slug: str) -> list[str]:
    return [i if i.startswith(slug + "-") else f"{slug}-{i}" for i in ids]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="ledger.py", description="atomize records")
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("add")
    a.add_argument("target")
    a.add_argument("--status", required=True, choices=["extracted", "made", "test"])
    a.add_argument("--as-backup", default="")
    r = sub.add_parser("recent-ideas")
    r.add_argument("target")
    r.add_argument("--n", type=int, default=40)
    r.add_argument("--exclude-video")
    fr = sub.add_parser("finding-recent")
    fr.add_argument("target")
    fr.add_argument("--weeks", type=int, default=6)
    fr.add_argument("--exclude-video")
    ss = sub.add_parser("set-status")
    ss.add_argument("target")
    ss.add_argument("--ids", required=True)
    ss.add_argument("--status", required=True)
    ss.add_argument("--test", action="store_true")
    d = sub.add_parser("drop")
    d.add_argument("target")
    d.add_argument("id")
    d.add_argument("--reason", required=True)
    d.add_argument("--test", action="store_true")
    pg = sub.add_parser("purge")
    pg.add_argument("target")
    pg.add_argument("--status", default="test")
    args = ap.parse_args(argv)
    try:
        mc = _resolve_mc(args.target)
        test = args.status == "test" if args.cmd == "add" else getattr(args, "test", False)
        if test and mc.name == "microcontent":
            raise ValueError(f"a test run never writes into {mc}: copy it to a test folder "
                             "(for example microcontent-test) and pass that")
        p = paths.atomize_paths(mc)
        slug = paths.video_slug(mc.parent)
        if args.cmd == "add":
            n = add(mc, args.status, tuple(x for x in args.as_backup.split(",") if x))
            if n == 0 and args.status == "test" and _has_cards(mc):
                print("0 test rows (all rows are real)")
                return 0
            if n == 0:
                print(f"ledger.py: no cards found under {mc} (expected posts/, backups/ or article/plan.md)", file=sys.stderr)
                return 1
            print(f"{n} rows")
        elif args.cmd == "recent-ideas":
            for row in recent_ideas(p["posts"], args.n, args.exclude_video):
                print(" | ".join([row["post_id"], row["idea_type"], row["idea"]]))
        elif args.cmd == "finding-recent":
            for f in finding_recent(p["findings"], p["posts"], args.weeks, None, args.exclude_video):
                print(" | ".join([f["finding_id"], f["last_led_date"], f["statement"]]))
        elif args.cmd == "set-status":
            n = set_status(p["posts"], _full_ids([i for i in args.ids.split(",") if i], slug), args.status, test=args.test)
            print(f"{n} rows")
        elif args.cmd == "drop":
            print(drop_post(mc, args.id, args.reason, args.test))
        elif args.cmd == "purge":
            print(f"removed {purge(p['posts'], args.status, slug)} rows")
    except (ValueError, FileNotFoundError, FileExistsError) as e:
        print(f"ledger.py: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
