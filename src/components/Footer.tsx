export default function Footer() {
  return (
    <footer className="mt-16 border-t border-white/5 pt-8 text-xs text-gray-400">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-300">
        Strategy Rules
      </h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        <li>One trade per week max. Skipping is a feature, not a bug.</li>
        <li>Default to long calls. Long puts only in strong bear conditions.</li>
        <li>Risk ~1.5% of account per trade ($15 on a $1,000 account).</li>
        <li>Use a limit order. Never chase the price.</li>
        <li>Take profit at +75%. Cut losses at −35%.</li>
        <li>Hold ~30–45 day expirations to manage theta.</li>
        <li>Setup must pass all 8 filters or no trade is recommended.</li>
        <li>Past performance does not guarantee future results.</li>
      </ul>
      <p className="mt-6 text-[11px] leading-5 text-gray-500">
        Educational use only. This is not financial advice. Options are risky
        and you can lose your entire premium. Always do your own research and
        only invest money you can afford to lose.
      </p>
      <p className="mt-2 text-[11px] text-gray-600">
        Built with Grok · Next.js · Supabase · Vercel.
      </p>
    </footer>
  );
}
