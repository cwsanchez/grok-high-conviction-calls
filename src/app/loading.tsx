export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
      <header className="mb-8 sm:mb-10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-bull-500/30 to-bull-700/30 ring-1 ring-bull-500/20 pulse-glow" />
          <div>
            <div className="text-sm uppercase tracking-widest text-bull-500">
              Grok High-Conviction
            </div>
            <div className="text-xs text-gray-400">
              Loading the latest analysis…
            </div>
          </div>
        </div>
      </header>

      <section className="mb-10 text-center">
        <div className="mx-auto h-8 w-3/4 animate-pulse rounded-md bg-white/5 sm:h-10" />
        <div className="mx-auto mt-4 h-4 w-1/2 animate-pulse rounded bg-white/5" />
      </section>

      <div className="space-y-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="glass overflow-hidden rounded-2xl ring-1 ring-white/5 sm:rounded-3xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 sm:px-6 sm:py-4">
              <div className="h-5 w-32 shimmer rounded-full" />
              <div className="h-5 w-24 shimmer rounded-full" />
            </div>
            <div className="px-4 py-6 sm:px-8 sm:py-8">
              <div className="h-10 w-32 shimmer rounded" />
              <div className="mt-4 h-3 w-full shimmer rounded-full" />
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                  <div key={j} className="h-16 shimmer rounded-xl" />
                ))}
              </div>
              <div className="mt-7 space-y-3">
                <div className="h-20 shimmer rounded-xl" />
                <div className="h-16 shimmer rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
