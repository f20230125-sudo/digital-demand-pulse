"use client";

import { useState } from "react";
import type { Check, Pulse as P } from "@/lib/types";
import { count, pct, signedPct } from "@/lib/format";
import { Bars, type Bar } from "./Bars";
import { Fig } from "./Fig";
import { Lines, type Series } from "./Lines";
import { ThemeToggle } from "./ThemeToggle";

const SECTIONS = [
  { id: "share", label: "Share of attention" },
  { id: "movers", label: "This week" },
  { id: "spikes", label: "Spikes" },
  { id: "arabic", label: "Arabic readers" },
  { id: "checks", label: "Checks" },
  { id: "method", label: "Method" },
];
const STATUS_WORD = { pass: "Pass", warn: "Review", fail: "Fail", info: "Info" } as const;
const short = (label: string) => label.split(" (")[0];
const dateLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function StatusGlyph({ s }: { s: Check["status"] }) {
  const d = { pass: "M3 8.5l3 3 7-7", warn: "M8 4v5", fail: "M4 4l8 8M12 4l-8 8", info: "M8 7v5" }[s];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {s !== "pass" && s !== "fail" && <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" />}
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {s === "warn" && <circle cx="8" cy="11.6" r="1" fill="currentColor" />}
      {s === "info" && <circle cx="8" cy="4.6" r="1" fill="currentColor" />}
    </svg>
  );
}

export function Pulse({ r, repoUrl }: { r: P; repoUrl?: string }) {
  const groups = [...new Set(r.shareOfVoice.map((s) => s.group))];
  const [group, setGroup] = useState(groups[0]);
  const inGroup = r.shareOfVoice.filter((s) => s.group === group).sort((a, b) => b.share12m - a.share12m);
  const keytruda = r.shareOfVoice.find((s) => s.article === "Pembrolizumab")!;
  const januvia = r.shareOfVoice.find((s) => s.article === "Sitagliptin")!;
  const gardasil = r.shareOfVoice.find((s) => s.article === "HPV vaccine")!;
  const diabLead = r.shareOfVoice.filter((s) => s.group === januvia.group).sort((a, b) => b.share12m - a.share12m)[0];
  const yoys = r.shareOfVoice.map((s) => s.yoy).filter((v): v is number => v != null);
  const noArabic = r.arabic.filter((a) => a.arPerEn == null);

  // Monthly share of attention within the chosen group, English Wikipedia.
  const arts = inGroup.map((s) => s.article);
  const months = [...new Set(r.monthly.filter((m) => m.l === "en").map((m) => m.m))].sort().filter((m) => m >= "2019-01");
  const v = (a: string, m: string) => r.monthly.find((x) => x.a === a && x.l === "en" && x.m === m)?.v ?? 0;
  const totals = Object.fromEntries(months.map((m) => [m, arts.reduce((t, a) => t + v(a, m), 0)]));
  const series: Series[] = inGroup.map((s) => ({ id: s.article, label: s.label, msd: s.msd, points: months.map((m) => ({ x: m, y: totals[m] ? v(s.article, m) / totals[m] : 0 })) }));

  const shareRows: Bar[] = inGroup.map((s) => ({
    label: short(s.label),
    value: s.share12m,
    tone: s.msd ? "msd" : "ink",
    text: `${pct(s.share12m)} (${pct(s.sharePrior12m)} a year before)`,
    tip: [
      { label: "Views, last 12 months", value: s.views12m.toLocaleString("en-US") },
      { label: "Year on year", value: signedPct(s.yoy) },
    ],
  }));
  const moverRows: Bar[] = r.movers.slice(0, 10).map((m) => ({
    label: short(m.label),
    value: m.change,
    tone: r.shareOfVoice.find((s) => s.article === m.article)?.msd ? "msd" : "ink",
    text: signedPct(m.change),
    tip: [
      { label: "Last 7 days", value: m.last7.toLocaleString("en-US") },
      { label: "Weekly average, 4 weeks before", value: Math.round(m.avgPrior4w).toLocaleString("en-US") },
    ],
  }));
  const arabicRows: Bar[] = r.arabic
    .filter((a) => a.arPerEn != null)
    .sort((a, b) => b.arPerEn! - a.arPerEn!)
    .map((a) => ({ label: short(a.label), value: a.arPerEn!, tone: r.shareOfVoice.find((s) => s.article === a.article)?.msd ? "msd" : "ink", text: `${(a.arPerEn! * 100).toFixed(1)} per 100` }));

  return (
    <>
      <a className="skip" href="#main">
        Skip to the report
      </a>
      <header className="bar">
        <div className="shell bar-in">
          <a className="brand" href="#top">
            Digital Demand Pulse
          </a>
          <nav aria-label="Sections">
            {SECTIONS.map((x) => (
              <a key={x.id} href={`#${x.id}`}>
                {x.label}
              </a>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="shell">
        <section className="hero" id="top">
          <p className="kicker">
            <b>Digital Demand Pulse</b> · a digital performance case study by Mohammad Uzair Khan, on public Wikipedia readership, refreshed every week
          </p>
          <h1>
            Keytruda draws {pct(keytruda.share12m)} of readers among PD-1/PD-L1 drugs and the HPV vaccine (Gardasil) {pct(gardasil.share12m)} among these vaccines; Januvia has {pct(januvia.share12m)} in a diabetes group led by{" "}
            {short(diabLead.label)}
          </h1>
          <p className="lede">
            Daily human pageviews for {r.articles.length} Wikipedia articles (MSD&rsquo;s molecules, their competitors and the diseases they treat) in English and Arabic, from 2016 to {dateLabel(r.through)}. Read as a
            measure of public attention: every article lost readers this year ({signedPct(Math.max(...yoys))} to {signedPct(Math.min(...yoys))}), in line with the fall in Wikipedia&rsquo;s human traffic, so the page
            compares shares within each therapy group rather than raw views.
          </p>
          <dl className="figs">
            <div>
              <dt>Daily rows, two languages</dt>
              <dd>{count(r.rows)}</dd>
            </div>
            <div>
              <dt>Keytruda share, a year earlier</dt>
              <dd>
                {pct(keytruda.sharePrior12m)} → {pct(keytruda.share12m)}
              </dd>
            </div>
            <div>
              <dt>MSD article with no Arabic page</dt>
              <dd>{noArabic.map((a) => short(a.label)).join(", ") || "none"}</dd>
            </div>
            <div>
              <dt>Checks before publishing</dt>
              <dd>
                {r.checks.filter((c) => c.status === "pass").length} pass, {r.checks.filter((c) => c.status === "fail").length} fail
              </dd>
            </div>
          </dl>
        </section>

        <section className="sec" id="share" aria-labelledby="share-h">
          <div className="sec-head">
            <h2 id="share-h">Share of attention within each therapy group</h2>
            <p className="dek">Share of English Wikipedia views among the products in the group, last 12 months and the 12 before. MSD&rsquo;s product is in the accent colour.</p>
          </div>
          <div className="ctl" style={{ marginBottom: 14 }}>
            <div className="seg" role="group" aria-label="Therapy group">
              {groups.map((g) => (
                <button key={g} type="button" aria-pressed={g === group} onClick={() => setGroup(g)}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="sec-body">
            <Fig
              title={`${group}: share of attention, last 12 months`}
              source={<>Source: Wikimedia pageviews API, English Wikipedia, human readers only (known bots and spiders excluded).</>}
              table={
                <table className="tbl">
                  <caption className="sr-only">Share of attention, {group}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col">Company</th>
                      <th scope="col" className="n">
                        Views, 12 months
                      </th>
                      <th scope="col" className="n">
                        Year on year
                      </th>
                      <th scope="col" className="n">
                        Share
                      </th>
                      <th scope="col" className="n">
                        Share a year before
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {inGroup.map((s) => (
                      <tr key={s.article}>
                        <th scope="row">{s.label}</th>
                        <td>{s.owner}</td>
                        <td className="n">{s.views12m.toLocaleString("en-US")}</td>
                        <td className="n">{signedPct(s.yoy)}</td>
                        <td className="n">{pct(s.share12m)}</td>
                        <td className="n">{pct(s.sharePrior12m)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <Bars rows={shareRows} label={170} ariaLabel={`${group} share of attention: ${shareRows.map((x) => `${x.label} ${x.text}`).join("; ")}.`} tickFormat={(t) => pct(t)} ticks={[0, 0.25, 0.5, 0.75]} />
            </Fig>
            <Fig
              title={`${group}: monthly share of attention since 2019`}
              sub="Each line is the product's share of the group's English views that month."
              source={<>Source: Wikimedia pageviews API. Complete months only.</>}
              table={
                <table className="tbl">
                  <caption className="sr-only">Monthly share of attention, {group}, by year (January)</caption>
                  <thead>
                    <tr>
                      <th scope="col">Month</th>
                      {series.map((s) => (
                        <th key={s.id} scope="col" className="n">
                          {short(s.label)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {months
                      .map((m, i) => [m, i] as const)
                      .filter(([m]) => m.endsWith("-01") || m === months.at(-1))
                      .map(([m, i]) => (
                        <tr key={m}>
                          <th scope="row">{m}</th>
                          {series.map((s) => (
                            <td key={s.id} className="n">
                              {pct(s.points[i].y)}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              }
            >
              <Lines series={series} fmt={(t) => pct(t)} ariaLabel={`${group}, latest monthly share: ${series.map((s) => `${short(s.label)} ${pct(s.points.at(-1)?.y)}`).join("; ")}.`} />
            </Fig>
          </div>
        </section>

        <section className="sec" id="movers" aria-labelledby="movers-h">
          <div className="sec-head">
            <h2 id="movers-h">This week: {short(r.movers[0].label)} moved most, {signedPct(r.movers[0].change)}</h2>
            <p className="dek">Views in the 7 days to {dateLabel(r.through)} against the weekly average of the 4 weeks before, English Wikipedia. Products and diseases together.</p>
          </div>
          <Fig
            title="Largest weekly changes"
            source={<>Refreshed every week by a scheduled job; the weekly note is written from the same numbers.</>}
            table={
              <table className="tbl">
                <caption className="sr-only">Weekly changes</caption>
                <thead>
                  <tr>
                    <th scope="col">Article</th>
                    <th scope="col" className="n">
                      Last 7 days
                    </th>
                    <th scope="col" className="n">
                      Weekly average before
                    </th>
                    <th scope="col" className="n">
                      Change
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.movers.map((m) => (
                    <tr key={m.article}>
                      <th scope="row">{m.label}</th>
                      <td className="n">{m.last7.toLocaleString("en-US")}</td>
                      <td className="n">{Math.round(m.avgPrior4w).toLocaleString("en-US")}</td>
                      <td className="n">{signedPct(m.change)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <Bars rows={moverRows} label={170} ariaLabel={`Weekly change: ${moverRows.map((x) => `${x.label} ${x.text}`).join("; ")}.`} tickFormat={(t) => signedPct(t)} ticks={[-0.2, 0, 0.2]} />
          </Fig>
        </section>

        <section className="sec" id="spikes" aria-labelledby="spikes-h">
          <div className="sec-head">
            <h2 id="spikes-h">
              {r.spikes.length} attention spikes since 2016; {r.spikes.filter((s) => s.event).length} line up with a dated approval
            </h2>
            <p className="dek">
              A spike is a week with at least {r.spikeRule.minViews.toLocaleString("en-US")} views, at least {r.spikeRule.ratio} times the article&rsquo;s median of the previous {r.spikeRule.window} weeks and a robust
              z-score of {r.spikeRule.z} or more. An event is named only where a dated approval falls in the same week; the rest are left unexplained rather than guessed.
            </p>
          </div>
          <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Spikes: table">
            <table className="tbl">
              <caption>The 15 largest spikes</caption>
              <thead>
                <tr>
                  <th scope="col">Article</th>
                  <th scope="col">Week of</th>
                  <th scope="col" className="n">
                    Views
                  </th>
                  <th scope="col" className="n">
                    × usual
                  </th>
                  <th scope="col">Matched event</th>
                </tr>
              </thead>
              <tbody>
                {r.spikes.slice(0, 15).map((s) => (
                  <tr key={`${s.article}-${s.week}`}>
                    <th scope="row">{s.label}</th>
                    <td>{s.week}</td>
                    <td className="n">{s.views.toLocaleString("en-US")}</td>
                    <td className="n">{s.ratio.toFixed(1)}</td>
                    <td>{s.event ?? "unexplained"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="sec" id="arabic" aria-labelledby="arabic-h">
          <div className="sec-head">
            <h2 id="arabic-h">Arabic readers: a small audience, and one gap</h2>
            <p className="dek">
              Arabic Wikipedia views per 100 English views, last 12 months. The Arabic title of each article comes from Wikipedia&rsquo;s own language links. {noArabic.map((a) => short(a.label)).join(", ")} has no Arabic
              article at all: content an Arabic-speaking patient or doctor in the Gulf cannot find there.
            </p>
          </div>
          <Fig
            title="Arabic views per 100 English views"
            source={<>Source: Wikimedia pageviews API, Arabic and English Wikipedia.</>}
            table={
              <table className="tbl">
                <caption className="sr-only">Arabic and English views</caption>
                <thead>
                  <tr>
                    <th scope="col">Article</th>
                    <th scope="col">Arabic title</th>
                    <th scope="col" className="n">
                      Arabic views
                    </th>
                    <th scope="col" className="n">
                      English views
                    </th>
                    <th scope="col" className="n">
                      Per 100
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.arabic.map((a) => (
                    <tr key={a.article}>
                      <th scope="row">{a.label}</th>
                      <td lang="ar" dir="rtl">
                        {a.titleAr || "no Arabic article"}
                      </td>
                      <td className="n">{a.ar12m == null ? "" : a.ar12m.toLocaleString("en-US")}</td>
                      <td className="n">{a.en12m.toLocaleString("en-US")}</td>
                      <td className="n">{a.arPerEn == null ? "" : (a.arPerEn * 100).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <Bars rows={arabicRows} label={170} ariaLabel={`Arabic views per 100 English: ${arabicRows.map((x) => `${x.label} ${x.text}`).join("; ")}.`} tickFormat={(t) => (t * 100).toFixed(0)} ticks={[0, 0.02, 0.04]} />
          </Fig>
        </section>

        <section className="sec" id="checks" aria-labelledby="checks-h">
          <div className="sec-head">
            <h2 id="checks-h">Checked before each weekly report is published</h2>
            <p className="dek">A failed check stops the weekly job, so a broken week is never published.</p>
          </div>
          <ul className="qlist">
            {r.checks.map((c) => (
              <li className="qrow" key={c.id}>
                <span className="st">
                  <StatusGlyph s={c.status} />
                  {STATUS_WORD[c.status]}
                </span>
                <span>
                  <span className="nm">{c.check}</span>
                  <span className="rs">
                    {c.result} · rule: {c.rule}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="sec" id="method" aria-labelledby="method-h">
          <div className="sec-head">
            <h2 id="method-h">Method, downloads and limits</h2>
          </div>
          <ol className="method">
            <li>
              <b>Collect.</b> The Wikimedia pageviews API, one call per article and language, human readers only. Arabic titles come from Wikipedia&rsquo;s language links. A day with no views has no row and is counted as 0.
            </li>
            <li>
              <b>Report.</b> Share of attention within each therapy group, the week&rsquo;s movers, spikes against each article&rsquo;s own recent level, and the Arabic audience; written to this page, an Excel workbook and a short
              weekly note.
            </li>
            <li>
              <b>Automate.</b> A scheduled GitHub Actions job refreshes the data every week, re-runs the checks and commits the new report; a failed check stops it.
            </li>
          </ol>
          <p className="downloads">
            <a className="btn" href="/downloads/Digital-Demand-Pulse.xlsx" download>
              Download the Excel workbook (.xlsx)
            </a>
            {repoUrl && (
              <a className="btn" href={`${repoUrl}/blob/main/reports/latest.md`}>
                This week&rsquo;s note on GitHub
              </a>
            )}
          </p>
          <p className="limits">
            <b>Limits.</b> Wikipedia readership is public attention, not prescriptions, sales or traffic to MSD&rsquo;s own channels. An article covers a molecule, not only a brand, and the vaccine articles cover several
            companies&rsquo; products. An independent analysis of public data, not produced or endorsed by MSD or any company named.
          </p>
        </section>
      </main>

      <footer className="foot">
        <div className="shell">
          <p className="disc">
            Built by Mohammad Uzair Khan · {repoUrl ? <a href={repoUrl}>Code on GitHub</a> : "Code on GitHub"} · data through {dateLabel(r.through)}
          </p>
        </div>
      </footer>
    </>
  );
}
