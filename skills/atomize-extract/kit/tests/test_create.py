import itertools, json, random, re, shutil, subprocess, sys, tempfile, time, unittest
from collections import Counter
from datetime import date
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KIT))
sys.path.insert(0, str(KIT / "tests"))
import create  # noqa: E402
import fixture_tree as ft  # noqa: E402
import ledger  # noqa: E402
import paths  # noqa: E402

P4 = ["alex", "sam", "jordan", "acme"]
IDS = [f"P{i:02d}" for i in range(1, 13)]
FORMATS = ["infographic", "carousel"]


def ids(n):
    return [f"P{i:02d}" for i in range(1, n + 1)]


def grid(posts, profiles, default=3, **over):
    """fit table: default score, over = {profile: {post: score}}."""
    fit = {p: {a: default for a in profiles} for p in posts}
    for a, d in over.items():
        for p, s in d.items():
            fit[p][a] = s
    return fit


def cycle(posts):
    return {p: FORMATS[i % 2] for i, p in enumerate(posts)}


class SolverTest(unittest.TestCase):
    def setUp(self):
        self.fit = grid(IDS, P4,
                        sam={p: 5 for p in IDS[0:3]},
                        alex={"P01": 4, "P04": 5, "P05": 5},
                        jordan={p: 5 for p in IDS[5:8]},
                        acme={p: 5 for p in IDS[8:11]})
        self.fit_ish = grid(IDS, P4, sam={p: 5 for p in IDS[0:3]})
        self.f = cycle(IDS)
        self.blocks = {p: FORMATS[i // 6] for i, p in enumerate(IDS)}
        self.one = {p: "infographic" for p in IDS}
        self.all3 = grid(IDS, P4)

    def test_best_total_beats_greedy(self):
        a = create.solve(self.fit, self.f, P4, 3)
        self.assertEqual(a["P01"], "sam")
        self.assertEqual(create.totals(a, self.fit, self.f, P4)["fit"], 58)

    def test_three_each(self):
        a = create.solve(self.fit, self.f, P4, 3)
        self.assertEqual(sorted(Counter(a.values()).values()), [3, 3, 3, 3])

    def test_spread_breaks_fit_tie(self):
        a = create.solve(self.all3, self.blocks, P4, 3)
        self.assertTrue(all(len({self.blocks[p] for p in a if a[p] == x}) == 2 for x in P4))
        self.assertEqual(create.totals(a, self.all3, self.blocks, P4)["spread"], 4)

    def test_spread_never_beats_fit(self):
        a = create.solve(self.fit_ish, self.blocks, P4, 3)
        self.assertEqual({p for p in a if a[p] == "sam"}, {"P01", "P02", "P03"})

    def test_tie_break_order(self):
        fit = grid(ids(4), ["alex", "sam"], alex={"P01": 5, "P02": 1},
                   sam={"P01": 5, "P02": 1})
        one = {p: "infographic" for p in fit}
        self.assertEqual(create.solve(fit, one, ["alex", "sam"], 2),
                         {"P01": "alex", "P02": "sam", "P03": "alex", "P04": "sam"})

    def test_full_tie_is_table_order(self):
        a = create.solve(self.all3, self.one, P4, 3)
        self.assertEqual([a[p] for p in IDS],
                         ["alex"] * 3 + ["sam"] * 3 + ["jordan"] * 3 + ["acme"] * 3)

    def test_five_profiles(self):
        posts = ids(15)
        fit = grid(posts, P4 + ["x"], x={p: 5 for p in posts[12:]})
        a = create.solve(fit, cycle(posts), P4 + ["x"], 3)
        self.assertEqual({p for p in a if a[p] == "x"}, {"P13", "P14", "P15"})

    def test_two_each(self):
        posts = ids(8)
        fit, f = grid(posts, P4), cycle(posts)
        a = create.solve(fit, f, P4, 2)
        self.assertEqual(sorted(Counter(a.values()).values()), [2, 2, 2, 2])
        self.assertEqual(create.totals(a, fit, f, P4)["spread"], 4)

    def test_wrong_count_raises(self):
        posts = ids(11)
        with self.assertRaises(ValueError):
            create.solve(grid(posts, P4), cycle(posts), P4, 3)

    def test_deterministic_and_order_free(self):
        self.assertEqual(create.solve(self.fit, self.f, P4, 3),
                         create.solve(dict(reversed(self.fit.items())), self.f, P4, 3))

    def test_fast(self):
        posts, profs = ids(15), P4 + ["x"]
        rnd = random.Random(1)
        fit = {p: {a: rnd.randint(1, 5) for a in profs} for p in posts}
        t = time.time()
        create.solve(fit, cycle(posts), profs, 3)
        self.assertLess(time.time() - t, 2.0)

    def test_totals_by_account(self):
        a = create.solve(self.fit, self.f, P4, 3)
        t = create.totals(a, self.fit, self.f, P4)
        self.assertEqual(sum(t["by_account"].values()), t["fit"])
        self.assertEqual(set(t["by_account"]), set(P4))

    def test_matches_brute_force(self):
        profs, per = ["a", "b", "c"], 2
        posts = ids(6)
        fmts = ["f1", "f2", "f3"]
        for seed in range(40):
            rnd = random.Random(seed)
            fit = {p: {a: rnd.randint(1, 5) for a in profs} for p in posts}
            f = {p: rnd.choice(fmts) for p in posts}
            best = None
            for vec in itertools.product(range(len(profs)), repeat=len(posts)):
                if any(vec.count(j) != per for j in range(len(profs))):
                    continue
                alloc = {p: profs[j] for p, j in zip(posts, vec)}
                t = create.totals(alloc, fit, f, profs)
                key = (-t["fit"], -t["spread"],
                       tuple(-t["by_account"][a] for a in profs), vec)
                if best is None or key < best[0]:
                    best = (key, alloc)
            self.assertEqual(create.solve(fit, f, profs, per), best[1], f"seed {seed}")


class MatchTest(unittest.TestCase):
    def setUp(self):
        self.tmps = []
        self.mc = self.tree()
        self.pp = self.mc.parents[2] / "workspace" / "records" / "posts.csv"

    def tearDown(self):
        for t in self.tmps:
            shutil.rmtree(t, ignore_errors=True)

    def tree(self, status="made", **kw):
        t = Path(tempfile.mkdtemp())
        self.tmps.append(t)
        c = ft.make_tree(t, **kw)
        mc = c / "videos" / "01-fixture-video" / "microcontent"
        ledger.add(mc, status)
        ft.write_scores(mc)
        return mc

    def row(self, pid, mc=None):
        mc = mc or self.mc
        pp = mc.parents[2] / "workspace" / "records" / "posts.csv"
        full = f"fixture-video-{pid}"
        return next(r for r in ledger.read_table(pp, ledger.POST_COLUMNS) if r["post_id"] == full)

    def status(self, pid, mc=None):
        return self.row(pid, mc)["status"]

    def account(self, pid, mc=None):
        return self.row(pid, mc)["account"]

    def scores(self, mc=None):
        return json.loads(((mc or self.mc) / "match.json").read_text())["scores"]

    def save_scores(self, scores, mc=None):
        (((mc or self.mc) / "match.json")).write_text(json.dumps({"scores": scores}))

    def test_match_writes_allocation_and_renames(self):
        out = create.match(self.mc)
        self.assertEqual(len(out["allocation"]), 12)
        self.assertTrue((self.mc / f"posts/P01-{out['allocation']['P01']}-idea-p01").is_dir())
        self.assertEqual(self.status("P01"), "matched")
        self.assertEqual(self.account("P01"), out["allocation"]["P01"])
        saved = json.loads((self.mc / "match.json").read_text())
        self.assertEqual(saved["allocation"], out["allocation"])
        self.assertEqual(saved["per_profile"], 3)
        self.assertIn("fit", saved["totals"])

    def test_match_points_report_at_new_folder(self):
        create.match(self.mc)
        for d in (self.mc / "posts").glob("P*"):
            files = json.loads((d / "report.json").read_text())["files"]
            self.assertTrue(files and all(Path(f).parent.name == d.name and Path(f).is_file() for f in files), d.name)

    def test_four_each_when_backups_promoted(self):
        for b in sorted((self.mc / "backups").glob("B*")):
            b.rename(self.mc / "posts" / b.name)
        idx = self.mc / "index.md"
        idx.write_text(re.sub(r"(?m)^backups:.*$", "backups: none", idx.read_text()))
        for d in sorted((self.mc / "posts").glob("B*")):
            for f in ("visual-review.json", "report.json", "slots.json"):
                src = next((self.mc / "posts").glob("P01-*")) / f
                if src.is_file() and not (d / f).is_file():
                    (d / f).write_text(src.read_text())
        ledger.add(self.mc, "made")
        s = self.scores()
        for b in ("B1", "B2", "B3", "B4"):
            s[b] = s["P01"]
        self.save_scores(s)
        out = create.match(self.mc)
        self.assertEqual(out["per_profile"], 4)
        self.assertEqual(sorted(Counter(out["allocation"].values()).values()), [4, 4, 4, 4])

    def test_backups_not_allocated(self):
        out = create.match(self.mc)
        self.assertNotIn("B1", out["allocation"])
        self.assertEqual(self.status("B1"), "backup")
        self.assertTrue((self.mc / "backups/B1-idea-b1").is_dir())

    def test_rerun_keeps_match(self):
        first = create.match(self.mc)["allocation"]
        s = self.scores()
        for p in s:
            for a in s[p]:
                s[p][a]["score"] = 1
        self.save_scores(s)
        self.assertEqual(create.match(self.mc)["allocation"], first)

    def test_rematch_renames_and_clears(self):
        first = create.match(self.mc)["allocation"]
        old = first["P01"]
        ft.write_post(self.mc, "P01", old)
        ft.write_review(paths.find_post_dir(self.mc, "P01"))
        ft.write_post(self.mc, "P02", first["P02"])
        ledger.set_status(self.pp, ["fixture-video-P02"], "written")
        new = next(a for a in P4 if a != old)
        s = self.scores()
        for a in P4:
            s["P01"][a]["score"] = 5 if a == new else 1
        self.save_scores(s)
        out = create.match(self.mc, rematch=True)
        self.assertEqual(out["allocation"]["P01"], new)
        d = paths.find_post_dir(self.mc, "P01")
        self.assertEqual(d.name, f"P01-{new}-idea-p01")
        self.assertFalse((d / "post.md").exists())
        self.assertFalse((d / "review.json").exists())
        self.assertFalse((self.mc / f"posts/P01-{old}-idea-p01").exists())
        self.assertEqual(self.status("P01"), "matched")
        for pid, acc in out["allocation"].items():
            if first[pid] == acc and pid != "P01":
                self.assertTrue(paths.find_post_dir(self.mc, pid).name.startswith(f"{pid}-{acc}-"))
        if out["allocation"]["P02"] == first["P02"]:
            self.assertEqual(self.status("P02"), "written")
            self.assertTrue((paths.find_post_dir(self.mc, "P02") / "post.md").exists())

    def test_rematch_without_allocation_is_first_match(self):
        out = create.match(self.mc, rematch=True)
        self.assertEqual(len(out["allocation"]), 12)

    def test_match_refuses_missing_scores(self):
        s = self.scores()
        del s["P03"]["sam"]
        self.save_scores(s)
        with self.assertRaisesRegex(ValueError, "P03/sam: missing"):
            create.match(self.mc)

    def test_match_refuses_out_of_range(self):
        s = self.scores()
        s["P02"]["acme"]["score"] = 6
        self.save_scores(s)
        with self.assertRaisesRegex(ValueError, "P02/acme"):
            create.match(self.mc)

    def test_match_refuses_non_whole_score(self):
        s = self.scores()
        s["P02"]["acme"]["score"] = 3.5
        s["P04"]["sam"]["score"] = True
        self.save_scores(s)
        with self.assertRaisesRegex(ValueError, "(?s)P02/acme.*P04/sam"):
            create.match(self.mc)

    def test_match_refuses_empty_reason(self):
        s = self.scores()
        s["P05"]["alex"]["reason"] = " "
        self.save_scores(s)
        with self.assertRaisesRegex(ValueError, "P05/alex"):
            create.match(self.mc)

    def test_match_refuses_unknown_account(self):
        s = self.scores()
        for p in s:
            s[p]["x"] = {"score": 3, "reason": "r"}
        self.save_scores(s)
        with self.assertRaisesRegex(ValueError, "P01/x"):
            create.match(self.mc)

    def test_match_refuses_wrong_post_count(self):
        mc10 = self.tree(posts=ft.TWELVE[:10], backups=("B1", "B2", "B3", "B4"))
        with self.assertRaisesRegex(ValueError, "need the same number for each"):
            create.match(mc10)

    def test_two_each_when_eight(self):
        mc8 = self.tree(posts=ft.TWELVE[:8])
        out = create.match(mc8)
        self.assertEqual(out["per_profile"], 2)
        self.assertEqual(len(out["allocation"]), 8)

    def test_check_refuses_old_layout(self):
        (self.mc / "ready").mkdir()
        self.assertIn("old layout", create.check_stage1(self.mc)[0])
        with self.assertRaisesRegex(ValueError, "old layout"):
            create.match(self.mc)

    def test_check_passes_clean_tree(self):
        self.assertEqual(create.check_stage1(self.mc), [])

    def test_read_index(self):
        self.assertEqual(create.read_index(self.mc),
                         {"visuals_done": True, "reviewed": "2026-11-20", "backups": ["B1", "B2", "B3", "B4"]})

    def test_check_needs_index_lines(self):
        idx = self.mc / "index.md"
        idx.write_text(idx.read_text().replace("visuals: done\n", ""))
        self.assertTrue(any("visuals" in e for e in create.check_stage1(self.mc)))
        idx.write_text(idx.read_text().replace("reviewed: 2026-11-20\n", ""))
        self.assertTrue(any("reviewed" in e for e in create.check_stage1(self.mc)))

    def test_check_needs_card_and_visual_review(self):
        d = paths.find_post_dir(self.mc, "P03")
        (d / "visual-review.json").write_text(json.dumps({"post": "P03", "status": "fail"}))
        (paths.find_post_dir(self.mc, "P04") / "card.md").unlink()
        errs = create.check_stage1(self.mc)
        self.assertTrue(any("P03" in e and "visual-review" in e for e in errs))
        self.assertTrue(any("P04" in e and "card.md" in e for e in errs))

    def test_check_needs_article_reports(self):
        (self.mc / "article" / "figure-2" / "report.json").unlink()
        (self.mc / "article" / "cover" / "report.json").unlink()
        errs = create.check_stage1(self.mc)
        self.assertTrue(any("figure-2" in e for e in errs))
        self.assertTrue(any("cover" in e for e in errs))
        (self.mc / "article" / "plan.md").unlink()
        self.assertTrue(any("plan.md" in e for e in create.check_stage1(self.mc)))

    def test_check_needs_made_rows_unless_test(self):
        ledger.write_table([], self.pp, ledger.POST_COLUMNS)
        self.assertTrue(create.check_stage1(self.mc))
        self.assertEqual(create.check_stage1(self.mc, test=True), [])

    def test_check_accepts_later_status_on_rerun(self):
        create.match(self.mc)
        self.assertEqual(create.check_stage1(self.mc), [])

    def test_test_mode_rows_stay_test(self):
        mc = self.tree(status="test")
        create.match(mc, test=True)
        self.assertEqual((self.status("P01", mc), self.account("P01", mc) != ""), ("test", True))

    def test_test_mode_leaves_real_rows(self):
        create.match(self.mc, test=True)
        self.assertEqual((self.status("P01"), self.account("P01")), ("made", ""))

    def test_promoted_backup_counts_as_post(self):
        # stage 1 review: P04 dropped, B1 moved into posts/ keeping its id, backups line updated
        ledger.drop_post(self.mc, "P04", "weak")
        (self.mc / "backups/B1-idea-b1").rename(self.mc / "posts/B1-idea-b1")
        idx = self.mc / "index.md"
        idx.write_text(idx.read_text().replace("backups: B1, B2, B3, B4", "backups: B2, B3, B4"))
        ledger.add(self.mc, "made")
        ft.write_scores(self.mc)
        self.assertIn("B1", self.scores())
        self.assertEqual(create.check_stage1(self.mc), [])
        vr = self.mc / "posts/B1-idea-b1/visual-review.json"
        saved = vr.read_text()
        vr.unlink()
        self.assertTrue(any(e.startswith("B1:") and "visual-review" in e for e in create.check_stage1(self.mc)))
        vr.write_text(saved)
        out = create.match(self.mc)
        self.assertIn("B1", out["allocation"])
        self.assertNotIn("P04", out["allocation"])

    def test_check_extracted_row_names_the_fix(self):
        ledger.set_status(self.pp, ["fixture-video-P02"], "extracted")
        errs = create.check_stage1(self.mc)
        self.assertTrue(any("P02" in e and "ledger.py add MC --status made" in e for e in errs), errs)

    def test_read_index_no_backups_words(self):
        idx = self.mc / "index.md"
        base = idx.read_text()
        for word in ("none", "None", "-", ""):
            idx.write_text(base.replace("backups: B1, B2, B3, B4", f"backups: {word}"))
            self.assertEqual(create.read_index(self.mc)["backups"], [], word)

    def test_cli_test_flag_refused_on_real_folder(self):
        cli = [sys.executable, str(KIT / "create.py")]
        env = {"PYTHONDONTWRITEBYTECODE": "1", "PATH": "/usr/bin:/bin"}
        for args in (["check", str(self.mc), "--test"], ["match", str(self.mc), "--test"],
                     ["swap", str(self.mc), "P04", "B2", "--test"], ["handover", str(self.mc), "--test"],
                     ["link", str(self.mc), URL, "--test"]):
            r = subprocess.run(cli + args, capture_output=True, text=True, env=env)
            self.assertEqual(r.returncode, 1, args)
            self.assertIn("microcontent-test", r.stdout, args)
        self.assertFalse((self.mc / "match.json").read_text().count("allocation"))
        test_mc = self.mc.with_name("microcontent-test")
        self.mc.rename(test_mc)
        r = subprocess.run(cli + ["check", str(test_mc), "--test"], capture_output=True, text=True, env=env)
        self.assertEqual((r.returncode, r.stdout), (0, ""))

    def test_cli_bad_target_no_traceback(self):
        cli = [sys.executable, str(KIT / "create.py")]
        env = {"PYTHONDONTWRITEBYTECODE": "1", "PATH": "/usr/bin:/bin"}
        root = self.mc.parents[2]
        for args in (["check", "no-such-video"], ["link", "no-such-video", URL]):
            r = subprocess.run(cli + args, capture_output=True, text=True, env=env, cwd=str(root))
            self.assertEqual(r.returncode, 1, args)
            self.assertNotIn("Traceback", r.stderr, args)
            self.assertIn("no-such-video", r.stdout + r.stderr, args)

    def test_cli(self):
        cli = [sys.executable, str(KIT / "create.py")]
        env = {"PYTHONDONTWRITEBYTECODE": "1", "PATH": "/usr/bin:/bin"}
        r = subprocess.run(cli + ["check", str(self.mc)], capture_output=True, text=True, env=env)
        self.assertEqual((r.returncode, r.stdout), (0, ""))
        r = subprocess.run(cli + ["match", str(self.mc)], capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("fit", r.stdout)
        (self.mc / "ready").mkdir()
        r = subprocess.run(cli + ["check", str(self.mc)], capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 1)
        self.assertIn("old layout", r.stdout)
        r = subprocess.run(cli + ["match", str(self.mc), "--rematch"], capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 1)
        self.assertIn("old layout", r.stdout + r.stderr)


class SwapTest(unittest.TestCase):
    def setUp(self):
        self.tmps = []
        self.mc = self.tree()
        self.alloc = create.match(self.mc)["allocation"]

    def tearDown(self):
        for t in self.tmps:
            shutil.rmtree(t, ignore_errors=True)

    def tree(self, status="made", **kw):
        t = Path(tempfile.mkdtemp())
        self.tmps.append(t)
        c = ft.make_tree(t, **kw)
        mc = c / "videos" / "01-fixture-video" / "microcontent"
        ledger.add(mc, status, as_backup=kw.get("index_backups") or ())
        ft.write_scores(mc)
        return mc

    def rows(self, mc=None):
        mc = mc or self.mc
        pp = mc.parents[2] / "workspace" / "records" / "posts.csv"
        return {r["post_id"]: r for r in ledger.read_table(pp, ledger.POST_COLUMNS)}

    def status(self, pid, mc=None):
        return self.rows(mc)[f"fixture-video-{pid}"]["status"]

    def read_match(self, mc=None):
        return json.loads(((mc or self.mc) / "match.json").read_text())

    def test_swap_moves_backup_to_failed_profile(self):
        acct = self.alloc["P04"]
        d = create.swap(self.mc, "P04", "B2")
        self.assertEqual(d, (self.mc / f"posts/B2-{acct}-idea-b2").resolve())
        self.assertTrue(d.is_dir())
        self.assertFalse((self.mc / "backups/B2-idea-b2").exists())
        m = self.read_match()
        self.assertEqual(m["allocation"]["B2"], acct)
        self.assertNotIn("P04", m["allocation"])
        self.assertEqual(self.status("B2"), "matched")
        self.assertEqual(self.rows()["fixture-video-B2"]["account"], acct)
        self.assertEqual([(w["failed"], w["backup"], w["account"]) for w in m["swaps"]], [("P04", "B2", acct)])
        self.assertTrue(m["swaps"][0]["date"])

    def test_swap_drops_failed_and_clears_lead(self):
        acct = self.alloc["P04"]
        fp = self.mc.parents[2] / "workspace" / "records" / "findings.csv"
        lead = "F-marlow-1995-days"
        row = lambda: next(r for r in ledger.read_table(fp, ledger.FINDING_COLUMNS) if r["finding_id"] == lead)
        ledger.upsert_findings([{"finding_id": lead, "last_led_date": "2026-11-01"}], fp)
        self.assertEqual(row()["last_led_date"], "2026-11-01")
        create.swap(self.mc, "P04", "B2")
        self.assertTrue((self.mc / f"dropped/P04-{acct}-idea-p04").is_dir())
        self.assertEqual(self.status("P04"), "dropped")
        self.assertEqual(row()["last_led_date"], "")

    def test_swap_backup_from_posts_folder(self):
        mc = self.tree(posts=[f"P{i:02d}" for i in range(1, 11)], backups=(), index_backups=("P09", "P10"))
        self.assertEqual(self.status("P09", mc), "backup")
        alloc = create.match(mc)["allocation"]
        self.assertEqual(len(alloc), 8)
        d = create.swap(mc, "P04", "P09")
        self.assertEqual(d, (mc / f"posts/P09-{alloc['P04']}-idea-p09").resolve())
        self.assertEqual(self.status("P09", mc), "matched")
        self.assertEqual(create.check_stage1(mc), [])
        self.assertEqual(set(create.match(mc)["allocation"]), (set(alloc) - {"P04"}) | {"P09"})

    def test_swap_keeps_check_and_rematch_working(self):
        create.swap(self.mc, "P04", "B2")
        self.assertEqual(create.check_stage1(self.mc), [])
        with self.assertRaises(ValueError) as cm:  # a rematch needs scores for the swapped-in backup
            create.match(self.mc, rematch=True)
        self.assertIn("B2/", str(cm.exception))
        m = self.read_match()
        m["scores"]["B2"] = {a: {"score": 3, "reason": "ok"} for a in m["scores"]["P01"]}
        (self.mc / "match.json").write_text(json.dumps(m))
        out = create.match(self.mc, rematch=True)
        self.assertIn("B2", out["allocation"])
        self.assertEqual(out["swaps"][0]["backup"], "B2")

    def test_swap_refuses_used_backup(self):
        create.swap(self.mc, "P04", "B2")
        with self.assertRaises(ValueError):
            create.swap(self.mc, "P05", "B2")

    def test_swap_refuses_dropped_backup(self):
        ledger.drop_post(self.mc, "B2", "no")
        with self.assertRaises(ValueError):
            create.swap(self.mc, "P04", "B2")
        self.assertIn("P04", self.read_match()["allocation"])

    def test_swap_refuses_unknown_failed(self):
        with self.assertRaises(ValueError):
            create.swap(self.mc, "P99", "B2")
        with self.assertRaises(ValueError):
            create.swap(self.mc, "B3", "B2")

    def test_swap_refuses_unknown_backup(self):
        with self.assertRaises(ValueError):
            create.swap(self.mc, "P04", "B9")
        with self.assertRaises(ValueError):
            create.swap(self.mc, "P04", "P05")

    def test_swap_refuses_backup_row_not_backup(self):
        pp = self.mc.parents[2] / "workspace" / "records" / "posts.csv"
        ledger.set_status(pp, ["fixture-video-B2"], "extra")
        with self.assertRaises(ValueError):
            create.swap(self.mc, "P04", "B2")
        self.assertTrue((self.mc / "backups/B2-idea-b2").is_dir())

    def test_swap_test_mode_rows_stay_test(self):
        mc = self.tree(status="test")
        alloc = create.match(mc, test=True)["allocation"]
        d = create.swap(mc, "P04", "B2", test=True)
        self.assertEqual(d, (mc / f"posts/B2-{alloc['P04']}-idea-b2").resolve())
        self.assertEqual((self.status("P04", mc), self.status("B2", mc)), ("test", "test"))
        self.assertEqual(self.rows(mc)["fixture-video-B2"]["account"], alloc["P04"])

    def test_swap_test_mode_leaves_real_rows(self):
        create.swap(self.mc, "P04", "B2", test=True)
        self.assertEqual((self.status("P04"), self.status("B2")), ("matched", "backup"))

    def test_dropped_backup_does_not_block_check(self):
        create.swap(self.mc, "P04", "B2")
        ledger.drop_post(self.mc, "B2", "failed twice")
        ledger.drop_post(self.mc, "B3", "weak")
        self.assertEqual(create.check_stage1(self.mc), [])

    def test_rematch_after_drop_names_the_dropped_post(self):
        create.swap(self.mc, "P04", "B2")
        m = self.read_match()
        m["scores"]["B2"] = {a: {"score": 3, "reason": "ok"} for a in m["scores"]["P01"]}
        (self.mc / "match.json").write_text(json.dumps(m))
        ledger.drop_post(self.mc, "B2", "failed twice")
        with self.assertRaises(ValueError) as cm:
            create.match(self.mc, rematch=True)
        msg = str(cm.exception)
        self.assertIn("11 posts", msg)
        self.assertIn("B2", msg)
        self.assertNotIn("no format", msg)

    def test_swap_locks_backup_lead_finding(self):
        fp = self.mc.parents[2] / "workspace" / "records" / "findings.csv"
        lead = "F-marlow-1995-b2"
        ledger.upsert_findings([{"finding_id": lead, "last_led_date": ""}], fp)
        row = lambda: next(r for r in ledger.read_table(fp, ledger.FINDING_COLUMNS) if r["finding_id"] == lead)
        create.swap(self.mc, "P04", "B2")
        self.assertEqual(row()["last_led_date"], date.today().isoformat())

    def test_swap_test_mode_leaves_backup_lead_finding(self):
        mc = self.tree(status="test")
        create.match(mc, test=True)
        fp = mc.parents[2] / "workspace" / "records" / "findings.csv"
        lead = "F-marlow-1995-b2"
        ledger.upsert_findings([{"finding_id": lead, "last_led_date": ""}], fp)
        create.swap(mc, "P04", "B2", test=True)
        self.assertEqual(next(r for r in ledger.read_table(fp, ledger.FINDING_COLUMNS)
                              if r["finding_id"] == lead)["last_led_date"], "")

    def test_cli(self):
        cli = [sys.executable, str(KIT / "create.py")]
        env = {"PYTHONDONTWRITEBYTECODE": "1", "PATH": "/usr/bin:/bin"}
        r = subprocess.run(cli + ["swap", str(self.mc), "P04", "B2"], capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("B2", r.stdout)
        r = subprocess.run(cli + ["swap", str(self.mc), "P05", "B2"], capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 1)
        self.assertTrue(r.stdout.strip())


URL = "https://www.linkedin.com/feed/update/urn:li:activity:111"
URL2 = "https://www.linkedin.com/feed/update/urn:li:activity:222"
TOKEN = "{{VIDEO_POST_URL}}"


def liked(n):
    return {"checks": {"liked_posts": {"score": n}}}


class _Base(unittest.TestCase):
    def setUp(self):
        self.t = Path(tempfile.mkdtemp())
        c = ft.make_tree(self.t)
        self.c = c
        self.mc = c / "videos" / "01-fixture-video" / "microcontent"
        ledger.add(self.mc, "made", as_backup=("B1", "B2", "B3", "B4"))
        ft.write_scores(self.mc)
        self.alloc = create.match(self.mc)["allocation"]
        for pid, a in self.alloc.items():
            ft.write_post(self.mc, pid, a)
            ft.write_review(self.dir_of(pid))
        ft.write_article(self.mc)
        ft.write_review(self.mc / "article")
        self.ish_posts = sorted(p for p, a in self.alloc.items() if a == "sam")
        self.today = date.today().isoformat()

    def tearDown(self):
        shutil.rmtree(self.t, ignore_errors=True)

    def dir_of(self, pid):
        return paths.find_post_dir(self.mc, pid, ("posts",))

    def rows(self):
        pp = self.c / "workspace" / "records" / "posts.csv"
        return {r["post_id"]: r for r in ledger.read_table(pp, ledger.POST_COLUMNS)}

    def row(self, pid):
        return self.rows()[f"fixture-video-{pid}"]

    def status(self, pid):
        return self.row(pid)["status"]

    def hand_text(self):
        return create.handover(self.mc).read_text()

    def handed(self):
        text = (self.mc / "handover.md").read_text().split("## Kept for later")[0]
        return re.findall(r"^posts/([A-Z]\d+)-", text, re.M)


class HandoverTest(_Base):
    def test_handover_sections_per_profile(self):
        h = self.hand_text()
        for name in ["Alex Rivera", "Sam Lee", "Jordan", "Acme"]:
            self.assertIn(f"## {name} (3 posts)", h)
        self.assertIn("article/publish.md", h)
        self.assertIn("# Hand-over: fixture-video", h)
        self.assertIn(" · upload: ", h)

    def test_handover_no_copy(self):
        before = set(self.mc.rglob("*"))
        create.handover(self.mc)
        self.assertEqual(sorted(set(self.mc.rglob("*")) - before), [self.mc / "article/publish.md", self.mc / "handover.md"])

    def test_publish_md_has_steps_and_image_folders(self):
        create.handover(self.mc)
        t = (self.mc / "article" / "publish.md").read_text()
        self.assertIn("article/cover/", t)
        self.assertIn("article/figure-N/", t)
        self.assertIn("SEO", t)

    def test_handover_refuses_failed_post(self):
        ft.write_review(self.dir_of("P02"), "fail")
        with self.assertRaisesRegex(ValueError, "P02"):
            create.handover(self.mc)

    def test_handover_refuses_missing_post_md(self):
        (self.dir_of("P03") / "post.md").unlink()
        with self.assertRaisesRegex(ValueError, "P03"):
            create.handover(self.mc)

    def test_waiting_for_link_without_link(self):
        create.handover(self.mc)
        self.assertEqual(self.status("P01"), "waiting-for-link")
        self.assertEqual(self.status("A01"), "waiting-for-link")
        self.assertIn(TOKEN, (self.dir_of("P01") / "post.md").read_text())

    def test_ready_with_link_fills_token(self):
        create.handover(self.mc, URL)
        self.assertEqual(self.status("A01"), "ready")
        self.assertEqual(self.status("P01"), "ready")
        self.assertNotIn(TOKEN, (self.dir_of("P01") / "post.md").read_text())
        self.assertNotIn(TOKEN, (self.mc / "article" / "article.html").read_text())
        self.assertEqual((self.mc / "video-link.txt").read_text().strip(), URL)

    def test_link_found_in_packaging(self):
        (self.mc.parent / "packaging.md").write_text(f"# Packaging\n\nLinkedIn video post: {URL}\n")
        create.handover(self.mc)
        self.assertEqual(self.status("P01"), "ready")

    def test_sets_first_line_and_date(self):
        create.handover(self.mc)
        self.assertEqual(self.row("P01")["handed_over_date"], self.today)
        self.assertTrue(self.row("P01")["first_line"].startswith("235 people called"))
        self.assertEqual(self.row("A01")["account"], "alex")
        self.assertEqual(self.row("A01")["first_line"], "Who shows up after a call")

    def test_drop_to_two(self):
        ledger.drop_post(self.mc, self.ish_posts[0], "x")
        create.handover(self.mc)
        h = self.handed()
        self.assertEqual(sum(1 for p in h if self.alloc[p] == "sam"), 2)
        self.assertEqual(len(h), 8)
        self.assertIn("## Kept for later", (self.mc / "handover.md").read_text())
        extras = [p for p in self.alloc if p not in h and p != self.ish_posts[0]]
        self.assertEqual(len(extras), 3)
        self.assertTrue(all(self.status(p) == "extra" for p in extras))
        self.assertIn("## Sam Lee (2 posts)", (self.mc / "handover.md").read_text())

    def test_drop_to_two_keeps_best_liked(self):
        ledger.drop_post(self.mc, self.ish_posts[0], "x")
        vin = sorted(p for p, a in self.alloc.items() if a == "alex")
        ft.write_review(self.dir_of(vin[0]), liked=2)
        create.handover(self.mc)
        self.assertNotIn(vin[0], self.handed())
        self.assertEqual(self.status(vin[0]), "extra")

    def test_pick_best_order(self):
        self.assertEqual(create.pick_best(["P01", "P02", "P03"], {"P01": liked(4), "P02": liked(5), "P03": liked(4)},
                                          {"P01": 3, "P02": 1, "P03": 4}, 2), (["P02", "P03"], ["P01"]))

    def test_pick_best_tie_goes_to_id(self):
        r = {p: liked(4) for p in ("P01", "P02", "P03")}
        self.assertEqual(create.pick_best(["P03", "P02", "P01"], r, {p: 3 for p in r}, 2), (["P01", "P02"], ["P03"]))

    def test_fewer_than_two_raises(self):
        ledger.drop_post(self.mc, self.ish_posts[0], "x")
        ledger.drop_post(self.mc, self.ish_posts[1], "x")
        with self.assertRaisesRegex(ValueError, "stop and ask"):
            create.handover(self.mc)

    def test_article_failure_raises(self):
        ft.write_review(self.mc / "article", "fail")
        with self.assertRaisesRegex(ValueError, "article"):
            create.handover(self.mc)

    def test_article_missing_raises(self):
        (self.mc / "article" / "article.html").unlink()
        with self.assertRaisesRegex(ValueError, "article"):
            create.handover(self.mc)

    def test_handover_lists_swapped_backup(self):
        create.swap(self.mc, "P04", "B2")
        d = self.dir_of("B2")
        ft.write_post(self.mc, "B2", self.alloc["P04"])
        ft.write_review(d)
        h = self.hand_text()
        self.assertIn("B2-", h)
        self.assertIn("P04", h.split("## Swaps and drops")[1])
        self.assertEqual(h.split("## Swaps and drops")[1].count("P04"), 1)

    def test_swaps_and_drops_section_reads_reason(self):
        ledger.drop_post(self.mc, self.ish_posts[0], "too thin")
        h = self.hand_text()
        self.assertIn("too thin", h.split("## Swaps and drops")[1])

    def test_test_run_sets_only_first_line_on_test_rows(self):
        pp = self.c / "workspace" / "records" / "posts.csv"
        ledger.set_status(pp, ["fixture-video-P01"], "test")
        create.handover(self.mc, test=True)
        self.assertEqual(self.status("P01"), "test")
        self.assertTrue(self.row("P01")["first_line"])
        self.assertEqual(self.row("P01")["handed_over_date"], "")
        self.assertEqual(self.status("P02"), "matched")
        self.assertEqual(self.row("P02")["first_line"], "")

    def test_cli(self):
        cli = [sys.executable, str(KIT / "create.py")]
        env = {"PYTHONDONTWRITEBYTECODE": "1", "PATH": "/usr/bin:/bin"}
        r = subprocess.run(cli + ["handover", str(self.mc), "--link", URL], capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.status("P01"), "ready")
        ft.write_review(self.dir_of("P02"), "fail")
        r = subprocess.run(cli + ["handover", str(self.mc)], capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 1)
        self.assertIn("P02", r.stdout)


class LinkTest(_Base):
    def test_link_command_fills_and_sets_ready(self):
        create.handover(self.mc)
        self.assertEqual(create.link(self.mc, URL), 0)
        self.assertEqual(self.status("P01"), "ready")
        self.assertEqual(self.status("A01"), "ready")
        self.assertNotIn(TOKEN, (self.mc / "handover.md").read_text())

    def test_link_twice_new_url_replaces_old(self):
        create.link(self.mc, URL)
        create.link(self.mc, URL2)
        for f in [self.dir_of("P01") / "post.md", self.mc / "article" / "article.html"]:
            t = f.read_text()
            self.assertIn(URL2, t)
            self.assertNotIn(URL, t)
            self.assertNotIn(TOKEN, t)
        self.assertEqual((self.mc / "video-link.txt").read_text().strip(), URL2)

    def test_link_before_handover_saved(self):
        create.link(self.mc, URL)
        create.handover(self.mc)
        self.assertEqual(self.status("P01"), "ready")

    def test_link_leaves_test_rows(self):
        pp = self.c / "workspace" / "records" / "posts.csv"
        ledger.set_status(pp, ["fixture-video-P01"], "test")
        create.handover(self.mc, test=True)
        self.assertEqual(create.link(self.mc, URL, test=True), 0)
        self.assertEqual(self.status("P01"), "test")

    def test_link_gate_failure_keeps_waiting(self):
        create.handover(self.mc)
        f = self.dir_of("P01") / "post.md"
        f.write_text(f.read_text() + "\n\nTBD\n")
        self.assertNotEqual(create.link(self.mc, URL), 0)
        self.assertEqual(self.status("P01"), "waiting-for-link")

    def test_find_link_order(self):
        self.assertIsNone(create.find_link(self.mc))
        (self.mc.parent / "packaging.md").write_text(f"LinkedIn video post: {URL}\n")
        self.assertEqual(create.find_link(self.mc), URL)
        (self.mc / "video-link.txt").write_text(URL2 + "\n")
        self.assertEqual(create.find_link(self.mc), URL2)
        self.assertEqual(create.find_link(self.mc, "https://x.example/1"), "https://x.example/1")

    def test_cli(self):
        cli = [sys.executable, str(KIT / "create.py")]
        env = {"PYTHONDONTWRITEBYTECODE": "1", "PATH": "/usr/bin:/bin"}
        create.handover(self.mc)
        r = subprocess.run(cli + ["link", str(self.mc), URL], capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.status("P01"), "ready")


if __name__ == "__main__":
    unittest.main()
