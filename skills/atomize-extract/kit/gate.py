#!/usr/bin/env python3
"""Script checks for atomize pieces (design 7.2). One JSON line per item; exit 1 if any fail.

    gate.py cards   <microcontent_dir>
    gate.py visuals <piece_dir> [<piece_dir> ...]
    gate.py posts   <microcontent_dir> [--allow-token]
    gate.py article <microcontent_dir> [--allow-token]
"""
from __future__ import annotations

import argparse
import difflib
import html
import json
import re
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parent
sys.path.insert(0, str(KIT))
import accounts as acc  # noqa: E402
import cards  # noqa: E402
import ledger  # noqa: E402
import paths  # noqa: E402
from numtok import TOKEN, extract  # noqa: E402

HOOK_MAX = 210
IMAGE_MAX = 5 * 1024 * 1024
PDF_MAX = 100 * 1024 * 1024
PLACEHOLDERS = [r"\btbd\b", r"\[insert", r"\boption a\b", r"\bchoose one\b", r"\bcheck before\b", r"\blorem\b"]
EMOJI = re.compile("[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F2FF\U0001F600-\U0001F64F]")
POST_KEYS = ["piece", "account", "format", "caption_shape", "hook_type"]


# ---------- workspace rules ----------

def fenced(path: Path, name: str) -> list[str]:
    if not path or not Path(path).is_file():
        return []
    out = []
    for block in re.findall(rf"```{re.escape(name)}\s*\n(.*?)```", Path(path).read_text(), re.S):
        out += [l.strip() for l in block.splitlines() if l.strip()]
    return out


class Rules:
    def __init__(self, start: Path, voice: Path | None = None):
        self.p = paths.atomize_paths(start)
        files = [self.p["company_voice"]] + ([voice] if voice else [])
        self.words = [w for f in files for w in fenced(f, "banned-words")]
        self.chars = [c for f in files for c in fenced(f, "banned-chars")]
        self.allowed = [n for f in files for n in fenced(f, "allowed-numbers")]
        self.accounts = acc.load_accounts(self.p["accounts"]) if Path(self.p["accounts"]).exists() else []

    def style(self, text: str) -> list[str]:
        errs = []
        for w in self.words:
            if re.search(rf"(?<!\w){re.escape(w)}(?!\w)", text, re.I):
                errs.append(f"banned word: {w}")
        for c in self.chars:
            if c == "EMOJI":
                if EMOJI.search(text):
                    errs.append("banned: emoji")
            elif c in text:
                errs.append(f"banned character: {c}")
        return errs

    def numbers(self, text: str) -> set[str]:
        return extract(text, self.allowed)


def placeholders(text: str, allow_token: bool) -> list[str]:
    errs = [f"placeholder: {p}" for p in PLACEHOLDERS if re.search(p, text, re.I)]
    rest = text.replace(TOKEN, "") if allow_token else text
    if "{{" in rest:
        errs.append("placeholder: {{ ... }}" if TOKEN not in text else "the video link is still the token")
    return errs


def norm_match(s: str) -> str:
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"(\*\*|__|`)", "", s)
    s = re.sub(r"(?m)^\s*(>\s*|[-*]\s+|\d+[.)]\s+)", "", s)
    s = s.lower()
    for a, b in (("‘", "'"), ("’", "'"), ("“", '"'), ("”", '"'), ("–", "-"), ("—", "-"), ("…", "...")):
        s = s.replace(a, b)
    s = re.sub(r"\s+", " ", s).strip()
    return s.strip("\"' ")


def excerpt_found(excerpt: str, source_text: str) -> bool:
    src = norm_match(source_text)
    ex = norm_match(excerpt)
    if "..." not in ex:
        return ex in src
    parts = [p.strip(" \"'") for p in ex.split("...")]
    long_parts = [p for p in parts if len(p) >= 12]
    if not long_parts:
        return False
    pos = 0
    for p in long_parts:
        i = src.find(p, pos)
        if i < 0:
            return False
        pos = i + len(p)
    return True


def result(item: str, errs: list[str]) -> dict:
    return {"item": item, "status": "fail" if errs else "pass", "fail_reasons": errs}


# ---------- cards ----------

def source_errors(c: dict, video_dir: Path, rules: Rules) -> list[str]:
    """Source files exist, excerpts and real moments are word for word in them, every number sits in an excerpt."""
    errs: list[str] = []
    files = {s["id"]: video_dir / s["file"] for s in c.get("sources") or []}
    texts: dict[str, str] = {}
    for sid, f in files.items():
        if not f.is_file():
            errs.append(f"source {sid}: file not found: {f}")
        else:
            texts[sid] = f.read_text()
    by_source: dict[str, list[str]] = {}
    for kind in ("excerpts", "real_moments"):
        for e in c.get(kind) or []:
            sid = e["source"]
            if sid in texts and not excerpt_found(e["text"], texts[sid]):
                errs.append(f"{kind}: not found word for word in {files[sid].name}: {e['text'][:70]}")
            by_source.setdefault(sid, []).append(e["text"])
    for n in c.get("numbers") or []:
        if n.get("derived"):
            continue
        have = set()
        for t in by_source.get(n["source"], []):
            have |= rules.numbers(t)
        missing = rules.numbers(str(n["value"])) - have
        if missing:
            errs.append(f"number {n['value']}: not in any excerpt from {n['source']} (add the excerpt, or mark it derived)")
    return errs


def check_card(card_path: Path, video_dir: Path, rules: Rules, vocab: dict, slug: str = "",
               recent: dict[str, str] | None = None, matched: bool = False) -> dict:
    """`recent` maps a finding id to the date it last led a post (findings from other videos only)."""
    name = card_path.parent.name
    try:
        c = cards.load(card_path)
    except (ValueError, OSError) as e:
        return result(name, [str(e)])
    errs = cards.validate(c, vocab)
    if errs:
        return result(name, errs)
    errs += source_errors(c, video_dir, rules)
    for s in c["said_in"] or []:
        f = video_dir / s["file"]
        if not f.is_file():
            errs.append(f"said_in: file not found: {s['file']}")
        elif not excerpt_found(s["quote"], f.read_text()):
            errs.append(f"said_in: not found word for word in {f.name}: {str(s['quote'])[:70]}")
    if not cards.passes_bar(c["scores"]):
        sc = c["scores"]
        errs.append(f"below the bar: stands_alone {sc['stands_alone']}, true {sc['true']}, hook {sc['hook']}, "
                    f"retain {sc['retain']}, reward {sc['reward']}, total {sc['total']} (need {cards.BAR} of 15, none under {cards.FLOOR})")
    if sum(1 for s in c["sources"] if str(s["file"]).startswith("../")) > 1:
        errs.append("more than one borrowed finding")
    lead = str(c["findings"][0])
    if recent and lead in recent:
        errs.append(f"lead finding {lead} led a post on {recent[lead]} (6 weeks)")
    errs += rules.style("\n".join([str(c["idea"])] + list(c["prose"].values())))
    if not matched and paths.folder_account(name, [a["id"] for a in rules.accounts]):
        errs.append("folder name starts with an account id")
    return result(name, errs)


def check_plan(plan_path: Path, video_dir: Path, rules: Rules) -> dict:
    item = "article/plan.md"
    try:
        plan = cards.load_plan(plan_path)
    except (ValueError, OSError) as e:
        return result(item, [str(e)])
    errs = cards.validate_plan(plan)
    if errs:
        return result(item, errs)
    errs += source_errors(plan, video_dir, rules)
    ids = {str(s.get("id")) for s in plan.get("sources") or []}
    for s in plan["sections"]:
        bare = re.sub(r"\([^)]*\)", "", s.get("uses") or "")  # drop what each source is used for
        for sid in [w.split()[0] for w in re.split(r"[,;]", bare) if w.split()]:
            if sid not in ids:
                errs.append(f"section '{s['heading']}': Uses names {sid}, which is not in the plan's sources")
    text = "\n".join(plan["titles"] + plan["subtitles"] + [plan["why"], plan["close"]]
                      + [f"{s['heading']}\n{s['purpose']}\n{s['beats']}" for s in plan["sections"]])
    errs += rules.style(text)
    return result(item, errs)


def _allocation(mc: Path) -> dict:
    f = Path(mc) / "match.json"
    try:
        return json.loads(f.read_text()).get("allocation") or {} if f.is_file() else {}
    except ValueError:
        return {}


def cmd_cards(mc: Path) -> list[dict]:
    mc = Path(mc)
    if any((mc / old).exists() for old in ("pieces", "spares", "ready")):
        return [result(str(mc), ["old layout (pieces/, spares/, ready/): read-only, not supported"])]
    rules = Rules(mc)
    posts = sorted((mc / "posts").glob("*/card.md"))
    backups = sorted((mc / "backups").glob("*/card.md"))
    if not posts and not backups:
        return [result(str(mc), ["no cards in posts/ or backups/"])]
    vocab = cards.load_vocab(mc)
    slug = paths.video_slug(mc.parent)
    recent = {f["finding_id"]: f["last_led_date"]
              for f in ledger.finding_recent(rules.p["findings"], rules.p["posts"], 6, None, exclude_video=slug)}
    matched = bool(_allocation(mc))  # after create.py match, folder names carry the profile id
    out = [check_card(p, mc.parent, rules, vocab, slug, recent, matched) for p in posts + backups]
    plan = mc / "article" / "plan.md"
    out.append(check_plan(plan, mc.parent, rules) if plan.is_file() else result("article/plan.md", ["article/plan.md missing"]))
    errs: list[str] = []
    counts = cards.handover_counts(len(posts) + len(backups), len(rules.accounts))
    if counts is None:
        errs.append("fewer than 2 per profile: refill or stop")
    elif len(posts) < counts[0]:
        errs.append(f"need {counts[0]} post cards")
    out.append(result("counts", errs))
    return out


# ---------- visuals ----------

def check_report(report_path: Path) -> tuple[dict, list[str]]:
    if not report_path.is_file():
        return {}, [f"no report.json in {report_path.parent.name} (render first)"]
    r = json.loads(report_path.read_text())
    errs = list(r.get("errors") or [])
    if r.get("overflow"):
        errs += [f"overflow: {o}" for o in r["overflow"]]
    if not r.get("font_ok"):
        errs.append("fonts did not load")
    if not str(r.get("source", "")).strip() and r.get("kind") != "article-cover":
        errs.append("no source line on the visual")
    return r, errs


def check_visual(piece_dir: Path, card: dict, rules: Rules) -> list[str]:
    r, errs = check_report(piece_dir / "report.json")
    if not r:
        return errs
    text = r.get("text", "")
    extra = rules.numbers(text) - cards.card_numbers(card)
    if extra:
        errs.append(f"numbers on the visual not in the card: {', '.join(sorted(extra))}")
    for name in acc.team_names(rules.accounts):
        if re.search(rf"\b{re.escape(name)}\b", text):
            errs.append(f"the visual names a team member: {name}")
    errs += rules.style(text)
    errs += placeholders(text, allow_token=True)
    return errs


def cmd_visuals(dirs: list[Path]) -> list[dict]:
    out = []
    for d in dirs:
        rules = Rules(d)
        try:
            card = cards.load_plan(d.parent / "plan.md") if d.parent.name == "article" and not (d / "card.md").is_file() \
                else cards.load(d / "card.md")
        except (ValueError, OSError) as e:
            out.append(result(str(d), [str(e)]))
            continue
        out.append(result(str(d), check_visual(d, card, rules)))
    for r, err in zip(out, layout_repeats(dirs)):
        if err:
            r["fail_reasons"].append(err)
            r["status"] = "fail"
    return out


def layout_repeats(dirs: list[Path]) -> list[str]:
    """For posts checked together: a post with the same theme and the same templates, in order, as an earlier one
    looks like a repeat."""
    seen: dict[tuple, str] = {}
    out = []
    for d in dirs:
        f = d / "slots.json"
        try:
            s = json.loads(f.read_text()) if f.is_file() else None
        except ValueError:
            s = None
        if not s or not s.get("slides") or d.parent.name == "article":
            out.append("")
            continue
        theme = s.get("theme", "light")
        key = (theme, tuple(x.get("template") for x in s["slides"]))
        pid = d.name.split("-")[0]
        lead_stat = (s.get("kind") == "carousel" and len(s["slides"]) > 1 and s["slides"][1].get("template") == "stat")
        if key in seen:
            out.append(f"looks like {seen[key]}: same theme ({key[0]}) and templates ({', '.join(key[1])}); change the theme or a template")
        elif lead_stat and ("stat2", theme) in seen:
            out.append(f"looks like {seen[('stat2', theme)]}: a big-number slide right after the title, in the same theme ({theme}); "
                       "move the number or use another template")
        else:
            seen[key] = pid
            if lead_stat:
                seen[("stat2", theme)] = pid
            out.append("")
    return out


# ---------- posts ----------

def parse_post(path: Path) -> dict:
    text = path.read_text()
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.S)
    import yaml
    fm = yaml.safe_load(m.group(1)) if m else {}
    body = m.group(2) if m else text

    def fence(heading):
        mm = re.search(rf"^## {heading}\s*\n```text\n(.*?)\n```", body, re.S | re.M)
        return mm.group(1) if mm else None
    up = re.search(r"^Upload:\s*(.*)$", body, re.M)
    doc = re.search(r"^Document title:\s*(.*)$", body, re.M)
    alt = re.search(r"^## Alt text\s*\n(.*?)(?=^## |\Z)", body, re.S | re.M)
    return {"fm": fm or {}, "caption": fence("Post"), "comment": fence("First comment"), "alt": re.sub(r"(?im)^\s*-\s*image\s+\d+:", "", alt.group(1)).strip() if alt else "",
            "upload": [u.strip() for u in up.group(1).split(",") if u.strip()] if up else [],
            "doc_title": doc.group(1).strip() if doc else "", "raw": text}


def check_post(path: Path, mc: Path, rules_cache: dict, allow_token: bool, posts_csv: Path | None) -> dict:
    """`path` is posts/<folder>/post.md; the card, report.json and slots.json sit in the same folder."""
    pdir = path.parent
    name = pdir.name
    p = parse_post(path)
    fm = p["fm"]
    errs = [f"front matter: missing {k}" for k in POST_KEYS if k not in fm]
    if errs:
        return result(name, errs)
    slug = paths.video_slug(mc.parent)
    ids = [a["id"] for a in rules_cache["accounts"]]
    if not (pdir / "card.md").is_file():
        return result(name, ["no card.md in the post folder"])
    card = cards.load(pdir / "card.md")
    account = next((a for a in rules_cache["accounts"] if a["id"] == fm["account"]), None)
    if not account:
        return result(name, [f"unknown account {fm['account']}"])
    folder_acc = paths.folder_account(name, ids)
    if folder_acc is None:
        errs.append("the folder has no account in its name (match first)")
    elif folder_acc != fm["account"]:
        errs.append(f"post account {fm['account']}, folder says {folder_acc}")
    voice = acc.voice_path(account, rules_cache["root"], rules_cache["company_voice"])
    rules = Rules(mc, voice if voice.is_file() else None)
    cap, com = p["caption"], p["comment"]
    if cap is None:
        return result(name, ["no ```text block under ## Post"])
    if com is None:
        errs.append("no ```text block under ## First comment")
        com = ""
    hook = cap.split("\n\n")[0]
    if len(hook) > HOOK_MAX or hook.count("\n") > 2:
        errs.append(f"hook before the first blank line is {len(hook)} characters / {hook.count(chr(10)) + 1} lines (max {HOOK_MAX} / 3)")
    report, rerrs = check_report(pdir / "report.json")
    errs += rerrs
    first = cap.strip().splitlines()[0] if cap.strip() else ""
    if report.get("headline") and difflib.SequenceMatcher(None, first.lower(), report["headline"].lower()).ratio() >= 0.8:
        errs.append("the caption's first line repeats the visual's headline")
    all_text = "\n".join([cap, com, p["doc_title"], p["alt"]])
    errs += rules.style(re.sub(r"https?://\S+", " ", all_text))
    errs += placeholders(all_text, allow_token)
    extra = rules.numbers(cap + "\n" + com + "\n" + p["doc_title"] + "\n" + p["alt"]) - cards.card_numbers(card)
    if extra:
        errs.append(f"numbers not in the card: {', '.join(sorted(extra))}")
    if re.search(r"https?://|www\.", cap):
        errs.append("a link in the caption (links go in the first comment)")
    if not (TOKEN in com or re.search(r"https://((www\.)?linkedin\.com|lnkd\.in)/", com)):
        errs.append("the first comment has no link to the LinkedIn video post")
    want = len(report.get("files") or [])
    if len(p["upload"]) != want:
        errs.append(f"{len(p['upload'])} upload files listed, the visual has {want}")
    for u in p["upload"]:
        f = path.parent / u
        if not f.is_file():
            errs.append(f"upload file missing: {u}")
        elif f.stat().st_size > (PDF_MAX if f.suffix == ".pdf" else IMAGE_MAX):
            errs.append(f"upload file too big: {u}")
    paras = [x for x in cap.strip().split("\n\n") if x.strip()]
    middle = "\n".join(paras[1:-1]) if len(paras) > 2 else ""
    # a mid-caption question to the reader is a second ask; list items and quotes are content, not asks
    mid = re.sub(r'"[^"]*"|“[^”]*”', "", middle)
    mid = "\n".join(l for l in mid.splitlines() if not re.match(r"\s*(\d+[.)]|[-*•])\s", l))
    for q in re.findall(r"[^.?!\n]*\?", mid):
        if re.search(r"\byou(r|rs)?\b", q, re.I):
            errs.append(f"more than one ask: a question to the reader in the middle of the caption ('{q.strip()[:60]}')")
            break
    sp = pdir / "slots.json"
    if sp.exists():
        asks = [sl["slots"].get("question", "") for sl in json.loads(sp.read_text()).get("slides", []) if sl.get("template") == "ask"]
        cap_q = next((l.strip() for l in reversed(cap.strip().splitlines()) if l.strip().endswith("?")), "")
        for q in asks:
            plain = re.sub(r"\*", "", q)
            if not cap_q or difflib.SequenceMatcher(None, plain.lower(), cap_q.lower()).ratio() < 0.8:
                errs.append(f"two different asks: the last slide asks '{plain[:60]}', the caption asks '{cap_q[:60]}' (use one)")
    if fm["format"] == "carousel" and not p["doc_title"]:
        errs.append("a carousel needs a document title")
    words = re.findall(r"\w+", first.lower())[:8]
    posts_csv = posts_csv or paths.atomize_paths(mc)["posts"]
    for old in ledger.recent_first_lines(posts_csv, 200, exclude_video=slug):
        ow = re.findall(r"\w+", old.lower())[:8]
        if words and ow and difflib.SequenceMatcher(None, words, ow).ratio() >= 0.75:
            errs.append(f"opening too close to an earlier post: {old[:60]}")
            break
    return result(name, errs)


def cmd_posts(mc: Path, allow_token: bool, posts_csv: Path | None = None) -> list[dict]:
    p = paths.atomize_paths(mc)
    cache = {"accounts": acc.load_accounts(p["accounts"]), "root": p["root"], "company_voice": p["company_voice"]}
    files = sorted((Path(mc) / "posts").glob("*/post.md"))
    if not files:
        return [result(str(Path(mc) / "posts"), ["no post.md in posts/"])]
    out = []
    for f in files:
        try:
            out.append(check_post(f, Path(mc), cache, allow_token, posts_csv))
        except Exception as e:  # one unreadable post.md (bad front matter) fails that post, not the whole run
            out.append(result(f.parent.name, [f"post.md could not be read: {type(e).__name__}: {str(e).splitlines()[0][:120]}"]))
    return out


# ---------- article ----------

def cmd_article(mc: Path, allow_token: bool) -> list[dict]:
    a = mc / "article"
    errs: list[str] = []
    if not (a / "article.html").is_file() or not (a / "plan.md").is_file():
        return [result(str(a), ["article.html or plan.md missing"])]
    pa = paths.atomize_paths(mc)
    author = acc.settings(pa["accounts"])["article_author"]
    who = next((x for x in acc.load_accounts(pa["accounts"]) if x["id"] == author), None)
    if who is None:
        return [result(str(a), [f"unknown article author: {author}"])]
    vv = acc.voice_path(who, pa["root"], pa["company_voice"])
    rules = Rules(mc, vv if vv and vv.is_file() else None)
    try:
        card = cards.load_plan(a / "plan.md")
    except (ValueError, OSError) as e:
        return [result(str(a), [str(e)])]
    raw = (a / "article.html").read_text()
    fields = {k: html.unescape(re.sub(r"<[^>]+>", "", v)).strip()
              for k, v in re.findall(r'<p data-field="(\w+)">(.*?)</p>', raw, re.S)}
    for k in ("title", "seo", "share"):
        if not fields.get(k):
            errs.append(f"publish-info: missing {k}")
    if len(fields.get("title", "")) > 60:
        errs.append(f"title is {len(fields['title'])} characters (max 60)")
    if fields.get("seo") and not 140 <= len(fields["seo"]) <= 160:
        errs.append(f"SEO description is {len(fields['seo'])} characters (140-160)")
    text = html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"(?s)<(script|style)\b.*?</\1>", " ", raw)))
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"\[Image:[^\]]*\]", " ", text)
    errs += rules.style(text)
    errs += placeholders(text, allow_token)
    extra = rules.numbers(text) - cards.card_numbers(card)
    if extra:
        errs.append(f"numbers not in the article plan: {', '.join(sorted(extra))}")
    reports = sorted(a.glob("*/report.json"))
    if not reports:
        errs.append("no rendered cover or figures")
    for rp in reports:
        _, rerrs = check_report(rp)
        errs += [f"{rp.parent.name}: {e}" for e in rerrs]
    return [result(str(a), errs)]


def main() -> int:
    ap = argparse.ArgumentParser(description="atomize gate")
    ap.add_argument("mode", choices=["cards", "visuals", "posts", "article"])
    ap.add_argument("targets", nargs="+")
    ap.add_argument("--allow-token", action="store_true")
    a = ap.parse_args()
    t = [Path(x).resolve() for x in a.targets]
    if a.mode == "cards":
        res = cmd_cards(t[0])
    elif a.mode == "visuals":
        res = cmd_visuals(t)
    elif a.mode == "posts":
        res = cmd_posts(t[0], a.allow_token)
    else:
        res = cmd_article(t[0], a.allow_token)
    for r in res:
        print(json.dumps(r))
    return 1 if any(r["status"] == "fail" for r in res) else 0


if __name__ == "__main__":
    sys.exit(main())
