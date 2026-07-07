import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { updateAccount, type AccountResponse } from '../api/auth';
import { getMyProfile, getMyProfileQr, publicCardUrl } from '../api/profile';
import { problemOf } from '../api/problem';
import { useCurrentAccount } from '../features/auth/useCurrentAccount';
import { useMyProfile } from '../features/profile/useMyProfile';
import { ShareDialog } from '../features/profile/ShareDialog';
import { LANG_FLAGS, SUPPORTED_LANGS, type Lang } from '../i18n';

const PANEL = 'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-6';

export function AccountPage() {
  const { t } = useTranslation();
  const { data: account, isLoading, isError } = useCurrentAccount();

  if (isLoading) {
    return <div className="mx-auto max-w-md p-6 text-slate-600">{t('account.loading')}</div>;
  }
  if (isError || !account) {
    // A 401 has already cleared the token (apiFetch), so ProtectedRoute redirects on the next
    // render. This covers other failures (server down); logout is available in the app header.
    return <div className="mx-auto max-w-md p-6 text-sm text-red-600">{t('account.loadError')}</div>;
  }

  return <AccountDetails account={account} />;
}

/** Matches the placeholder handle minted for a fresh Google sign-in (user_<8 hex>). */
const PLACEHOLDER_HANDLE = /^user_[0-9a-f]{8}$/i;

function AccountDetails({ account }: { account: AccountResponse }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const { data: profile } = useMyProfile();

  const currentLang = (account.locale ?? i18n.language) as Lang;
  const [handle, setHandle] = useState(account.username);
  const [lang, setLang] = useState<Lang>(currentLang);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const trimmed = handle.trim();
  const dirty = trimmed !== account.username || lang !== currentLang;
  const needsHandle = PLACEHOLDER_HANDLE.test(account.username);
  const cardUrl = publicCardUrl(account.username);
  const displayName = profile?.display_name?.trim() || `@${account.username}`;

  const qr = useQuery({ queryKey: ['profile', 'qr'], queryFn: getMyProfileQr });

  const memberSince = new Date(account.created_at).toLocaleDateString(i18n.language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const copyLink = () => {
    navigator.clipboard?.writeText(cardUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

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
    <>
      <div className="mx-auto grid max-w-4xl gap-5 px-4 py-6 lg:grid-cols-[1fr_minmax(0,340px)] lg:items-start">
        <div className="space-y-5">
          {/* Identity + primary actions */}
          <section className={PANEL}>
            <div className="flex items-center gap-4">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="h-20 w-20 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-2xl font-semibold text-indigo-600">
                  {displayName.replace(/^@/, '').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">{displayName}</h1>
                <p className="text-sm text-slate-500">@{account.username}</p>
                <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium uppercase text-indigo-800">
                  {account.plan}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <RouterLink
                to="/app/profile"
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 active:scale-[.99]"
              >
                {t('account.editCard')}
              </RouterLink>
              <RouterLink
                to={`/@${account.username}`}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[.99]"
              >
                {t('editor.viewPublic')}
              </RouterLink>
            </div>

            <dl className="mt-6 grid grid-cols-3 gap-y-3 border-t border-slate-100 pt-5 text-sm">
              <dt className="col-span-1 text-slate-500">{t('account.email')}</dt>
              <dd className="col-span-2 truncate text-slate-900">{account.email}</dd>

              <dt className="col-span-1 text-slate-500">{t('lang.label')}</dt>
              <dd className="col-span-2 text-slate-900">
                {LANG_FLAGS[currentLang] ?? ''} {t(`lang.${currentLang}`)}
              </dd>

              <dt className="col-span-1 text-slate-500">{t('account.memberSince')}</dt>
              <dd className="col-span-2 text-slate-900">{memberSince}</dd>
            </dl>
          </section>

          {/* Settings */}
          <section className={PANEL}>
            <h2 className="text-base font-semibold text-slate-900">{t('account.settings')}</h2>

            {needsHandle && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {t('account.pickHandle')}
              </p>
            )}
            {error && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            {saved && !dirty && (
              <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {t('account.saved')}
              </p>
            )}

            <label className="mt-4 mb-1 block text-sm font-medium text-slate-700" htmlFor="handle">
              {t('account.handle')}
            </label>
            <div className="flex items-center rounded-lg border border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500">
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
                className="w-full rounded-lg px-1 py-2 focus:outline-none"
              />
            </div>

            <label className="mt-4 mb-1 block text-sm font-medium text-slate-700" htmlFor="account-lang">
              {t('lang.label')}
            </label>
            <select
              id="account-lang"
              value={lang}
              onChange={(e) => {
                setLang(e.target.value as Lang);
                setSaved(false);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {save.isPending ? t('account.saving') : t('account.save')}
            </button>
          </section>
        </div>

        {/* Share / QR — the home for sharing the public card */}
        <section className={`${PANEL} lg:sticky lg:top-20`}>
          <h2 className="text-base font-semibold text-slate-900">{t('editor.shareTitle')}</h2>
          <p className="mt-0.5 text-xs text-slate-400">{t('share.subtitle')}</p>

          <div className="mx-auto mt-4 flex aspect-square w-full max-w-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white p-3">
            {qr.data ? (
              <div
                className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qr.data }}
              />
            ) : (
              <span className="text-sm text-slate-400">
                {qr.isLoading ? t('share.generating') : t('share.unavailable')}
              </span>
            )}
          </div>

          <p className="mt-3 break-all text-center text-xs text-slate-500">{cardUrl}</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={copyLink}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white transition hover:bg-indigo-700"
            >
              {copied ? t('share.copied') : t('share.copy')}
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              {t('editor.shareButton')}
            </button>
          </div>
        </section>
      </div>

      {shareOpen && (
        <ShareDialog
          username={account.username}
          url={cardUrl}
          qrSvg={qr.data}
          isLoading={qr.isLoading}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}
