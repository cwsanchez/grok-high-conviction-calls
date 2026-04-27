import type { Recommendation, RiskLevel, TradeRating } from "@/lib/types";
import { formatDate, formatPrice } from "@/lib/dates";

const RANK_META: Record<number, { label: string; ribbon: string; ring: string }> = {
  1: {
    label: "#1 Best Trade",
    ribbon:
      "bg-gradient-to-r from-amber-400/20 via-bull-500/20 to-emerald-400/20 text-amber-300",
    ring: "ring-amber-400/40",
  },
  2: {
    label: "#2 Trade",
    ribbon: "bg-white/5 text-gray-200",
    ring: "ring-white/10",
  },
  3: {
    label: "#3 Trade",
    ribbon: "bg-white/5 text-gray-200",
    ring: "ring-white/10",
  },
};

const RATING_STYLES: Record<TradeRating, string> = {
  "Strong Buy":
    "bg-bull-500/15 text-bull-500 ring-bull-500/40",
  Moderate: "bg-amber-400/15 text-amber-300 ring-amber-400/40",
  Weak: "bg-orange-500/15 text-orange-300 ring-orange-500/40",
  Skip: "bg-bear-500/15 text-bear-500 ring-bear-500/40",
};

const RISK_STYLES: Record<RiskLevel, string> = {
  Low: "bg-bull-500/15 text-bull-500 ring-bull-500/30",
  Medium: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
  High: "bg-bear-500/15 text-bear-500 ring-bear-500/30",
};

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
    <div className="rounded-xl bg-ink-800/60 p-3 ring-1 ring-white/5 sm:p-4">
      <div className="text-[10px] uppercase tracking-widest text-gray-400 sm:text-[11px]">
        {label}
      </div>
      <div
        className={`mt-1 ${
          emphasis
            ? "text-lg font-semibold text-white sm:text-2xl"
            : "text-base text-gray-100 sm:text-lg"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StrengthMeter({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  const tone =
    score >= 8.5 ? "from-emerald-400 to-bull-500"
    : score >= 7 ? "from-amber-300 to-amber-500"
    : "from-orange-300 to-orange-500";
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px] uppercase tracking-widest text-gray-400">
        <span>Strength Score</span>
        <span className="font-semibold text-white">{score.toFixed(1)} / 10</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-white/5">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${tone}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StructuredReasoning({ text }: { text: string }) {
  if (!text) return null;
  // Detect and split labelled paragraphs like "Why this trade:" / "What to watch:" etc.
  const labels = ["Why this trade", "What to watch", "How to manage", "Beginner tip"];
  type Section = { label?: string; body: string };
  const sections: Section[] = [];
  let remaining = text;
  // Find every label occurrence with index
  const positions: Array<{ label: string; start: number }> = [];
  for (const l of labels) {
    const re = new RegExp(`\\b${l}\\s*:`, "i");
    const m = remaining.match(re);
    if (m && m.index != null) {
      positions.push({ label: l, start: m.index });
    }
  }
  positions.sort((a, b) => a.start - b.start);

  if (positions.length === 0) {
    return (
      <div className="whitespace-pre-line rounded-xl bg-ink-800/60 p-4 text-sm leading-6 text-gray-200 ring-1 ring-white/5 wrap-anywhere">
        {text}
      </div>
    );
  }

  // Anything before the first label is treated as preamble.
  if (positions[0].start > 0) {
    const pre = text.slice(0, positions[0].start).trim();
    if (pre) sections.push({ body: pre });
  }
  for (let i = 0; i < positions.length; i++) {
    const cur = positions[i];
    const next = positions[i + 1];
    const segStart = cur.start;
    const segEnd = next ? next.start : text.length;
    const seg = text.slice(segStart, segEnd).trim();
    const colon = seg.indexOf(":");
    const body = colon >= 0 ? seg.slice(colon + 1).trim() : seg;
    sections.push({ label: cur.label, body });
  }

  return (
    <div className="space-y-3">
      {sections.map((s, idx) => (
        <div
          key={idx}
          className="rounded-xl bg-ink-800/60 p-4 text-sm leading-6 text-gray-200 ring-1 ring-white/5 wrap-anywhere"
        >
          {s.label && (
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-bull-500">
              {s.label}
            </div>
          )}
          <div className="whitespace-pre-line">{s.body}</div>
        </div>
      ))}
    </div>
  );
}

export default function TradeCard({ rec }: { rec: Recommendation }) {
  const t = (rec.type ?? "").toLowerCase();
  const isCall = t === "call";
  const rank = rec.rank ?? 1;
  const meta = RANK_META[rank] ?? RANK_META[1];
  const rating = (rec.rating ?? "Moderate") as TradeRating;
  const risk = (rec.risk_level ?? "Medium") as RiskLevel;

  const maxRisk =
    rec.max_risk != null && rec.max_risk > 0
      ? rec.max_risk
      : Math.max(0, (rec.entry_price - rec.stop_loss) * 100);
  const profitPotential = Math.max(
    0,
    (rec.profit_target - rec.entry_price) * 100
  );
  const rewardRiskRatio = (() => {
    const risk = rec.entry_price - rec.stop_loss;
    const reward = rec.profit_target - rec.entry_price;
    if (risk <= 0) return null;
    return reward / risk;
  })();

  return (
    <div
      className={`glass overflow-hidden rounded-2xl ring-1 sm:rounded-3xl ${meta.ring}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3 sm:px-6 sm:py-4 ${
          isCall ? "bg-bull-700/15" : "bg-bear-700/15"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest ring-1 ring-inset ${meta.ribbon}`}
          >
            {meta.label}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest ${
              isCall ? "text-bull-500" : "text-bear-500"
            }`}
          >
            <span
              className={`inline-flex h-1.5 w-1.5 rounded-full ${
                isCall ? "bg-bull-500" : "bg-bear-500"
              }`}
            />
            Long {isCall ? "Call" : "Put"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${RATING_STYLES[rating]}`}
            title="Should you do it?"
          >
            {rating}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${RISK_STYLES[risk]}`}
            title="Risk level"
          >
            {risk} Risk
          </span>
        </div>
      </div>

      <div className="px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:gap-x-4">
          <div className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {rec.asset}
          </div>
          <div
            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest ${
              isCall ? "bg-bull-500/15 text-bull-500" : "bg-bear-500/15 text-bear-500"
            }`}
          >
            {rec.type.toUpperCase()}
          </div>
          <div className="text-xs text-gray-400 sm:text-sm">
            Confidence:{" "}
            <span className={`font-semibold ${isCall ? "text-bull-500" : "text-bear-500"}`}>
              {rec.confidence}/100
            </span>
          </div>
        </div>

        <div className="mt-5">
          <StrengthMeter score={Number(rec.strength_score ?? 7)} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:mt-7 sm:grid-cols-4 sm:gap-3">
          <StatBlock label="Strike" value={formatPrice(rec.strike)} emphasis />
          <StatBlock
            label="Expiration"
            value={formatDate(rec.expiration)}
            emphasis
          />
          <StatBlock
            label="Limit Buy"
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
            label="Max Risk ($)"
            value={
              <span className="text-bear-500">
                {formatPrice(maxRisk)}
              </span>
            }
          />
          <StatBlock
            label="Profit Potential"
            value={
              <span className="text-bull-500">
                {formatPrice(profitPotential)}
              </span>
            }
          />
          <StatBlock
            label="Reward / Risk"
            value={
              rewardRiskRatio == null ? "—" : `${rewardRiskRatio.toFixed(2)}x`
            }
          />
        </div>

        {rec.rank_explanation && (
          <div className="mt-7 rounded-xl border border-bull-500/20 bg-bull-500/5 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-bull-500">
              Why this ranks here
            </div>
            <div className="mt-1 text-sm leading-6 text-gray-200 wrap-anywhere">
              {rec.rank_explanation}
            </div>
          </div>
        )}

        {rec.reasoning && (
          <div className="mt-7">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
              Why This Trade
            </h3>
            <div className="mt-2">
              <StructuredReasoning text={cleanReasoning(rec.reasoning)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function cleanReasoning(text: string): string {
  // The DB stores reasoning + rank_explanation + agent debate + checklist appended.
  // Strip the suffix so the structured paragraphs render cleanly.
  const idx = text.indexOf("\nAgent Debate Summary:");
  const rankIdx = text.indexOf("\nWhy this ranks here:");
  const cutIdx = [idx, rankIdx].filter((n) => n > -1).sort((a, b) => a - b)[0];
  if (cutIdx != null && cutIdx >= 0) {
    return text.slice(0, cutIdx).trim();
  }
  return text;
}
