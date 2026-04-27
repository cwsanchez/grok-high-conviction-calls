import type { MarketState } from "@/lib/types";

const REGIME_TONE: Record<string, string> = {
  "strong-bull": "bg-bull-500",
  bull: "bg-bull-500",
  neutral: "bg-amber-400",
  choppy: "bg-amber-400",
  "high-vol": "bg-orange-400",
  bear: "bg-bear-500",
  "strong-bear": "bg-bear-500",
};

export default function MarketView({
  state,
  view,
  regime,
  tradeType,
}: {
  state: MarketState | null;
  view: string | null;
  regime: string | null;
  tradeType: string | null;
}) {
  const finalRegime =
    regime ?? state?.regime ?? inferRegimeFromType(tradeType) ?? "Unknown";
  const notes =
    view ??
    state?.notes ??
    "We will update this view after the next analysis.";
  const tone = REGIME_TONE[finalRegime] ?? "bg-gray-400";

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
        Current Market View
      </h2>
      <div className="mt-3 glass rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-2 w-2 rounded-full ${tone}`} />
          <span className="text-sm font-semibold capitalize text-white">
            Regime: {String(finalRegime).replace(/-/g, " ")}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-gray-300 wrap-anywhere">
          {notes}
        </p>
      </div>
    </section>
  );
}

function inferRegimeFromType(t: string | null): string | null {
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower === "call") return "bull";
  if (lower === "put") return "bear";
  return null;
}
