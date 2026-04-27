import { getSupabase } from "./supabase";
import type {
  ExecuteVerdict,
  MarketState,
  Recommendation,
  WeekGroup,
  WeeklyVerdict,
} from "./types";

const WEEKLY_VERDICTS: WeeklyVerdict[] = [
  "Strong Week",
  "Solid",
  "Mixed",
  "Caution",
  "Sit Out",
];
const EXECUTE_VERDICTS: ExecuteVerdict[] = [
  "Take It",
  "Small Size",
  "Watchlist",
  "Pass",
];

const VERDICT_TAG_RE = /^\[VERDICT:([^\]]+)\]\s*/;

function parseVerdictPrefix<T extends string>(
  text: string | null | undefined,
  allowed: T[]
): { verdict: T | null; rest: string } {
  if (!text) return { verdict: null, rest: "" };
  const m = text.match(VERDICT_TAG_RE);
  if (!m) return { verdict: null, rest: text };
  const value = m[1].trim();
  const verdict = (allowed as string[]).includes(value) ? (value as T) : null;
  const rest = text.slice(m[0].length);
  return { verdict, rest };
}

function parseWeeklyVerdict(view: string | null | undefined): {
  verdict: WeeklyVerdict | null;
  summary: string | null;
  marketView: string | null;
} {
  const { verdict, rest } = parseVerdictPrefix(view, WEEKLY_VERDICTS);
  if (!verdict) {
    return { verdict: null, summary: null, marketView: view ?? null };
  }
  // Encoded format: [VERDICT:X]\n\nsummary\n\nmarket_view
  const parts = rest.split(/\n\s*\n/);
  const summary = parts[0]?.trim() || null;
  const marketView = parts.slice(1).join("\n\n").trim() || null;
  return { verdict, summary, marketView };
}

function parseExecuteVerdict(rankExplanation: string | null | undefined): {
  verdict: ExecuteVerdict | null;
  rest: string | null;
} {
  if (!rankExplanation) return { verdict: null, rest: null };
  const { verdict, rest } = parseVerdictPrefix(rankExplanation, EXECUTE_VERDICTS);
  return { verdict, rest: rest.trim() || null };
}

function decorate(rec: Recommendation): Recommendation {
  const { verdict: weekly, summary } = parseWeeklyVerdict(rec.market_view);
  const { verdict: exec, rest: cleanedExpl } = parseExecuteVerdict(
    rec.rank_explanation
  );
  return {
    ...rec,
    rank_explanation: cleanedExpl ?? rec.rank_explanation,
    execute_verdict: exec,
    weekly_verdict: weekly,
    weekly_verdict_summary: summary,
  };
}

function getDisplayMarketView(view: string | null | undefined): string | null {
  if (!view) return null;
  const { marketView } = parseWeeklyVerdict(view);
  return marketView ?? view;
}

export async function fetchLatestWeekTrades(): Promise<{
  week_start: string | null;
  trades: Recommendation[];
  market_view: string | null;
  market_regime: string | null;
  weekly_verdict: WeeklyVerdict | null;
  weekly_verdict_summary: string | null;
}> {
  const supabase = getSupabase();

  const { data: weekRow, error: weekErr } = await supabase
    .from("recommendations")
    .select("week_start")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (weekErr) throw weekErr;
  const latestWeek = (weekRow as { week_start?: string } | null)?.week_start ?? null;
  if (!latestWeek) {
    return {
      week_start: null,
      trades: [],
      market_view: null,
      market_regime: null,
      weekly_verdict: null,
      weekly_verdict_summary: null,
    };
  }

  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .eq("week_start", latestWeek)
    .order("rank", { ascending: true });
  if (error) throw error;

  const raw = (data as Recommendation[] | null) ?? [];
  const trades = raw.map(decorate);
  const first = trades[0];
  const { verdict: weeklyVerdict, summary: weeklySummary } = parseWeeklyVerdict(
    first?.market_view ?? null
  );
  return {
    week_start: latestWeek,
    trades,
    market_view: getDisplayMarketView(first?.market_view),
    market_regime: first?.market_regime ?? null,
    weekly_verdict: weeklyVerdict,
    weekly_verdict_summary: weeklySummary,
  };
}

export async function fetchHistoryGrouped(weeksLimit = 12): Promise<WeekGroup[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .order("week_start", { ascending: false })
    .order("rank", { ascending: true })
    .limit(weeksLimit * 5);

  if (error) throw error;
  const rows = ((data as Recommendation[] | null) ?? []).map(decorate);

  const map = new Map<string, WeekGroup>();
  for (const r of rows) {
    const key = r.week_start;
    if (!map.has(key)) {
      const { verdict, summary } = parseWeeklyVerdict(r.market_view);
      map.set(key, {
        week_start: key,
        trades: [],
        market_view: getDisplayMarketView(r.market_view),
        market_regime: r.market_regime,
        weekly_verdict: verdict,
        weekly_verdict_summary: summary,
        is_no_trade_week: false,
      });
    }
    map.get(key)!.trades.push(r);
  }

  const groups = Array.from(map.values());
  for (const g of groups) {
    // Treat as a "no-trade week" only if every trade is verdict Pass / a legacy
    // NONE row. Real trades (Take It / Small Size / Watchlist) keep the week open.
    g.is_no_trade_week = g.trades.every(
      (t) =>
        t.asset === "NONE" ||
        t.type === "none" ||
        (t.type ?? "").trim() === "" ||
        t.performance_status === "no_trade" ||
        t.execute_verdict === "Pass"
    );
    g.trades.sort((a, b) => (a.rank ?? 1) - (b.rank ?? 1));
  }

  groups.sort((a, b) => (a.week_start < b.week_start ? 1 : -1));
  return groups.slice(0, weeksLimit);
}

export async function fetchMarketState(): Promise<MarketState | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("market_state")
    .select("*")
    .order("last_updated", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const ms = (data as MarketState | null) ?? null;
  if (ms?.notes) {
    ms.notes = getDisplayMarketView(ms.notes);
  }
  return ms;
}
