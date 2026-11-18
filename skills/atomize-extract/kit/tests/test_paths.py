import json, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KIT))
sys.path.insert(0, str(KIT / "tests"))
import paths  # noqa: E402
import fixture_tree as ft  # noqa: E402

_TMP = Path(tempfile.mkdtemp())
CONTENT = ft.make_tree(_TMP).resolve()  # a made-up content workspace with one video, 01-fixture-video


def tearDownModule():
    shutil.rmtree(_TMP, ignore_errors=True)


class PathsTest(unittest.TestCase):
    def test_find_root_from_video_dir(self):
        self.assertEqual(paths.find_content_root(CONTENT / "videos" / "01-fixture-video"), CONTENT)

    def test_atomize_paths_keys(self):
        p = paths.atomize_paths(CONTENT)
        for k in ["accounts", "company_voice", "ledger", "brand", "profile", "framework", "product_facts", "final_cut_words_glob"]:
            self.assertIn(k, p)
        self.assertTrue(str(p["ledger"]).endswith("workspace/records/ledger.csv"))
        self.assertTrue(str(p["findings"]).endswith("workspace/records/findings.csv"))
        self.assertTrue(str(p["posts"]).endswith("workspace/records/posts.csv"))

    def test_video_dir_by_slug(self):
        self.assertEqual(paths.video_dir("fixture-video", CONTENT).name, "01-fixture-video")
        self.assertEqual(paths.video_slug(Path("05-late-invoices")), "late-invoices")

    def test_missing_root_raises(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(FileNotFoundError):
                paths.find_content_root(Path(d))


class PathsV2Test(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp()).resolve()
        self.c = ft.make_tree(self.tmp)
        self.mc = self.c / "videos/01-fixture-video/microcontent"

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_new_keys_resolve(self):
        p = paths.atomize_paths(self.c)
        for k in ["findings", "posts", "personas", "scoring_notes", "matching_rules", "quality_bar", "feedback_log"]:
            self.assertTrue(str(p[k]).startswith(str(self.c)))
        self.assertEqual(p["scoring_notes"], self.c / "workspace/learning/scoring-notes.md")
        self.assertEqual(p["feedback_log"], self.c / "workspace/learning/atomize-feedback-log.md")
        self.assertEqual(p["personas"], self.c / "workspace/org/details.md")

    def test_defaults_standard_layout(self):
        vp = self.c / "videopowers.md"
        vp.write_text(vp.read_text().split("## Atomize")[0])
        p = paths.atomize_paths(self.c)
        self.assertEqual(p["findings"], self.c / "findings.csv")
        self.assertEqual(p["posts"], self.c / "posts.csv")
        self.assertEqual(p["ledger"], self.c / "ledger.csv")
        self.assertEqual(p["brand"], self.c / "brand")
        self.assertEqual(p["videos"], self.c / "videos")
        self.assertEqual(p["personas"], p["profile"])
        self.assertNotIn("accounts", p)
        self.assertNotIn("workspace", p)

    def test_find_post_dir_plain_and_renamed(self):
        d = paths.find_post_dir(self.mc, "P01")
        self.assertEqual(d.name, "P01-idea-p01")
        d.rename(d.with_name("P01-sam-idea-p01"))
        self.assertEqual(paths.find_post_dir(self.mc, "P01").name, "P01-sam-idea-p01")
        self.assertEqual(paths.find_post_dir(self.mc, "B1").parent.name, "backups")
        self.assertIsNone(paths.find_post_dir(self.mc, "B1", ("posts",)))
        self.assertEqual(paths.find_post_dir(self.mc, "A01"), self.mc / "article")
        self.assertIsNone(paths.find_post_dir(self.mc, "P13"))

    def test_folder_account_and_idea_slug(self):
        ids = ["alex", "sam", "jordan", "acme"]
        self.assertEqual(paths.folder_account("P01-sam-idea-p01", ids), "sam")
        self.assertIsNone(paths.folder_account("P01-idea-p01", ids))
        self.assertEqual(paths.idea_slug("B1-acme-idea-b1", ids), "idea-b1")
        self.assertEqual(paths.idea_slug("P01-idea-p01", ids), "idea-p01")

    def test_missing_required_names_files(self):
        (self.c / "workspace/org/framework.md").unlink()
        p = paths.atomize_paths(self.c)
        self.assertEqual(paths.missing_required(p, 1), ["framework"])
        self.assertEqual(paths.missing_required(p, 2), [])

    def test_missing_required_absent_key(self):
        vp = self.c / "videopowers.md"
        vp.write_text("\n".join(l for l in vp.read_text().splitlines() if not l.startswith("- accounts:")) + "\n")
        p = paths.atomize_paths(self.c)
        self.assertNotIn("accounts", p)
        self.assertEqual(paths.missing_required(p, 2), ["accounts"])

    def test_ensure_setup_creates_notes_and_brand(self):
        p = paths.atomize_paths(self.c)
        (p["brand"] / "Acme-Logo.svg").write_text("<svg/>")
        made = paths.ensure_setup(p)
        self.assertEqual({f.name for f in made}, {"scoring-notes.md", "matching-notes.md", "quality-bar-notes.md", "brand.json"})
        brand = json.loads((p["brand"] / "brand.json").read_text())
        self.assertEqual(set(brand), {"name", "logo", "font", "colours", "themes"})
        self.assertEqual(brand["logo"], "Acme-Logo.svg")
        p["scoring_notes"].write_text("# mine\n")
        self.assertEqual(paths.ensure_setup(p), [])
        self.assertEqual(p["scoring_notes"].read_text(), "# mine\n")

    def test_ensure_setup_logo_empty_when_none(self):
        p = paths.atomize_paths(self.c)
        paths.ensure_setup(p)
        self.assertEqual(json.loads((p["brand"] / "brand.json").read_text())["logo"], "")

    def _check(self, *args, **kw):
        return subprocess.run([sys.executable, str(KIT / "paths.py"), "check", *args], capture_output=True, text=True, **kw)

    def test_check_cli(self):
        vid = str(self.c / "videos/01-fixture-video")
        r = self._check(vid, "--stage", "1")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        (self.c / "videos/01-fixture-video/script.md").unlink()
        r = self._check(vid, "--stage", "1")
        self.assertEqual(r.returncode, 1)
        self.assertIn("script.md", r.stdout)
        self.assertEqual(self._check(vid, "--stage", "2").returncode, 0)

    def test_check_cli_slug_from_parent_dir(self):
        r = self._check("fixture-video", "--stage", "1", cwd=self.tmp)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(paths.locate_content_root(self.tmp), self.c.resolve())

    def test_locate_content_root_errors(self):
        empty = Path(tempfile.mkdtemp())
        try:
            with self.assertRaises(FileNotFoundError):
                paths.locate_content_root(empty)
            for n in ("a", "b"):
                (empty / n).mkdir()
                (empty / n / "videopowers.md").write_text("x")
            with self.assertRaises(FileNotFoundError):
                paths.locate_content_root(empty)
        finally:
            shutil.rmtree(empty, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
