import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { problemOf } from '../../api/problem';
import type { AuthResponse } from '../../api/auth';
import { GoogleSignInButton } from './GoogleSignInButton';

/**
 * "or / Continue with Google" block for the login and signup pages. Renders
 * nothing when VITE_GOOGLE_CLIENT_ID is unset, so the pages are unchanged until
 * Google is configured.
 */
export function GoogleAuthSection({
  text,
  onSuccess,
}: {
  text: 'signin_with' | 'signup_with';
  onSuccess: (res: AuthResponse) => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) return null;

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        {t('auth.orDivider')}
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <GoogleSignInButton
        text={text}
        onSuccess={onSuccess}
        onError={(e) =>
          setError(
            problemOf(e)?.code === 'email_password_account'
              ? t('auth.googleEmailConflict')
              : t('auth.googleError'),
          )
        }
      />
    </div>
  );
}
