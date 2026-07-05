import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { logout as logoutApi, updateAccount, type AccountResponse } from '../api/auth';
import { getMyProfile } from '../api/profile';
import { problemOf } from '../api/problem';
import { useCurrentAccount } from '../features/auth/useCurrentAccount';
import { LANG_FLAGS, SUPPORTED_LANGS, type Lang } from '../i18n';

export function AccountPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clear = useAuthStore((s) => s.clear);
  const { data: account, isLoading, isError } = useCurrentAccount();

  const logout = () => {
    // Best-effort server-side revoke of the refresh token; clear locally regardless.
    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      void logoutApi(refreshToken).catch(() => {});
    }
    clear();
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  if (isLoading) {
    return <div className="max-w-md mx-auto mt-20 p-6 text-slate-600">{t('account.loading')}</div>;
  }

  if (isError || !account) {
    // A 401 has already cleared the token (apiFetch), so ProtectedRoute will
    // redirect on the next render. This covers other failures (e.g. server down).
    return (
      <div className="max-w-md mx-auto mt-20 p-6">
        <p className="text-sm text-red-600 mb-4">{t('account.loadError')}</p>
        <button onClick={logout} className="text-indigo-600 hover:underline text-sm">
          {t('account.signInAgain')}
        </button>
      </div>
    );
  }

  return <AccountDetails account={account} onLogout={logout} />;
}

/** Matches the placeholder handle minted for a fresh Google sign-in (user_<8 hex>). */
const PLACEHOLDER_HANDLE = /^user_[0-9a-f]{8}$/i;

function AccountDetails({ account, onLogout }: { account: AccountResponse; onLogout: () => void }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);

  const currentLang = (account.locale ?? i18n.language) as Lang;
  const [handle, setHandle] = useState(account.username);
  const [lang, setLang] = useState<Lang>(currentLang);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const trimmed = handle.trim();
  const dirty = trimmed !== account.username || lang !== currentLang;
  const needsHandle = PLACEHOLDER_HANDLE.test(account.username);

  const memberSince = new Date(account.created_at).toLocaleDateString(i18n.language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const save = useMutation({
    mutationFn: () =>
      updateAccount({
        username: trimmed !== account.username ? trimmed : undefined,
        locale: lang !== currentLang ? lang : undefined,
      }),
    onSuccess: async (res) => {
      setSession(res.access_token, res.refresh_token); // fresh tokens carry the new claims
      await i18n.changeLanguage(res.user.locale);
      setError(null);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['account', 'me'] });
      // Force profile-service to reconcile its denormalized handle/locale using the new token.
      void getMyProfile().catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (e) => {
      setSaved(false);
      const code = problemOf(e)?.code;
      setError(
        code === 'username_taken'
          ? t('account.handleTaken')
          : code === 'validation_failed'
            ? t('account.handleInvalid')
            : t('account.saveError'),
      );
    },
  });

  return (
    <div className="max-w-md mx-auto mt-20 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">@{account.username}</h1>
        <button
          onClick={onLogout}
          className="text-sm px-3 py-1.5 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition"
        >
          {t('account.logOut')}
        </button>
      </div>

      <dl className="grid grid-cols-3 gap-y-3 text-sm">
        <dt className="col-span-1 text-slate-500">{t('account.email')}</dt>
        <dd className="col-span-2 text-slate-900">{account.email}</dd>

        <dt className="col-span-1 text-slate-500">{t('account.plan')}</dt>
        <dd className="col-span-2">
          <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-medium uppercase">
            {account.plan}
          </span>
        </dd>

        <dt className="col-span-1 text-slate-500">{t('account.memberSince')}</dt>
        <dd className="col-span-2 text-slate-900">{memberSince}</dd>
      </dl>

      <section className="mt-8 border-t border-slate-100 pt-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">{t('account.settings')}</h2>

        {needsHandle && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t('account.pickHandle')}
          </p>
        )}
        {error && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        {saved && !dirty && (
          <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {t('account.saved')}
          </p>
        )}

        <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="handle">
          {t('account.handle')}
        </label>
        <div className="flex items-center rounded-md border border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500">
          <span className="pl-3 text-slate-400">@</span>
          <input
            id="handle"
            value={handle}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => {
              setHandle(e.target.value);
              setSaved(false);
            }}
            className="w-full rounded-md px-1 py-2 focus:outline-none"
          />
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700 mb-1" htmlFor="account-lang">
          {t('lang.label')}
        </label>
        <select
          id="account-lang"
          value={lang}
          onChange={(e) => {
            setLang(e.target.value as Lang);
            setSaved(false);
          }}
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {SUPPORTED_LANGS.map((lng) => (
            <option key={lng} value={lng}>
              {LANG_FLAGS[lng]} {t(`lang.${lng}`)}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={!dirty || save.isPending || trimmed.length < 3}
          onClick={() => save.mutate()}
          className="mt-4 py-2 px-4 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {save.isPending ? t('account.saving') : t('account.save')}
        </button>
      </section>

      <RouterLink
        to="/app/profile"
        className="mt-8 inline-block py-2 px-4 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition"
      >
        {t('account.editCard')}
      </RouterLink>
    </div>
  );
}
