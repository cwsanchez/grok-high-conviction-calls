import type { MarketState, Recommendation } from "@/lib/types";

export default function MarketView({
  state,
  latest,
}: {
  state: MarketState | null;
  latest: Recommendation | null;
}) {
  const regime = state?.regime ?? inferRegimeFromRec(latest) ?? "Unknown";
  const notes = state?.notes ?? "We will update this view after the next analysis.";

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
        Current Market View
      </h2>
      <div className="mt-3 glass rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-bull-500" />
          <span className="text-sm font-semibold capitalize text-white">
            Regime: {regime.replace(/-/g, " ")}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-gray-300">{notes}</p>
      </div>
    </section>
  );
}

function inferRegimeFromRec(rec: Recommendation | null): string | null {
  if (!rec) return null;
  const t = (rec.type ?? "").toLowerCase();
  if (t === "call") return "bull";
  if (t === "put") return "bear";
  return null;
}
