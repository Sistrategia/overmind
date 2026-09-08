export const TENANT_TZ = 'America/Mexico_City';
export const TENANT_TZ_LABEL = 'CST, UTC−6'; // Mexico has no DST since 2022.

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions, tz: string): Intl.DateTimeFormat {
  const key = tz + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) { f = new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: tz }); cache.set(key, f); }
  return f;
}

export function fmtDateTime(iso: string, tz: string = TENANT_TZ): string {
  return fmt({ day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }, tz)
    .format(new Date(iso)).replace(',', '');
}
export function fmtDate(iso: string, tz: string = TENANT_TZ): string {
  return fmt({ day: '2-digit', month: 'short', year: 'numeric' }, tz).format(new Date(iso));
}
export function fmtDayMonth(iso: string, tz: string = TENANT_TZ): string {
  return fmt({ day: '2-digit', month: 'short' }, tz).format(new Date(iso));
}
export function fmtTime(iso: string, tz: string = TENANT_TZ): string {
  return fmt({ hour: '2-digit', minute: '2-digit', hour12: false }, tz).format(new Date(iso));
}
export function fmtWeekday(iso: string, tz: string = TENANT_TZ): string {
  return fmt({ weekday: 'short' }, tz).format(new Date(iso));
}
export function fmtUtc(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}
export function fmtRelative(iso: string, nowIso: string): string {
  const ms = new Date(nowIso).getTime() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return fmtDate(iso);
}
/** Local calendar date (YYYY-MM-DD) in the tenant time zone. */
export function tzDateKey(iso: string, tz: string = TENANT_TZ): string {
  const parts = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }, tz).formatToParts(new Date(iso));
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
/** Start of the ISO week (Monday 00:00 tenant time) containing the instant, as ISO UTC. */
export function startOfTenantWeek(iso: string): string {
  const key = tzDateKey(iso);
  // Tenant zone is fixed UTC-6, so local midnight is 06:00Z.
  const midnight = new Date(`${key}T06:00:00Z`);
  const dow = (midnight.getUTCDay() + 6) % 7; // Monday = 0 (weekday same in UTC at 06:00Z)
  midnight.setUTCDate(midnight.getUTCDate() - dow);
  return midnight.toISOString();
}
export function startOfTenantDay(iso: string): string {
  return new Date(`${tzDateKey(iso)}T06:00:00Z`).toISOString();
}
export function plural(n: number, one: string, many = one + 's'): string { return `${n} ${n === 1 ? one : many}`; }
