import { describe, expect, it } from "vitest";
import { loadPulse } from "./load";

const r = loadPulse();

describe("weekly report data", () => {
  it("shares within each group add up to 100%", () => {
    const groups = new Set(r.shareOfVoice.map((s) => s.group));
    for (const g of groups) {
      const total = r.shareOfVoice.filter((s) => s.group === g).reduce((a, s) => a + s.share12m, 0);
      expect(total, g).toBeCloseTo(1, 6);
    }
  });
  it("each therapy group has exactly one MSD product, except where the article is shared", () => {
    for (const g of ["Immuno-oncology (PD-1/PD-L1)", "Type 2 diabetes", "Pulmonary arterial hypertension"]) {
      expect(r.shareOfVoice.filter((s) => s.group === g && s.msd)).toHaveLength(1);
    }
  });
  it("no check failed and the data is recent", () => {
    expect(r.checks.filter((c) => c.status === "fail")).toEqual([]);
    expect(new Date(r.through).getTime()).toBeGreaterThan(Date.now() - 10 * 864e5);
  });
  it("every spike meets the published rule", () => {
    for (const s of r.spikes) {
      expect(s.views).toBeGreaterThanOrEqual(r.spikeRule.minViews);
      expect(s.ratio).toBeGreaterThanOrEqual(r.spikeRule.ratio);
      expect(s.z).toBeGreaterThanOrEqual(r.spikeRule.z);
    }
  });
  it("a mover's change is its last 7 days over the 4-week average, minus one", () => {
    for (const m of r.movers) expect(m.change).toBeCloseTo(m.last7 / m.avgPrior4w - 1, 2);
  });
});
