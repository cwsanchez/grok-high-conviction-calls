import { NextRequest, NextResponse } from "next/server";
import { runWeeklyAnalysis } from "@/lib/agents";
import { getSupabase } from "@/lib/supabase";
import { mostRecentMonday } from "@/lib/dates";
import { updatePastPerformance } from "@/lib/performance";
import { SYSTEM_PROMPTS } from "@/lib/prompts";
import type { AgentReport, RankedTrade } from "@/lib/types";

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
  agents: Record<string, AgentReport>
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
    "",
    `8-Point Checklist (${trade.checklist.passed_count}/8 passed):`,
    ...checklistLines,
  ].join("\n");
}

async function clearWeek(weekStart: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("recommendations")
    .delete()
    .eq("week_start", weekStart);
  if (error) console.error("clearWeek error", error);
}

async function runJob() {
  const weekStart = mostRecentMonday();

  await upsertSystemPrompts();

  const perfResult = await updatePastPerformance(weekStart).catch((e) => {
    console.error("performance update failed", e);
    return { updated: 0 };
  });

  const { final, agents } = await runWeeklyAnalysis();

  const supabase = getSupabase();

  const marketStateInsert = await supabase.from("market_state").insert({
    regime: final.market_regime,
    last_updated: new Date().toISOString(),
    notes: final.market_view,
  });
  if (marketStateInsert.error) {
    console.error("market_state insert error", marketStateInsert.error);
  }

  // Replace this week's rows so re-runs are idempotent.
  await clearWeek(weekStart);

  const insertedIds: number[] = [];

  if (final.trades.length >= 2) {
    const rows = final.trades.map((t) => ({
      week_start: weekStart,
      rank: t.rank,
      asset: t.asset,
      type: t.type.toLowerCase(),
      strike: t.strike,
      expiration: t.expiration,
      entry_price: t.entry_price,
      profit_target: t.profit_target,
      stop_loss: t.stop_loss,
      max_risk: t.max_risk,
      confidence: t.confidence,
      strength_score: t.strength_score,
      rating: t.rating,
      risk_level: t.risk_level,
      rank_explanation: t.rank_explanation,
      reasoning: buildReasoning(t, agents),
      price_at_recommendation: t.price_at_recommendation || null,
      market_view: final.market_view,
      market_regime: final.market_regime,
      checklist_passed_count: t.checklist.passed_count,
      performance_status: "pending",
      actual_pnl: null,
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
  } else {
    const reason =
      final.why_no_trades ??
      "Setup did not produce enough qualifying trades this week.";
    const { error } = await supabase.from("recommendations").insert({
      week_start: weekStart,
      rank: 1,
      asset: "NONE",
      type: "none",
      strike: 0,
      expiration: weekStart,
      entry_price: 0,
      profit_target: 0,
      stop_loss: 0,
      max_risk: 0,
      confidence: 0,
      strength_score: null,
      rating: null,
      risk_level: null,
      rank_explanation: null,
      reasoning: `LIMITED OPPORTUNITIES THIS WEEK\n\n${reason}\n\nMarket view: ${final.market_view}`,
      price_at_recommendation: null,
      market_view: final.market_view,
      market_regime: final.market_regime,
      checklist_passed_count: null,
      performance_status: "no_trade",
      actual_pnl: 0,
      created_at: new Date().toISOString(),
    });
    if (error) console.error("no-trade row insert error", error);
  }

  return {
    week_start: weekStart,
    trades_count: final.trades.length,
    assets: final.trades.map((t) => `${t.rank}:${t.asset}`),
    market_regime: final.market_regime,
    inserted_ids: insertedIds,
    performance_updated: perfResult.updated,
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runJob();
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
