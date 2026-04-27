import type { Recommendation } from "@/lib/types";
import TradeCard from "./TradeCard";
import LimitedOpportunities from "./LimitedOpportunities";
import { formatDate } from "@/lib/dates";

function isNoTradeRow(r: Recommendation): boolean {
  return (
    r.asset === "NONE" ||
    r.type === "none" ||
    (r.type ?? "").trim() === "" ||
    r.performance_status === "no_trade"
  );
}

export default function TopTrades({
  trades,
  weekStart,
}: {
  trades: Recommendation[];
  weekStart: string | null;
}) {
  const valid = trades.filter((t) => !isNoTradeRow(t));

  if (!weekStart) {
    return (
      <div className="glass rounded-2xl p-6 text-sm text-gray-300 sm:rounded-3xl sm:p-8">
        No analysis has been run yet. The first cycle runs Sunday at 8:00 PM
        Mountain Time.
      </div>
    );
  }

  if (valid.length < 2) {
    const noTradeRow = trades.find(isNoTradeRow) ?? null;
    return <LimitedOpportunities rec={noTradeRow} weekStart={formatDate(weekStart)} />;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
        <span>
          Showing top {valid.length} {valid.length === 1 ? "trade" : "trades"} for the
          week of <span className="text-gray-200">{formatDate(weekStart)}</span>.
        </span>
        <span className="text-gray-500">
          All trades passed at least 7 of 8 checklist points.
        </span>
      </div>
      {valid.map((t) => (
        <TradeCard key={t.id} rec={t} />
      ))}
    </div>
  );
}
