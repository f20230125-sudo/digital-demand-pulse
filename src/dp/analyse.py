"""Turn daily pageviews into the weekly report: share of attention, movers, spikes, the Arabic audience, and checks.

    python -m dp.analyse          (writes site/public/data/pulse.json, excel/Digital-Demand-Pulse.xlsx, reports/latest.md)

Every figure on the site, in the workbook and in the weekly note comes from this file.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
SITE = ROOT / "site" / "public" / "data"
XL = ROOT / "excel"
REPORTS = ROOT / "reports"

# Dated public events, used only to label a spike that falls in the same week. A spike with no match stays "unexplained".
EVENTS = [
    ("2021-06-04", "Semaglutide", "FDA approves Wegovy (semaglutide) for weight management"),
    ("2022-05-13", "Tirzepatide", "FDA approves Mounjaro (tirzepatide) for type 2 diabetes"),
    ("2023-11-08", "Tirzepatide", "FDA approves Zepbound (tirzepatide) for weight management"),
    ("2024-03-26", "Sotatercept", "FDA approves Winrevair (sotatercept) for pulmonary arterial hypertension"),
]
SPIKE_Z = 5.0        # robust z-score of the week's log views against the previous 26 weeks
SPIKE_RATIO = 2.0    # and at least twice the previous 26-week median
SPIKE_MIN = 2000     # and at least 2,000 views that week, so small articles' noise is not reported


def load() -> tuple[pd.DataFrame, pd.DataFrame]:
    arts = pd.read_csv(RAW / "articles.csv", keep_default_na=False)
    pv = pd.read_csv(RAW / "pageviews.csv", dtype={"date": str})
    pv["date"] = pd.to_datetime(pv.date, format="%Y%m%d")
    return arts, pv


def fill_zero_days(pv: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """The API returns no row for a day with no human views; each series gets every day from its first to the last day, as 0."""
    last = pv.date.max()
    parts, filled = [], 0
    for (a, l), d in pv.groupby(["article", "lang"]):
        idx = pd.date_range(d.date.min(), last, freq="D")
        full = d.set_index("date").views.reindex(idx, fill_value=0)
        filled += len(idx) - len(d)
        parts.append(pd.DataFrame({"article": a, "lang": l, "date": idx, "views": full.to_numpy()}))
    return pd.concat(parts, ignore_index=True), filled


def checks(arts: pd.DataFrame, pv: pd.DataFrame, filled: int) -> list[dict]:
    out = []
    add = lambda i, name, ok, result, rule, info=False: out.append({"id": i, "check": name, "status": "info" if info else ("pass" if ok else "fail"), "result": result, "rule": rule})  # noqa: E731
    last = pv.date.max().date()
    add("C01", "Data is current", last >= date.today() - timedelta(days=5), str(last), "latest day within 5 days of the run (Wikimedia publishes with a lag of a few days)")
    en = pv[pv.lang == "en"]
    missing_en = sorted(set(arts.title_en) - set(en.article))
    add("C02", "Every English article returned data", not missing_en, ", ".join(missing_en) or f"all {len(arts)}", "no article without pageviews")
    add("C03", "Days with no human views, filled as 0", True, f"{filled:,} of {len(pv):,} series-days, mostly small Arabic articles", "the API returns no row for a day with no views", info=True)
    add("C04", "No negative or duplicate rows", (pv.views >= 0).all() and not pv.duplicated(["article", "lang", "date"]).any(), f"{len(pv):,} rows", "views >= 0; one row per article, language and day")
    no_ar = arts[arts.title_ar == ""].label.tolist()
    add("C05", "Articles with no Arabic Wikipedia page", True, ", ".join(no_ar) or "none", "reported, not a failure: a content gap for Arabic readers", info=True)
    return out


def main() -> None:
    SITE.mkdir(parents=True, exist_ok=True)
    XL.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    arts, pv = load()
    pv, filled = fill_zero_days(pv)
    meta = arts.set_index("title_en")
    last = pv.date.max()
    en = pv[pv.lang == "en"]

    # Monthly history (complete months only) and the last 104 weeks, English and Arabic.
    pv["month"] = pv.date.dt.to_period("M")
    full_months = pv.groupby("month").date.nunique()
    complete = full_months[full_months >= pv.groupby("month").date.max().dt.days_in_month.reindex(full_months.index)].index
    monthly = pv[pv.month.isin(complete)].groupby(["article", "lang", "month"]).views.sum().reset_index()
    wk = pv[pv.date > last - pd.Timedelta(weeks=104)].copy()
    wk["week"] = wk.date - pd.to_timedelta((wk.date - (last + pd.Timedelta(days=1))).dt.days % 7, unit="D")
    weekly = wk.groupby(["article", "lang", "week"]).views.sum().reset_index()

    # Share of attention within each group, English, last 365 days vs the 365 before.
    y1 = en[en.date > last - pd.Timedelta(days=365)].groupby("article").views.sum()
    y0 = en[(en.date <= last - pd.Timedelta(days=365)) & (en.date > last - pd.Timedelta(days=730))].groupby("article").views.sum()
    rows = []
    for a in arts.itertuples():
        rows.append({"article": a.title_en, "label": a.label, "group": a.group, "owner": a.owner, "kind": a.kind, "msd": a.owner == "MSD",
                     "views12m": int(y1.get(a.title_en, 0)), "viewsPrior12m": int(y0.get(a.title_en, 0)),
                     "yoy": (y1.get(a.title_en, 0) / y0.get(a.title_en, 1) - 1) if y0.get(a.title_en, 0) else None})
    sov = pd.DataFrame(rows)
    prod = sov[sov.kind == "product"].copy()
    prod["share12m"] = prod.views12m / prod.groupby("group").views12m.transform("sum")
    prod["sharePrior12m"] = prod.viewsPrior12m / prod.groupby("group").viewsPrior12m.transform("sum")

    # This week's movers: the last 7 days against the average of the 4 weeks before, English.
    d7 = en[en.date > last - pd.Timedelta(days=7)].groupby("article").views.sum()
    d28 = en[(en.date <= last - pd.Timedelta(days=7)) & (en.date > last - pd.Timedelta(days=35))].groupby("article").views.sum() / 4
    movers = pd.DataFrame({"last7": d7, "avgPrior4w": d28}).dropna()
    movers["change"] = movers.last7 / movers.avgPrior4w - 1
    movers = movers.sort_values("change", key=abs, ascending=False)

    # Spikes: weekly English views far above the brand's own recent level.
    en_w = en.copy()
    en_w["week"] = en_w.date - pd.to_timedelta(en_w.date.dt.dayofweek, unit="D")
    ew = en_w.groupby(["article", "week"]).views.sum().reset_index()
    spikes = []
    for art, d in ew.groupby("article"):
        d = d.sort_values("week").reset_index(drop=True)
        lv = np.log1p(d.views.to_numpy())
        for i in range(26, len(d) - 1):  # the current, partial week is left out
            base = lv[i - 26:i]
            med = np.median(base)
            mad = np.median(np.abs(base - med)) * 1.4826 or 1e-6
            z = (lv[i] - med) / mad
            ratio = d.views[i] / np.expm1(med)
            if z >= SPIKE_Z and ratio >= SPIKE_RATIO and d.views[i] >= SPIKE_MIN and not (spikes and spikes[-1]["article"] == art and spikes[-1]["_i"] == i - 1):
                wk_start = d.week[i]
                ev = [e for e in EVENTS if e[1] == art and wk_start <= pd.Timestamp(e[0]) < wk_start + pd.Timedelta(days=7)]
                spikes.append({"article": art, "label": meta.label[art], "week": wk_start.date().isoformat(), "views": int(d.views[i]), "ratio": round(float(ratio), 2),
                               "z": round(float(z), 1), "event": ev[0][2] if ev else None, "_i": i})
            elif spikes and spikes[-1]["article"] == art and spikes[-1]["_i"] == i - 1 and z >= SPIKE_Z:
                spikes[-1]["_i"] = i  # the same episode continues; keep its first week
    spikes = sorted(({k: v for k, v in x.items() if k != "_i"} for x in spikes), key=lambda s: -s["ratio"])

    # Arabic audience: Arabic views as a share of English, last 12 months.
    ar1 = pv[(pv.lang == "ar") & (pv.date > last - pd.Timedelta(days=365))].groupby("article").views.sum()
    arabic = [{"article": a.title_en, "label": a.label, "group": a.group, "titleAr": a.title_ar, "ar12m": int(ar1.get(a.title_en, 0)) if a.title_ar else None,
               "en12m": int(y1.get(a.title_en, 0)), "arPerEn": (ar1.get(a.title_en, 0) / y1.get(a.title_en, 1)) if a.title_ar else None} for a in arts.itertuples()]

    chk = checks(arts, pv, filled)
    msd_sov = prod[prod.msd][["label", "group", "share12m", "sharePrior12m"]]
    report = {
        "through": last.date().isoformat(),
        "rows": int(len(pv)),
        "articles": arts.to_dict("records"),
        "shareOfVoice": json.loads(prod.to_json(orient="records")),
        "diseases": json.loads(sov[sov.kind == "disease"].to_json(orient="records")),
        "movers": [{"article": a, "label": meta.label[a], "last7": int(r.last7), "avgPrior4w": round(float(r.avgPrior4w), 1), "change": round(float(r.change), 4)} for a, r in movers.iterrows()],
        "spikes": spikes,
        "arabic": arabic,
        "monthly": [{"a": r.article, "l": r.lang, "m": str(r.month), "v": int(r.views)} for r in monthly.itertuples()],
        "weekly": [{"a": r.article, "l": r.lang, "w": r.week.date().isoformat(), "v": int(r.views)} for r in weekly.itertuples()],
        "checks": chk,
        "spikeRule": {"z": SPIKE_Z, "ratio": SPIKE_RATIO, "window": 26, "minViews": SPIKE_MIN},
    }
    (SITE / "pulse.json").write_text(json.dumps(report, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

    with pd.ExcelWriter(XL / "Digital-Demand-Pulse.xlsx", engine="openpyxl") as xw:
        prod[["group", "label", "owner", "views12m", "viewsPrior12m", "yoy", "share12m", "sharePrior12m"]].to_excel(xw, sheet_name="Share of attention", index=False)
        pd.DataFrame(report["movers"]).to_excel(xw, sheet_name="This week's movers", index=False)
        pd.DataFrame(spikes).to_excel(xw, sheet_name="Spikes", index=False)
        pd.DataFrame(arabic).to_excel(xw, sheet_name="Arabic audience", index=False)
        pd.DataFrame(chk).to_excel(xw, sheet_name="Checks", index=False)
        monthly.assign(month=monthly.month.astype(str)).pivot_table(index="month", columns=["lang", "article"], values="views").to_excel(xw, sheet_name="Monthly views")

    dl = ROOT / "site" / "public" / "downloads"
    dl.mkdir(parents=True, exist_ok=True)
    (dl / "Digital-Demand-Pulse.xlsx").write_bytes((XL / "Digital-Demand-Pulse.xlsx").read_bytes())

    # The weekly note: rule-based, every sentence filled from the numbers above.
    top = report["movers"][:3]
    lines = [f"# Digital Demand Pulse: week to {report['through']}", ""]
    for g, d in prod.groupby("group"):
        m = d[d.msd]
        lead = d.sort_values("share12m", ascending=False).iloc[0]
        if len(m):
            m = m.iloc[0]
            lines.append(f"- **{g}:** {m.label} holds {m.share12m:.0%} of English Wikipedia attention in its group over 12 months ({m.sharePrior12m:.0%} the year before); the most read is {lead.label} ({lead.share12m:.0%}).")
    lines.append("- **Biggest moves this week (vs the 4 weeks before):** " + "; ".join(f"{m['label']} {m['change']:+.0%}" for m in top) + ".")
    lines.append(f"- **Checks:** {sum(c['status'] == 'pass' for c in chk)} pass, {sum(c['status'] == 'fail' for c in chk)} fail.")
    (REPORTS / "latest.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"spikes: {len(spikes)}, explained: {sum(1 for s in spikes if s['event'])}")
    if any(c["status"] == "fail" for c in chk):
        raise SystemExit("a check failed: the weekly report is not published")


if __name__ == "__main__":
    main()
