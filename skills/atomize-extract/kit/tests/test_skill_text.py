"""Checks on the skill text: required headings and facts, forbidden words, dead paths and dead commands.
Reads the real skill files; writes nothing."""
import re, subprocess, sys, unittest
from functools import lru_cache
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
X = KIT.parent
C = KIT.parents[1] / "atomize-create"
sys.path.insert(0, str(KIT))
import gate  # noqa: E402

# Words from the old layout, and anything tied to one machine or one company's repo.
FORBIDDEN = ["atomize-" + "assign", "assign.py", "blocks.json", "assignment.json", "ready/", "spares/", "pieces/",
             "disclosure", "company-voice.md", "ledger.csv", "posted.csv", "caption_shapes", "comment_variants",
             "/Users/", "/home/", ".claude/skills/"]
ALLOWED_PHRASE = "no disclosure line"
EM_DASH = "—"
NO_SUBCOMMAND = {"render.py", "review.py"}

# Stage 1 and stage 2 both have a SKILL.md, so each stage keeps its own dict.
HEADINGS_1 = {
    "idea-scoring.md": ["The six points", "Priority", "Rubric", "What earns a high score", "Idea types",
                        "Workspace scoring notes"],
    "idea-generation.md": ["One pass", "Each candidate", "Sources", "Ideas without numbers"],
    "picking.md": ["How many", "Spread", "Ties", "Refill", "Backups", "Repeat check", "candidates.md"],
    "idea-card.md": ["Rules", "Fields", "Example"],
    "article-plan.md": ["Who publishes", "The plan file", "Rules", "Images"],
    "article-brief.md": ["Read", "Do", "Return"],
    "formats.md": ["The three formats", "Templates"],
    "visual-brief.md": ["Read", "Do", "Return"],
    "gate-brief.md": ["Read", "Checks", "Fail reasons", "Return"],
    "SKILL.md": ["Call", "Workspace", "How the work is split", "Part 1: ideas", "Review and feedback",
                 "Part 2: visuals", "Hard rules", "Finish"],
}
HEADINGS_2 = {
    "matching.md": ["Fit score", "Role lines", "Format spread", "How the total is compared",
                    "Workspace matching notes", "Output"],
    "quality-bar.md": ["Checks", "Voice fit", "Redos", "review.json"],
    "write-brief.md": ["You are given", "Read", "Write post.md", "Rules", "Redo", "Return"],
    "article-write-brief.md": ["You are given", "Read", "Write article.html", "Rules", "Return"],
    "review-brief.md": ["You are given", "Read", "For each post and the article", "Return"],
    "SKILL.md": ["Call", "Workspace", "How the work is split", "Steps", "When posts fail", "Re-running",
                 "The link", "Hard rules"],
}
HEADINGS = {X: HEADINGS_1, C: HEADINGS_2}


def file_for(name: str, skill: Path = X) -> Path:
    return skill / name if name == "SKILL.md" else skill / "references" / name


def read(name: str, skill: Path = X) -> str:
    return file_for(name, skill).read_text()


def strip_fenced(text: str, name: str) -> str:
    return re.sub(rf"```{re.escape(name)}[ \t]*\n.*?```", "", text, flags=re.S)


def forbidden_hits(text: str) -> list[str]:
    text = text.replace(ALLOWED_PHRASE, "")
    hits = []
    for w in FORBIDDEN:
        if "/" in w:
            if w in text:
                hits.append(w)
        elif re.search(rf"(?<![\w-]){re.escape(w)}(?![\w-])", text, re.I):
            hits.append(w)
    if EM_DASH in text:
        hits.append("em dash")
    if gate.EMOJI.search(text):
        hits.append("emoji")
    return hits


def _tokens(text: str) -> list[str]:
    """Words inside inline code spans and fenced blocks."""
    out: list[str] = []
    for block in re.findall(r"```[^\n]*\n(.*?)```", text, re.S):
        out += block.split()
    inline = re.sub(r"```.*?```", "", text, flags=re.S)
    for span in re.findall(r"`([^`\n]+)`", inline):
        out += span.split()
    return out


def dead_paths(path: Path, aliases: dict[str, Path]) -> list[str]:
    """Every code token that starts with an alias (KIT/, REF/, XREF/) must exist.
    Tokens with a placeholder (<...>, {...}) or a glob (*) are skipped."""
    dead = []
    for tok in _tokens(Path(path).read_text()):
        tok = tok.strip("\"'(),;:.[]")
        if any(ch in tok for ch in "<>{}*"):
            continue
        pre = next((a for a in aliases if tok.startswith(a)), None)
        if pre is None:
            continue
        target = aliases[pre] / tok[len(pre):]
        if not target.exists():
            dead.append(tok)
    return dead


@lru_cache(maxsize=None)
def _help(script: str) -> str:
    r = subprocess.run([sys.executable, str(KIT / script), "--help"], cwd=KIT, capture_output=True, text=True,
                       env={"PYTHONDONTWRITEBYTECODE": "1", "PATH": "/usr/bin:/bin"})
    return r.stdout + r.stderr


def dead_commands(text: str) -> list[str]:
    """Every `python3 KIT/<script>.py <word>` names a script that exists, and <word> is in its --help."""
    dead = []
    for m in re.finditer(r"python3 KIT/([\w-]+\.py)(?:[ \t]+(\S+))?", text):
        script, word = m.group(1), (m.group(2) or "").strip("`")
        if not (KIT / script).is_file():
            dead.append(m.group(0))
        elif script not in NO_SUBCOMMAND and word and not word.startswith("<") \
                and not re.search(rf"(?<![\w-]){re.escape(word)}(?![\w-])", _help(script)):
            dead.append(m.group(0))
    return dead


ALIASES_1 = {"KIT/": KIT, "REF/": X / "references"}
ALIASES_2 = {"KIT/": KIT, "REF/": C / "references", "XREF/": X / "references"}


class HelperTest(unittest.TestCase):
    def test_forbidden_hits(self):
        self.assertEqual(forbidden_hits("plain text with no label line"), [])
        self.assertEqual(forbidden_hits("no disclosure line here"), [])
        self.assertIn("/Users/", forbidden_hits("see /Users/someone/file"))
        self.assertIn("em dash", forbidden_hits("a — b"))
        self.assertIn("ready/", forbidden_hits("in ready/ folder"))
        self.assertEqual(forbidden_hits("ready to post"), [])

    def test_dead_commands(self):
        self.assertEqual(dead_commands("`python3 KIT/ledger.py add MC --status made`"), [])
        self.assertEqual(dead_commands("`python3 KIT/render.py <folder>/slots.json`"), [])
        self.assertTrue(dead_commands("`python3 KIT/ledger.py recent --videos 20`"))
        self.assertTrue(dead_commands("`python3 KIT/nothing.py run`"))


class Stage1TextTest(unittest.TestCase):
    FILES = [X / f if f == "SKILL.md" else X / "references" / f for f in HEADINGS_1]

    def test_headings(self):
        for name, heads in HEADINGS_1.items():
            f = file_for(name)
            self.assertTrue(f.is_file(), f"missing {f}")
            text = f.read_text()
            for h in heads:
                self.assertRegex(text, rf"(?m)^## {re.escape(h)}[ \t]*$", f"{name}: no '## {h}'")

    def test_forbidden_words(self):
        for f in self.FILES:
            self.assertTrue(f.is_file(), f"missing {f}")
            self.assertEqual(forbidden_hits(f.read_text()), [], f.name)

    def test_no_dead_paths_or_commands(self):
        for f in self.FILES:
            self.assertTrue(f.is_file(), f"missing {f}")
            self.assertEqual(dead_paths(f, ALIASES_1), [], f"{f.name}: dead paths")
            self.assertEqual(dead_commands(f.read_text()), [], f"{f.name}: dead commands")

    def test_facts(self):
        self.assertIn("Bar: 10", read("idea-scoring.md"))
        self.assertIn("20 to 24", read("idea-generation.md"))
        self.assertIn("16 or more", read("picking.md"))
        self.assertIn("--as-backup", read("picking.md"))
        self.assertIn("finding-recent", read("picking.md"))
        self.assertIn("lead finding", read("picking.md"))
        self.assertIn("visual-review.json", read("gate-brief.md"))
        self.assertIn("said_in", read("idea-card.md"))
        self.assertNotIn("article.html", read("article-brief.md"))

    def test_skill_facts(self):
        text = read("SKILL.md")
        for fact in ["visuals: done", "reviewed:", "backups:", "atomize-create", "idea-scoring.md", "idea-generation.md",
                     "picking.md", "article-plan.md", "per profile", "finding-recent", "--status test"]:
            self.assertIn(fact, text)
        self.assertRegex(text, r"(?m)^name: atomize-extract$")


class Stage2TextTest(unittest.TestCase):
    FILES = [file_for(f, C) for f in HEADINGS_2]

    def test_headings(self):
        for name, heads in HEADINGS_2.items():
            f = file_for(name, C)
            self.assertTrue(f.is_file(), f"missing {f}")
            text = f.read_text()
            for h in heads:
                self.assertRegex(text, rf"(?m)^## {re.escape(h)}[ \t]*$", f"{name}: no '## {h}'")

    def test_forbidden_words(self):
        for f in self.FILES:
            self.assertTrue(f.is_file(), f"missing {f}")
            self.assertEqual(forbidden_hits(f.read_text()), [], f.name)

    def test_no_dead_paths_or_commands(self):
        for f in self.FILES:
            self.assertTrue(f.is_file(), f"missing {f}")
            self.assertEqual(dead_paths(f, ALIASES_2), [], f"{f.name}: dead paths")
            self.assertEqual(dead_commands(f.read_text()), [], f"{f.name}: dead commands")

    def test_facts(self):
        m = read("matching.md", C)
        self.assertIn("default 3", m)
        self.assertIn("first person", m)
        self.assertIn("placeholder", read("quality-bar.md", C))
        w = read("write-brief.md", C)
        for fact in ["{{VIDEO_POST_URL}}", "caption_shape", "hook_type", "no personal stories", 'never "I"']:
            self.assertIn(fact, w)
        self.assertNotIn("ask_type", w)
        self.assertNotIn("comment variant", w)
        a = read("article-write-brief.md", C)
        self.assertIn("title_choice", a)
        self.assertIn("plan.md", a)
        self.assertIn("review.json", read("review-brief.md", C))

    def test_skill_facts(self):
        text = read("SKILL.md", C)
        for fact in ["handover.md", "matching.md", "quality-bar.md", "write-brief.md", "article-write-brief.md",
                     "review-brief.md", "rewrite <profile>", "--rematch", "set-status", "--test"]:
            self.assertIn(fact, text)
        self.assertRegex(text, r"(?m)^name: atomize-create$")


if __name__ == "__main__":
    unittest.main()
