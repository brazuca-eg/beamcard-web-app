import { useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { resendVerificationEmail, signup, type AuthResponse } from '../../api/auth';
import { applyFieldErrors, problemOf } from '../../api/problem';
import { LANG_FLAGS, SUPPORTED_LANGS, type Lang } from '../../i18n';
import { signupSchema, type SignupFormValues } from './schema';
import { sanitizeHandle } from './handle';

interface Props {
  /** Called only when signup returns a session (email verification disabled). */
  onAuthenticated: (response: AuthResponse) => void;
}

export function SignupForm({ onAuthenticated }: Props) {
  const { t, i18n } = useTranslation();
  const emailId = useId();
  const usernameId = useId();
  const passwordId = useId();
  const localeId = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null); // set when verification is required
  const [resent, setResent] = useState(false);

  const resend = useMutation({
    mutationFn: () => resendVerificationEmail(sentTo ?? ''),
    onSuccess: () => setResent(true),
  });

  const detected = (SUPPORTED_LANGS as readonly string[]).includes(i18n.language)
    ? (i18n.language as Lang)
    : 'en';

  // Pre-fill the handle from the landing "claim your @username" hero (?u=...).
  const [params] = useSearchParams();
  const prefillHandle = sanitizeHandle(params.get('u') ?? '');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
    defaultValues: { locale: detected, username: prefillHandle || undefined },
  });

  const localeField = register('locale');

  const mutation = useMutation({
    mutationFn: signup,
    onSuccess: (res) => {
      if (res.verification_required || !res.auth) {
        setSentTo(res.email); // show "check your inbox" — no session issued
      } else {
        onAuthenticated(res.auth); // verification disabled → auto-login
      }
    },
    onError: (err) => {
      const problem = problemOf(err);
      // Map backend 409s into per-field errors so the UI feels integrated.
      if (err instanceof ApiError && err.status === 409) {
        if (problem?.code === 'email_taken') {
          setError('email', { message: 'auth.emailTaken' });
        } else if (problem?.code === 'username_taken') {
          setError('username', { message: 'auth.usernameTaken' });
        } else {
          setFormError(t('common.genericError'));
        }
      } else if (problem?.code === 'validation_failed') {
        // Server-side rejection the client zod schema didn't catch.
        if (!applyFieldErrors(problem, setError, ['email', 'username', 'password'])) {
          setFormError(t('common.genericError'));
        }
      } else {
        setFormError(err instanceof ApiError ? t('common.genericError') : t('common.networkError'));
      }
    },
  });

  const submitting = mutation.isPending;

  // Verification required: account created, no session — tell them to check their inbox.
  if (sentTo) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <h2 className="text-base font-semibold text-green-900">{t('auth.checkInboxTitle')}</h2>
          <p className="mt-1 text-sm text-green-800">{t('auth.checkInboxBody', { email: sentTo })}</p>
        </div>
        {resent ? (
          <p className="text-sm text-slate-600">{t('auth.verificationResent')}</p>
        ) : (
          <button
            type="button"
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
            className="text-sm text-indigo-600 hover:underline disabled:opacity-50"
          >
            {resend.isPending ? t('auth.sending') : t('auth.resendVerification')}
          </button>
        )}
        <p className="text-sm text-slate-600">
          <Link className="text-indigo-600 hover:underline" to="/login">
            {t('auth.goToSignIn')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((data) => {
        setFormError(null);
        mutation.mutate(data);
      })}
      className="space-y-4"
      noValidate
    >
      <div>
        <label htmlFor={emailId} className="block text-sm font-medium text-slate-700 mb-1">
          {t('auth.email')}
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          {...register('email')}
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{t(errors.email.message ?? '')}</p>}
      </div>

      <div>
        <label htmlFor={usernameId} className="block text-sm font-medium text-slate-700 mb-1">
          {t('auth.username')}
        </label>
        <input
          id={usernameId}
          type="text"
          autoComplete="username"
          {...register('username')}
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.username && <p className="mt-1 text-sm text-red-600">{t(errors.username.message ?? '')}</p>}
      </div>

      <div>
        <label htmlFor={passwordId} className="block text-sm font-medium text-slate-700 mb-1">
          {t('auth.password')}
        </label>
        <input
          id={passwordId}
          type="password"
          autoComplete="new-password"
          {...register('password')}
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{t(errors.password.message ?? '')}</p>}
      </div>

      <div>
        <label htmlFor={localeId} className="block text-sm font-medium text-slate-700 mb-1">
          {t('lang.label')}
        </label>
        <select
          id={localeId}
          {...localeField}
          onChange={(e) => {
            void localeField.onChange(e); // keep react-hook-form in sync
            void i18n.changeLanguage(e.target.value); // live-translate the page (no reload)
          }}
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {SUPPORTED_LANGS.map((lng) => (
            <option key={lng} value={lng}>
              {LANG_FLAGS[lng]} {t(`lang.${lng}`)}
            </option>
          ))}
        </select>
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2 px-4 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {submitting ? t('auth.creatingAccount') : t('auth.createAccountButton')}
      </button>
    </form>
  );
}
