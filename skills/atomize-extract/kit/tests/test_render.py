import json, shutil, sys, tempfile, unittest
from pathlib import Path

from PIL import Image

KIT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KIT))
import render  # noqa: E402
import paths  # noqa: E402

BRAND = KIT / "tests" / "fixtures" / "brand"  # a made-up brand: no font, two colours
SRC = "Test source 2021."
TPL = KIT / "templates"
T = json.loads((TPL / "templates.json").read_text())


def slide(t, **slots):
    return {"template": t, "slots": slots}


TITLE = slide("title", kicker="Kicker", headline="A headline with *a highlight*", lead="A short lead.")
STAT = slide("stat", kicker="Kicker", headline="One number", number="81%", number_label="of invoices were paid late")
CMP = slide("compare", kicker="K", headline="Two numbers", left_label="Phone number", left_value="29%", right_label="A date + a person", right_value="85%")
STEPS = slide("steps", kicker="K", headline="Steps", items=[{"title": "First", "text": "Do this."}, {"title": "Second"}])
LIST = slide("list", kicker="K", headline="List", items=[{"text": "Age", "mark": "no"}, {"text": "Gender", "mark": "no"}, {"text": "Days", "mark": "yes"}])
QUOTE = slide("quote", kicker="K", quote="\"A real quote.\"", who="Someone")
ASK = slide("ask", kicker="Your turn", question="How many days at *your practice?*", cta="Tell us in the comments.")


STAT_SLIDE = {"template": "stat", "slots": {"kicker": "K", "headline": "One", "number": "81%", "number_label": "x"}}
INFO = {"kind": "infographic", "theme": "light", "source": SRC, "slides": [STAT_SLIDE]}


class RenderTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_brand_defaults_when_missing(self):
        self.assertEqual(render.load_brand(self.tmp), paths.BRAND_DEFAULTS)

    def test_brand_json_merged_over_defaults(self):
        (self.tmp / "brand.json").write_text(json.dumps({"name": "X", "font": "Lato"}))
        b = render.load_brand(self.tmp)
        self.assertEqual((b["name"], b["font"], b["themes"]), ("X", "Lato", ["light", "dark"]))

    def test_logo_from_brand_json(self):
        h = render.build_html(INFO, TPL, self.tmp, {**paths.BRAND_DEFAULTS, "logo": "x-logo.png", "name": "X"})
        self.assertIn("x-logo.png", h)
        self.assertIn('alt="X"', h)

    def test_no_logo_when_empty(self):
        h = render.build_html(INFO, TPL, self.tmp, paths.BRAND_DEFAULTS)
        parts = h.split('class="foot"')
        self.assertEqual(len(parts), 2, "template no longer has a foot")
        self.assertNotIn("<img src", parts[1])

    def test_theme_from_brand(self):
        self.assertTrue(render.validate({**INFO, "theme": "light"}, T, ["dark"]))
        self.assertEqual(render.validate({**INFO, "theme": "purple"}, T, ["dark"]), [])

    def test_brand_colours_become_css_variables(self):
        h = render.build_html(INFO, TPL, BRAND, render.load_brand(BRAND))
        self.assertIn("--primary:#0b6e4f;", h)
        self.assertIn("--accent:#d9822b;", h)
        self.assertNotIn("brand.css", h)  # no brand.css in the folder, so none is linked

    def test_old_theme_name_still_renders_dark(self):
        h = render.build_html({**INFO, "theme": "purple"}, TPL, BRAND, render.load_brand(BRAND))
        self.assertIn("t-dark", h)
        self.assertEqual(render.validate({**INFO, "theme": "purple"}, T, ["light", "dark"]), [])

    def run_slots(self, data, templates=None):
        p = self.tmp / "slots.json"
        p.write_text(json.dumps(data))
        return render.render(p, self.tmp / "out", BRAND, templates)

    def test_carousel_renders(self):
        r = self.run_slots({"kind": "carousel", "theme": "light", "source": SRC, "slides": [TITLE, STAT, CMP, STEPS, LIST, QUOTE, ASK]})
        self.assertTrue(r["ok"], r)
        out = self.tmp / "out"
        pngs = sorted(out.glob("slide-*.png"))
        self.assertEqual(len(pngs), 7)
        self.assertEqual(Image.open(pngs[0]).size, (2160, 2700))
        self.assertEqual(len(__import__("re").findall(rb"/Type\s*/Page\b", (out / "carousel.pdf").read_bytes())), 7)
        self.assertTrue((out / "contact.png").exists())
        self.assertEqual(len(r["slides"]), 7)

    def test_infographic_one_slide(self):
        r = self.run_slots({"kind": "infographic", "theme": "dark", "source": SRC, "slides": [STAT]})
        self.assertTrue(r["ok"], r)
        self.assertEqual(len(r["files"]), 1)

    def test_multi_image_rejected(self):
        r = self.run_slots({"kind": "multi-image", "theme": "light", "source": SRC, "slides": [STAT, CMP, QUOTE]})
        self.assertFalse(r["ok"], r)

    def test_cover_landscape(self):
        r = self.run_slots({"kind": "article-cover", "theme": "dark", "source": SRC, "slides": [slide("cover", kicker="Newsletter", headline="A title")]})
        self.assertTrue(r["ok"], r)
        self.assertEqual(Image.open(r["files"][0]).size, (2400, 1350))

    def test_slot_over_limit(self):
        long = slide("stat", kicker="K", headline="x" * 91, number="1", number_label="y")
        r = self.run_slots({"kind": "infographic", "theme": "light", "source": SRC, "slides": [long]})
        self.assertFalse(r["ok"])
        self.assertTrue(any("slides[0].headline" in e for e in r["errors"]), r["errors"])
        self.assertFalse((self.tmp / "out" / "visual.html").exists())

    def test_unknown_template(self):
        r = self.run_slots({"kind": "infographic", "theme": "light", "source": SRC, "slides": [slide("nope", a="b")]})
        self.assertFalse(r["ok"])
        self.assertIn("unknown template", r["errors"][0])

    def test_carousel_must_end_with_ask(self):
        r = self.run_slots({"kind": "carousel", "theme": "light", "source": SRC, "slides": [TITLE, STAT, CMP, STEPS, LIST]})
        self.assertFalse(r["ok"])

    def test_overflow_detected(self):
        tdir = self.tmp / "templates"
        shutil.copytree(KIT / "templates", tdir)
        spec = json.loads((tdir / "templates.json").read_text())
        spec["tight"] = {"size": "portrait", "slots": {"text": {"max": 2000}}}
        (tdir / "templates.json").write_text(json.dumps(spec))
        (tdir / "tight.html").write_text('<div class="inner"><p data-slot="text" style="height:120px;overflow:hidden;font-size:30px">{{text}}</p></div>')
        r = self.run_slots({"kind": "infographic", "theme": "light", "source": SRC,
                            "slides": [slide("tight", text="A line of text that wraps. " * 40)]}, tdir)
        self.assertTrue(r["overflow"], r)
        self.assertFalse(r["ok"])

    def test_font_loaded(self):
        r = self.run_slots({"kind": "infographic", "theme": "light", "source": SRC, "slides": [CMP]})
        self.assertTrue(r["font_ok"], r)

    def test_text_contains_slots(self):
        r = self.run_slots({"kind": "infographic", "theme": "light", "source": SRC, "slides": [STAT]})
        self.assertIn("81%", r["text"])
        self.assertIn(SRC, r["text"])
        self.assertNotIn("Swipe", r["text"])
        self.assertEqual(r["headline"], "One number")

    def test_png_under_5mb(self):
        r = self.run_slots({"kind": "infographic", "theme": "light", "source": SRC, "slides": [STAT]})
        self.assertLess(Path(r["files"][0]).stat().st_size, 5 * 1024 * 1024)


if __name__ == "__main__":
    unittest.main()
