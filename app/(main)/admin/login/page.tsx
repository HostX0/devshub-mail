'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { AlertCircle, Shield } from '@/components/icons';
import { useConfig } from '@/hooks/use-config';
import { apiFetch, withBasePath } from '@/lib/browser-navigation';
import { safeAdminNext } from '@/lib/connector/admin-next';

export default function AdminLoginPage() {
  const router = useRouter();
  const arabic = useLocale().startsWith('ar');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginLogoLightUrl, loginLogoDarkUrl, appName } = useConfig();
  // Both logos, picked by CSS: the server can't know the theme, and a logo
  // chosen from the theme store swaps after the first paint.
  const logoLight = withBasePath(loginLogoLightUrl || loginLogoDarkUrl);
  const logoDark = withBasePath(loginLogoDarkUrl || loginLogoLightUrl);

  useEffect(() => {
    document.title = `${arabic ? 'تسجيل دخول الإدارة' : 'Admin sign-in'} - ${appName}`;
  }, [appName, arabic]);

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

      const data = await res.json();

      if (!res.ok) {
        setError(arabic ? (res.status === 429 ? 'محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.' : 'تعذّر الدخول. تحقّق من كلمة مرور الإدارة.') : data.error || 'Login failed');
        return;
      }

      // A connector link to an admin page parks its destination in ?next=
      // so logging in lands on the page that was clicked, not the overview.
      // safeAdminNext() is the gate: it is the only path here that comes out
      // of a URL rather than out of a fixed template. A version pick (an
      // install link to one version of an extension) rides in its query.
      router.push(safeAdminNext(new URLSearchParams(window.location.search).get('next')) ?? '/admin');
    } catch {
      setError(arabic ? 'تعذّر الاتصال. أعد المحاولة.' : 'Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir={arabic ? 'rtl' : 'ltr'} className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
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
          <h1 className="text-xl font-semibold text-foreground">{arabic ? 'إدارة بريد الشركة' : 'Company mail administration'}</h1>
          <p className="text-sm text-muted-foreground mt-1">{arabic ? 'أدخل كلمة مرور الإدارة لإدارة حسابات الموظفين' : 'Enter your administrator password to manage employee accounts'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
              {arabic ? 'كلمة مرور الإدارة' : 'Administrator password'}
            </label>
            <input
              id="password"
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground hover:border-muted-foreground focus-visible:outline-hidden focus-visible:border-ring"
              placeholder={arabic ? 'أدخل كلمة مرور الإدارة' : 'Enter administrator password'}
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
              <span id="admin-login-error">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 shadow-sm"
          >
            {loading ? (arabic ? 'جارٍ تسجيل الدخول…' : 'Signing in…') : (arabic ? 'دخول الإدارة' : 'Sign in')}
          </button>
        </form>
        <a className="mt-6 block text-center text-sm text-primary hover:underline" href={withBasePath('/login')}>{arabic ? 'الدخول إلى البريد الإلكتروني' : 'Sign in to your mailbox'}</a>
      </div>
    </div>
  );
}
