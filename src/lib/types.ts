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

export interface ChecklistResult {
  trend_alignment: { pass: boolean; detail: string };
  momentum: { pass: boolean; detail: string };
  iv_rank: { pass: boolean; detail: string };
  liquidity: { pass: boolean; detail: string };
  binary_events: { pass: boolean; detail: string };
  sentiment: { pass: boolean; detail: string };
  historical_pattern: { pass: boolean; detail: string };
  confidence_threshold: { pass: boolean; detail: string };
  passed_count: number;
  all_passed: boolean;
}

export interface AgentReport {
  agent: "bull" | "bear" | "risk" | "historian";
  picks: Array<{ asset: string; thesis: string; conviction: number }>;
  summary: string;
}

export interface FinalRecommendation {
  trade: boolean;
  asset?: string;
  type?: TradeType;
  expiration?: string;
  strike?: number;
  entry_price?: number;
  profit_target?: number;
  stop_loss?: number;
  max_risk?: number;
  confidence?: number;
  reasoning?: string;
  market_view: string;
  market_regime: string;
  checklist: ChecklistResult;
  why_no_trade?: string;
}

export interface Recommendation {
  id: number;
  week_start: string;
  asset: string;
  type: string;
  strike: number;
  expiration: string;
  entry_price: number;
  profit_target: number;
  stop_loss: number;
  confidence: number;
  reasoning: string | null;
  performance_status: string | null;
  actual_pnl: number | null;
  created_at: string | null;
}

export interface MarketState {
  id: number;
  regime: string | null;
  last_updated: string | null;
  notes: string | null;
}
