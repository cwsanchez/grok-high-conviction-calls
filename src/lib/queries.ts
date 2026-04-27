import { getSupabase } from "./supabase";
import type { Recommendation, MarketState, WeekGroup } from "./types";

export async function fetchLatestWeekTrades(): Promise<{
  week_start: string | null;
  trades: Recommendation[];
  market_view: string | null;
  market_regime: string | null;
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
    return { week_start: null, trades: [], market_view: null, market_regime: null };
  }

  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .eq("week_start", latestWeek)
    .order("rank", { ascending: true });
  if (error) throw error;

  const trades = (data as Recommendation[] | null) ?? [];
  const first = trades[0];
  return {
    week_start: latestWeek,
    trades,
    market_view: first?.market_view ?? null,
    market_regime: first?.market_regime ?? null,
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
  const rows = (data as Recommendation[] | null) ?? [];

  const map = new Map<string, WeekGroup>();
  for (const r of rows) {
    const key = r.week_start;
    if (!map.has(key)) {
      map.set(key, {
        week_start: key,
        trades: [],
        market_view: r.market_view,
        market_regime: r.market_regime,
        is_no_trade_week: false,
      });
    }
    map.get(key)!.trades.push(r);
  }

  const groups = Array.from(map.values());
  for (const g of groups) {
    g.is_no_trade_week = g.trades.every(
      (t) =>
        t.asset === "NONE" ||
        t.type === "none" ||
        (t.type ?? "").trim() === "" ||
        t.performance_status === "no_trade"
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
  return (data as MarketState | null) ?? null;
}
