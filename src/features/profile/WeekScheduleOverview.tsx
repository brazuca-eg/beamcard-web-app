import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { OpeningHours } from '../../api/profile';
import { workplaceColor } from './accents';
import { DAY_ORDER } from './hours';

interface Workplace {
  label: string;
  hours: OpeningHours[];
}

interface Segment {
  wp: number;
  start: number; // minutes since midnight
  end: number;
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

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const colorOf = workplaceColor;

/** Pairwise overlap ranges among a day's segments (any two workplaces at the same time). */
function overlapRanges(segments: Segment[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const s = Math.max(segments[i].start, segments[j].start);
      const e = Math.min(segments[i].end, segments[j].end);
      if (s < e) out.push([s, e]);
    }
  }
  return out;
}

/**
 * A weekly timeline of all workplaces' opening hours. Each workplace is a colored bar; a
 * day where two workplaces overlap is flagged (red hatch + warning), since one person can't
 * be in two places at once. Gives the "which day is fine / which clashes" overview at a glance.
 */
export function WeekScheduleOverview({ workplaces }: { workplaces: Workplace[] }) {
  const { t } = useTranslation();

  const { byDay, windowStart, windowEnd, active } = useMemo(() => {
    const segs: Record<string, Segment[]> = Object.fromEntries(DAY_ORDER.map((d) => [d, [] as Segment[]]));
    let min = 24 * 60;
    let max = 0;
    const activeWps = new Set<number>();
    workplaces.forEach((w, wp) => {
      for (const h of w.hours) {
        const start = toMinutes(h.open);
        const end = toMinutes(h.close);
        if (start == null || end == null || end <= start) continue;
        segs[h.day]?.push({ wp, start, end });
        min = Math.min(min, start);
        max = Math.max(max, end);
        activeWps.add(wp);
      }
    });
    if (max === 0) return { byDay: segs, windowStart: 0, windowEnd: 0, active: activeWps };
    // Pad to whole hours so the bars breathe.
    const ws = Math.floor(min / 60) * 60;
    const we = Math.ceil(max / 60) * 60;
    return { byDay: segs, windowStart: ws, windowEnd: we, active: activeWps };
  }, [workplaces]);

  const span = windowEnd - windowStart;
  if (span <= 0) return null; // nothing scheduled yet — no overview to show

  const pct = (min: number) => ((min - windowStart) / span) * 100;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{t('editor.weekOverview')}</h3>
        <span className="text-xs text-slate-400">
          {fmt(windowStart)}–{fmt(windowEnd)}
        </span>
      </div>

      {/* Legend */}
      {workplaces.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
          {workplaces.map((w, i) =>
            active.has(i) ? (
              <li key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorOf(i) }} />
                <span className="max-w-[10rem] truncate">{w.label || t('editor.weekWorkplaceN', { n: i + 1 })}</span>
              </li>
            ) : null,
          )}
        </ul>
      )}

      <div className="space-y-1.5">
        {DAY_ORDER.map((day) => {
          const segments = byDay[day];
          const overlaps = overlapRanges(segments);
          const clash = overlaps.length > 0;
          return (
            <div key={day} className="flex items-center gap-2">
              <span className="w-9 shrink-0 text-xs font-medium text-slate-500">{t(`days.${day}`)}</span>
              <div className="relative h-6 flex-1 overflow-hidden rounded bg-slate-100">
                {segments.map((seg, i) => (
                  <div
                    key={i}
                    className="absolute inset-y-1 rounded-sm"
                    style={{
                      left: `${pct(seg.start)}%`,
                      width: `${pct(seg.end) - pct(seg.start)}%`,
                      backgroundColor: colorOf(seg.wp),
                      opacity: 0.85,
                    }}
                    title={`${workplaces[seg.wp]?.label || t('editor.weekWorkplaceN', { n: seg.wp + 1 })}: ${fmt(seg.start)}–${fmt(seg.end)}`}
                  />
                ))}
                {overlaps.map(([s, e], i) => (
                  <div
                    key={`ov-${i}`}
                    className="absolute inset-y-0 border border-red-500"
                    style={{
                      left: `${pct(s)}%`,
                      width: `${pct(e) - pct(s)}%`,
                      backgroundImage:
                        'repeating-linear-gradient(45deg, rgba(220,38,38,0.55) 0 4px, rgba(220,38,38,0.15) 4px 8px)',
                    }}
                    title={t('editor.weekClash')}
                  />
                ))}
              </div>
              <span className="w-4 shrink-0 text-center" aria-hidden="true">
                {segments.length === 0 ? (
                  <span className="text-slate-300">·</span>
                ) : clash ? (
                  <span className="text-red-500" title={t('editor.weekClash')}>
                    ⚠
                  </span>
                ) : (
                  <span className="text-emerald-500" title={t('editor.weekOk')}>
                    ✓
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
