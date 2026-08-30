import type { DayOfWeek, OpeningHours } from '../../api/profile';

/** Monday-first week order for display. */
export const DAY_ORDER: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

/** JS Date.getDay() (0=Sun…6=Sat) → our DayOfWeek key, for "today" highlighting. */
const JS_DAY: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export function todayKey(): DayOfWeek {
  return JS_DAY[new Date().getDay()];
}

/** Group a flat interval list by weekday, preserving Monday-first order. */
export function groupByDay(hours: OpeningHours[] | undefined): Record<DayOfWeek, OpeningHours[]> {
  const out = Object.fromEntries(DAY_ORDER.map((d) => [d, [] as OpeningHours[]])) as Record<DayOfWeek, OpeningHours[]>;
  for (const h of hours ?? []) {
    if (out[h.day]) out[h.day].push(h);
  }
  return out;
}

/** Rebuild the flat list in canonical day order after an edit. */
export function flattenByDay(byDay: Record<DayOfWeek, OpeningHours[]>): OpeningHours[] {
  return DAY_ORDER.flatMap((d) => byDay[d] ?? []);
}

/** "HH:MM" → minutes since midnight, or null if malformed. */
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * The first weekday on which any two intervals in `hours` overlap, or null if none do.
 * Pass the combined hours across ALL workplaces — one person can't be in two places at
 * once, so their schedule must not overlap on a given day. Touching intervals are fine.
 * Mirrors the server-side rule in ProfileServiceImpl.
 */
export function overlappingHoursDay(hours: OpeningHours[]): DayOfWeek | null {
  const byDay = groupByDay(hours);
  for (const day of DAY_ORDER) {
    const intervals = byDay[day]
      .map((h) => [toMinutes(h.open), toMinutes(h.close)] as [number | null, number | null])
      .filter((iv): iv is [number, number] => iv[0] != null && iv[1] != null && iv[1] > iv[0])
      .sort((a, b) => a[0] - b[0]);
    let prevEnd = -1;
    for (const [start, end] of intervals) {
      if (start < prevEnd) return day;
      prevEnd = Math.max(prevEnd, end);
    }
  }
  return null;
}
