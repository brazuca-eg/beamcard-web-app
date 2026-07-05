import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { loginWithGoogle, type AuthResponse } from '../../api/auth';

/**
 * Renders Google's official "Sign in with Google" button via Google Identity
 * Services (loaded on demand). On success it exchanges the returned ID token
 * for a Beamcard session and hands the AuthResponse back to the page.
 *
 * Renders nothing when VITE_GOOGLE_CLIENT_ID is unset — so local dev and tests
 * work without a Google client configured.
 */
export function GoogleSignInButton({
  text,
  onSuccess,
  onError,
}: {
  text: 'signin_with' | 'signup_with';
  onSuccess: (res: AuthResponse) => void;
  onError: (e: unknown) => void;
}) {
  const { i18n } = useTranslation();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const container = useRef<HTMLDivElement>(null);

  // Keep the latest callbacks/locale in refs so the GIS callback (registered once) never goes stale.
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const localeRef = useRef(i18n.language);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  localeRef.current = i18n.language;

  useEffect(() => {
    if (!clientId || !container.current) return;
    let cancelled = false;

    void loadGis(i18n.language)
      .then(() => {
        if (cancelled || !window.google || !container.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            loginWithGoogle(response.credential, localeRef.current)
              .then((auth) => onSuccessRef.current(auth))
              .catch((e) => onErrorRef.current(e));
          },
        });
        window.google.accounts.id.renderButton(container.current, {
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          width: 320,
          locale: i18n.language,
        });
      })
      .catch((e) => onErrorRef.current(e));

    return () => {
      cancelled = true;
    };
    // Re-render the button when the client id, label, or language changes.
  }, [clientId, text, i18n.language]);

  if (!clientId) return null;
  return <div ref={container} className="flex justify-center" />;
}

// --- Google Identity Services loader + minimal typings ---

interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GoogleIdConfig {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
}

interface GoogleButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  width?: number;
  locale?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfig) => void;
          renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
        };
      };
    };
  }
}

const GIS_SCRIPT_ID = 'google-gsi-client';

let gisPromise: Promise<void> | null = null;
let gisLocale: string | null = null;

/**
 * Injects the Google Identity Services script, localized via the `hl` query param
 * (the authoritative way to set the button's language — the renderButton `locale`
 * option is unreliable and falls back to the account/browser language). GIS bakes
 * the language at load time, so a language change reloads the script.
 */
function loadGis(locale: string): Promise<void> {
  if (gisPromise && gisLocale === locale) return gisPromise;

  // First load, or the language changed: (re)load the script so GIS re-localizes.
  gisLocale = locale;
  document.getElementById(GIS_SCRIPT_ID)?.remove();
  delete window.google; // force GIS to re-initialize in the new language

  gisPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = GIS_SCRIPT_ID;
    script.src = `https://accounts.google.com/gsi/client?hl=${encodeURIComponent(locale)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null; // allow a retry on a later mount
      gisLocale = null;
      reject(new Error('Failed to load Google Identity Services'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}
