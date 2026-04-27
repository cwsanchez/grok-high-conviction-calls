import type { Recommendation } from "@/lib/types";
import { formatDate, formatPrice } from "@/lib/dates";

function statusBadge(status: string | null) {
  const s = (status ?? "pending").toLowerCase();
  const styles: Record<string, string> = {
    win: "bg-bull-500/15 text-bull-500 ring-bull-500/30",
    loss: "bg-bear-500/15 text-bear-500 ring-bear-500/30",
    pending: "bg-amber-400/10 text-amber-400 ring-amber-400/30",
    expired_breakeven: "bg-gray-500/15 text-gray-300 ring-gray-500/30",
    no_trade: "bg-gray-500/15 text-gray-300 ring-gray-500/30",
    unknown: "bg-gray-500/15 text-gray-300 ring-gray-500/30",
  };
  const label = s === "expired_breakeven" ? "breakeven" : s.replace("_", " ");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
        styles[s] ?? styles.pending
      }`}
    >
      {label}
    </span>
  );
}

export default function HistoryTable({ rows }: { rows: Recommendation[] }) {
  if (!rows.length) {
    return (
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
          History
        </h2>
        <div className="mt-3 glass rounded-2xl p-5 text-sm text-gray-400">
          No past recommendations yet. The first analysis runs Sunday at 8:00 PM
          Mountain Time.
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
        History
      </h2>
      <div className="mt-3 glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/5 text-sm">
            <thead className="bg-ink-800/60 text-xs uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Week</th>
                <th className="px-4 py-3 text-left font-medium">Asset</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Strike</th>
                <th className="px-4 py-3 text-left font-medium">Expiration</th>
                <th className="px-4 py-3 text-left font-medium">Entry</th>
                <th className="px-4 py-3 text-left font-medium">Confidence</th>
                <th className="px-4 py-3 text-left font-medium">Result</th>
                <th className="px-4 py-3 text-right font-medium">P&L (per contract)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => {
                const t = (r.type ?? "").toLowerCase();
                const isNoTrade =
                  r.asset === "NONE" || t === "none" || t === "" || t === "no_trade";
                const pnlPerContract =
                  r.actual_pnl != null ? r.actual_pnl * 100 : null;
                return (
                  <tr key={r.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-gray-300">
                      {formatDate(r.week_start)}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {isNoTrade ? "—" : r.asset}
                    </td>
                    <td className="px-4 py-3">
                      {isNoTrade ? (
                        <span className="text-gray-500">—</span>
                      ) : (
                        <span
                          className={
                            t === "call" ? "text-bull-500" : "text-bear-500"
                          }
                        >
                          {r.type.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {isNoTrade ? "—" : formatPrice(r.strike)}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {isNoTrade ? "—" : formatDate(r.expiration)}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {isNoTrade ? "—" : formatPrice(r.entry_price)}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {isNoTrade ? "—" : `${r.confidence}/100`}
                    </td>
                    <td className="px-4 py-3">
                      {statusBadge(isNoTrade ? "no_trade" : r.performance_status)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {pnlPerContract == null ? (
                        <span className="text-gray-500">—</span>
                      ) : (
                        <span
                          className={
                            pnlPerContract > 0
                              ? "text-bull-500"
                              : pnlPerContract < 0
                              ? "text-bear-500"
                              : "text-gray-400"
                          }
                        >
                          {pnlPerContract > 0 ? "+" : ""}
                          {formatPrice(pnlPerContract)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
