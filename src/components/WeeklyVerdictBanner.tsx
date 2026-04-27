import type { WeeklyVerdict } from "@/lib/types";
import { formatDate } from "@/lib/dates";

interface VerdictMeta {
  label: string;
  blurb: string;
  ribbon: string;
  ring: string;
  dot: string;
  glow: string;
  headline: string;
}

const META: Record<WeeklyVerdict, VerdictMeta> = {
  "Strong Week": {
    label: "Strong Week",
    blurb: "Take all 3 — multiple clean setups align.",
    ribbon: "from-emerald-400/30 via-bull-500/30 to-emerald-400/20 text-emerald-300",
    ring: "ring-emerald-400/40",
    dot: "bg-emerald-400",
    glow: "from-emerald-400/0 via-emerald-400/70 to-emerald-400/0",
    headline: "This week is good to execute on.",
  },
  Solid: {
    label: "Solid Week",
    blurb: "Take the strongest 1-2 with normal sizing.",
    ribbon: "from-bull-500/25 via-emerald-400/20 to-bull-500/10 text-bull-500",
    ring: "ring-bull-500/40",
    dot: "bg-bull-500",
    glow: "from-bull-500/0 via-bull-500/70 to-bull-500/0",
    headline: "Solid — selective execution.",
  },
  Mixed: {
    label: "Mixed Week",
    blurb: "Be selective. Smaller size; paper-trade the weakest.",
    ribbon: "from-amber-400/30 via-amber-400/20 to-amber-400/10 text-amber-300",
    ring: "ring-amber-400/40",
    dot: "bg-amber-400",
    glow: "from-amber-400/0 via-amber-400/70 to-amber-400/0",
    headline: "Mixed — execute selectively.",
  },
  Caution: {
    label: "Caution",
    blurb: "Below-average quality. Consider sitting out.",
    ribbon: "from-orange-500/30 via-orange-400/20 to-orange-500/10 text-orange-300",
    ring: "ring-orange-400/40",
    dot: "bg-orange-400",
    glow: "from-orange-400/0 via-orange-400/70 to-orange-400/0",
    headline: "Caution — most ideas are weak this week.",
  },
  "Sit Out": {
    label: "Sit Out",
    blurb: "None of the 3 are good to execute. Stay flat.",
    ribbon: "from-bear-500/25 via-bear-500/15 to-bear-500/10 text-bear-500",
    ring: "ring-bear-500/40",
    dot: "bg-bear-500",
    glow: "from-bear-500/0 via-bear-500/70 to-bear-500/0",
    headline: "This week is NOT good to execute on.",
  },
};

export default function WeeklyVerdictBanner({
  verdict,
  summary,
  weekStart,
}: {
  verdict: WeeklyVerdict | null;
  summary: string | null;
  weekStart: string | null;
}) {
  const meta = verdict ? META[verdict] : null;

  if (!meta) {
    return null;
  }

  return (
    <div
      className={`glass relative overflow-hidden rounded-2xl ring-1 sm:rounded-3xl ${meta.ring}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${meta.glow}`} />
      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r px-3 py-1 text-[11px] font-semibold uppercase tracking-widest ring-1 ring-inset ring-white/10 ${meta.ribbon}`}
            >
              <span className={`inline-flex h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              Weekly Verdict · {meta.label}
            </span>
          </div>
          {weekStart && (
            <span className="text-[11px] text-gray-500">
              Week of {formatDate(weekStart)}
            </span>
          )}
        </div>
        <h2 className="mt-3 text-xl font-semibold leading-snug text-white sm:text-2xl">
          {meta.headline}
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-300 sm:text-base">
          <span className="text-gray-200">{meta.blurb}</span>{" "}
          {summary && <span className="text-gray-400">{summary}</span>}
        </p>
      </div>
    </div>
  );
}
