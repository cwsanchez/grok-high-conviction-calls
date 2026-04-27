import type { Recommendation } from "@/lib/types";

const TIPS = [
  {
    title: "Cash is a position",
    body: "Sitting out is one of the most underrated edges in trading. You can't lose money on a trade you don't take.",
  },
  {
    title: "Quality > quantity",
    body: "Our system requires at least 7 of 8 strict checks to pass. Most weeks, the market simply doesn't offer that.",
  },
  {
    title: "Patience pays",
    body: "Strong setups cluster after consolidations and clean trends. Skipping muddy weeks preserves capital for the clean ones.",
  },
];

export default function LimitedOpportunities({
  rec,
  weekStart,
}: {
  rec: Recommendation | null;
  weekStart?: string | null;
}) {
  const reason =
    rec?.reasoning ??
    "Our 4 AI agents reviewed all 12 assets, but fewer than 2 setups passed at least 7 of our 8 strict checklist points this week.";
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-6 sm:rounded-3xl sm:p-10">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400/0 via-amber-400/60 to-amber-400/0" />
      <div className="flex items-center gap-3">
        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">
          Limited Opportunities This Week
        </span>
      </div>
      <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
        No high-conviction setups passed our filters
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">
        Our 4 AI agents reviewed all 12 assets and ranked every candidate against the
        8-point checklist. Fewer than 2 trades cleared our 7-of-8 quality bar this
        week. Rather than force a marginal trade, the system recommends staying flat.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {TIPS.map((t) => (
          <div
            key={t.title}
            className="rounded-xl bg-ink-800/60 p-4 ring-1 ring-white/5"
          >
            <div className="text-xs font-semibold uppercase tracking-widest text-bull-500">
              {t.title}
            </div>
            <div className="mt-1 text-sm leading-6 text-gray-200">{t.body}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 whitespace-pre-line rounded-xl bg-ink-800/60 p-4 text-sm leading-6 text-gray-200 ring-1 ring-white/5 wrap-anywhere">
        {reason}
      </div>

      {weekStart && (
        <div className="mt-4 text-xs text-gray-500">
          Week of {weekStart}. Next analysis runs Sunday at 8:00 PM Mountain Time.
        </div>
      )}
    </div>
  );
}
