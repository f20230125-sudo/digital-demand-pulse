"""Fetch daily Wikipedia pageviews (human readers only) for MSD's molecules, their competitors and the diseases they treat.

    python -m dp.fetch            (writes data/raw/pageviews.csv and data/raw/articles.csv)

English titles are fixed below; the Arabic title of each article comes from Wikipedia's own language links, so no
title is typed by hand. Source: Wikimedia REST API (per-article pageviews, agent = user, which excludes known bots and
spiders). Free, no key; a descriptive User-Agent is required by Wikimedia's policy.
"""

from __future__ import annotations

import csv
import json
import time
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
UA = "digital-demand-pulse/1.0 (https://github.com/f20230125-sudo/digital-demand-pulse; portfolio project)"
START = "20160101"

# group, English Wikipedia title, label, owner (MSD or not), kind (product or disease)
ARTICLES = [
    ("Immuno-oncology (PD-1/PD-L1)", "Pembrolizumab", "Keytruda (pembrolizumab)", "MSD", "product"),
    ("Immuno-oncology (PD-1/PD-L1)", "Nivolumab", "Opdivo (nivolumab)", "Bristol Myers Squibb", "product"),
    ("Immuno-oncology (PD-1/PD-L1)", "Atezolizumab", "Tecentriq (atezolizumab)", "Roche", "product"),
    ("Immuno-oncology (PD-1/PD-L1)", "Durvalumab", "Imfinzi (durvalumab)", "AstraZeneca", "product"),
    ("Immuno-oncology (PD-1/PD-L1)", "Cemiplimab", "Libtayo (cemiplimab)", "Regeneron/Sanofi", "product"),
    ("Type 2 diabetes", "Sitagliptin", "Januvia (sitagliptin)", "MSD", "product"),
    ("Type 2 diabetes", "Linagliptin", "Trajenta (linagliptin)", "Boehringer Ingelheim/Lilly", "product"),
    ("Type 2 diabetes", "Empagliflozin", "Jardiance (empagliflozin)", "Boehringer Ingelheim/Lilly", "product"),
    ("Type 2 diabetes", "Dapagliflozin", "Farxiga (dapagliflozin)", "AstraZeneca", "product"),
    ("Type 2 diabetes", "Semaglutide", "Ozempic/Wegovy (semaglutide)", "Novo Nordisk", "product"),
    ("Type 2 diabetes", "Tirzepatide", "Mounjaro/Zepbound (tirzepatide)", "Lilly", "product"),
    ("Vaccines", "HPV vaccine", "HPV vaccine (Gardasil)", "MSD", "product"),
    ("Vaccines", "Pneumococcal vaccine", "Pneumococcal vaccine (Capvaxive, Vaxneuvance, Prevnar)", "Shared", "product"),
    ("Vaccines", "Rotavirus vaccine", "Rotavirus vaccine (RotaTeq, Rotarix)", "Shared", "product"),
    ("Pulmonary arterial hypertension", "Sotatercept", "Winrevair (sotatercept)", "MSD", "product"),
    ("Pulmonary arterial hypertension", "Macitentan", "Opsumit (macitentan)", "Johnson & Johnson", "product"),
    ("Pulmonary arterial hypertension", "Selexipag", "Uptravi (selexipag)", "Johnson & Johnson", "product"),
    ("Diseases", "Lung cancer", "Lung cancer", "", "disease"),
    ("Diseases", "Melanoma", "Melanoma", "", "disease"),
    ("Diseases", "Type 2 diabetes", "Type 2 diabetes", "", "disease"),
    ("Diseases", "Cervical cancer", "Cervical cancer", "", "disease"),
    ("Diseases", "Pulmonary hypertension", "Pulmonary hypertension", "", "disease"),
]


def get(url: str) -> dict:
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return {}
            time.sleep(2 * (attempt + 1))
        except Exception:
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"failed: {url}")


def arabic_title(en: str) -> str | None:
    q = urllib.parse.urlencode({"action": "query", "prop": "langlinks", "titles": en, "lllang": "ar", "redirects": 1, "format": "json", "formatversion": 2})
    d = get(f"https://en.wikipedia.org/w/api.php?{q}")
    pages = d.get("query", {}).get("pages", [])
    links = pages[0].get("langlinks", []) if pages else []
    return links[0]["title"] if links else None


def views(project: str, title: str, end: str) -> list[tuple[str, int]]:
    t = urllib.parse.quote(title.replace(" ", "_"), safe="")
    d = get(f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{project}/all-access/user/{t}/daily/{START}/{end}")
    return [(i["timestamp"][:8], int(i["views"])) for i in d.get("items", [])]


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    end = (date.today() - timedelta(days=1)).strftime("%Y%m%d")
    arts, rows = [], []
    for group, en, label, owner, kind in ARTICLES:
        ar = arabic_title(en)
        arts.append({"group": group, "title_en": en, "title_ar": ar or "", "label": label, "owner": owner, "kind": kind})
        for lang, title in (("en", en), ("ar", ar)):
            if not title:
                continue
            v = views(f"{lang}.wikipedia", title, end)
            rows += [(en, lang, d, n) for d, n in v]
            print(f"{lang} {title}: {len(v)} days")
    with (RAW / "articles.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(arts[0]))
        w.writeheader()
        w.writerows(arts)
    with (RAW / "pageviews.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["article", "lang", "date", "views"])
        w.writerows(rows)
    print(f"{len(rows)} daily rows for {len(arts)} articles, through {end}")


if __name__ == "__main__":
    main()
