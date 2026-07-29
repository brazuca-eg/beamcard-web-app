import type { ReactNode } from 'react';

/** Small line icons shared by the editor tabs and section headers. */
export function TabIcon({ name }: { name: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    className: 'h-4 w-4 shrink-0',
  } as const;
  switch (name) {
    case 'profile':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 20c0-3.3 3.1-5 7-5s7 1.7 7 5" />
        </svg>
      );
    case 'pin':
      return (
        <svg {...common}>
          <path d="M12 21s-6-5.3-6-10a6 6 0 1112 0c0 4.7-6 10-6 10z" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      );
    case 'services':
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      );
    case 'portfolio':
      return (
        <svg {...common}>
          <circle cx="12" cy="9" r="5" />
          <path d="m9 13-1.5 7L12 18l4.5 2L15 13" />
        </svg>
      );
    case 'link':
      return (
        <svg {...common}>
          <path d="M10 13a5 5 0 007.1 0l1.4-1.4a5 5 0 00-7.1-7.1L10 6" />
          <path d="M14 11a5 5 0 00-7.1 0L5.5 12.4a5 5 0 007.1 7.1L14 18" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...common}>
          <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h5l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
          <circle cx="12" cy="12.5" r="3.2" />
        </svg>
      );
    case 'tag':
      return (
        <svg {...common}>
          <path d="M11.6 3.5H6a2.5 2.5 0 0 0-2.5 2.5v5.6a2 2 0 0 0 .6 1.4l7 7a2 2 0 0 0 2.8 0l5.6-5.6a2 2 0 0 0 0-2.8l-7-7a2 2 0 0 0-1.5-.6Z" />
          <circle cx="8" cy="8" r="1.1" />
        </svg>
      );
    case 'image':
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
          <circle cx="9" cy="9.5" r="1.6" />
          <path d="m20 16-4.5-4.5L5 22" />
        </svg>
      );
    default:
      return null;
  }
}

/** Colored icon tile + title (+ optional hint / trailing node) that opens every editor section. */
export function SectionHead({
  icon,
  title,
  hint,
  aside,
}: {
  icon: string;
  title: string;
  hint?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <TabIcon name={icon} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
        </div>
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

/** Friendly zero-state: soft icon + message inside a dashed panel, so empty sections don't read as broken. */
export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
        <TabIcon name={icon} />
      </span>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

/** Full-width dashed "add another row" button — reads as an add affordance and fills empty space. */
export const ADD_ROW_BTN =
  'inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50/60 hover:text-indigo-700';

/** Soft-indigo accent button for upload / add-media actions. */
export const UPLOAD_BTN =
  'inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50';
