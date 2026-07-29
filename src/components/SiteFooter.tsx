import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const LEGAL = [
  { to: '/about', key: 'nav.about' },
  { to: '/privacy', key: 'nav.privacy' },
  { to: '/terms', key: 'nav.terms' },
  { to: '/cookies', key: 'nav.cookies' },
  { to: '/accessibility', key: 'nav.accessibility' },
];

/** Single compact footer shared across every page: brand + © year on the left, legal links on the right. */
export function SiteFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200/70">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-6 sm:flex-row sm:justify-between">
        <Link to="/" className="flex items-center gap-2 text-slate-900" aria-label="Beamcard">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
            B
          </span>
          <span className="text-sm font-bold tracking-tight">Beamcard</span>
          <span className="text-xs text-slate-400">© {year}</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {LEGAL.map((l) => (
            <Link key={l.to} to={l.to} className="text-xs text-slate-500 transition hover:text-slate-900">
              {t(l.key)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
