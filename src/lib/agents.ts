import { callGrok, extractJson } from "./grok";
import { SYSTEM_PROMPTS } from "./prompts";
import type { AgentReport, ChecklistResult, FinalRecommendation } from "./types";

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
    { temperature: 0.5, jsonMode: true, maxTokens: 1400 }
  );
  return extractJson(content);
}

export async function runWeeklyAnalysis(): Promise<{
  agents: ReturnType<typeof Object.fromEntries>;
  final: FinalRecommendation;
}> {
  const today = todayISO();

  const [bull, bear, risk, historian] = await Promise.all([
    runAgent("bull", today),
    runAgent("bear", today),
    runAgent("risk", today),
    runAgent("historian", today),
  ]);

  const judgeUser = `Today is ${today}.

Below are the four agent reports for this week. Synthesize them into a SINGLE high-conviction recommendation, or skip the week. Apply the strict 8-point checklist. Default strongly to long CALLS; only recommend a long PUT in extremely clear and strong bearish conditions.

BULL REPORT:
${JSON.stringify(bull, null, 2)}

BEAR REPORT:
${JSON.stringify(bear, null, 2)}

RISK REPORT:
${JSON.stringify(risk, null, 2)}

HISTORIAN REPORT:
${JSON.stringify(historian, null, 2)}

Return JSON only.`;

  const judgeRaw = await callGrok(
    [
      { role: "system", content: SYSTEM_PROMPTS.judge },
      { role: "user", content: judgeUser },
    ],
    { temperature: 0.2, jsonMode: true, maxTokens: 1600 }
  );

  const judged = extractJson<FinalRecommendation>(judgeRaw);

  const final = enforceChecklist(judged);

  return {
    agents: { bull, bear, risk, historian },
    final,
  };
}

export function enforceChecklist(r: FinalRecommendation): FinalRecommendation {
  const c = r.checklist as Partial<ChecklistResult> | undefined;
  const items: Array<keyof ChecklistResult> = [
    "trend_alignment",
    "momentum",
    "iv_rank",
    "liquidity",
    "binary_events",
    "sentiment",
    "historical_pattern",
    "confidence_threshold",
  ];

  let passed = 0;
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

  for (const key of items) {
    const v = (c as Record<string, { pass?: boolean; detail?: string }> | undefined)?.[key];
    const pass = Boolean(v?.pass);
    const detail = String(v?.detail ?? "missing");
    (normalized as unknown as Record<string, { pass: boolean; detail: string }>)[key] = {
      pass,
      detail,
    };
    if (pass) passed++;
  }

  normalized.passed_count = passed;
  normalized.all_passed = passed === items.length;

  let trade = Boolean(r.trade) && normalized.all_passed;

  if (trade && (r.confidence ?? 0) < 82) {
    trade = false;
    normalized.confidence_threshold = {
      pass: false,
      detail: `Confidence ${r.confidence ?? 0} below 82 threshold`,
    };
    normalized.all_passed = false;
    normalized.passed_count = Math.min(normalized.passed_count, 7);
  }

  if (trade) {
    const required = [
      "asset",
      "type",
      "expiration",
      "strike",
      "entry_price",
      "profit_target",
      "stop_loss",
    ] as const;
    for (const key of required) {
      if ((r as unknown as Record<string, unknown>)[key] == null) {
        trade = false;
        break;
      }
    }
  }

  return {
    ...r,
    trade,
    checklist: normalized,
    why_no_trade:
      !trade && !r.why_no_trade
        ? `Only ${normalized.passed_count} of 8 checklist items passed. The setup is not strong enough this week — patience is part of the edge.`
        : r.why_no_trade,
  };
}
