import json, re, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KIT))
sys.path.insert(0, str(KIT / "tests"))
import fixture_tree as ft  # noqa: E402
import gate  # noqa: E402
import create  # noqa: E402
import ledger  # noqa: E402


def ledger_paths(mc):
    import paths
    return paths.atomize_paths(mc)


class GateTest(unittest.TestCase):
    def setUp(self):
        self.t2 = Path(tempfile.mkdtemp())
        self.c2 = ft.make_tree(self.t2)
        self.mc2 = self.c2 / "videos" / "01-fixture-video" / "microcontent"

    def tearDown(self):
        shutil.rmtree(self.t2, ignore_errors=True)

    def card2(self, pid="P01"):
        return next((self.mc2 / "posts").glob(f"{pid}-*")) / "card.md"

    def plan(self):
        return self.mc2 / "article" / "plan.md"

    def reasons(self, item):
        res = gate.cmd_cards(self.mc2)
        return next(r for r in res if r["item"].startswith(item))["fail_reasons"]

    def records(self, lead="F-marlow-1995-days", weeks_ago=1, video="other-video"):
        import datetime as dt
        p = ledger_paths(self.mc2)
        day = (dt.date.today() - dt.timedelta(weeks=weeks_ago)).isoformat()
        ledger.write_table([{"finding_id": lead, "last_led_date": day}], p["findings"], ledger.FINDING_COLUMNS)
        ledger.write_table([{"post_id": f"{video}-P01", "video": video, "findings": lead, "status": "posted"}],
                           p["posts"], ledger.POST_COLUMNS)

    def edit(self, path, old, new):
        t = path.read_text()
        self.assertIn(old, t)
        path.write_text(t.replace(old, new))

    def statuses(self, res):
        return {Path(r["item"]).name if "/" in r["item"] else r["item"]: r for r in res}

    # cards
    def test_good_cards_and_plan_pass(self):
        res = gate.cmd_cards(self.mc2)
        self.assertTrue(all(r["status"] == "pass" for r in res), res)
        self.assertIn("plan.md", " ".join(r["item"] for r in res))
        self.assertEqual(len(res), 12 + 4 + 2)

    def test_missing_key_fails(self):
        self.edit(self.card2(), "persona: owner\n", "")
        self.assertIn("missing field: persona", self.reasons("P01"))

    def test_no_number_card_needs_said_in(self):
        t = self.card2().read_text()
        t = t.replace("numbers:\n  - {value: \"235\", source: s1}\n  - {value: \"doubled\", source: s1, derived: \"10 to 20 bookings\"}\n", "numbers: []\n")
        t = t.replace("excerpts:\n  - {source: s1, text: \"Of 235 people who called, only the days until the appointment predicted attendance.\"}\n  - {source: s1, text: \"bookings went from 10 to 20 a week\"}\n", "excerpts: []\n")
        self.card2().write_text(t)
        self.assertTrue(any("said_in" in e for e in self.reasons("P01")))
        self.edit(self.card2(), "said_in: []", 'said_in:\n  - {file: script.md, quote: "At night, nobody picks up the phone."}')
        self.assertEqual(self.reasons("P01"), [])
        self.edit(self.card2(), "nobody picks up the phone.", "everybody answers the phone.")
        self.assertTrue(any("said_in: not found word for word" in e for e in self.reasons("P01")))

    def test_scores_below_bar_fail(self):
        self.edit(self.card2(), "hook: 4, retain: 4, reward: 3, true: pass, total: 11", "hook: 2, retain: 3, reward: 3, true: pass, total: 8")
        self.assertTrue(any("below the bar" in e for e in self.reasons("P01")))

    def test_two_borrowed_findings_fail(self):
        t = self.card2().read_text()
        t = t.replace('tier: T1, file: "research.md"}\n', 'tier: T1, file: "research.md"}\n'
                      '  - {id: s2, title: "X", year: 2000, link: "https://example.org/x", tier: T1, file: "../02-other/research.md"}\n'
                      '  - {id: s3, title: "Y", year: 2001, link: "https://example.org/y", tier: T1, file: "../03-other/research.md"}\n', 1)
        self.card2().write_text(t)
        errs = self.reasons("P01")
        self.assertIn("more than one borrowed finding", errs)

    def test_lead_finding_recent_fails(self):
        self.assertEqual(self.reasons("P01"), [])
        self.records()
        self.assertTrue(any("led a post" in e for e in self.reasons("P01")))

    def test_lead_finding_lookup_excludes_own_video(self):
        self.records(video="fixture-video")
        self.assertEqual(self.reasons("P01"), [])

    def test_lead_finding_old_is_fine(self):
        self.records(weeks_ago=8)
        self.assertEqual(self.reasons("P01"), [])

    def test_banned_word_in_card(self):
        self.edit(self.card2(), "The guess, the answer.", "We leverage the guess.")
        self.assertIn("banned word: leverage", self.reasons("P01"))

    def test_folder_starting_with_account_fails(self):
        d = self.card2().parent
        d.rename(d.parent / "P01-sam-thing")
        self.assertIn("folder name starts with an account id", self.reasons("P01"))

    def test_counts_too_few(self):
        t = ft.make_tree(self.t2 / "few", posts=ft.TWELVE[:5], backups=("B1", "B2"))
        mc = t / "videos" / "01-fixture-video" / "microcontent"
        res = gate.cmd_cards(mc)
        self.assertTrue(any("fewer than 2 per profile" in e for r in res if r["item"] == "counts" for e in r["fail_reasons"]))

    def test_counts_need_post_cards(self):
        for pid in ("P11", "P12"):
            shutil.rmtree(next((self.mc2 / "posts").glob(f"{pid}-*")))
        # 10 posts + 4 backups = 14: 3 per profile of 4 needs 12 post cards
        self.assertIn("need 12 post cards", self.reasons("counts"))

    def test_old_layout_named(self):
        for old in ["pieces", "spares", "ready"]:
            (self.mc2 / old).mkdir()
            res = gate.cmd_cards(self.mc2)
            (self.mc2 / old).rmdir()
            self.assertEqual(len(res), 1)
            self.assertIn("old layout", res[0]["fail_reasons"][0])

    def test_empty_mc_fails(self):
        shutil.rmtree(self.mc2 / "posts")
        shutil.rmtree(self.mc2 / "backups")
        res = gate.cmd_cards(self.mc2)
        self.assertEqual(res[0]["status"], "fail")
        self.assertIn("no cards", res[0]["fail_reasons"][0])

    def test_missing_plan_fails(self):
        self.plan().unlink()
        self.assertIn("article/plan.md missing", self.reasons("article/plan.md"))

    def test_folder_name_with_profile_ok_after_match(self):
        d = next((self.mc2 / "posts").glob("P01-*"))
        d.rename(d.with_name("P01-sam-" + d.name.split("-", 1)[1]))
        self.assertTrue(any("starts with an account id" in e for e in self.reasons("P01")))
        (self.mc2 / "match.json").write_text(json.dumps({"allocation": {"P01": "sam"}}))
        self.assertFalse(any("starts with an account id" in e for e in self.reasons("P01")))

    def test_plan_uses_unknown_source(self):
        t = self.plan().read_text()
        self.plan().write_text(t.replace("Uses: s1", "Uses: s1 (\"6\"), s9 (quote)", 1))
        self.assertTrue(any("Uses names s9" in e for e in self.reasons("article/plan.md")))

    def test_plan_checks(self):
        orig = self.plan().read_text()
        self.edit(self.plan(), "1. Who shows up after a call", "1. " + "T" * 61)
        self.assertTrue(any("over 60" in e for e in self.reasons("article/plan.md")))
        self.plan().write_text(orig)
        self.edit(self.plan(), "Figure: figure-2", "Figure: figure-1")
        self.assertTrue(any("figures" in e for e in self.reasons("article/plan.md")))
        self.plan().write_text(orig)
        self.edit(self.plan(), 'numbers:\n  - {value: "235", source: s1}', 'numbers:\n  - {value: "999", source: s1}')
        self.assertTrue(any("999" in e for e in self.reasons("article/plan.md")))
        self.plan().write_text(orig)
        self.edit(self.plan(), "A guess first", "A leverage guess first")
        self.assertIn("banned word: leverage", self.reasons("article/plan.md"))
        self.plan().write_text(orig)
        self.edit(self.plan(), "Of 235 people who called, only the days until the appointment predicted attendance.", "Of 235 people who called, only the cost predicted attendance.")
        self.assertTrue(any("not found word for word" in e for e in self.reasons("article/plan.md")))

    def test_excerpt_normalisation(self):
        # curly quotes and markdown in the source: the plain copy in the card still matches
        self.assertEqual(self.reasons("P01"), [])
        self.edit(self.card2(), "only the days until the appointment predicted attendance.", "only the waiting time predicted attendance.")
        self.assertTrue(any("not found word for word" in e for e in self.reasons("P01")))

    def test_excerpt_with_ellipsis(self):
        self.assertTrue(gate.excerpt_found("Marlow and colleagues followed ... called an outpatient dental clinic", ft.RESEARCH))
        self.assertFalse(gate.excerpt_found("short ... bits", ft.RESEARCH))

    def test_markdown_in_source(self):
        self.assertTrue(gate.excerpt_found("followed 235 people who called", ft.RESEARCH))
        self.assertTrue(gate.excerpt_found("See the report.", ft.RESEARCH))

    def test_card_number_not_in_excerpt(self):
        self.edit(self.card2(), '{value: "235", source: s1}', '{value: "72%", source: s1}')
        self.assertTrue(any("72%" in e for e in self.reasons("P01")))

    # visuals (v2 tree)
    def vdir(self, pid="P01"):
        return self.card2().parent

    def set_report(self, d, **kw):
        rep = json.loads((d / "report.json").read_text())
        for k, v in kw.items():
            rep[k] = rep.get(k, "") + v if k == "text" else v
        (d / "report.json").write_text(json.dumps(rep))

    def test_derived_numbers_allowed(self):
        d = self.vdir()
        self.set_report(d, text="\nfrom 10 to 20 bookings")
        self.assertEqual(gate.cmd_visuals([d])[0]["status"], "pass")

    def test_visual_number_not_in_card(self):
        d = self.vdir()
        self.set_report(d, text="\n72% missed")
        r = gate.cmd_visuals([d])[0]
        self.assertTrue(any("72%" in e for e in r["fail_reasons"]), r)

    def test_visual_overflow_fails(self):
        d = self.vdir()
        self.set_report(d, overflow=["slide 1: headline: spills its box: x"])
        self.assertEqual(gate.cmd_visuals([d])[0]["status"], "fail")

    def test_team_name_on_visual(self):
        d = self.vdir()
        self.set_report(d, text="\nAs Alex found")
        r = gate.cmd_visuals([d])[0]
        self.assertTrue(any("Alex" in e for e in r["fail_reasons"]), r)
        rep = json.loads((d / "report.json").read_text())
        rep["text"] = rep["text"].replace("As Alex found", "Acme builds")
        (d / "report.json").write_text(json.dumps(rep))
        self.assertEqual(gate.cmd_visuals([d])[0]["status"], "pass")

    def test_article_image_uses_plan(self):
        d = self.mc2 / "article" / "figure-1"
        self.assertEqual(gate.cmd_visuals([d])[0]["status"], "pass", gate.cmd_visuals([d]))
        self.set_report(d, text="\n999 callers")
        r = gate.cmd_visuals([d])[0]
        self.assertTrue(any("999" in e for e in r["fail_reasons"]), r)

class PostsGateTest(unittest.TestCase):
    def setUp(self):
        self.t = Path(tempfile.mkdtemp())
        self.c = ft.make_tree(self.t)
        self.mc = self.c / "videos" / "01-fixture-video" / "microcontent"
        ledger.add(self.mc, "made")
        ft.write_scores(self.mc)
        self.alloc = create.match(self.mc)["allocation"]
        for pid, a in self.alloc.items():
            ft.write_post(self.mc, pid, a)
        ft.write_article(self.mc)
        self.accounts = self.c / "workspace" / "profiles" / "accounts.md"

    def tearDown(self):
        shutil.rmtree(self.t, ignore_errors=True)

    def folder(self, pid="P01"):
        return next((self.mc / "posts").glob(f"{pid}-*"))

    def post_md(self, pid="P01"):
        return self.folder(pid) / "post.md"

    def post_result(self, pid="P01", allow=True):
        res = gate.cmd_posts(self.mc, allow)
        return next(r for r in res if r["item"].startswith(f"{pid}-"))

    def write(self, pid="P01", caption=ft.CAPTION):
        return ft.write_post(self.mc, pid, self.alloc[pid], caption)

    def reasons_with_upload(self, names):
        f = self.post_md()
        f.write_text(re.sub(r"(?m)^Upload:.*$", f"Upload: {names}", f.read_text()))
        return self.post_result()["fail_reasons"]

    def reasons_with_account(self, account):
        f = self.post_md()
        f.write_text(f.read_text().replace(f"account: {self.alloc['P01']}", f"account: {account}", 1))
        return self.post_result()["fail_reasons"]

    def test_all_good_posts_pass(self):
        res = gate.cmd_posts(self.mc, True)
        self.assertEqual(len(res), 12)
        self.assertTrue(all(r["status"] == "pass" for r in res), res)

    def test_good_post_passes(self):
        self.assertEqual(self.post_result("P01")["status"], "pass")

    def test_no_disclosure_check(self):
        d = self.folder()
        d.joinpath("card.md").write_text(d.joinpath("card.md").read_text().replace("points_to_offer: false", "points_to_offer: true"))
        self.assertEqual(self.post_result("P01")["status"], "pass")

    def test_no_post_files(self):
        for f in (self.mc / "posts").glob("*/post.md"):
            f.unlink()
        res = gate.cmd_posts(self.mc, True)
        self.assertIn("no post.md in posts/", res[0]["fail_reasons"])

    def test_upload_names_relative_to_folder(self):
        self.assertIn("upload file missing: files/x.png", self.reasons_with_upload("files/x.png"))

    def test_upload_file_exists_in_folder(self):
        name = Path(json.loads((self.folder() / "report.json").read_text())["files"][0]).name
        self.assertTrue((self.folder() / name).is_file())
        self.assertEqual(self.post_result()["fail_reasons"], [])

    def test_account_matches_folder(self):
        other = next(a for a in ("alex", "sam", "jordan", "acme") if a != self.alloc["P01"])
        errs = self.reasons_with_account(other)
        self.assertIn(f"post account {other}, folder says {self.alloc['P01']}", errs)

    def test_missing_front_matter_key(self):
        f = self.post_md()
        f.write_text(f.read_text().replace("hook_type: number-first\n", ""))
        self.assertIn("front matter: missing hook_type", self.post_result()["fail_reasons"])

    def test_ask_type_not_required(self):
        f = self.post_md()
        f.write_text(f.read_text().replace("ask_type: own-number\n", ""))
        self.assertEqual(self.post_result()["status"], "pass")

    def test_samey_first_line_from_posts_csv(self):
        pp = self.mc.parents[2] / "workspace" / "records" / "posts.csv"
        rows = ledger.read_table(pp, ledger.POST_COLUMNS)
        rows.append({"post_id": "old-P01", "video": "old", "status": "posted",
                     "first_line": "235 people called an dental clinic. One thing predicted everything."})
        ledger.write_table(rows, pp, ledger.POST_COLUMNS)
        self.assertTrue(any("too close" in e for e in self.post_result()["fail_reasons"]))

    def test_own_video_first_lines_ignored(self):
        pp = self.mc.parents[2] / "workspace" / "records" / "posts.csv"
        rows = ledger.read_table(pp, ledger.POST_COLUMNS)
        for r in rows:
            r["first_line"] = "235 people called an dental clinic. One thing predicted who showed up."
        ledger.write_table(rows, pp, ledger.POST_COLUMNS)
        self.assertFalse(any("too close" in e for e in self.post_result()["fail_reasons"]))

    def test_post_long_first_paragraph(self):
        self.write(caption="x " * 106 + "\n\nHow many days at your practice?")
        self.assertTrue(any("hook" in e for e in self.post_result()["fail_reasons"]))

    def test_post_banned_char(self):
        self.write(caption=ft.CAPTION.replace("It was not age.", "It was not age \u2014 it was"))
        self.assertTrue(any("\u2014" in e for e in self.post_result()["fail_reasons"]))

    def test_post_placeholder_tbd(self):
        self.write(caption=ft.CAPTION + "\n\nTBD")
        self.assertEqual(self.post_result()["status"], "fail")

    def test_post_token_allowed_flag(self):
        self.assertEqual(self.post_result(allow=False)["status"], "fail")
        self.assertEqual(self.post_result(allow=True)["status"], "pass")

    def test_post_link_in_caption(self):
        self.write(caption=ft.CAPTION + "\n\nhttps://example.org")
        self.assertTrue(any("link in the caption" in e for e in self.post_result()["fail_reasons"]))

    def test_link_with_banned_name_is_fine(self):
        pid = next(p for p, a in self.alloc.items() if a == "sam")
        f = self.post_md(pid)
        f.write_text(f.read_text().replace("{{VIDEO_POST_URL}}", "https://www.linkedin.com/posts/alex-agrawal-abc_x-activity-1"))
        r = self.post_result(pid, allow=False)
        self.assertEqual(r["status"], "pass", r)

    def test_bad_front_matter_fails_one_post(self):
        f = self.post_md()
        f.write_text(f.read_text().replace("---\n", "---\ncaption_shape: a: b: c\n", 1))
        res = gate.cmd_posts(self.mc, True)
        bad = [r for r in res if r["item"] == f.parent.name][0]
        self.assertEqual(bad["status"], "fail")
        self.assertTrue(any("could not be read" in e for e in bad["fail_reasons"]))
        self.assertTrue(len(res) > 1)

    def test_stat_after_title_twice_in_a_theme(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            dirs = []
            for name, second, theme in (("P01-a", "stat", "purple"), ("P02-b", "stat", "light"), ("P03-c", "stat", "purple"),
                                        ("P04-d", "list", "purple")):
                d = tmp / name
                d.mkdir()
                slides = [{"template": "title"}, {"template": second}, {"template": "steps" if name < "P03" else "list"}, {"template": "ask"}]
                (d / "slots.json").write_text(json.dumps({"kind": "carousel", "theme": theme, "slides": slides}))
                dirs.append(d)
            out = gate.layout_repeats(dirs)
            self.assertEqual([bool(x) for x in out], [False, False, True, False])
            self.assertIn("big-number slide", out[2])
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_short_link_accepted(self):
        f = self.post_md()
        f.write_text(f.read_text().replace("{{VIDEO_POST_URL}}", "https://lnkd.in/p/abc123"))
        self.assertFalse(any("no link" in e for e in self.post_result(allow=False)["fail_reasons"]))

    def test_layout_repeat_flagged(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            slots = {"kind": "infographic", "theme": "light", "slides": [{"template": "list", "slots": {}}]}
            dirs = []
            for name, theme in (("P01-a", "light"), ("P02-b", "purple"), ("P03-c", "light")):
                d = tmp / name
                d.mkdir()
                (d / "slots.json").write_text(json.dumps(dict(slots, theme=theme)))
                dirs.append(d)
            out = gate.layout_repeats(dirs)
            self.assertEqual(out[:2], ["", ""])
            self.assertIn("looks like P01", out[2])
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_alt_text_checked(self):
        f = self.post_md()
        f.write_text(f.read_text().replace("A list of things about a caller.", "A list of things \u2014 about a caller."))
        self.assertTrue(any("\u2014" in e for e in self.post_result()["fail_reasons"]))

    def test_question_in_the_middle(self):
        self.write(caption=ft.CAPTION.replace("It was not age.", "Do you know your number? It was not age."))
        self.assertTrue(any("more than one ask" in e for e in self.post_result()["fail_reasons"]))
        self.write(caption=ft.CAPTION.replace("It was not age.", "They asked:\n1. Will my insurance be accepted?\nIt was not age."))
        self.assertFalse(any("more than one ask" in e for e in self.post_result()["fail_reasons"]))

    def test_post_number_not_in_card(self):
        self.write(caption=ft.CAPTION.replace("235 people", "300 people"))
        self.assertTrue(any("300" in e for e in self.post_result()["fail_reasons"]))

    def test_upload_count(self):
        pid = next(p for p in self.alloc if json.dumps(json.loads((self.folder(p) / "report.json").read_text())["files"]).count(".png") == 1)
        f = self.post_md(pid)
        f.write_text(re.sub(r"(?m)^Upload:.*$", "Upload: slide-01.png, slide-02.png", f.read_text()))
        self.assertTrue(any("upload files listed" in e for e in self.post_result(pid)["fail_reasons"]))

    def test_exit_code(self):
        self.write(caption=ft.CAPTION + "\n\nTBD")
        r = subprocess.run([sys.executable, str(KIT / "gate.py"), "posts", str(self.mc), "--allow-token"], capture_output=True)
        self.assertEqual(r.returncode, 1)
        self.assertEqual(json.loads(r.stdout.decode().splitlines()[0])["status"], "fail")

    # article
    def article(self, allow=True):
        return gate.cmd_article(self.mc, allow)[0]

    def test_article_passes(self):
        self.assertEqual(self.article()["status"], "pass", self.article())

    def test_article_token_flag(self):
        self.assertEqual(self.article(allow=False)["status"], "fail")

    def test_article_reads_plan(self):
        ft.write_article(self.mc, "<p>Of 235 callers and 999 more.</p><p>The full video: {{VIDEO_POST_URL}}</p>")
        self.assertTrue(any("999" in e for e in self.article()["fail_reasons"]))
        ft.write_article(self.mc, "<p>Of 235 callers in 1995.</p><p>The full video: {{VIDEO_POST_URL}}</p>")
        self.assertEqual(self.article()["status"], "pass")

    def test_article_needs_plan(self):
        (self.mc / "article" / "plan.md").unlink()
        self.assertIn("plan.md missing", self.article()["fail_reasons"][0])

    def test_article_title_length(self):
        p = self.mc / "article" / "article.html"
        p.write_text(p.read_text().replace("Who shows up after a call</p><p data-field=\"seo", "T" * 61 + "</p><p data-field=\"seo"))
        self.assertTrue(any("title" in e for e in self.article()["fail_reasons"]))

    def test_article_author_from_settings(self):
        ft.write_article(self.mc, "<p>Alex found 235 callers.</p><p>The full video: {{VIDEO_POST_URL}}</p>")
        self.assertEqual(self.article()["status"], "pass")
        self.accounts.write_text(self.accounts.read_text().replace("- article author: alex", "- article author: sam"))
        self.assertIn("banned word: Alex", self.article()["fail_reasons"])

    def test_article_unknown_author_fails(self):
        self.accounts.write_text(self.accounts.read_text().replace("- article author: alex", "- article author: nobody"))
        r = self.article()
        self.assertEqual(r["status"], "fail")
        self.assertIn("unknown article author: nobody", r["fail_reasons"])

    def test_article_cli(self):
        r = subprocess.run([sys.executable, str(KIT / "gate.py"), "article", str(self.mc), "--allow-token"], capture_output=True)
        self.assertEqual(r.returncode, 0, r.stdout)


if __name__ == "__main__":
    unittest.main()
