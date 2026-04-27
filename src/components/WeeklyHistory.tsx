"use client";

import { useState } from "react";
import type { Recommendation, WeekGroup } from "@/lib/types";
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 sm:text-[11px] ${
        styles[s] ?? styles.pending
      }`}
    >
      {label}
    </span>
  );
}

function priceMovementText(r: Recommendation): string {
  if (r.price_movement_summary) return r.price_movement_summary;
  if (r.price_change_pct != null && r.price_at_recommendation != null) {
    const dir = r.price_change_pct >= 0 ? "rose" : "fell";
    return `${r.asset} ${dir} ~${Math.abs(r.price_change_pct).toFixed(
      1
    )}% from ${formatPrice(r.price_at_recommendation)} since the call.`;
  }
  return "Price movement data not available yet.";
}

function TradeRow({ r }: { r: Recommendation }) {
  const t = (r.type ?? "").toLowerCase();
  const isCall = t === "call";
  const pnlPerContract = r.actual_pnl != null ? r.actual_pnl * 100 : null;
  const pct = r.price_change_pct;

  return (
    <div className="rounded-xl bg-ink-800/60 p-4 ring-1 ring-white/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {r.rank ? (
            <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-300 ring-1 ring-white/10">
              #{r.rank}
            </span>
          ) : null}
          <span className="text-base font-semibold text-white">{r.asset}</span>
          <span
            className={`text-[11px] font-semibold uppercase tracking-widest ${
              isCall ? "text-bull-500" : "text-bear-500"
            }`}
          >
            {r.type?.toUpperCase()}
          </span>
          {r.rating && (
            <span className="text-[11px] text-gray-400">· {r.rating}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
          {statusBadge(r.performance_status)}
          {pnlPerContract != null && (
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
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Field label="Strike" value={formatPrice(r.strike)} />
        <Field label="Expiration" value={formatDate(r.expiration)} />
        <Field label="Entry" value={formatPrice(r.entry_price)} />
        <Field
          label="Confidence"
          value={r.confidence ? `${r.confidence}/100` : "—"}
        />
      </div>
      <div className="mt-3 rounded-lg bg-ink-700/40 p-3 text-xs leading-5 text-gray-300 ring-1 ring-white/5 wrap-anywhere">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Price Movement
          </span>
          {pct != null && (
            <span
              className={`text-[12px] font-semibold ${
                pct >= 0 ? "text-bull-500" : "text-bear-500"
              }`}
            >
              {pct >= 0 ? "+" : ""}
              {pct.toFixed(2)}%
            </span>
          )}
          {r.price_at_recommendation != null && r.price_at_evaluation != null && (
            <span className="text-[11px] text-gray-400">
              {formatPrice(r.price_at_recommendation)} →{" "}
              {formatPrice(r.price_at_evaluation)}
            </span>
          )}
        </div>
        <div className="mt-1">{priceMovementText(r)}</div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-gray-500">
        {label}
      </div>
      <div className="mt-0.5 text-gray-200">{value}</div>
    </div>
  );
}

function WeekAccordion({
  group,
  defaultOpen,
}: {
  group: WeekGroup;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const realTrades = group.trades.filter(
    (t) =>
      t.asset !== "NONE" &&
      t.type !== "none" &&
      t.performance_status !== "no_trade"
  );

  const wins = realTrades.filter((t) => t.performance_status === "win").length;
  const losses = realTrades.filter((t) => t.performance_status === "loss").length;
  const pending = realTrades.filter(
    (t) =>
      !t.performance_status ||
      t.performance_status === "pending" ||
      t.performance_status === "unknown"
  ).length;

  const titleSummary = group.is_no_trade_week
    ? "No trades — Limited opportunities"
    : `${realTrades.length} trade${realTrades.length === 1 ? "" : "s"}`;

  return (
    <div className="glass overflow-hidden rounded-2xl ring-1 ring-white/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02] sm:px-5 sm:py-4"
      >
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest text-gray-400">
            Week of
          </div>
          <div className="mt-0.5 truncate text-base font-semibold text-white sm:text-lg">
            {formatDate(group.week_start)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-gray-400">
          <span className="rounded-full bg-white/5 px-2 py-0.5 ring-1 ring-white/10">
            {titleSummary}
          </span>
          {!group.is_no_trade_week && (
            <>
              {wins > 0 && (
                <span className="rounded-full bg-bull-500/15 px-2 py-0.5 text-bull-500 ring-1 ring-bull-500/30">
                  {wins}W
                </span>
              )}
              {losses > 0 && (
                <span className="rounded-full bg-bear-500/15 px-2 py-0.5 text-bear-500 ring-1 ring-bear-500/30">
                  {losses}L
                </span>
              )}
              {pending > 0 && (
                <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-amber-400 ring-1 ring-amber-400/30">
                  {pending} pending
                </span>
              )}
            </>
          )}
          <span
            className={`ml-1 inline-block h-4 w-4 transform text-gray-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.085l3.71-3.853a.75.75 0 111.08 1.04l-4.24 4.402a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </div>
      </button>
      {open && (
        <div className="border-t border-white/5 px-4 py-4 sm:px-5 sm:py-5">
          {group.market_view && (
            <div className="mb-4 rounded-lg bg-ink-700/30 p-3 text-xs leading-5 text-gray-300 ring-1 ring-white/5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                Market view that week
              </div>
              <div className="mt-1">{group.market_view}</div>
            </div>
          )}
          {group.is_no_trade_week ? (
            <div className="rounded-xl bg-ink-800/50 p-4 text-sm text-gray-300 ring-1 ring-white/5">
              <div className="font-semibold text-white">Limited Opportunities</div>
              <div className="mt-1 text-xs leading-6 text-gray-400 wrap-anywhere">
                {group.trades[0]?.reasoning ??
                  "Fewer than 2 trades passed our 7-of-8 checklist."}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {realTrades.map((r) => (
                <TradeRow key={r.id} r={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WeeklyHistory({ groups }: { groups: WeekGroup[] }) {
  if (!groups.length) {
    return (
      <section className="mt-12">
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
    <section className="mt-12">
      <div className="flex items-end justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
          History
        </h2>
        <p className="text-[11px] text-gray-500">
          Most recent week first · click to expand
        </p>
      </div>
      <div className="mt-3 space-y-3">
        {groups.map((g, i) => (
          <WeekAccordion key={g.week_start} group={g} defaultOpen={i === 0} />
        ))}
      </div>
    </section>
  );
}
