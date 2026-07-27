import { useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { login, resendVerificationEmail, type AuthResponse } from '../../api/auth';
import { problemOf } from '../../api/problem';
import { loginSchema, type LoginFormValues } from './schema';

interface Props {
  onSuccess: (response: AuthResponse) => void;
}

export function LoginForm({ onSuccess }: Props) {
  const { t } = useTranslation();
  const emailId = useId();
  const passwordId = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const lastEmail = useRef('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const resend = useMutation({
    mutationFn: () => resendVerificationEmail(unverifiedEmail ?? ''),
    onSuccess: () => setResent(true),
  });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess,
    onError: (err) => {
      // Login errors are surfaced at the form level — never per-field — so we
      // don't reveal whether the email or the password was the wrong one.
      if (err instanceof ApiError) {
        const code = problemOf(err)?.code;
        if (err.status === 403 && code === 'email_not_verified') {
          setUnverifiedEmail(lastEmail.current); // offer a resend
          setFormError(t('auth.emailNotVerified'));
        } else if (err.status === 401) {
          setFormError(t('auth.invalidCredentials'));
        } else if (err.status === 403 && code === 'account_inactive') {
          setFormError(t('auth.accountInactive'));
        } else {
          // 400 (validation_failed), 500 (internal_error), anything else.
          setFormError(t('common.genericError'));
        }
      } else {
        setFormError(t('common.networkError'));
      }
    },
  });

  const submitting = mutation.isPending;

  return (
    <form
      onSubmit={handleSubmit((data) => {
        setFormError(null);
        setUnverifiedEmail(null);
        setResent(false);
        lastEmail.current = data.email;
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
        <label htmlFor={passwordId} className="block text-sm font-medium text-slate-700 mb-1">
          {t('auth.password')}
        </label>
        <input
          id={passwordId}
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{t(errors.password.message ?? '')}</p>}
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      {unverifiedEmail &&
        (resent ? (
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
        ))}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2 px-4 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {submitting ? t('auth.signingIn') : t('auth.signIn')}
      </button>
    </form>
  );
}
