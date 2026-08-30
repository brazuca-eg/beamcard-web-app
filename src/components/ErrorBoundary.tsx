import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Friendly fallback shown when a render crash is caught, instead of a white screen. */
function Fallback() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl">⚠️</div>
      <h1 className="mt-4 text-lg font-semibold text-slate-900">{t('errorBoundary.title')}</h1>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{t('errorBoundary.body')}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        {t('errorBoundary.reload')}
      </button>
    </div>
  );
}

/**
 * Catches render-time exceptions anywhere below it and shows a recoverable fallback so a single
 * component crash doesn't blank the whole app. Class component because only class lifecycles
 * (getDerivedStateFromError / componentDidCatch) can catch React render errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Unhandled UI error:', error);
  }

  render() {
    return this.state.hasError ? <Fallback /> : this.props.children;
  }
}
