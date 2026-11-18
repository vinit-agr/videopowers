import sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from numtok import extract, normalise  # noqa: E402


class NumbersTest(unittest.TestCase):
    def check(self, text, expected, allowed=()):
        self.assertEqual(extract(text, allowed), set(expected), text)

    def test_arrow(self): self.check("from 21→0 days", {"21", "0"})
    def test_pct_range(self): self.check("52%→18%", {"52%", "18%"})
    def test_pct_carries(self): self.check("52→18%", {"52%", "18%"})
    def test_percent_word(self): self.check("2.3 percent", {"2.3%"})
    def test_millions(self): self.check("$2M", {"2000000"})
    def test_thousands_k(self): self.check("10k visits", {"10000"})
    def test_commas(self): self.check("1,200 calls", {"1200"})
    def test_in(self): self.check("1 in 10", {"1", "10"})
    def test_year(self): self.check("In 2023, 9 in 10", {"2023", "9", "10"})
    def test_counter_line(self): self.check("3 / 9", set())
    def test_list_marker(self): self.check("1. Orlando cut 21 to 0", {"21", "0"})
    def test_url(self): self.check("https://youtu.be/RmiXoMqe7So", set())
    def test_letters(self): self.check("Q3 and CCBHC", set())
    def test_en_dash(self): self.check("13–0 days", {"13", "0"})
    def test_hyphen_word(self): self.check("a 30-day wait", {"30"})
    def test_allowed(self): self.check("open 24/7", set(), ["24/7"])
    def test_period(self): self.check("in 2023.", {"2023"})
    def test_ordinal(self): self.check("the 50th", {"50"})
    def test_token(self): self.check("watch {{VIDEO_POST_URL}}", set())
    def test_decimal_zero(self): self.assertEqual(normalise("5.0"), "5")


if __name__ == "__main__":
    unittest.main()
