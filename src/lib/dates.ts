// "Active" trading week for the app runs Mon 00:00 MT through Sun 19:59 MT.
// On Sunday after 8:00 PM Mountain Time we flip to the *upcoming* Monday so the
// cron and any catch-up logic publish trades for the new week, not the one
// that just closed.
const MT_OFFSET_HOURS = 6; // MDT (UTC-6). Close enough for week boundary math.

function toMtNow(date = new Date()): Date {
  return new Date(date.getTime() - MT_OFFSET_HOURS * 60 * 60 * 1000);
}

export function activeWeekStart(date = new Date()): string {
  const mt = toMtNow(date);
  const dow = mt.getUTCDay(); // 0=Sun..6=Sat in MT-shifted clock
  const hour = mt.getUTCHours();

  // If it's Sunday after 8 PM MT, treat the upcoming Monday as the new week.
  if (dow === 0 && hour >= 20) {
    const monday = new Date(mt);
    monday.setUTCDate(monday.getUTCDate() + 1);
    monday.setUTCHours(0, 0, 0, 0);
    return monday.toISOString().slice(0, 10);
  }

  // Otherwise: the most recent Monday (in MT) is the active week_start.
  const diff = (dow + 6) % 7;
  const monday = new Date(mt);
  monday.setUTCDate(monday.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export function mostRecentMonday(date = new Date()): string {
  return activeWeekStart(date);
}

export function previousMonday(weekStartISO: string): string {
  const d = new Date(`${weekStartISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

export interface WeekContext {
  weekStart: string;            // YYYY-MM-DD (Monday)
  weekEnd: string;              // YYYY-MM-DD (Friday close)
  tradingDaysRemaining: number; // 5 = full week ahead, 0 = market already closed
  hoursRemaining: number;       // until Friday 14:00 MT (close)
  isLateStart: boolean;         // true if cron is firing mid-week
  todayIso: string;             // today's date in MT
}

export function weekContext(date = new Date()): WeekContext {
  const weekStart = activeWeekStart(date);
  const monday = new Date(`${weekStart}T00:00:00Z`);
  const friday = new Date(monday);
  friday.setUTCDate(friday.getUTCDate() + 4);
  const weekEnd = friday.toISOString().slice(0, 10);

  // Friday close ~ 2 PM MT (4 PM ET) ≈ 20:00 UTC during DST.
  const fridayCloseUtc = new Date(friday);
  fridayCloseUtc.setUTCHours(20, 0, 0, 0);

  const mt = toMtNow(date);
  const todayIso = mt.toISOString().slice(0, 10);

  const msRemaining = fridayCloseUtc.getTime() - date.getTime();
  const hoursRemaining = Math.max(0, Math.round(msRemaining / (60 * 60 * 1000)));

  let tradingDaysRemaining: number;
  if (todayIso < weekStart) {
    // We're publishing for an upcoming week (Sun night after 8 PM MT).
    tradingDaysRemaining = 5;
  } else if (todayIso > weekEnd) {
    tradingDaysRemaining = 0;
  } else {
    let count = 0;
    for (
      let d = new Date(`${todayIso}T00:00:00Z`);
      d <= friday;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const dow = d.getUTCDay();
      if (dow >= 1 && dow <= 5) count++;
    }
    tradingDaysRemaining = count;
  }

  const isLateStart = todayIso > weekStart;

  return {
    weekStart,
    weekEnd,
    tradingDaysRemaining,
    hoursRemaining,
    isLateStart,
    todayIso,
  };
}

export function formatPrice(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${Number(n).toFixed(2)}`;
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s.length === 10 ? `${s}T00:00:00Z` : s);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
