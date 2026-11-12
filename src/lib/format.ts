// Hebrew formatting helpers. No React Native imports.

/** "עכשיו", "לפני 5 דקות", "לפני 3 שעות", "לפני יומיים" */
export function timeAgo(ts: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'עכשיו';
  const m = Math.round(s / 60);
  if (m === 1) return 'לפני דקה';
  if (m < 60) return `לפני ${m} דקות`;
  const h = Math.round(m / 60);
  if (h === 1) return 'לפני שעה';
  if (h === 2) return 'לפני שעתיים';
  if (h < 24) return `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  if (d === 1) return 'אתמול';
  if (d === 2) return 'לפני יומיים';
  return `לפני ${d} ימים`;
}

/** Local clock time at a place, given its UTC offset in seconds. */
export function clockAt(utcOffsetSeconds: number, now: number = Date.now()): string {
  const d = new Date(now + utcOffsetSeconds * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Start of the local day (device time zone), as epoch ms. */
export function startOfToday(now: Date = new Date()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** WMO weather code → emoji + Hebrew label (Open-Meteo `weather_code`). */
export function weatherLabel(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: 'בהיר' };
  if (code <= 2) return { icon: '🌤️', label: 'מעונן חלקית' };
  if (code === 3) return { icon: '☁️', label: 'מעונן' };
  if (code === 45 || code === 48) return { icon: '🌫️', label: 'ערפל' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', label: 'טפטוף' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: '🌧️', label: 'גשם' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: '❄️', label: 'שלג' };
  if (code >= 95) return { icon: '⛈️', label: 'סופה' };
  return { icon: '🌡️', label: '' };
}
