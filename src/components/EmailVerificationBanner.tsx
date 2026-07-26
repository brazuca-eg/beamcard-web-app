import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { requestEmailVerification } from '../api/auth';
import { useCurrentAccount } from '../features/auth/useCurrentAccount';

/**
 * Soft "verify your email" nudge shown across the signed-in app while the account
 * is unverified. Offers a resend and can be dismissed for the session (nothing is
 * gated — the banner is the only consequence of being unverified).
 */
export function EmailVerificationBanner() {
  const { t } = useTranslation();
  const { data: account } = useCurrentAccount();
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);

  const resend = useMutation({
    mutationFn: requestEmailVerification,
    onSuccess: () => setSent(true),
  });

  if (!account || account.email_verified || dismissed) {
    return null;
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm text-amber-800">
        <span aria-hidden="true">✉️</span>
        <p className="min-w-0 flex-1">{t('verify.bannerText')}</p>
        {sent ? (
          <span className="font-medium text-amber-900">{t('verify.resent')}</span>
        ) : (
          <button
            type="button"
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
            className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
          >
            {resend.isPending ? t('verify.resending') : t('verify.resend')}
          </button>
        )}
        <button
          type="button"
          aria-label={t('verify.dismiss')}
          onClick={() => setDismissed(true)}
          className="px-1 text-amber-500 transition hover:text-amber-800"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
