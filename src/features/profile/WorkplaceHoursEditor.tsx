import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DayOfWeek, OpeningHours } from '../../api/profile';
import { DAY_ORDER, flattenByDay, groupByDay } from './hours';

const TIME_INPUT =
  'w-[6.5rem] rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100';

/**
 * Weekly opening-hours editor for a single workplace. Monday-first rows; each day is
 * Closed or has one-or-more time ranges (split hours). Collapsed by default so a
 * workplace card stays compact until the user opens it. Native <input type="time">
 * gives the OS time picker (great on mobile) and emits "HH:mm".
 */
export function WorkplaceHoursEditor({
  hours,
  onChange,
}: {
  hours: OpeningHours[];
  onChange: (hours: OpeningHours[]) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const byDay = groupByDay(hours);
  const daysSet = DAY_ORDER.filter((d) => byDay[d].length > 0).length;

  const setDay = (day: DayOfWeek, ranges: OpeningHours[]) => onChange(flattenByDay({ ...byDay, [day]: ranges }));

  const addRange = (day: DayOfWeek) => {
    const prev = byDay[day];
    const start = prev.length ? prev[prev.length - 1].close : '09:00';
    setDay(day, [...prev, { day, open: start, close: '17:00' }]);
  };
  const updateRange = (day: DayOfWeek, idx: number, field: 'open' | 'close', value: string) =>
    setDay(
      day,
      byDay[day].map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  const removeRange = (day: DayOfWeek, idx: number) =>
    setDay(
      day,
      byDay[day].filter((_, i) => i !== idx),
    );

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('editor.hoursTitle')}
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-400">
          {daysSet > 0 ? t('editor.hoursDaysSet', { count: daysSet }) : t('editor.hoursNotSet')}
          <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="space-y-1 border-t border-slate-200 px-3 py-2">
          {DAY_ORDER.map((day) => {
            const ranges = byDay[day];
            return (
              <div key={day} className="flex items-start gap-3 py-1">
                <span className="mt-2 w-9 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t(`days.${day}`)}
                </span>
                <div className="min-w-0 flex-1">
                  {ranges.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => addRange(day)}
                      className="py-1 text-sm text-slate-400 transition hover:text-indigo-600"
                    >
                      {t('editor.hoursClosed')} · <span className="font-medium">{t('editor.hoursAdd')}</span>
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      {ranges.map((r, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={r.open}
                            onChange={(e) => updateRange(day, idx, 'open', e.target.value)}
                            aria-label={t('editor.hoursOpenAria', { day: t(`days.${day}`) })}
                            className={TIME_INPUT}
                          />
                          <span className="text-slate-400">–</span>
                          <input
                            type="time"
                            value={r.close}
                            onChange={(e) => updateRange(day, idx, 'close', e.target.value)}
                            aria-label={t('editor.hoursCloseAria', { day: t(`days.${day}`) })}
                            className={TIME_INPUT}
                          />
                          <button
                            type="button"
                            onClick={() => removeRange(day, idx)}
                            aria-label={t('editor.hoursRemove')}
                            className="px-1.5 text-red-500 transition hover:scale-110 hover:text-red-700"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addRange(day)}
                        className="text-xs font-medium text-indigo-600 transition hover:text-indigo-800"
                      >
                        ＋ {t('editor.hoursAddRange')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
