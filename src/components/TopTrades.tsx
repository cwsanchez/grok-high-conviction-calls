import type { Recommendation, WeeklyVerdict } from "@/lib/types";
import TradeCard from "./TradeCard";
import WeeklyVerdictBanner from "./WeeklyVerdictBanner";
import { formatDate } from "@/lib/dates";

function isLegacyNoTradeRow(r: Recommendation): boolean {
  // Legacy rows from before the "always 3 trades" change.
  return (
    r.asset === "NONE" ||
    r.type === "none" ||
    (r.type ?? "").trim() === "" ||
    (r.performance_status === "no_trade" && !r.execute_verdict)
  );
}

export default function TopTrades({
  trades,
  weekStart,
  weeklyVerdict,
  weeklyVerdictSummary,
}: {
  trades: Recommendation[];
  weekStart: string | null;
  weeklyVerdict: WeeklyVerdict | null;
  weeklyVerdictSummary: string | null;
}) {
  if (!weekStart) {
    return (
      <div className="glass rounded-2xl p-6 text-sm text-gray-300 sm:rounded-3xl sm:p-8">
        No analysis has been run yet. The primary cycle runs Sunday at 8:00 PM
        Mountain Time, with a daily 8:00 AM MT catch-up that self-heals if the
        Sunday run is missed.
      </div>
    );
  }

  // Filter out *only* legacy NONE rows. New "Pass" rows are still rendered for
  // transparency — they get a clear "Pass" verdict on the card.
  const visible = trades.filter((t) => !isLegacyNoTradeRow(t));

  return (
    <div className="space-y-5 sm:space-y-6">
      <WeeklyVerdictBanner
        verdict={weeklyVerdict}
        summary={weeklyVerdictSummary}
        weekStart={weekStart}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
        <span>
          Showing top {visible.length} {visible.length === 1 ? "trade" : "trades"} for the
          week of <span className="text-gray-200">{formatDate(weekStart)}</span>.
        </span>
        <span className="text-gray-500">
          Each card shows whether to actually take it.
        </span>
      </div>
      {visible.map((t) => (
        <TradeCard key={t.id} rec={t} />
      ))}
    </div>
  );
}
