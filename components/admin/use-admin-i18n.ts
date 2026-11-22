'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';

/** Small, synchronous admin copy selector; changing language never reloads a form. */
export function useAdminI18n() {
  const locale = useLocale();
  const isArabic = locale.split('-')[0] === 'ar';
  const t = useCallback((english: string, arabic: string) => isArabic ? arabic : english, [isArabic]);
  return { t, locale, isArabic, dir: isArabic ? 'rtl' as const : 'ltr' as const };
}
