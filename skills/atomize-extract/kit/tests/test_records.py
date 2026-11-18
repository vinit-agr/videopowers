import datetime
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KIT))
sys.path.insert(0, str(KIT / "tests"))
import ledger  # noqa: E402
import fixture_tree as ft  # noqa: E402

SLUG = "fixture-video"


class RecordsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp()).resolve()
        self.content = ft.make_tree(self.tmp)
        self.mc = self.content / "videos" / "01-fixture-video" / "microcontent"
        self.pp = self.content / "workspace" / "records" / "posts.csv"
        self.fp = self.content / "workspace" / "records" / "findings.csv"
        self.today = datetime.date.today().isoformat()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def row(self, short):
        return {r["post_id"]: r for r in ledger.read_table(self.pp, ledger.POST_COLUMNS)}[f"{SLUG}-{short}"]

    def status(self, short):
        return self.row(short)["status"]

    def finding(self, fid):
        return {r["finding_id"]: r for r in ledger.read_table(self.fp, ledger.FINDING_COLUMNS)}[fid]

    def seed(self, rows):
        ledger.write_table([{c: r.get(c, "") for c in ledger.POST_COLUMNS} for r in rows], self.pp, ledger.POST_COLUMNS)

    def test_statuses_list(self):
        self.assertEqual(ledger.STATUSES, ["extracted", "backup", "made", "matched", "written", "ready", "waiting-for-link",
                                           "extra", "dropped", "test", "handed-over", "scheduled", "posted"])

    def test_idea_types_list(self):
        import json
        lists = json.loads((KIT / "lists.json").read_text())
        self.assertEqual(lists["idea_types"], ["surprising number", "myth vs evidence", "real quote or story", "how-to",
                                               "objection", "comparison", "who-it's-not-for", "opinion"])

    def test_upsert_rejects_unknown_status(self):
        with self.assertRaises(ValueError):
            ledger.upsert_posts([{"post_id": "v-P01", "status": "seed"}], self.pp)

    def test_add_extracted_writes_posts_and_backups(self):
        ledger.add(self.mc, "extracted")
        rows = {r["post_id"]: r for r in ledger.read_table(self.pp, ledger.POST_COLUMNS)}
        self.assertEqual(rows["fixture-video-P01"]["status"], "extracted")
        self.assertEqual(rows["fixture-video-B1"]["status"], "backup")
        self.assertEqual(rows["fixture-video-A01"]["format"], "article")
        self.assertEqual(rows["fixture-video-A01"]["idea"], "Who shows up after a call")
        self.assertEqual(rows["fixture-video-P01"]["persona"], "owner")
        self.assertEqual(rows["fixture-video-P01"]["findings"], "F-marlow-1995-days")
        self.assertEqual(len(rows), 17)

    def test_add_as_backup(self):
        ledger.add(self.mc, "extracted", ("P12",))
        self.assertEqual(self.status("P12"), "backup")
        self.assertEqual(self.status("P11"), "extracted")

    def test_add_sets_lead_finding_last_led(self):
        ledger.add(self.mc, "extracted")
        f = self.finding("F-marlow-1995-days")
        self.assertEqual(f["last_led_date"], self.today)
        self.assertIn("fixture-video-P01", f["posts_used"])
        self.assertEqual(f["source_title"], "Marlow et al.")
        self.assertEqual(f["year"], "1995")
        self.assertEqual(f["first_video"], "fixture-video")
        self.assertTrue(f["statement"].startswith("Of 235 people who called"))

    def test_backup_finding_does_not_get_lead_date(self):
        ledger.add(self.mc, "extracted")
        self.assertEqual(self.finding("F-marlow-1995-b1")["last_led_date"], "")

    def test_add_twice_updates_in_place(self):
        ledger.add(self.mc, "extracted")
        card = next((self.mc / "posts").glob("P01-*")) / "card.md"
        card.write_text(card.read_text().replace("Only the days until the appointment predicted who showed up.", "New idea", 1))
        ledger.add(self.mc, "extracted")
        rows = {r["post_id"]: r for r in ledger.read_table(self.pp, ledger.POST_COLUMNS)}
        self.assertEqual(len(rows), 17)
        self.assertEqual(rows["fixture-video-P01"]["idea"], "New idea")
        self.assertEqual(self.finding("F-marlow-1995-days")["posts_used"].count("fixture-video-P01"), 1)

    def test_add_made_keeps_backups_and_later_statuses(self):
        ledger.add(self.mc, "extracted")
        ledger.set_status(self.pp, ["fixture-video-P02"], "matched")
        ledger.add(self.mc, "made")
        self.assertEqual(self.status("P01"), "made")
        self.assertEqual(self.status("P02"), "matched")
        self.assertEqual(self.status("B1"), "backup")

    def test_made_leaves_findings_alone(self):
        ledger.add(self.mc, "made")
        self.assertEqual(ledger.read_table(self.fp, ledger.FINDING_COLUMNS), [])

    def test_test_row_never_overwrites_real_row(self):
        ledger.add(self.mc, "extracted")
        ledger.add(self.mc, "test")
        self.assertEqual(self.status("P01"), "extracted")
        self.assertEqual(self.status("B1"), "backup")

    def test_test_run_leaves_findings_untouched(self):
        ledger.add(self.mc, "test")
        self.assertEqual(ledger.read_table(self.fp, ledger.FINDING_COLUMNS), [])
        self.assertEqual(self.status("P01"), "test")
        self.assertEqual(self.status("B1"), "test")

    def test_test_run_leaves_later_status_rows_untouched(self):
        ledger.add(self.mc, "extracted")
        ledger.set_status(self.pp, ["fixture-video-P01"], "written", account="sam")
        ledger.set_status(self.pp, ["fixture-video-P02"], "ready")
        before = {r["post_id"]: r for r in ledger.read_table(self.pp, ledger.POST_COLUMNS)}
        card = next((self.mc / "posts").glob("P01-*")) / "card.md"
        card.write_text(card.read_text().replace("Only the days until", "Changed days until", 1))
        ledger.add(self.mc, "test")
        after = {r["post_id"]: r for r in ledger.read_table(self.pp, ledger.POST_COLUMNS)}
        self.assertEqual(after, before)
        self.assertEqual(after["fixture-video-P01"]["status"], "written")

    def test_add_keeps_original_date_on_rerun(self):
        ledger.add(self.mc, "extracted")
        rows = ledger.read_table(self.pp, ledger.POST_COLUMNS)
        for r in rows:
            r["date"] = "2026-01-01"
        ledger.write_table(rows, self.pp, ledger.POST_COLUMNS)
        ledger.add(self.mc, "extracted")
        self.assertEqual({r["date"] for r in ledger.read_table(self.pp, ledger.POST_COLUMNS)}, {"2026-01-01"})

    def test_blank_values_never_overwrite(self):
        ledger.upsert_posts([{"post_id": "v-P01", "video": "v", "idea": "Keep me", "status": "extracted"}], self.pp)
        ledger.upsert_posts([{"post_id": "v-P01", "idea": "", "status": "made"}], self.pp)
        r = ledger.read_table(self.pp, ledger.POST_COLUMNS)[0]
        self.assertEqual((r["idea"], r["status"], r["video"]), ("Keep me", "made", "v"))

    def test_upsert_findings_unions_and_keeps_first_video(self):
        base = {"finding_id": "F-a-2020-x", "statement": "s", "first_video": "v1", "videos_used": "v1",
                "posts_used": "v1-P01", "last_led_date": "2026-01-01"}
        ledger.upsert_findings([base], self.fp)
        ledger.upsert_findings([dict(base, first_video="v2", videos_used="v2", posts_used="v2-P03", last_led_date="")], self.fp)
        f = self.finding("F-a-2020-x")
        self.assertEqual((f["first_video"], f["videos_used"], f["posts_used"]), ("v1", "v1; v2", "v1-P01; v2-P03"))
        self.assertEqual(f["last_led_date"], "")
        ledger.upsert_findings([{"finding_id": "F-a-2020-x", "statement": "t"}], self.fp)
        self.assertEqual(self.finding("F-a-2020-x")["statement"], "t")

    def test_recent_ideas_skips_and_caps(self):
        rows = [{"post_id": f"v-P{i}", "video": "v", "idea": f"i{i}", "status": "ready"} for i in range(1, 46)]
        rows += [{"post_id": "v-T", "video": "v", "status": "test"}, {"post_id": "v-D", "video": "v", "status": "dropped"},
                 {"post_id": "v-B", "video": "v", "status": "backup"}]
        self.seed(rows)
        r = ledger.recent_ideas(self.pp)
        self.assertEqual(len(r), 40)
        self.assertEqual(r[-1]["post_id"], "v-P45")
        self.assertFalse({x["status"] for x in r} & {"test", "dropped", "backup"})
        self.seed(rows + [{"post_id": "w-P1", "video": "w", "status": "ready"}])
        r2 = ledger.recent_ideas(self.pp, exclude_video="v")
        self.assertEqual([x["post_id"] for x in r2], ["w-P1"])

    def test_finding_recent_window(self):
        ledger.upsert_findings([
            {"finding_id": "F-a-2020-x", "statement": "a", "last_led_date": "2026-11-26"},
            {"finding_id": "F-b-2020-y", "statement": "b", "last_led_date": "2026-11-12"}], self.fp)
        self.seed([{"post_id": "v-P01", "video": "v", "findings": "F-a-2020-x", "status": "ready"},
                   {"post_id": "v-P02", "video": "v", "findings": "F-b-2020-y", "status": "ready"}])
        ids = [f["finding_id"] for f in ledger.finding_recent(self.fp, self.pp, 6, "2026-12-31")]
        self.assertIn("F-a-2020-x", ids)
        self.assertNotIn("F-b-2020-y", ids)
        ex = [f["finding_id"] for f in ledger.finding_recent(self.fp, self.pp, 6, "2026-12-31", exclude_video="v")]
        self.assertNotIn("F-a-2020-x", ex)
        self.seed([{"post_id": "w-P01", "video": "w", "findings": "F-a-2020-x", "status": "ready"},
                   {"post_id": "v-P01", "video": "v", "findings": "F-a-2020-x", "status": "ready"}])
        ex = [f["finding_id"] for f in ledger.finding_recent(self.fp, self.pp, 6, "2026-12-31", exclude_video="v")]
        self.assertIn("F-a-2020-x", ex)

    def test_recent_first_lines(self):
        self.seed([{"post_id": "v1-P01", "video": "v1", "first_line": "Line one", "status": "ready"},
                   {"post_id": "v2-P01", "video": "v2", "first_line": "Line two", "status": "ready"},
                   {"post_id": "v3-P01", "video": "v3", "first_line": "Line test", "status": "test"}])
        self.assertEqual(ledger.recent_first_lines(self.pp, exclude_video="v2"), ["Line one"])

    def test_drop_moves_folder_and_clears_lead(self):
        ledger.add(self.mc, "extracted")
        d = ledger.drop_post(self.mc, "P03", "too thin")
        self.assertEqual(d, self.mc / "dropped" / "P03-idea-p03")
        self.assertIn("too thin", (d / "reason.txt").read_text())
        self.assertFalse((self.mc / "posts" / "P03-idea-p03").exists())
        self.assertEqual(self.status("P03"), "dropped")
        self.assertEqual(self.finding("F-marlow-1995-days")["last_led_date"], "")

    def test_drop_backup_folder(self):
        ledger.add(self.mc, "extracted")
        d = ledger.drop_post(self.mc, "B1", "weak")
        self.assertEqual(d, self.mc / "dropped" / "B1-idea-b1")
        self.assertEqual(self.status("B1"), "dropped")
        self.assertEqual(self.finding("F-marlow-1995-days")["last_led_date"], self.today)

    def test_drop_test_mode(self):
        ledger.add(self.mc, "test")
        ledger.drop_post(self.mc, "P03", "x", test=True)
        self.assertEqual(self.status("P03"), "test")

    def test_set_status(self):
        ledger.add(self.mc, "extracted")
        self.assertEqual(ledger.set_status(self.pp, ["fixture-video-P01"], "written"), 1)
        self.assertEqual(self.status("P01"), "written")
        with self.assertRaises(ValueError):
            ledger.set_status(self.pp, ["fixture-video-P01"], "bogus")

    def test_set_status_test_mode_leaves_real_rows(self):
        ledger.add(self.mc, "extracted")
        self.assertEqual(ledger.set_status(self.pp, ["fixture-video-P01"], "written", test=True, account="sam"), 0)
        self.assertEqual((self.status("P01"), self.row("P01")["account"]), ("extracted", ""))

    def test_set_status_test_mode_writes_fields_on_test_rows(self):
        ledger.add(self.mc, "test")
        self.assertEqual(ledger.set_status(self.pp, ["fixture-video-P01"], "written", test=True, account="sam"), 1)
        self.assertEqual((self.status("P01"), self.row("P01")["account"]), ("test", "sam"))

    def test_purge(self):
        ledger.add(self.mc, "test")
        self.seed(ledger.read_table(self.pp, ledger.POST_COLUMNS) + [{"post_id": "w-P01", "video": "w", "status": "test"},
                                                                     {"post_id": "w-P02", "video": "w", "status": "ready"}])
        self.assertEqual(ledger.purge(self.pp, "test", SLUG), 17)
        self.assertEqual([r["post_id"] for r in ledger.read_table(self.pp, ledger.POST_COLUMNS)], ["w-P01", "w-P02"])
        self.assertEqual(ledger.purge(self.pp), 1)

    def test_article_row_account_from_settings(self):
        ledger.add(self.mc, "extracted")
        self.assertEqual(self.row("A01")["account"], "alex")

    def run_cli(self, *args):
        return subprocess.run([sys.executable, str(KIT / "ledger.py"), *args], capture_output=True, text=True, cwd=str(self.tmp))

    def test_set_status_cli_short_ids(self):
        self.assertEqual(self.run_cli("add", str(self.mc), "--status", "extracted").returncode, 0)
        r = self.run_cli("set-status", str(self.mc), "--ids", "P01,B1", "--status", "written")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual((self.status("P01"), self.status("B1"), self.status("P02")), ("written", "written", "extracted"))

    def test_cli_add_on_renamed_mc(self):
        test_mc = self.mc.parent / "microcontent-test"
        self.mc.rename(test_mc)
        r = self.run_cli("add", str(test_mc), "--status", "test")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("17 rows", r.stdout)
        self.assertEqual(len(ledger.read_table(self.pp, ledger.POST_COLUMNS)), 17)
        r = self.run_cli("drop", str(test_mc), "P03", "--reason", "x", "--test")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue((test_mc / "dropped" / "P03-idea-p03").is_dir())

    def test_cli_add_empty_folder_fails(self):
        empty = self.mc.parent / "microcontent-empty"
        empty.mkdir()
        r = self.run_cli("add", str(empty), "--status", "test")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("no cards", r.stderr)
        self.assertFalse(self.pp.exists())

    def test_cli_test_flag_refused_on_real_folder(self):
        self.assertEqual(self.run_cli("add", str(self.mc), "--status", "extracted").returncode, 0)
        for args in (["add", str(self.mc), "--status", "test"],
                     ["set-status", str(self.mc), "--ids", "P01", "--status", "written", "--test"],
                     ["drop", str(self.mc), "P03", "--reason", "x", "--test"]):
            r = self.run_cli(*args)
            self.assertEqual(r.returncode, 1, args)
            self.assertIn("microcontent-test", r.stderr, args)
        self.assertTrue((self.mc / "posts" / "P03-idea-p03").is_dir())

    def test_cli_add_test_all_real_rows(self):
        test_mc = self.mc.parent / "microcontent-test"
        self.mc.rename(test_mc)
        ledger.add(test_mc, "extracted")
        r = self.run_cli("add", str(test_mc), "--status", "test")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("0 test rows (all rows are real)", r.stdout)

    def test_cli_drop_and_purge(self):
        self.mc = self.mc.rename(self.mc.parent / "microcontent-test")
        self.run_cli("add", str(self.mc), "--status", "test", "--as-backup", "P11,P12")
        self.assertEqual(self.status("P12"), "test")
        r = self.run_cli("drop", str(self.mc), "P03", "--reason", "thin", "--test")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue((self.mc / "dropped" / "P03-idea-p03" / "reason.txt").exists())
        r = self.run_cli("purge", str(self.mc), "--status", "test")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(ledger.read_table(self.pp, ledger.POST_COLUMNS), [])

    def test_cli_recent_ideas_and_finding_recent(self):
        self.run_cli("add", str(self.mc), "--status", "extracted")
        r = self.run_cli("recent-ideas", str(self.mc), "--exclude-video", "other")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("fixture-video-P01", r.stdout)
        r = self.run_cli("finding-recent", str(self.mc))
        self.assertIn("F-marlow-1995-days", r.stdout)
        r = self.run_cli("finding-recent", str(self.mc), "--exclude-video", SLUG)
        self.assertNotIn("F-marlow-1995-days", r.stdout)


if __name__ == "__main__":
    unittest.main()
