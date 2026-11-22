'use client';

import { useId } from 'react';
import { useLocaleStore } from '@/stores/locale-store';
import { getPathPrefix } from '@/lib/browser-navigation';
import { useAdminI18n } from './use-admin-i18n';

/** Use the existing catalog loader so language changes preserve unsaved fields and sessions. */
export function AdminLanguageSwitcher() {
  const id = useId();
  const { t, isArabic } = useAdminI18n();
  const setLocale = useLocaleStore(s => s.setLocale);
  function change(locale: string) {
    document.cookie = `NEXT_LOCALE=${locale}; Path=${getPathPrefix() ? `${getPathPrefix()}/` : '/'}; Max-Age=34560000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    setLocale(locale);
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id} className="text-muted-foreground">{t('Language', 'اللغة')}</label>
      <select id={id} value={isArabic ? 'ar' : 'en'} onChange={e => change(e.target.value)} className="h-9 min-w-24 rounded-md border border-input bg-background px-2 text-foreground">
        <option value="ar">{t('Arabic', 'العربية')}</option>
        <option value="en">{t('English', 'الإنجليزية')}</option>
      </select>
    </div>
  );
}
