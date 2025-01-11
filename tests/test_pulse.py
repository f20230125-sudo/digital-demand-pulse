import json
from pathlib import Path

import pandas as pd

from dp import analyse, fetch

ROOT = Path(__file__).resolve().parents[1]


def test_zero_view_days_are_filled_from_the_first_day():
    pv = pd.DataFrame({"article": ["A", "A", "B"], "lang": ["en", "en", "en"], "date": pd.to_datetime(["2026-01-01", "2026-01-04", "2026-01-02"]), "views": [5, 7, 3]})
    full, filled = analyse.fill_zero_days(pv)
    a = full[full.article == "A"].views.tolist()
    assert a == [5, 0, 0, 7] and filled == 2 + 2  # A misses 2 days; B starts on the 2nd and runs to the 4th with 2 empty days
    assert full[full.article == "B"].date.min() == pd.Timestamp("2026-01-02")


def test_published_report_ties_out():
    r = json.loads((ROOT / "site" / "public" / "data" / "pulse.json").read_text(encoding="utf-8"))
    for g in {s["group"] for s in r["shareOfVoice"]}:
        assert abs(sum(s["share12m"] for s in r["shareOfVoice"] if s["group"] == g) - 1) < 1e-9
    assert not [c for c in r["checks"] if c["status"] == "fail"]
    assert all(s["views"] >= analyse.SPIKE_MIN and s["ratio"] >= analyse.SPIKE_RATIO for s in r["spikes"])
    approved = {s["article"] for s in r["spikes"] if s["event"]}
    assert "Sotatercept" in approved  # Winrevair's approval week stands out in its own readership


def test_every_article_has_a_label_group_and_kind():
    arts = pd.read_csv(ROOT / "data" / "raw" / "articles.csv", keep_default_na=False)
    assert list(arts.title_en) == [a[1] for a in fetch.ARTICLES]
    assert set(arts.kind) == {"product", "disease"}
    assert (arts.label != "").all() and (arts.group != "").all()
