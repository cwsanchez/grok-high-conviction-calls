import { callGrok, extractJson } from "./grok";
import { SYSTEM_PROMPTS } from "./prompts";
import { weekContext, type WeekContext } from "./dates";
import type {
  AgentReport,
  ChecklistResult,
  ExecuteVerdict,
  FinalAnalysis,
  RankedTrade,
  RiskLevel,
  TradeRating,
  WeeklyVerdict,
} from "./types";

function describeWeek(ctx: WeekContext): string {
  if (ctx.tradingDaysRemaining >= 5) {
    return `This is the FULL upcoming trading week (Mon ${ctx.weekStart} open through Fri ${ctx.weekEnd} close). Five trading days available.`;
  }
  if (ctx.tradingDaysRemaining <= 0) {
    return `The trading week ${ctx.weekStart} → ${ctx.weekEnd} has already closed. Lean toward "Sit Out" on the weekly verdict, but still rank the best 3 ideas you would have taken.`;
  }
  return `This analysis is starting MID-WEEK. Week of ${ctx.weekStart} → ${ctx.weekEnd}. Only ${ctx.tradingDaysRemaining} trading day${
    ctx.tradingDaysRemaining === 1 ? "" : "s"
  } and ~${ctx.hoursRemaining} hours remain until Friday close. Adjust position sizing, profit targets, and stop losses to reflect the shorter holding window. Reduce conviction on slow-moving setups; favor catalysts that could play out in the remaining days. If <2 trading days remain, the weekly verdict should usually be "Caution" or "Sit Out".`;
}

const userTaskTemplate = (ctx: WeekContext) => `Today is ${ctx.todayIso}.
Analyze the current market for the trading week of ${ctx.weekStart} (Monday open) through ${ctx.weekEnd} (Friday close).
Use your best knowledge of recent market action, sector rotation, macro news, sentiment, options flow, analyst commentary, and seasonality.
You are encouraged to think broadly and creatively — research analogs, debate setups, and consider opposing views.
If exact recent data is uncertain, state your reasoning conservatively and adjust conviction down.

Week timing context:
${describeWeek(ctx)}

Return JSON only.`;

async function runAgent(
  name: "bull" | "bear" | "risk" | "historian",
  ctx: WeekContext
): Promise<AgentReport & { regime?: string; veto_assets?: string[]; week_quality?: string }> {
  const content = await callGrok(
    [
      { role: "system", content: SYSTEM_PROMPTS[name] },
      { role: "user", content: userTaskTemplate(ctx) },
    ],
    { temperature: 0.6, jsonMode: true, maxTokens: 1800 }
  );
  return extractJson(content);
}

interface DebateReport {
  agent: "debate";
  summary: string;
  week_quality?: string;
  action_stance?: string;
  shortlist?: Array<{
    asset?: string;
    bull_case?: string;
    bear_case?: string;
    resolution?: string;
    consensus_score?: number;
  }>;
}

async function runDebate(
  ctx: WeekContext,
  bull: AgentReport,
  bear: AgentReport,
  risk: AgentReport,
  historian: AgentReport
): Promise<DebateReport> {
  const userMsg = `Today is ${ctx.todayIso}. Week of ${ctx.weekStart} → ${ctx.weekEnd}.
${describeWeek(ctx)}

Run a focused debate over the most promising tickers. Synthesize the four reports below into a shortlist with bull case / bear case / resolution per ticker, and an overall week quality and action stance.

BULL REPORT:
${JSON.stringify(bull, null, 2)}

BEAR REPORT:
${JSON.stringify(bear, null, 2)}

RISK REPORT:
${JSON.stringify(risk, null, 2)}

HISTORIAN REPORT:
${JSON.stringify(historian, null, 2)}

Return JSON only with the schema described in the system prompt.`;

  const content = await callGrok(
    [
      { role: "system", content: SYSTEM_PROMPTS.debate },
      { role: "user", content: userMsg },
    ],
    { temperature: 0.5, jsonMode: true, maxTokens: 1800 }
  );
  return extractJson<DebateReport>(content);
}

const CHECKLIST_KEYS: Array<keyof ChecklistResult> = [
  "trend_alignment",
  "momentum",
  "iv_rank",
  "liquidity",
  "binary_events",
  "sentiment",
  "historical_pattern",
  "confidence_threshold",
];

const VALID_RATINGS: TradeRating[] = [
  "Strong Buy",
  "Moderate",
  "Weak",
  "Skip",
];
const VALID_RISK: RiskLevel[] = ["Low", "Medium", "High"];
const VALID_EXECUTE: ExecuteVerdict[] = [
  "Take It",
  "Small Size",
  "Watchlist",
  "Pass",
];
const VALID_WEEKLY: WeeklyVerdict[] = [
  "Strong Week",
  "Solid",
  "Mixed",
  "Caution",
  "Sit Out",
];

interface RawTrade {
  rank?: number;
  asset?: string;
  type?: string;
  expiration?: string;
  strike?: number;
  entry_price?: number;
  profit_target?: number;
  stop_loss?: number;
  max_risk?: number;
  confidence?: number;
  strength_score?: number;
  rating?: string;
  execute_verdict?: string;
  risk_level?: string;
  rank_explanation?: string;
  reasoning?: string;
  price_at_recommendation?: number;
  checklist?: Partial<ChecklistResult>;
}

interface RawJudge {
  trades?: RawTrade[];
  market_view?: string;
  market_regime?: string;
  weekly_verdict?: string;
  weekly_verdict_summary?: string;
}

export async function runWeeklyAnalysis(
  ctxOverride?: WeekContext
): Promise<{
  agents: Record<string, AgentReport>;
  debate: DebateReport;
  final: FinalAnalysis;
}> {
  const ctx = ctxOverride ?? weekContext();

  const [bull, bear, risk, historian] = await Promise.all([
    runAgent("bull", ctx),
    runAgent("bear", ctx),
    runAgent("risk", ctx),
    runAgent("historian", ctx),
  ]);

  // New: agents debate before the judge synthesizes.
  const debate = await runDebate(ctx, bull, bear, risk, historian);

  const judgeUser = `Today is ${ctx.todayIso}.

You are producing trades for the week of ${ctx.weekStart} → ${ctx.weekEnd}.
${describeWeek(ctx)}

Below are the five agent reports for this week (Bull, Bear, Risk, Historian, Debate). Synthesize them into the TOP 3 highest-conviction trade ideas, ranked best-first.

CRITICAL:
- Always return EXACTLY 3 trades. Do not return fewer. Even in a weak week, surface the best 3 ideas the agents debated.
- Use the 8-point checklist as INPUT to your scoring, not as a hard gate.
- Provide a clear weekly_verdict ("Strong Week", "Solid", "Mixed", "Caution", or "Sit Out") and a 2-3 sentence weekly_verdict_summary that tells the user, in plain English, whether to actually execute this week and which (if any) of the 3 trades are good to take vs. transparency-only.
- Each trade also gets an execute_verdict ("Take It", "Small Size", "Watchlist", or "Pass") that explicitly tells the user whether to take that specific trade.
- If the week is already in progress, scale profit targets, stop losses, and position sizing for the shorter holding window.

BULL REPORT:
${JSON.stringify(bull, null, 2)}

BEAR REPORT:
${JSON.stringify(bear, null, 2)}

RISK REPORT:
${JSON.stringify(risk, null, 2)}

HISTORIAN REPORT:
${JSON.stringify(historian, null, 2)}

DEBATE SYNTHESIS:
${JSON.stringify(debate, null, 2)}

Return JSON only with the schema described in the system prompt. EXACTLY 3 trades.`;

  const judgeRaw = await callGrok(
    [
      { role: "system", content: SYSTEM_PROMPTS.judge },
      { role: "user", content: judgeUser },
    ],
    { temperature: 0.3, jsonMode: true, maxTokens: 4500 }
  );

  const judged = extractJson<RawJudge>(judgeRaw);

  const final = enforceTopTrades(judged);

  return {
    agents: { bull, bear, risk, historian },
    debate,
    final,
  };
}

function normalizeChecklist(raw: Partial<ChecklistResult> | undefined): ChecklistResult {
  const normalized: ChecklistResult = {
    trend_alignment: { pass: false, detail: "missing" },
    momentum: { pass: false, detail: "missing" },
    iv_rank: { pass: false, detail: "missing" },
    liquidity: { pass: false, detail: "missing" },
    binary_events: { pass: false, detail: "missing" },
    sentiment: { pass: false, detail: "missing" },
    historical_pattern: { pass: false, detail: "missing" },
    confidence_threshold: { pass: false, detail: "missing" },
    passed_count: 0,
    all_passed: false,
  };
  let passed = 0;
  for (const key of CHECKLIST_KEYS) {
    const v = (raw as Record<string, { pass?: boolean; detail?: string }> | undefined)?.[key];
    const pass = Boolean(v?.pass);
    const detail = String(v?.detail ?? "missing");
    (normalized as unknown as Record<string, { pass: boolean; detail: string }>)[key] = {
      pass,
      detail,
    };
    if (pass) passed++;
  }
  normalized.passed_count = passed;
  normalized.all_passed = passed === CHECKLIST_KEYS.length;
  return normalized;
}

function clampRating(r: string | undefined, passed: number, confidence: number): TradeRating {
  if (r && (VALID_RATINGS as string[]).includes(r)) {
    return r as TradeRating;
  }
  if (passed === 8 && confidence >= 85) return "Strong Buy";
  if (passed >= 7 && confidence >= 80) return "Moderate";
  if (passed >= 5) return "Weak";
  return "Skip";
}

function deriveExecuteVerdict(
  raw: string | undefined,
  rating: TradeRating,
  passed: number,
  confidence: number
): ExecuteVerdict {
  if (raw && (VALID_EXECUTE as string[]).includes(raw)) {
    return raw as ExecuteVerdict;
  }
  if (rating === "Strong Buy") return "Take It";
  if (rating === "Moderate") return passed >= 7 && confidence >= 80 ? "Take It" : "Small Size";
  if (rating === "Weak") return "Watchlist";
  return "Pass";
}

function clampRisk(r: string | undefined): RiskLevel {
  if (r && (VALID_RISK as string[]).includes(r)) return r as RiskLevel;
  return "Medium";
}

function clampStrength(s: number | undefined, passed: number, confidence: number): number {
  if (typeof s === "number" && isFinite(s) && s > 0) {
    return Math.max(1, Math.min(10, Math.round(s * 10) / 10));
  }
  // Fallback: derive from passed + confidence.
  const base = passed >= 8 ? 8.5 : passed >= 7 ? 7.5 : passed >= 5 ? 6.0 : 4.5;
  const conf = Math.max(-10, Math.min(20, (confidence - 70) / 2));
  return Math.max(1, Math.min(10, Math.round((base + conf / 4) * 10) / 10));
}

function isComplete(t: RawTrade): boolean {
  const required: Array<keyof RawTrade> = [
    "asset",
    "type",
    "expiration",
    "strike",
    "entry_price",
    "profit_target",
    "stop_loss",
  ];
  for (const k of required) {
    const v = t[k];
    if (v == null || v === "") return false;
  }
  return true;
}

function clampWeeklyVerdict(
  raw: string | undefined,
  trades: RankedTrade[]
): WeeklyVerdict {
  if (raw && (VALID_WEEKLY as string[]).includes(raw)) {
    return raw as WeeklyVerdict;
  }
  // Derive a sensible default from the trades we ended up with.
  const takes = trades.filter((t) => t.execute_verdict === "Take It").length;
  const passes = trades.filter((t) => t.execute_verdict === "Pass").length;
  const avgPassed =
    trades.reduce((s, t) => s + t.checklist.passed_count, 0) /
    Math.max(1, trades.length);
  if (passes === 3 || (takes === 0 && avgPassed < 4)) return "Sit Out";
  if (takes >= 3 && avgPassed >= 7) return "Strong Week";
  if (takes >= 2 && avgPassed >= 6) return "Solid";
  if (takes >= 1) return "Mixed";
  return "Caution";
}

export function enforceTopTrades(judged: RawJudge): FinalAnalysis {
  const market_view = String(judged.market_view ?? "");
  const market_regime = String(judged.market_regime ?? "neutral");

  const rawTrades: RawTrade[] = Array.isArray(judged.trades) ? judged.trades : [];

  // Build all candidate trades that have a usable structure (don't gate on checklist).
  const candidates: RankedTrade[] = [];
  for (const t of rawTrades) {
    if (!isComplete(t)) continue;

    const typeUpper = String(t.type ?? "").toUpperCase();
    if (typeUpper !== "CALL" && typeUpper !== "PUT") continue;

    const entry = Number(t.entry_price ?? 0);
    const target = Number(t.profit_target ?? 0);
    const stop = Number(t.stop_loss ?? 0);
    if (entry <= 0 || target <= 0 || stop <= 0) continue;

    const checklist = normalizeChecklist(t.checklist);
    const confidence = Math.max(0, Math.min(100, Math.round(Number(t.confidence ?? 0))));

    const maxRisk =
      Number.isFinite(Number(t.max_risk)) && Number(t.max_risk) > 0
        ? Number(t.max_risk)
        : Math.max(0, (entry - stop) * 100);

    const rating = clampRating(t.rating, checklist.passed_count, confidence);
    const execute_verdict = deriveExecuteVerdict(
      t.execute_verdict,
      rating,
      checklist.passed_count,
      confidence
    );

    const trade: RankedTrade = {
      rank: 0,
      asset: String(t.asset),
      type: typeUpper as "CALL" | "PUT",
      expiration: String(t.expiration),
      strike: Number(t.strike),
      entry_price: entry,
      profit_target: target,
      stop_loss: stop,
      max_risk: Math.round(maxRisk * 100) / 100,
      confidence,
      strength_score: clampStrength(t.strength_score, checklist.passed_count, confidence),
      rating,
      execute_verdict,
      risk_level: clampRisk(t.risk_level),
      rank_explanation: String(t.rank_explanation ?? ""),
      reasoning: String(t.reasoning ?? ""),
      price_at_recommendation:
        Number.isFinite(Number(t.price_at_recommendation))
          ? Number(t.price_at_recommendation)
          : 0,
      checklist,
    };
    candidates.push(trade);
  }

  // Sort by quality signals: strength score, then confidence, then checklist count.
  candidates.sort((a, b) => {
    if (b.strength_score !== a.strength_score) return b.strength_score - a.strength_score;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.checklist.passed_count - a.checklist.passed_count;
  });

  // Take top 3. Fallback below ensures we always end up with exactly 3.
  const top = candidates.slice(0, 3).map((t, i) => ({ ...t, rank: i + 1 }));

  // Fallback: if the model returned fewer than 3 valid trades, synthesize placeholder
  // "Watchlist / Pass" entries so the UI never breaks the "always show 3" promise.
  while (top.length < 3) {
    top.push(makePlaceholderTrade(top.length + 1, market_view));
  }

  const weekly_verdict = clampWeeklyVerdict(judged.weekly_verdict, top);
  const weekly_verdict_summary =
    String(judged.weekly_verdict_summary ?? "").trim() ||
    defaultWeeklySummary(weekly_verdict, top);

  return {
    trades: top,
    market_view,
    market_regime,
    weekly_verdict,
    weekly_verdict_summary,
  };
}

function defaultWeeklySummary(
  verdict: WeeklyVerdict,
  trades: RankedTrade[]
): string {
  const takes = trades
    .filter((t) => t.execute_verdict === "Take It")
    .map((t) => `#${t.rank} ${t.asset}`);
  switch (verdict) {
    case "Strong Week":
      return `This is a strong week — multiple clean setups align. The top 3 ideas are all worth taking with normal sizing: ${trades
        .map((t) => `#${t.rank} ${t.asset}`)
        .join(", ")}.`;
    case "Solid":
      return `Solid week. Take ${
        takes.length ? takes.join(", ") : "the top 1-2 ideas"
      } with normal sizing; size down on any "Small Size" picks.`;
    case "Mixed":
      return `Mixed setup this week. Be selective — only take ${
        takes.length ? takes.join(", ") : "the strongest of the three"
      } and consider paper-trading the rest.`;
    case "Caution":
      return `Quality is below average. Only consider #1 with reduced size, and seriously think about sitting the week out. The other two are shown for transparency.`;
    case "Sit Out":
    default:
      return `This week is not good to execute on. The top 3 ideas are shown for transparency, but the system recommends staying flat — no trade is also a trade.`;
  }
}

function makePlaceholderTrade(rank: number, marketView: string): RankedTrade {
  return {
    rank,
    asset: "—",
    type: "CALL",
    expiration: "",
    strike: 0,
    entry_price: 0,
    profit_target: 0,
    stop_loss: 0,
    max_risk: 0,
    confidence: 0,
    strength_score: 1,
    rating: "Skip",
    execute_verdict: "Pass",
    risk_level: "High",
    rank_explanation:
      "The model did not produce a fully formed trade for this slot. Treat as transparency-only.",
    reasoning: `Why this trade: The agents did not converge on a third actionable idea this week.\n\nWhat to watch: ${
      marketView || "Watch for cleaner setups next week."
    }\n\nHow to manage: Skip this slot. Do not force a trade.\n\nBeginner tip: Sitting in cash is a position. Patience is part of the edge.`,
    price_at_recommendation: 0,
    checklist: {
      trend_alignment: { pass: false, detail: "n/a — placeholder" },
      momentum: { pass: false, detail: "n/a — placeholder" },
      iv_rank: { pass: false, detail: "n/a — placeholder" },
      liquidity: { pass: false, detail: "n/a — placeholder" },
      binary_events: { pass: false, detail: "n/a — placeholder" },
      sentiment: { pass: false, detail: "n/a — placeholder" },
      historical_pattern: { pass: false, detail: "n/a — placeholder" },
      confidence_threshold: { pass: false, detail: "n/a — placeholder" },
      passed_count: 0,
      all_passed: false,
    },
  };
}
