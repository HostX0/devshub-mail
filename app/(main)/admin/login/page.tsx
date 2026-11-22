'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminI18n } from '@/components/admin/use-admin-i18n';
import { AdminLanguageSwitcher } from '@/components/admin/language-switcher';
import { AlertCircle, Shield } from '@/components/icons';
import { useConfig } from '@/hooks/use-config';
import { apiFetch, withBasePath } from '@/lib/browser-navigation';
import { safeAdminNext } from '@/lib/connector/admin-next';

export default function AdminLoginPage() {
  const router = useRouter();
  const { t, dir } = useAdminI18n();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<'rate_limit' | 'sign_in' | 'connection' | ''>('');
  const [loading, setLoading] = useState(false);
  const { loginLogoLightUrl, loginLogoDarkUrl, appName } = useConfig();
  // Both logos, picked by CSS: the server can't know the theme, and a logo
  // chosen from the theme store swaps after the first paint.
  const logoLight = withBasePath(loginLogoLightUrl || loginLogoDarkUrl);
  const logoDark = withBasePath(loginLogoDarkUrl || loginLogoLightUrl);

  useEffect(() => {
    document.title = `${t('Admin sign-in', 'تسجيل دخول الإدارة')} - ${appName}`;
  }, [appName, t]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        setError(res.status === 429 ? 'rate_limit' : 'sign_in');
        return;
      }

      // A connector link to an admin page parks its destination in ?next=
      // so logging in lands on the page that was clicked, not the overview.
      // safeAdminNext() is the gate: it is the only path here that comes out
      // of a URL rather than out of a fixed template. A version pick (an
      // install link to one version of an extension) rides in its query.
      router.push(safeAdminNext(new URLSearchParams(window.location.search).get('next')) ?? '/admin');
    } catch {
      setError('connection');
    } finally {
      setLoading(false);
    }
  }

  const errorText = error === 'rate_limit'
    ? t('Too many attempts. Wait a moment and try again.', 'محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.')
    : error === 'connection'
      ? t('Connection failed. Please try again.', 'تعذّر الاتصال. أعد المحاولة.')
      : t('Could not sign in. Check your administrator password.', 'تعذّر الدخول. تحقّق من كلمة مرور الإدارة.');

  return (
    <div dir={dir} className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm py-8">
        <div className="mb-6 flex justify-end"><AdminLanguageSwitcher /></div>
        <div className="flex flex-col items-center mb-8">
          {logoLight ? (
            <>
              <img src={logoLight} alt="" className="h-12 object-contain mb-4 dark:hidden" />
              <img src={logoDark} alt="" className="h-12 object-contain mb-4 hidden dark:block" />
            </>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
          )}
          <h1 className="text-xl font-semibold text-foreground">{t('Company mail administration', 'إدارة بريد الشركة')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('Enter your administrator password to manage employee accounts', 'أدخل كلمة مرور الإدارة لإدارة حسابات الموظفين')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
              {t('Administrator password', 'كلمة مرور الإدارة')}
            </label>
            <input
              id="password"
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground hover:border-muted-foreground focus-visible:outline-hidden focus-visible:border-ring"
              placeholder={t('Enter administrator password', 'أدخل كلمة مرور الإدارة')}
              required
              autoFocus
              autoComplete="current-password"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'admin-login-error' : undefined}
            />
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span id="admin-login-error">{errorText}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 shadow-sm"
          >
            {loading ? t('Signing in…', 'جارٍ تسجيل الدخول…') : t('Sign in', 'دخول الإدارة')}
          </button>
        </form>
        <a className="mt-6 block text-center text-sm text-primary hover:underline" href={withBasePath('/login')}>{t('Sign in to your mailbox', 'الدخول إلى البريد الإلكتروني')}</a>
      </div>
    </div>
  );
}
