import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LanguageSwitcher } from './LanguageSwitcher';

/**
 * Shared top bar for the public-facing pages (landing + auth). Logo returns
 * home; the right slot holds page-specific actions (e.g. Log in / Get started).
 * Always carries the language switcher so visitors can read in their language.
 */
export function MarketingHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight text-slate-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white">
            B
          </span>
          Beamcard
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {children}
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
