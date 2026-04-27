import { NextRequest, NextResponse } from "next/server";
import { runWeeklyAnalysis } from "@/lib/agents";
import { getSupabase } from "@/lib/supabase";
import { weekContext, type WeekContext } from "@/lib/dates";
import { updatePastPerformance } from "@/lib/performance";
import { SYSTEM_PROMPTS } from "@/lib/prompts";
import type { AgentReport, FinalAnalysis, RankedTrade } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (isVercelCron) return true;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  if (cronSecret && req.nextUrl.searchParams.get("secret") === cronSecret) return true;
  return false;
}

async function upsertSystemPrompts(): Promise<void> {
  const supabase = getSupabase();
  const rows = Object.entries(SYSTEM_PROMPTS).map(([name, content]) => ({
    name,
    content,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("system_prompts")
    .upsert(rows, { onConflict: "name" });
  if (error) console.error("system_prompts upsert error", error);
}

function buildReasoning(
  trade: RankedTrade,
  agents: Record<string, AgentReport>,
  debate: { summary?: string; week_quality?: string; action_stance?: string } | null
): string {
  const checklistLines = Object.entries(trade.checklist)
    .filter(([k]) => k !== "passed_count" && k !== "all_passed")
    .map(([k, v]) => {
      const item = v as { pass: boolean; detail: string };
      return `- ${item.pass ? "PASS" : "FAIL"} ${k}: ${item.detail}`;
    });

  return [
    trade.reasoning ?? "",
    "",
    "Why this ranks here:",
    trade.rank_explanation || "—",
    "",
    "Agent Debate Summary:",
    `- Bull: ${agents.bull?.summary ?? ""}`,
    `- Bear: ${agents.bear?.summary ?? ""}`,
    `- Risk: ${agents.risk?.summary ?? ""}`,
    `- Historian: ${agents.historian?.summary ?? ""}`,
    debate?.summary ? `- Debate: ${debate.summary}` : "",
    debate?.action_stance ? `- Action stance: ${debate.action_stance}` : "",
    "",
    `8-Point Quality Checklist (${trade.checklist.passed_count}/8 passed — used as input, not as a hard gate):`,
    ...checklistLines,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

async function clearWeek(weekStart: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("recommendations")
    .delete()
    .eq("week_start", weekStart);
  if (error) console.error("clearWeek error", error);
}

async function weekHasRecommendations(weekStart: string): Promise<boolean> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("recommendations")
    .select("id", { count: "exact", head: true })
    .eq("week_start", weekStart);
  if (error) {
    console.error("weekHasRecommendations check error", error);
    return false;
  }
  return (count ?? 0) > 0;
}

// We persist the new fields (execute_verdict, weekly_verdict, weekly_verdict_summary)
// using tag prefixes in existing text columns to avoid a DB migration. The query
// layer parses these prefixes back out.
function encodeMarketView(final: FinalAnalysis): string {
  const tag = `[VERDICT:${final.weekly_verdict}]`;
  const summary = final.weekly_verdict_summary || "";
  const baseView = (final.market_view || "").trim();
  return [tag, summary, baseView].filter(Boolean).join("\n\n");
}

function encodeRankExplanation(trade: RankedTrade): string {
  const tag = `[VERDICT:${trade.execute_verdict}]`;
  const text = (trade.rank_explanation || "").trim();
  return text ? `${tag} ${text}` : tag;
}

async function runJob(opts: { force?: boolean } = {}) {
  const ctx = weekContext();
  const { weekStart } = ctx;

  if (!opts.force && (await weekHasRecommendations(weekStart))) {
    return {
      week_start: weekStart,
      skipped: true,
      reason: "already_has_recommendations",
      week_context: ctx,
    };
  }

  await upsertSystemPrompts();

  const perfResult = await updatePastPerformance(weekStart).catch((e) => {
    console.error("performance update failed", e);
    return { updated: 0 };
  });

  const { final, agents, debate } = await runWeeklyAnalysis(ctx);

  const supabase = getSupabase();

  const encodedMarketView = encodeMarketView(final);

  const marketStateInsert = await supabase.from("market_state").insert({
    regime: final.market_regime,
    last_updated: new Date().toISOString(),
    notes: encodedMarketView,
  });
  if (marketStateInsert.error) {
    console.error("market_state insert error", marketStateInsert.error);
  }

  // Replace this week's rows so re-runs are idempotent.
  await clearWeek(weekStart);

  const insertedIds: number[] = [];

  // ALWAYS insert exactly 3 rows. Even when execute_verdict = "Pass" we keep the
  // row visible for transparency and let the UI render the correct verdict badge.
  const rows = final.trades.map((t) => ({
    week_start: weekStart,
    rank: t.rank,
    asset: t.asset,
    type: (t.type || "CALL").toLowerCase(),
    strike: t.strike,
    expiration: t.expiration || weekStart,
    entry_price: t.entry_price,
    profit_target: t.profit_target,
    stop_loss: t.stop_loss,
    max_risk: t.max_risk,
    confidence: t.confidence,
    strength_score: t.strength_score,
    rating: t.rating,
    risk_level: t.risk_level,
    rank_explanation: encodeRankExplanation(t),
    reasoning: buildReasoning(t, agents, debate),
    price_at_recommendation: t.price_at_recommendation || null,
    market_view: encodedMarketView,
    market_regime: final.market_regime,
    checklist_passed_count: t.checklist.passed_count,
    performance_status: t.execute_verdict === "Pass" ? "no_trade" : "pending",
    actual_pnl: t.execute_verdict === "Pass" ? 0 : null,
    created_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("recommendations")
    .insert(rows)
    .select("id");
  if (error) {
    console.error("recommendations insert error", error);
  } else {
    for (const r of (data ?? []) as Array<{ id: number }>) {
      insertedIds.push(r.id);
    }
  }

  return {
    week_start: weekStart,
    trades_count: final.trades.length,
    weekly_verdict: final.weekly_verdict,
    assets: final.trades.map((t) => `${t.rank}:${t.asset}:${t.execute_verdict}`),
    market_regime: final.market_regime,
    inserted_ids: insertedIds,
    performance_updated: perfResult.updated,
    week_context: ctx,
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const force = req.nextUrl.searchParams.get("force") === "1";
    const result = await runJob({ force });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("cron failed", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

export type { WeekContext };
