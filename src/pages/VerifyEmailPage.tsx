import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { confirmEmailVerification } from '../api/auth';

type Status = 'loading' | 'success' | 'error';

/**
 * Public landing for the emailed verification link (/verify-email?token=…). Confirms
 * the token on mount, then refreshes the cached account so the app banner clears.
 */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'error');
  const queryClient = useQueryClient();
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true; // guard against StrictMode double-invoke (token is single-use)
    confirmEmailVerification(token)
      .then(() => {
        setStatus('success');
        void queryClient.invalidateQueries({ queryKey: ['account', 'me'] });
      })
      .catch(() => setStatus('error'));
  }, [token, queryClient]);

  return (
    <div className="mx-auto mt-20 max-w-md p-6">
      <h1 className="text-2xl font-bold text-slate-900">{t('verify.title')}</h1>
      {status === 'loading' && <p className="mt-4 text-sm text-slate-600">{t('verify.checking')}</p>}
      {status === 'success' && (
        <>
          <p className="mt-4 text-sm text-slate-700">{t('verify.success')}</p>
          <Link className="mt-4 inline-block text-sm text-indigo-600 hover:underline" to="/login">
            {t('verify.goToSignIn')}
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="mt-4 text-sm text-red-600">{t('verify.error')}</p>
          <Link className="mt-4 inline-block text-sm text-indigo-600 hover:underline" to="/login">
            {t('verify.goToSignIn')}
          </Link>
        </>
      )}
    </div>
  );
}
