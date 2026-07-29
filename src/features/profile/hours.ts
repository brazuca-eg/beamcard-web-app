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
