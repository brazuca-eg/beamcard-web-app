import { useTranslation } from 'react-i18next';
import { LANG_FLAGS, SUPPORTED_LANGS } from '../i18n';

/**
 * Compact flag + language picker for headers. Changing it live-translates the
 * page (no reload) and persists the choice via i18n's languageChanged handler.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();
  return (
    <select
      aria-label={t('lang.label')}
      value={SUPPORTED_LANGS.includes(i18n.language as never) ? i18n.language : 'en'}
      onChange={(e) => void i18n.changeLanguage(e.target.value)}
      className={`rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
    >
      {SUPPORTED_LANGS.map((lng) => (
        <option key={lng} value={lng}>
          {LANG_FLAGS[lng]} {t(`lang.${lng}`)}
        </option>
      ))}
    </select>
  );
}
