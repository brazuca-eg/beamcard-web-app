import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Footer for the public / marketing / auth pages — legal + about links. */
export function MarketingFooter() {
  const { t } = useTranslation();
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-slate-100 px-4 py-6 text-center text-xs text-slate-400">
      <Link to="/about" className="text-slate-500 hover:text-slate-900 hover:underline">
        {t('nav.about')}
      </Link>
      <span>·</span>
      <Link to="/privacy" className="text-slate-500 hover:text-slate-900 hover:underline">
        {t('nav.privacy')}
      </Link>
      <span>·</span>
      <Link to="/terms" className="text-slate-500 hover:text-slate-900 hover:underline">
        {t('nav.terms')}
      </Link>
      <span>·</span>
      <Link to="/cookies" className="text-slate-500 hover:text-slate-900 hover:underline">
        {t('nav.cookies')}
      </Link>
      <span>·</span>
      <Link to="/accessibility" className="text-slate-500 hover:text-slate-900 hover:underline">
        {t('nav.accessibility')}
      </Link>
      <span>·</span>
      <span>{t('publicCard.madeWith')}</span>
    </footer>
  );
}
