import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MarketingHeader } from '../components/MarketingHeader';
import { SignupForm } from '../features/auth/SignupForm';
import { GoogleAuthSection } from '../features/auth/GoogleAuthSection';
import { useAuthStore } from '../stores/authStore';
import type { AuthResponse } from '../api/auth';

export function SignupPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);

  const handleSuccess = (res: AuthResponse) => {
    setSession(res.access_token, res.refresh_token);
    void i18n.changeLanguage(res.user.locale);
    navigate('/app', { replace: true });
  };

  // Already signed in — skip the form.
  if (token) {
    return <Navigate to="/app" replace />;
  }

  return (
    <>
      <MarketingHeader />
      <div className="max-w-md mx-auto mt-12 p-6">
        <h1 className="text-2xl font-bold text-slate-900">{t('auth.createTitle')}</h1>
        <p className="text-sm text-slate-600 mb-6 italic">{t('auth.tagline')}</p>
        <SignupForm onSuccess={handleSuccess} />
        <GoogleAuthSection text="signup_with" onSuccess={handleSuccess} />
        <p className="mt-4 text-sm text-slate-600">
          {t('auth.alreadyHaveAccount')}{' '}
          <Link className="text-indigo-600 hover:underline" to="/login">
            {t('auth.signIn')}
          </Link>
        </p>
      </div>
    </>
  );
}
