export default function NoConfig() {
  return (
    <div className="glass rounded-2xl p-8">
      <h1 className="text-2xl font-semibold text-white">Setup needed</h1>
      <p className="mt-2 text-sm text-gray-300">
        This instance is missing the required environment variables. Add the
        following on Vercel (or in <code>.env.local</code> for local dev):
      </p>
      <ul className="mt-4 space-y-1 font-mono text-xs text-gray-200">
        <li>SUPABASE_URL</li>
        <li>SUPABASE_ANON_KEY</li>
        <li>GROK_API_KEY</li>
        <li>CRON_SECRET (any random string)</li>
      </ul>
    </div>
  );
}
