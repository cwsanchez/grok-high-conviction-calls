import { getSupabase } from "./supabase";
import { callGrok, extractJson } from "./grok";
import type { Recommendation } from "./types";

interface PerfEstimate {
  performance_status: "win" | "loss" | "expired_breakeven" | "unknown";
  actual_pnl: number | null;
  price_at_evaluation: number | null;
  price_change_pct: number | null;
  price_movement_summary: string;
  notes: string;
}

const PERF_PROMPT = `You evaluate whether a previous week's options trade recommendation would have hit its profit target or stop loss before expiration, AND describe how the underlying asset's price moved after the recommendation.

Given the trade details, estimate based on your best knowledge of recent price action:
- If the underlying clearly trended in favor and likely hit the +75% profit target, mark as "win" (actual_pnl approximately equal to entry_price * 0.75).
- If the underlying clearly moved against and likely hit the -35% stop loss, mark as "loss" (actual_pnl approximately equal to entry_price * -0.35).
- If neither was clearly hit and the contract may still be active, mark as "expired_breakeven" with a small estimated pnl based on intrinsic value.
- If you genuinely cannot tell, mark as "unknown" with actual_pnl null.

Also estimate:
- price_at_evaluation: the underlying's approximate spot price as of today.
- price_change_pct: percent change of the underlying from the recommendation date to today (e.g., +2.5 for +2.5%).
- price_movement_summary: ONE plain-English sentence describing how the asset moved (e.g., "NVDA rallied ~4% the following week on continued AI momentum.").

Return STRICT JSON:
{
  "performance_status": "win|loss|expired_breakeven|unknown",
  "actual_pnl": <number or null>,
  "price_at_evaluation": <number or null>,
  "price_change_pct": <number or null>,
  "price_movement_summary": "<one sentence>",
  "notes": "<one line explanation>"
}`;

export async function evaluatePastRecommendation(
  rec: Recommendation
): Promise<PerfEstimate> {
  if (
    rec.performance_status &&
    rec.performance_status !== "pending" &&
    rec.price_movement_summary
  ) {
    return {
      performance_status: rec.performance_status as PerfEstimate["performance_status"],
      actual_pnl: rec.actual_pnl,
      price_at_evaluation: rec.price_at_evaluation,
      price_change_pct: rec.price_change_pct,
      price_movement_summary: rec.price_movement_summary,
      notes: "already evaluated",
    };
  }

  const userMsg = `Trade to evaluate:
- Asset: ${rec.asset}
- Type: ${rec.type}
- Strike: $${rec.strike}
- Expiration: ${rec.expiration}
- Entry premium (limit): $${rec.entry_price}
- Profit target premium: $${rec.profit_target}
- Stop loss premium: $${rec.stop_loss}
- Underlying price at recommendation: ${
    rec.price_at_recommendation != null
      ? `$${rec.price_at_recommendation}`
      : "unknown"
  }
- Trade opened (week start): ${rec.week_start}
- Today: ${new Date().toISOString().slice(0, 10)}

Estimate the realistic outcome and price movement. Return JSON only.`;

  const raw = await callGrok(
    [
      { role: "system", content: PERF_PROMPT },
      { role: "user", content: userMsg },
    ],
    { temperature: 0.2, jsonMode: true, maxTokens: 600 }
  );

  return extractJson<PerfEstimate>(raw);
}

export async function updatePastPerformance(
  beforeWeek: string
): Promise<{ updated: number }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .lt("week_start", beforeWeek)
    .or("performance_status.is.null,performance_status.eq.pending")
    .neq("asset", "NONE")
    .order("week_start", { ascending: false })
    .limit(15);

  if (error) throw error;
  const rows = (data ?? []) as Recommendation[];

  let updated = 0;
  for (const rec of rows) {
    try {
      const perf = await evaluatePastRecommendation(rec);
      const { error: updErr } = await supabase
        .from("recommendations")
        .update({
          performance_status: perf.performance_status,
          actual_pnl: perf.actual_pnl,
          price_at_evaluation: perf.price_at_evaluation,
          price_change_pct: perf.price_change_pct,
          price_movement_summary: perf.price_movement_summary,
        })
        .eq("id", rec.id);
      if (!updErr) updated++;
    } catch (e) {
      console.error("perf eval failed for", rec.id, e);
    }
  }
  return { updated };
}
