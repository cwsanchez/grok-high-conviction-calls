# grok-high-conviction-calls

**AI-Powered Weekly High-Conviction Options Advisor**

A simple, transparent Next.js 14 web app that uses Grok + a strict 8-point checklist to recommend **one high-quality long call (or rare put)** per week — or skip the week entirely.

## How It Works

1. **Every Sunday at 8:00 PM Mountain Time** a Vercel Cron Job calls `/api/cron/weekly`.
2. Four AI agents — **Bull**, **Bear**, **Risk**, **Historian** — independently analyze the 12-asset universe using `grok-4-1-fast-reasoning`.
3. A **Judge** prompt synthesizes their reports and applies an 8-point checklist:
   1. Multi-timeframe trend alignment (above 20/50/200-day MA)
   2. Strong momentum (RSI 55–75 + positive MACD)
   3. Favorable IV Rank (25–55)
   4. High options liquidity (>50k contracts)
   5. No major binary events in next 10 days
   6. Positive sentiment from ≥3 sources
   7. Favorable historical pattern match (>58% success rate)
   8. Final confidence ≥ 82/100
4. **All 8 must pass** or the system displays *“No Trade This Week — Market Conditions Not Ideal.”*
5. The previous week’s recommendation is retroactively scored and saved.

Default strongly to **long calls**. Long puts only in extremely clear and strong bearish conditions (target frequency <10% of weeks).

## Asset Universe

`SPY · QQQ · IWM · XLK · NVDA · XLF · XLV · XLE · XLP · TLT · GLD · AAPL`

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres) for `recommendations`, `system_prompts`, `market_state`
- Grok API (xAI) — model `grok-4-1-fast-reasoning`
- Vercel Cron Jobs

## Environment Variables

These are already configured in the project's Vercel deployment:

| Variable | Purpose |
| --- | --- |
| `GROK_API_KEY` | xAI Grok API key (server-only) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key (server-only here, never shipped to client) |
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
