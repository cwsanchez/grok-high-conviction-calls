import type { Recommendation } from "@/lib/types";
import { formatDate, formatPrice } from "@/lib/dates";

function StatBlock({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl bg-ink-800/60 p-4 ring-1 ring-white/5">
      <div className="text-[11px] uppercase tracking-widest text-gray-400">
        {label}
      </div>
      <div
        className={`mt-1 ${
          emphasis ? "text-2xl font-semibold text-white" : "text-lg text-gray-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function NoTradeCard({ rec }: { rec: Recommendation | null }) {
  const reason = rec?.reasoning ?? "We have not run an analysis yet.";
  return (
    <div className="glass rounded-3xl p-8 sm:p-10">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
          No Trade This Week
        </span>
      </div>
      <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
        Market Conditions Not Ideal
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
        Our 4 AI agents reviewed all 12 assets and the setup did not pass our
        strict 8-point checklist. Patience is part of the edge — sitting in cash
        is a position.
      </p>
      <div className="mt-6 whitespace-pre-line rounded-xl bg-ink-800/60 p-4 text-sm text-gray-200 ring-1 ring-white/5">
        {reason}
      </div>
    </div>
  );
}

export default function RecommendationCard({
  rec,
}: {
  rec: Recommendation | null;
}) {
  if (!rec || rec.asset === "NONE" || rec.type === "NONE") {
    return <NoTradeCard rec={rec} />;
  }

  const isCall = rec.type.toUpperCase() === "CALL";
  const accent = isCall ? "bull" : "bear";

  return (
    <div className="glass overflow-hidden rounded-3xl ring-1 ring-white/5">
      <div
        className={`flex items-center justify-between gap-4 border-b border-white/5 px-6 py-4 ${
          isCall ? "bg-bull-700/15" : "bg-bear-700/15"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-2 w-2 rounded-full ${
              isCall ? "bg-bull-500" : "bg-bear-500"
            }`}
          />
          <span
            className={`text-xs font-semibold uppercase tracking-widest ${
              isCall ? "text-bull-500" : "text-bear-500"
            }`}
          >
            High-Conviction {isCall ? "Long Call" : "Long Put"}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          Week of {formatDate(rec.week_start)}
        </div>
      </div>

      <div className="px-6 py-8 sm:px-10">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <div className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            {rec.asset}
          </div>
          <div
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${
              isCall
                ? "bg-bull-500/15 text-bull-500"
                : "bg-bear-500/15 text-bear-500"
            }`}
          >
            {rec.type}
          </div>
          <div className="text-sm text-gray-400">
            Confidence:{" "}
            <span className={`font-semibold text-${accent}-500`}>
              {rec.confidence}/100
            </span>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBlock label="Strike" value={formatPrice(rec.strike)} emphasis />
          <StatBlock
            label="Expiration"
            value={formatDate(rec.expiration)}
            emphasis
          />
          <StatBlock
            label="Limit Buy Price"
            value={formatPrice(rec.entry_price)}
            emphasis
          />
          <StatBlock
            label="Profit Target"
            value={
              <span className="text-bull-500">
                {formatPrice(rec.profit_target)}
              </span>
            }
            emphasis
          />
          <StatBlock
            label="Stop Loss"
            value={
              <span className="text-bear-500">{formatPrice(rec.stop_loss)}</span>
            }
            emphasis
          />
          <StatBlock
            label="Max Risk (per contract)"
            value={formatPrice(
              Math.max(0, (rec.entry_price - rec.stop_loss) * 100)
            )}
          />
          <StatBlock
            label="Profit Potential"
            value={
              <span className="text-bull-500">
                {formatPrice(
                  Math.max(0, (rec.profit_target - rec.entry_price) * 100)
                )}
              </span>
            }
          />
          <StatBlock
            label="Reward / Risk"
            value={
              (() => {
                const risk = rec.entry_price - rec.stop_loss;
                const reward = rec.profit_target - rec.entry_price;
                if (risk <= 0) return "—";
                return `${(reward / risk).toFixed(2)}x`;
              })()
            }
          />
        </div>

        {rec.reasoning && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
              Why This Trade
            </h3>
            <div className="mt-2 whitespace-pre-line rounded-xl bg-ink-800/60 p-4 text-sm leading-6 text-gray-200 ring-1 ring-white/5">
              {rec.reasoning}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
