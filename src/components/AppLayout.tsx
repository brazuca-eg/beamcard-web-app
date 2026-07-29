import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { logout as logoutApi } from '../api/auth';
import { useCurrentAccount } from '../features/auth/useCurrentAccount';
import { EmailVerificationBanner } from './EmailVerificationBanner';
import { SiteFooter } from './SiteFooter';

/**
 * Chrome for the signed-in app (Account + Editor): a consistent branded header
 * with primary navigation + logout, and a footer. Pages render into the Outlet.
 */
export function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clear = useAuthStore((s) => s.clear);
  const { data: account } = useCurrentAccount();

  const logout = () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      void logoutApi(refreshToken).catch(() => {});
    }
    clear();
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-slate-50/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/app" className="flex items-center gap-2 font-bold tracking-tight text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white">
              B
            </span>
            <span className="hidden sm:inline">Beamcard</span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink to="/app" end className={navClass}>
              {t('nav.account')}
            </NavLink>
            <NavLink to="/app/profile" className={navClass}>
              {t('nav.editCard')}
            </NavLink>
            {account && (
              <NavLink to={`/@${account.username}`} className={navClass}>
                {t('nav.viewPublic')}
              </NavLink>
            )}
          </nav>

          <button
            onClick={logout}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            {t('account.logOut')}
          </button>
        </div>

        {/* Mobile primary nav (the logo doubles as Home on desktop). */}
        <nav className="mx-auto flex max-w-5xl items-center gap-1 border-t border-slate-200/70 px-2 py-1.5 sm:hidden">
          <NavLink to="/app" end className={navClass}>
            {t('nav.account')}
          </NavLink>
          <NavLink to="/app/profile" className={navClass}>
            {t('nav.editCard')}
          </NavLink>
          {account && (
            <NavLink to={`/@${account.username}`} className={navClass}>
              {t('nav.viewPublic')}
            </NavLink>
          )}
        </nav>
      </header>

      <EmailVerificationBanner />

      <main className="flex-1">
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  );
}
