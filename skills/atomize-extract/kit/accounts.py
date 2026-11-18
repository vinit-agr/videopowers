"""Read accounts.md: the table under '## Accounts' (columns found by name: id, name, role, voice)
and the '## Settings' list (posts per profile, article author)."""
from __future__ import annotations

import re
from pathlib import Path

COLS = ["id", "name", "role", "voice"]


def load_accounts(path: Path) -> list[dict]:
    """Rows as dicts. The four COLS come first; any extra column follows as a raw string, in table order."""
    text = Path(path).read_text()
    m = re.search(r"^## Accounts\s*\n(.*?)(?=^## |\Z)", text, re.S | re.M)
    if not m:
        raise ValueError(f"{path}: no '## Accounts' section")
    rows = [l for l in m.group(1).splitlines() if l.strip().startswith("|")]
    if len(rows) < 2:
        raise ValueError(f"{path}: no accounts table")
    head = [c.strip().lower() for c in rows[0].strip().strip("|").split("|")]
    for col in COLS:
        if col not in head:
            raise ValueError(f"{path}: table is missing the '{col}' column (has {head})")
    extras = [h for h in head if h not in COLS]
    out = []
    for line in rows[2:]:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        by = dict(zip(head, cells))
        r = {c: by.get(c, "") for c in COLS}
        r.update({e: by.get(e, "") for e in extras})
        out.append(r)
    return out


def settings(path: Path) -> dict:
    """{'posts_per_profile': int, 'article_author': id} from '## Settings'; defaults 3 and the first account id."""
    text = Path(path).read_text()
    m = re.search(r"^## Settings\s*\n(.*?)(?=^## |\Z)", text, re.S | re.M)
    body = m.group(1) if m else ""
    n = re.search(r"^\s*-\s*posts per profile:\s*(\d+)", body, re.M | re.I)
    a = re.search(r"^\s*-\s*article author:\s*(\S+)", body, re.M | re.I)
    first = load_accounts(path)[0]["id"]
    return {"posts_per_profile": int(n.group(1)) if n else 3, "article_author": a.group(1) if a else first}


def is_company(account: dict) -> bool:
    """The company page: the role line starts with 'company' (any case)."""
    return str(account.get("role", "")).strip().lower().startswith("company")


def voice_path(account: dict, content_root: Path, company_voice: Path) -> Path:
    """The account's voice file or folder, or the company voice when none is set or it doesn't exist."""
    v = account.get("voice", "company")
    if v and v != "company":
        p = Path(content_root) / v
        if p.exists():
            return p.resolve()
    return Path(company_voice).resolve()


def team_names(accounts: list[dict]) -> list[str]:
    names: list[str] = []
    for a in accounts:
        if not is_company(a):
            names.append(a["name"])
            names.append(a["name"].split()[0])
    return sorted(set(names), key=len, reverse=True)
