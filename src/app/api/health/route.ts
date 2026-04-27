import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasSupabase: hasSupabaseEnv(),
    hasGrok: Boolean(process.env.GROK_API_KEY),
    hasCronSecret: Boolean(process.env.CRON_SECRET),
    time: new Date().toISOString(),
  });
}
