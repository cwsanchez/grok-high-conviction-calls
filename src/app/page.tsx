import {
  fetchHistoryGrouped,
  fetchLatestWeekTrades,
  fetchMarketState,
} from "@/lib/queries";
import { hasSupabaseEnv } from "@/lib/supabase";
import TopTrades from "@/components/TopTrades";
import WeeklyHistory from "@/components/WeeklyHistory";
import MarketView from "@/components/MarketView";
import Footer from "@/components/Footer";
import NoConfig from "@/components/NoConfig";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <NoConfig />
      </main>
    );
  }

  let latest: Awaited<ReturnType<typeof fetchLatestWeekTrades>> = {
    week_start: null,
    trades: [],
    market_view: null,
    market_regime: null,
  };
  let history: Awaited<ReturnType<typeof fetchHistoryGrouped>> = [];
  let market = null;
  let dbError: string | null = null;

  try {
    [latest, history, market] = await Promise.all([
      fetchLatestWeekTrades(),
      fetchHistoryGrouped(12),
      fetchMarketState(),
    ]);
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
      <header className="mb-8 sm:mb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-bull-500 to-bull-700 ring-1 ring-bull-500/30" />
            <div>
              <div className="text-sm uppercase tracking-widest text-bull-500">
                Grok High-Conviction
              </div>
              <div className="text-xs text-gray-400">
                Top 3 disciplined trades each week. Or none at all.
              </div>
            </div>
          </div>
          <span className="text-xs text-gray-500">v2.0</span>
        </div>
      </header>

      <section className="mb-8 text-center sm:mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-5xl">
          This Week&rsquo;s Top 3 High-Conviction Trades
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-400 sm:mt-4 sm:text-base">
          Four competing AI agents debate every Sunday night. Only setups that
          pass at least 7 of 8 strict filters become a trade. Most weeks: only a
          handful qualify.
        </p>
      </section>

      {dbError ? (
        <div className="rounded-2xl border border-bear-700/40 bg-bear-700/10 p-6 text-bear-500">
          <div className="font-semibold">Could not load recommendations.</div>
          <div className="mt-1 text-sm text-gray-300">{dbError}</div>
        </div>
      ) : (
        <>
          <TopTrades trades={latest.trades} weekStart={latest.week_start} />
          <MarketView
            state={market}
            view={latest.market_view}
            regime={latest.market_regime}
            tradeType={latest.trades[0]?.type ?? null}
          />
          <WeeklyHistory groups={history} />
        </>
      )}

      <Footer />
    </main>
  );
}
