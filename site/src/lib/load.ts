import fs from "node:fs";
import path from "node:path";
import type { Pulse } from "./types";

/** Reads the weekly report at build time; a file without what the page needs fails the build with the reason. */
export function loadPulse(): Pulse {
  const r = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", "pulse.json"), "utf-8")) as Pulse;
  const problems = [
    !r.shareOfVoice?.length && "share of attention",
    !r.monthly?.length && "monthly views",
    !r.movers?.length && "movers",
    !r.checks?.length && "checks",
    r.checks?.some((c) => c.status === "fail") && "a failed check",
  ].filter(Boolean);
  if (problems.length) throw new Error(`pulse.json: ${problems.join(", ")}`);
  return r;
}
