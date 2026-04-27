import {
  fetchHistory,
  fetchLatestRecommendation,
  fetchMarketState,
} from "@/lib/queries";
import { hasSupabaseEnv } from "@/lib/supabase";
import RecommendationCard from "@/components/RecommendationCard";
import HistoryTable from "@/components/HistoryTable";
import MarketView from "@/components/MarketView";
import Footer from "@/components/Footer";
import NoConfig from "@/components/NoConfig";

export const revalidate = 300;

export default async function Page() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <NoConfig />
      </main>
    );
  }

  let latest = null;
  let history: Awaited<ReturnType<typeof fetchHistory>> = [];
  let market = null;
  let dbError: string | null = null;

  try {
    [latest, history, market] = await Promise.all([
      fetchLatestRecommendation(),
      fetchHistory(20),
      fetchMarketState(),
    ]);
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <header className="mb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-bull-500 to-bull-700 ring-1 ring-bull-500/30" />
            <div>
              <div className="text-sm uppercase tracking-widest text-bull-500">
                Grok High-Conviction
              </div>
              <div className="text-xs text-gray-400">
                One disciplined trade per week. Or no trade at all.
              </div>
            </div>
          </div>
          <a
            href="https://github.com"
            className="text-xs text-gray-400 hover:text-gray-200"
          >
            v1.0
          </a>
        </div>
      </header>

      <section className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          This Week’s High-Conviction Recommendation
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-gray-400">
          Four competing AI agents debate every Sunday night. Only setups that
          pass all 8 strict filters become a trade. Most weeks: no trade.
        </p>
      </section>

      {dbError ? (
        <div className="rounded-2xl border border-bear-700/40 bg-bear-700/10 p-6 text-bear-500">
          <div className="font-semibold">Could not load recommendations.</div>
          <div className="mt-1 text-sm text-gray-300">{dbError}</div>
        </div>
      ) : (
        <>
          <RecommendationCard rec={latest} />
          <MarketView state={market} latest={latest} />
          <HistoryTable rows={history} />
        </>
      )}

      <Footer />
    </main>
  );
}
