import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KIT))
sys.path.insert(0, str(KIT / "tests"))
import cards  # noqa: E402
import fixture_tree  # noqa: E402

GOOD = KIT / "tests" / "fixtures" / "card_good.md"
LISTS = json.loads((KIT / "lists.json").read_text())
VOCAB = {"products": {"chat", "voice", "both", "none"}, "buckets": {"problem", "options", "us", "buying"},
         "idea_types": set(LISTS["idea_types"])}
S = {"stands_alone": "pass", "hook": 4, "retain": 4, "reward": 3, "true": "pass", "total": 11}


class CardsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.root = fixture_tree.make_tree(self.tmp)
        self.mc = self.root / "videos" / "01-fixture-video" / "microcontent"

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def write(self, text):
        p = self.tmp / "card.md"
        p.write_text(text)
        return p

    def errs_with(self, **fields):
        c = cards.load(GOOD)
        c.update(fields)
        return cards.validate(c, VOCAB)

    def errs_without(self, key):
        c = cards.load(GOOD)
        del c[key]
        return cards.validate(c, VOCAB)

    def plan_with(self, **fields):
        p = cards.load_plan(self.mc / "article" / "plan.md")
        p.update(fields)
        return p

    def plan_with_title(self, title):
        return self.plan_with(titles=[title, "A second title"])

    def plan_with_figures(self, figs):
        p = cards.load_plan(self.mc / "article" / "plan.md")
        p["sections"] = [{**s, "figure": figs[i] if i < len(figs) else ""} for i, s in enumerate(p["sections"])]
        return p

    def test_good_card_passes(self):
        c = cards.load(GOOD)
        self.assertEqual(cards.validate(c, VOCAB), [])
        self.assertEqual(c["prose"]["Ask"], "How many days from yes to the first appointment?")

    def test_missing_key_fails(self):
        self.assertIn("missing field: customer_story", self.errs_without("customer_story"))

    def test_bad_enum_fails(self):
        self.assertTrue(any("product" in e for e in self.errs_with(product="phone")))
        self.assertTrue(any(e.startswith("bucket") for e in self.errs_with(bucket="awareness")))
        self.assertTrue(any("idea_type" in e for e in self.errs_with(idea_type="riddle")))
        self.assertEqual(self.errs_with(idea_type="surprising number"), [])
        self.assertTrue(any("step" in e for e in self.errs_with(step=8)))
        self.assertTrue(any("persona" in e for e in self.errs_with(persona=" ")))
        self.assertTrue(any("points_to_offer" in e for e in self.errs_with(points_to_offer="no")))

    def test_unknown_source(self):
        c = cards.load(self.write(GOOD.read_text().replace('{value: "235", source: s1}', '{value: "235", source: s9}')))
        self.assertTrue(any("unknown source" in e for e in cards.validate(c, VOCAB)))

    def test_no_number_card_needs_said_in(self):
        self.assertTrue(any("said_in" in e for e in self.errs_with(numbers=[], excerpts=[], said_in=[])))
        quote = {"file": "script.md", "quote": "At night, nobody picks up the phone."}
        self.assertEqual(self.errs_with(numbers=[], excerpts=[], said_in=[quote]), [])
        self.assertTrue(any("said_in" in e for e in self.errs_with(said_in=[{"file": "script.md"}])))

    def test_scores_total_and_range(self):
        self.assertEqual(cards.scores_errors(S), [])
        self.assertTrue(cards.scores_errors({**S, "total": 12}))
        self.assertTrue(cards.scores_errors({**S, "hook": 6}))
        self.assertTrue(cards.scores_errors({**S, "true": "maybe"}))
        self.assertTrue(cards.scores_errors({k: v for k, v in S.items() if k != "retain"}))

    def test_passes_bar(self):
        self.assertTrue(cards.passes_bar(S))
        self.assertFalse(cards.passes_bar({**S, "reward": 2, "hook": 5, "total": 11}))
        self.assertFalse(cards.passes_bar({**S, "true": "fail"}))
        self.assertFalse(cards.passes_bar({**S, "hook": 3, "retain": 3, "reward": 3, "total": 9}))

    def test_finding_id_format(self):
        self.assertTrue(self.errs_with(findings=["marlow"]))
        self.assertTrue(self.errs_with(findings=[]))

    def test_card_numbers_include_derived_year_and_said_in(self):
        c = cards.load(GOOD)
        self.assertEqual(cards.card_numbers(c), {"235", "10", "20", "1995"})
        c["said_in"] = [{"file": "script.md", "quote": "It took 48 hours."}]
        self.assertIn("48", cards.card_numbers(c))

    def test_vocab_from_workspace(self):
        v = cards.load_vocab(self.root)
        self.assertEqual(v["products"], {"chat", "voice", "both", "none"})
        self.assertEqual(v["buckets"], {"problem", "options", "us", "buying"})
        self.assertEqual(v["idea_types"], VOCAB["idea_types"])

    def test_vocab_missing_products_block_names_file(self):
        d = self.root / "workspace" / "org" / "details.md"
        d.write_text(d.read_text().replace("```products\nchat\nvoice\nboth\nnone\n```\n", ""))
        with self.assertRaisesRegex(ValueError, "details.md"):
            cards.load_vocab(self.root)

    def test_plan_parses(self):
        p = cards.load_plan(self.mc / "article" / "plan.md")
        self.assertEqual(len(p["titles"]), 2)
        self.assertEqual(p["subtitles"], ["What 235 callers say about waiting"])
        self.assertEqual(p["sections"][0]["heading"], "The guess")
        self.assertEqual(p["sections"][1]["figure"], "figure-2")
        self.assertEqual(cards.plan_figures(p), ["figure-1", "figure-2"])
        self.assertEqual(cards.validate_plan(p), [])

    def test_plan_title_too_long(self):
        self.assertTrue(any("60" in e for e in cards.validate_plan(self.plan_with_title("x" * 61))))
        self.assertEqual(cards.validate_plan(self.plan_with_title("x" * 60)), [])

    def test_plan_needs_two_or_three_figures(self):
        self.assertTrue(cards.validate_plan(self.plan_with_figures(["figure-1"])))
        self.assertTrue(cards.validate_plan(self.plan_with_figures(["figure-1", "figure-1"])))
        self.assertTrue(cards.validate_plan(self.plan_with_figures(["figure-1", "figure-4"])))

    def test_plan_other_rules(self):
        self.assertTrue(cards.validate_plan(self.plan_with(id="P01")))
        self.assertTrue(cards.validate_plan(self.plan_with(close="")))
        self.assertTrue(cards.validate_plan(self.plan_with(subtitles=[])))
        self.assertTrue(any("unknown source" in e for e in cards.validate_plan(self.plan_with(excerpts=[{"source": "s9", "text": "x"}]))))

    def test_handover_counts(self):
        for n, p, want in [(16, 4, (12, 4)), (20, 4, (12, 4)), (13, 4, (12, 1)), (12, 4, (12, 0)), (10, 4, (8, 2)),
                           (8, 4, (8, 0)), (7, 4, None), (15, 5, (15, 0)), (20, 5, (15, 5))]:
            self.assertEqual(cards.handover_counts(n, p), want, (n, p))

    def test_no_front_matter(self):
        with self.assertRaises(ValueError):
            cards.load(self.write("just text"))


if __name__ == "__main__":
    unittest.main()
