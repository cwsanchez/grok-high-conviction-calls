import { getSupabase } from "./supabase";
import type { Recommendation, MarketState } from "./types";

export async function fetchLatestRecommendation(): Promise<Recommendation | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Recommendation | null) ?? null;
}

export async function fetchHistory(limit = 20): Promise<Recommendation[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Recommendation[] | null) ?? [];
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
