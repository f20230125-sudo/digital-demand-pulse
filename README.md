# Digital Demand Pulse

**Live:** https://digital-demand-pulse.vercel.app

A weekly digital performance report on public attention to MSD's medicines: daily Wikipedia readership for 22 articles (MSD's molecules, their competitors and the diseases they treat) in **English and Arabic**, from 2016 to the latest published day. It produces a dashboard, an Excel workbook and a short weekly note, refreshed every Monday by a scheduled GitHub Actions job that stops if a check fails.

It mirrors what an omnichannel / digital data team does with its own channel data (analyse digital performance, build dashboards, automate the weekly report), on a public source anyone can check.

## What it found (data through 15 Oct 2026)

- **Keytruda leads its group and is gaining:** the pembrolizumab article has **57%** of English readers among five PD-1/PD-L1 drugs over the last 12 months, up from 51% the year before; Opdivo fell from 25% to 20%.
- **The HPV vaccine article (Gardasil)** has 65% of readers among the three vaccine articles (58% a year before). **Winrevair** leads pulmonary arterial hypertension at 44%.
- **Januvia has 3%** of attention in a type 2 diabetes group led by semaglutide (41%) and tirzepatide (31%).
- **Every article lost readers year on year (-24% to -65%)**, in line with the fall in Wikipedia's human traffic, so the report compares shares within each group, not raw views.
- **47 attention spikes since 2016**; three fall in the week of a dated FDA approval (Winrevair, Mounjaro, Zepbound). The rest are labelled unexplained rather than guessed.
- **Winrevair has no Arabic Wikipedia article**: a content gap for Arabic-speaking readers in the Gulf. Arabic readership of the other articles is 0.4 to 5 views per 100 English views.

## How it works

```
Wikimedia pageviews API (human readers, daily)   Wikipedia language links (English -> Arabic titles)
                         │                                  │
                  dp.fetch: 22 articles x 2 languages, 2016 to the latest day
                         │
dp.analyse: zero-view days filled, checks (freshness, completeness, duplicates, Arabic gaps),
            share of attention by therapy group, weekly movers, spikes (robust z-score), Arabic audience
                         │
site/public/data/pulse.json (dashboard)   excel/Digital-Demand-Pulse.xlsx   reports/latest.md (weekly note)
                         │
.github/workflows/weekly-pulse.yml: every Monday fetch -> analyse -> tests -> commit; Vercel redeploys
```

**Spike rule:** a week with at least 2,000 views, at least twice the article's median of the previous 26 weeks, and a robust z-score (median and MAD of log views) of 5 or more; consecutive spike weeks count once.

## Run it

```powershell
pip install -r requirements.txt
$env:PYTHONPATH = "src"; python -m dp.fetch; python -m dp.analyse; python -m pytest -q
cd site; npm install; npm run build; npm run start    # http://localhost:3110; npx vitest run; npx playwright test
```

Tests: 3 pytest, 5 vitest (shares add to 100%, the spike rule holds, movers tie out), 7 Playwright (sections, the group switch, the Arabic gap, the download, axe in light and dark, 390 and 320 px).

## Limits

- Wikipedia readership is public attention, not prescriptions, sales or traffic to MSD's own channels.
- An article covers a molecule, not only a brand; the vaccine articles cover several companies' products.
- An independent analysis of public data, not produced or endorsed by MSD or any company named.
