import re, shutil, sys, tempfile, unittest
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
X = KIT.parent
sys.path.insert(0, str(KIT))
sys.path.insert(0, str(KIT / "tests"))
import fixture_tree as ft  # noqa: E402
import review  # noqa: E402


class ReviewTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.c = ft.make_tree(self.tmp)
        self.mc = self.c / "videos" / "01-fixture-video" / "microcontent"

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def html(self):
        return review.build_review(self.mc).read_text()

    def html_with(self, field, value):
        card = next((self.mc / "posts").glob("P01-*/card.md"))
        t = card.read_text()
        t = re.sub(rf"^{field}: .*$", f"{field}: {value!r}" if field == "repeat_flag" else f'{field}: "{value}"', t, count=1, flags=re.M)
        card.write_text(t)
        return self.html()

    def test_counts_and_formats(self):
        h = self.html()
        self.assertIn("12 posts · 4 backups · article · 2 not picked", h)
        self.assertIn("6 infographic · 6 carousel", h)

    def test_ids_shown(self):
        h = self.html()
        self.assertTrue(all(i in h for i in ["P01", "P12", "B4", "C17"]))

    def test_no_account_names_before_posts(self):
        for f in (self.mc / "posts").glob("*/post.md"):
            f.unlink()
        h = self.html()
        self.assertFalse(any(n in h for n in ["Alex", "Sam Lee", "Jordan"]))

    def test_stage_note(self):
        for f in (self.mc / "posts").glob("*/post.md"):
            f.unlink()
        self.assertIn("atomize-create fixture-video", self.html())

    def test_visuals_and_downloads(self):
        h = self.html()
        out = self.mc / "review"
        self.assertIn('src="img/P01-01.jpg"', h)
        self.assertTrue((out / "img" / "P01-01.jpg").is_file())
        files = __import__("json").loads((out / "files.json").read_text())
        dl = [k for k in files if k.startswith("dl/")]
        self.assertTrue(dl and all((out / k).is_file() for k in dl))
        self.assertTrue(any(k.endswith("_carousel.pdf") for k in dl))

    def test_repeat_flag_shown(self):
        self.assertIn("Repeat: close to v2-P03", self.html_with("repeat_flag", "close to v2-P03"))

    def test_no_repeat_flag_when_empty(self):
        self.assertNotIn("Repeat:", self.html())

    def test_html_escaped(self):
        self.assertIn("&lt;b&gt;", self.html_with("idea", "<b>x</b>"))

    def test_plan_sections(self):
        h = self.html()
        self.assertIn("figure-1", h)
        self.assertIn("Who shows up after a call", h)

    def test_no_placeholders_left(self):
        self.assertNotIn("{{", self.html())

    def test_template_has_every_placeholder(self):
        t = (X / "templates/review.html").read_text()
        for k in ["title", "brand", "summary", "formats", "howto", "nav", "sections"]:
            self.assertIn("{{" + k + "}}", t)

    def test_parse_candidates(self):
        rows = review.parse_candidates(self.mc / "candidates.md")
        self.assertEqual(len(rows), 18)
        self.assertEqual(rows[16]["id"], "C17")
        self.assertEqual(rows[16]["result"], "not picked")
        self.assertEqual(review.parse_candidates(self.mc / "nope.md"), [])

    def test_no_plan_still_builds(self):
        shutil.rmtree(self.mc / "article")
        self.assertIn("P01", self.html())

    def test_card_details_shown(self):
        h = self.html()
        self.assertIn("<details>", h)

    def test_written_post_has_copy_buttons(self):
        ft.write_post(self.mc, "P01", "sam")
        h = self.html()
        self.assertIn("Copy post", h)
        self.assertIn("Copy comment", h)
        self.assertIn("Post for Sam Lee", h)
        self.assertIn("A clean number the owner can act on.", h)
        self.assertIn("hook 4", h)


if __name__ == "__main__":
    unittest.main()
