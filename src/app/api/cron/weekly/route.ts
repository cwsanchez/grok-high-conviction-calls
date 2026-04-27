import { NextRequest, NextResponse } from "next/server";
import { runWeeklyAnalysis } from "@/lib/agents";
import { getSupabase } from "@/lib/supabase";
import { mostRecentMonday } from "@/lib/dates";
import { updatePastPerformance } from "@/lib/performance";
import { SYSTEM_PROMPTS } from "@/lib/prompts";

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

  let recId: number | null = null;
  if (final.trade && final.asset && final.type && final.expiration) {
    const reasoningWithAgents = [
      final.reasoning ?? "",
      "",
      "Agent Debate Summary:",
      `- Bull: ${(agents as Record<string, { summary?: string }>).bull?.summary ?? ""}`,
      `- Bear: ${(agents as Record<string, { summary?: string }>).bear?.summary ?? ""}`,
      `- Risk: ${(agents as Record<string, { summary?: string }>).risk?.summary ?? ""}`,
      `- Historian: ${(agents as Record<string, { summary?: string }>).historian?.summary ?? ""}`,
      "",
      "8-Point Checklist:",
      ...Object.entries(final.checklist)
        .filter(([k]) => k !== "passed_count" && k !== "all_passed")
        .map(([k, v]) => {
          const item = v as { pass: boolean; detail: string };
          return `- ${item.pass ? "PASS" : "FAIL"} ${k}: ${item.detail}`;
        }),
    ].join("\n");

    const { data, error } = await supabase
      .from("recommendations")
      .upsert(
        {
          week_start: weekStart,
          asset: final.asset,
          type: final.type,
          strike: final.strike ?? 0,
          expiration: final.expiration,
          entry_price: final.entry_price ?? 0,
          profit_target: final.profit_target ?? 0,
          stop_loss: final.stop_loss ?? 0,
          confidence: final.confidence ?? 0,
          reasoning: reasoningWithAgents,
          performance_status: "pending",
          actual_pnl: null,
          created_at: new Date().toISOString(),
        },
        { onConflict: "week_start" }
      )
      .select("id")
      .single();
    if (error) {
      console.error("recommendation upsert error", error);
    } else {
      recId = (data as { id: number }).id;
    }
  } else {
    const noTradeReason =
      final.why_no_trade ?? "Setup did not pass all 8 checklist items this week.";
    const { error } = await supabase.from("recommendations").upsert(
      {
        week_start: weekStart,
        asset: "NONE",
        type: "NONE",
        strike: 0,
        expiration: weekStart,
        entry_price: 0,
        profit_target: 0,
        stop_loss: 0,
        confidence: final.confidence ?? 0,
        reasoning: `NO TRADE THIS WEEK\n\n${noTradeReason}\n\nMarket view: ${final.market_view}`,
        performance_status: "no_trade",
        actual_pnl: 0,
        created_at: new Date().toISOString(),
      },
      { onConflict: "week_start" }
    );
    if (error) console.error("no-trade row insert error", error);
  }

  return {
    week_start: weekStart,
    trade: final.trade,
    asset: final.asset ?? null,
    confidence: final.confidence ?? null,
    checklist_passed: final.checklist.passed_count,
    rec_id: recId,
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
