import shutil, sys, tempfile, unittest
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KIT))
sys.path.insert(0, str(KIT / "tests"))
import accounts  # noqa: E402
import fixture_tree as ft  # noqa: E402

REPO = KIT.parents[3]

OLD = """# Accounts
## Accounts
| weight | id | disclosure | name | voice | role |
|---|---|---|---|---|---|
| 25 | alex | We build agents. | Alex Rivera | workspace/profiles/alex/voice-writing.md | founder |
| 25 | acme | We build agents too. | Acme | company | company |
"""

NO_VOICE = """# Accounts
## Accounts
| id | name | role |
|---|---|---|
| alex | Alex Rivera | founder |
"""


class AccountsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp()).resolve()
        new = ft._ACCOUNTS_V2
        self.old = self._w("old.md", OLD)
        self.new = self._w("new.md", new)
        self.no_voice = self._w("no_voice.md", NO_VOICE)
        self.no_settings = self._w("no_settings.md", new.split("## Settings")[0])
        self.with2 = self._w("with2.md", new.replace("posts per profile: 3", "posts per profile: 2").replace("article author: alex", "article author: sam"))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _w(self, name, text):
        p = self.tmp / name
        p.write_text(text)
        return p

    def test_old_table_loads_by_name(self):
        a = accounts.load_accounts(self.old)
        self.assertEqual(list(a[0])[:4], ["id", "name", "role", "voice"])
        self.assertEqual(a[0]["weight"], "25")
        self.assertEqual(a[0]["name"], "Alex Rivera")
        self.assertEqual(a[0]["role"], "founder")

    def test_new_table_loads(self):
        self.assertEqual([x["id"] for x in accounts.load_accounts(self.new)], ["alex", "sam", "jordan", "acme"])

    def test_missing_column_raises(self):
        with self.assertRaisesRegex(ValueError, "voice"):
            accounts.load_accounts(self.no_voice)

    def test_settings_defaults_and_values(self):
        self.assertEqual(accounts.settings(self.no_settings), {"posts_per_profile": 3, "article_author": "alex"})
        self.assertEqual(accounts.settings(self.with2), {"posts_per_profile": 2, "article_author": "sam"})

    def test_is_company_and_team_names(self):
        self.assertTrue(accounts.is_company({"role": "company page; research"}))
        self.assertTrue(accounts.is_company({"role": "Company"}))
        self.assertFalse(accounts.is_company({"role": "founder"}))
        names = accounts.team_names(accounts.load_accounts(self.new))
        self.assertNotIn("Acme", names)
        self.assertIn("Alex", names)



if __name__ == "__main__":
    unittest.main()
