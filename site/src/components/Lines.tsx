"use client";

import { scaleLinear } from "d3-scale";
import { Tip, useTip, useWidth } from "./chart";

export type Series = { id: string; label: string; msd: boolean; points: { x: string; y: number }[] };

/** Monthly lines on a shared 0-100% axis. MSD's line is the accent colour and drawn last; the others are ink tints. */
export function Lines({ series, ariaLabel, fmt }: { series: Series[]; ariaLabel: string; fmt: (v: number) => string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const { tip, atPointer, hide } = useTip(ref);
  const h = 300;
  const m = { l: 40, r: 120, t: 10, b: 26 };
  const xs = series[0]?.points.map((p) => p.x) ?? [];
  const x = scaleLinear().domain([0, Math.max(1, xs.length - 1)]).range([m.l, w - m.r]);
  const top = Math.min(1, Math.ceil(Math.max(...series.flatMap((s) => s.points.map((p) => p.y))) * 10) / 10 || 1);
  const y = scaleLinear().domain([0, top]).range([h - m.b, m.t]);
  const ticks = [0, top / 2, top];
  const years = xs.map((v, i) => [v, i] as const).filter(([v]) => v.endsWith("-01"));
  const ordered = [...series].sort((a, b) => Number(a.msd) - Number(b.msd));
  // End labels: placed at each line's last value, then pushed apart so none overlap (13 px apart at least).
  const labelY: Record<string, number> = {};
  [...series]
    .sort((a, b) => y(a.points.at(-1)?.y ?? 0) - y(b.points.at(-1)?.y ?? 0))
    .forEach((s, i, arr) => {
      const want = y(s.points.at(-1)?.y ?? 0) + 4;
      labelY[s.id] = i ? Math.max(want, labelY[arr[i - 1].id] + 13) : want;
    });
  const tone = ["var(--ink)", "var(--ink-3)", "var(--bar-mute)", "var(--ink-2)", "var(--mute)"];
  const color = (s: Series, i: number) => (s.msd ? "var(--msd)" : tone[i % tone.length]);
  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const i = Math.round(x.invert(e.clientX - r.left + m.l));
    if (i < 0 || i >= xs.length) return;
    atPointer(xs[i], series.map((s) => ({ label: s.label, value: fmt(s.points[i]?.y ?? 0) })))(e);
  };
  return (
    <div ref={ref} style={{ position: "relative" }} onMouseLeave={hide}>
      <svg className="svg" width={w} height={h} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} />
            <text x={m.l - 6} y={y(t) + 4} textAnchor="end" className="t-mute">
              {fmt(t)}
            </text>
          </g>
        ))}
        {years.map(([v, i]) => (
          <text key={v} x={x(i)} y={h - 6} textAnchor="middle" className="t-mute">
            {v.slice(0, 4)}
          </text>
        ))}
        {ordered.map((s) => {
          const i = series.indexOf(s);
          const d = s.points.map((p, j) => `${j ? "L" : "M"}${x(j).toFixed(1)},${y(p.y).toFixed(1)}`).join("");
          const last = s.points.at(-1);
          return (
            <g key={s.id}>
              <path d={d} fill="none" stroke={color(s, i)} strokeWidth={s.msd ? 2.4 : 1.4} />
              {last && (
                <text x={w - m.r + 6} y={labelY[s.id]} className={s.msd ? "t-strong" : undefined}>
                  {s.label.split(" (")[0]} {fmt(last.y)}
                </text>
              )}
            </g>
          );
        })}
        <rect x={m.l} y={m.t} width={Math.max(0, w - m.l - m.r)} height={h - m.t - m.b} fill="transparent" onMouseMove={onMove} />
      </svg>
      <Tip tip={tip} width={w} />
    </div>
  );
}
