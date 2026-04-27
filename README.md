# grok-high-conviction-calls

**AI-Powered Weekly High-Conviction Options Advisor**

A simple, transparent Next.js 14 web app that uses Grok + a strict 8-point checklist to publish the **Top 3 high-conviction options trades** every week — or, when fewer than 2 setups qualify, no trades at all.

## How It Works

1. **Every Sunday at 8:00 PM Mountain Time** a Vercel Cron Job calls `/api/cron/weekly`. There is no manual trigger and no settings page.
2. Four AI agents — **Bull**, **Bear**, **Risk**, **Historian** — independently analyze the 12-asset universe using `grok-4-1-fast-reasoning`.
3. A **Judge** prompt synthesizes their reports, applies an 8-point checklist to every candidate, and returns the **top 3 ranked trades** (or fewer if fewer qualify):
   1. Multi-timeframe trend alignment (above 20/50/200-day MA)
   2. Strong momentum (RSI 55–75 + positive MACD)
   3. Favorable IV Rank (25–55)
   4. High options liquidity (>50k contracts)
   5. No major binary events in next 10 days
   6. Positive sentiment from ≥3 sources
   7. Favorable historical pattern match (>58% success rate)
   8. Final confidence ≥ 80/100
4. **At least 7 of 8 must pass** for a trade to be included.
5. If fewer than 2 trades qualify, the site shows *“Limited Opportunities This Week”* instead of forcing trades.
6. Each previous week’s trades are retroactively scored and a one-sentence price-movement summary is saved.

Default strongly to **long calls**. Long puts only in extremely clear and strong bearish conditions (target frequency <10% of weeks).

## Trade Display

Each of the top 3 trades is shown with:

- Rank ribbon (#1 Best, #2, #3)
- “Should you do it?” rating: **Strong Buy / Moderate / Weak / Skip**
- Strength Score 1–10 (gradient meter)
- All trade details: Ticker, Type (Call/Put), Strike, Expiration, Limit Buy Price, Profit Target, Stop Loss, Max Risk ($), Confidence %
- “Why this ranks here” callout
- Risk Level badge: **Low / Medium / High**
- Structured “Why This Trade” section: *Why this trade · What to watch · How to manage · Beginner tip*

The history section groups previous weeks into expandable accordions (most recent week at top), and each historical trade includes a price-movement summary with % change, before → after underlying price, and a one-sentence narrative.

## Asset Universe

`SPY · QQQ · IWM · XLK · NVDA · XLF · XLV · XLE · XLP · TLT · GLD · AAPL`

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres) for `recommendations`, `system_prompts`, `market_state`
- Grok API (xAI) — model `grok-4-1-fast-reasoning`
- Vercel Cron Jobs

## Database Schema (`recommendations`)

In addition to the original columns, this version adds:

| Column | Type | Purpose |
| --- | --- | --- |
| `rank` | smallint | 1, 2, or 3 within a week |
| `strength_score` | numeric | 1.0–10.0 quality score |
| `rating` | text | Strong Buy / Moderate / Weak / Skip |
| `risk_level` | text | Low / Medium / High |
| `rank_explanation` | text | Why this trade ranks where it does |
| `max_risk` | numeric | Dollar risk per contract |
| `price_at_recommendation` | numeric | Underlying spot at issue time |
| `price_at_evaluation` | numeric | Underlying spot at scoring time |
| `price_change_pct` | numeric | % change since recommendation |
| `price_movement_summary` | text | One-sentence narrative |
| `market_view`, `market_regime`, `checklist_passed_count` | text/smallint | Per-row context |

The previous unique constraint on `week_start` is replaced with a unique index on `(week_start, rank)`.

## Environment Variables

Configured in Vercel:

| Variable | Purpose |
| --- | --- |
| `GROK_API_KEY` | xAI Grok API key (server-only) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key (server-only here) |
| `CRON_SECRET` | Optional shared secret for manual triggering of `/api/cron/weekly` |

For local development copy `.env.example` → `.env.local`.

## Local Development

```bash
npm install
npm run dev
# open http://localhost:3000
```

Useful endpoints:
- `GET /api/health` — environment sanity check
- `POST /api/cron/weekly` (with `Authorization: Bearer $CRON_SECRET`) — manual run

## Deploy

Push to GitHub and Vercel auto-deploys. The cron schedule is defined in `vercel.json` (`0 2 * * 1` UTC = 8:00 PM Sunday MT during DST, 7:00 PM during standard time — adjust if needed).

## Disclaimer

Educational use only. Not financial advice. Options are risky.
