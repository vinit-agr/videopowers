import re, sys, unittest
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
NAMES = re.compile(r"/Users/|/home/|\.claude/skills/")  # personal paths or one company's repo layout


class PluginReadyTest(unittest.TestCase):
    def test_kit_has_no_names_or_repo_paths(self):
        files = sorted(KIT.glob("*.py")) + sorted((KIT.parent / "templates").glob("base.*")) \
            + sorted((KIT / "templates").glob("base.*"))
        self.assertTrue(any(f.suffix == ".py" for f in files))
        hits = []
        for f in files:
            for n, line in enumerate(f.read_text().splitlines(), 1):
                if NAMES.search(line):
                    hits.append(f"{f.name}:{n}: {line.strip()}")
        self.assertEqual(hits, [])


if __name__ == "__main__":
    unittest.main()
