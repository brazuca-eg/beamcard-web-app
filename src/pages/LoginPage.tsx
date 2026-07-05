import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MarketingHeader } from '../components/MarketingHeader';
import { LoginForm } from '../features/auth/LoginForm';
import { GoogleAuthSection } from '../features/auth/GoogleAuthSection';
import { useAuthStore } from '../stores/authStore';
import type { AuthResponse } from '../api/auth';

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);

  const handleSuccess = (res: AuthResponse) => {
    setSession(res.access_token, res.refresh_token);
    void i18n.changeLanguage(res.user.locale);
    navigate('/app', { replace: true });
  };

  // Already signed in — don't show the form; go to the app.
  if (token) {
    return <Navigate to="/app" replace />;
  }

  return (
    <>
      <MarketingHeader />
      <div className="max-w-md mx-auto mt-12 p-6">
        <h1 className="text-2xl font-bold text-slate-900">{t('auth.welcomeBack')}</h1>
      <p className="text-sm text-slate-600 mb-6 italic">{t('auth.tagline')}</p>
      <LoginForm onSuccess={handleSuccess} />
      <GoogleAuthSection text="signin_with" onSuccess={handleSuccess} />
      <p className="mt-4 text-sm">
        <Link className="text-indigo-600 hover:underline" to="/forgot-password">
          {t('auth.forgotLink')}
        </Link>
      </p>
      <p className="mt-2 text-sm text-slate-600">
        {t('auth.newToBeamcard')}{' '}
        <Link className="text-indigo-600 hover:underline" to="/signup">
          {t('auth.createAccount')}
        </Link>
      </p>
      </div>
    </>
  );
}
