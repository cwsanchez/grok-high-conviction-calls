import { callGrok, extractJson } from "./grok";
import { SYSTEM_PROMPTS } from "./prompts";
import type {
  AgentReport,
  ChecklistResult,
  FinalAnalysis,
  RankedTrade,
  RiskLevel,
  TradeRating,
} from "./types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const userTaskTemplate = (today: string) => `Today is ${today}.
Analyze the current market for the upcoming week (Monday open through Friday close).
Use your best knowledge of recent market action, sector rotation, macro news, and seasonality.
If exact recent data is uncertain, state your reasoning conservatively and adjust conviction down.
Return JSON only.`;

async function runAgent(
  name: "bull" | "bear" | "risk" | "historian",
  today: string
): Promise<AgentReport & { regime?: string; veto_assets?: string[] }> {
  const content = await callGrok(
    [
      { role: "system", content: SYSTEM_PROMPTS[name] },
      { role: "user", content: userTaskTemplate(today) },
    ],
    { temperature: 0.5, jsonMode: true, maxTokens: 1600 }
  );
  return extractJson(content);
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
  why_no_trades?: string;
}

export async function runWeeklyAnalysis(): Promise<{
  agents: Record<string, AgentReport>;
  final: FinalAnalysis;
}> {
  const today = todayISO();

  const [bull, bear, risk, historian] = await Promise.all([
    runAgent("bull", today),
    runAgent("bear", today),
    runAgent("risk", today),
    runAgent("historian", today),
  ]);

  const judgeUser = `Today is ${today}.

Below are the four agent reports for this week. Synthesize them into the TOP 3 highest-quality trade ideas (or fewer if quality setups don't exist). Apply the strict 8-point checklist; only include trades that pass at least 7 of 8 points. Default strongly to long CALLS; only recommend a long PUT in extremely clear and strong bearish conditions.

BULL REPORT:
${JSON.stringify(bull, null, 2)}

BEAR REPORT:
${JSON.stringify(bear, null, 2)}

RISK REPORT:
${JSON.stringify(risk, null, 2)}

HISTORIAN REPORT:
${JSON.stringify(historian, null, 2)}

Return JSON only with the schema described in the system prompt.`;

  const judgeRaw = await callGrok(
    [
      { role: "system", content: SYSTEM_PROMPTS.judge },
      { role: "user", content: judgeUser },
    ],
    { temperature: 0.2, jsonMode: true, maxTokens: 4000 }
  );

  const judged = extractJson<RawJudge>(judgeRaw);

  const final = enforceTopTrades(judged);

  return {
    agents: { bull, bear, risk, historian },
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
    if (r === "Skip") {
      // Skip should not appear in trades; downgrade to Weak.
      return passed >= 7 ? "Moderate" : "Weak";
    }
    return r as TradeRating;
  }
  if (passed === 8 && confidence >= 85) return "Strong Buy";
  if (passed >= 7 && confidence >= 80) return "Moderate";
  return "Weak";
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
  const base = passed >= 8 ? 8.5 : passed >= 7 ? 7.0 : 5.0;
  const conf = Math.max(0, Math.min(20, (confidence - 75) / 2));
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

export function enforceTopTrades(judged: RawJudge): FinalAnalysis {
  const market_view = String(judged.market_view ?? "");
  const market_regime = String(judged.market_regime ?? "neutral");

  const rawTrades: RawTrade[] = Array.isArray(judged.trades) ? judged.trades : [];

  const qualified: RankedTrade[] = [];
  for (const t of rawTrades) {
    if (!isComplete(t)) continue;
    const checklist = normalizeChecklist(t.checklist);
    if (checklist.passed_count < 7) continue;

    const typeUpper = String(t.type ?? "").toUpperCase();
    if (typeUpper !== "CALL" && typeUpper !== "PUT") continue;

    const confidence = Math.max(0, Math.min(100, Math.round(Number(t.confidence ?? 0))));
    if (confidence < 80) continue;

    const entry = Number(t.entry_price ?? 0);
    const target = Number(t.profit_target ?? 0);
    const stop = Number(t.stop_loss ?? 0);
    if (entry <= 0 || target <= 0 || stop <= 0) continue;

    const maxRisk =
      Number.isFinite(Number(t.max_risk)) && Number(t.max_risk) > 0
        ? Number(t.max_risk)
        : Math.max(0, (entry - stop) * 100);

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
      rating: clampRating(t.rating, checklist.passed_count, confidence),
      risk_level: clampRisk(t.risk_level),
      rank_explanation: String(t.rank_explanation ?? ""),
      reasoning: String(t.reasoning ?? ""),
      price_at_recommendation:
        Number.isFinite(Number(t.price_at_recommendation))
          ? Number(t.price_at_recommendation)
          : 0,
      checklist,
    };
    qualified.push(trade);
  }

  qualified.sort((a, b) => {
    if (b.strength_score !== a.strength_score) return b.strength_score - a.strength_score;
    return b.confidence - a.confidence;
  });

  const top = qualified.slice(0, 3).map((t, i) => ({ ...t, rank: i + 1 }));

  let why_no_trades: string | undefined = judged.why_no_trades;
  if (top.length < 2) {
    why_no_trades =
      why_no_trades ||
      `Only ${top.length} setup${top.length === 1 ? "" : "s"} passed our 7-of-8 checklist this week. Patience is part of the edge — sitting in cash is a position.`;
  } else {
    why_no_trades = undefined;
  }

  return {
    trades: top,
    market_view,
    market_regime,
    why_no_trades,
  };
}
