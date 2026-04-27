export const TICKERS = [
  "SPY",
  "QQQ",
  "IWM",
  "XLK",
  "NVDA",
  "XLF",
  "XLV",
  "XLE",
  "XLP",
  "TLT",
  "GLD",
  "AAPL",
] as const;

export type Ticker = (typeof TICKERS)[number];

export type TradeType = "CALL" | "PUT";

export type TradeRating = "Strong Buy" | "Moderate" | "Weak" | "Skip";
export type RiskLevel = "Low" | "Medium" | "High";
export type ExecuteVerdict = "Take It" | "Small Size" | "Watchlist" | "Pass";
export type WeeklyVerdict =
  | "Strong Week"
  | "Solid"
  | "Mixed"
  | "Caution"
  | "Sit Out";

export interface ChecklistItem {
  pass: boolean;
  detail: string;
}

export interface ChecklistResult {
  trend_alignment: ChecklistItem;
  momentum: ChecklistItem;
  iv_rank: ChecklistItem;
  liquidity: ChecklistItem;
  binary_events: ChecklistItem;
  sentiment: ChecklistItem;
  historical_pattern: ChecklistItem;
  confidence_threshold: ChecklistItem;
  passed_count: number;
  all_passed: boolean;
}

export interface AgentReport {
  agent: "bull" | "bear" | "risk" | "historian";
  picks: Array<{ asset: string; thesis: string; conviction: number }>;
  summary: string;
}

export interface RankedTrade {
  rank: number;
  asset: string;
  type: TradeType;
  expiration: string;
  strike: number;
  entry_price: number;
  profit_target: number;
  stop_loss: number;
  max_risk: number;
  confidence: number;
  strength_score: number;
  rating: TradeRating;
  execute_verdict: ExecuteVerdict;
  risk_level: RiskLevel;
  rank_explanation: string;
  reasoning: string;
  price_at_recommendation: number;
  checklist: ChecklistResult;
}

export interface FinalAnalysis {
  trades: RankedTrade[];
  market_view: string;
  market_regime: string;
  weekly_verdict: WeeklyVerdict;
  weekly_verdict_summary: string;
}

export interface Recommendation {
  id: number;
  week_start: string;
  rank: number;
  asset: string;
  type: string;
  strike: number;
  expiration: string;
  entry_price: number;
  profit_target: number;
  stop_loss: number;
  max_risk: number | null;
  confidence: number;
  strength_score: number | null;
  rating: TradeRating | null;
  risk_level: RiskLevel | null;
  rank_explanation: string | null;
  reasoning: string | null;
  performance_status: string | null;
  actual_pnl: number | null;
  price_at_recommendation: number | null;
  price_at_evaluation: number | null;
  price_change_pct: number | null;
  price_movement_summary: string | null;
  market_view: string | null;
  market_regime: string | null;
  checklist_passed_count: number | null;
  created_at: string | null;
  // Derived (parsed from encoded prefixes in `rank_explanation` / `market_view`).
  // Persisted via tag-prefix encoding so we don't need a DB migration.
  execute_verdict?: ExecuteVerdict | null;
  weekly_verdict?: WeeklyVerdict | null;
  weekly_verdict_summary?: string | null;
}

export interface MarketState {
  id: number;
  regime: string | null;
  last_updated: string | null;
  notes: string | null;
}

export interface WeekGroup {
  week_start: string;
  trades: Recommendation[];
  market_view: string | null;
  market_regime: string | null;
  weekly_verdict: WeeklyVerdict | null;
  weekly_verdict_summary: string | null;
  // True if EVERY trade in the week is verdict "Pass" (effectively a sit-out week).
  is_no_trade_week: boolean;
}
