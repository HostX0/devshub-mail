import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useLocaleStore } from '@/stores/locale-store';
import { localizedAdminPages, localizeAdminMetadata } from '@/lib/admin/admin-nav-i18n';
import { ADMIN_PAGES } from '@/lib/admin/admin-nav';
import { AdminLanguageSwitcher } from '../language-switcher';

const current = vi.hoisted(() => ({ locale: 'en' }));
vi.mock('next-intl', () => ({ useLocale: () => current.locale }));
vi.mock('@/lib/browser-navigation', () => ({ getPathPrefix: () => '' }));

beforeEach(() => {
  current.locale = 'en';
  useLocaleStore.setState({ locale: 'en' });
  document.cookie = 'NEXT_LOCALE=; Max-Age=0; Path=/';
});

describe('administrator language preference', () => {
  it('saves the selected language to the shared store and request cookie', () => {
    const view = render(<AdminLanguageSwitcher />);
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'ar' } });
    expect(useLocaleStore.getState().locale).toBe('ar');
    expect(document.cookie).toContain('NEXT_LOCALE=ar');
    current.locale = 'ar';
    view.rerender(<AdminLanguageSwitcher />);
    expect(screen.getByLabelText('اللغة')).toHaveValue('ar');
    expect(screen.getByRole('option', { name: 'الإنجليزية' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('اللغة'), { target: { value: 'en' } });
    expect(document.cookie).toContain('NEXT_LOCALE=en');
  });

  it('covers all navigation titles, descriptions and searchable section labels in Arabic', () => {
    const arabic = localizedAdminPages(true);
    expect(arabic.map(p => p.id)).toEqual(ADMIN_PAGES.map(p => p.id));
    for (const page of arabic) {
      expect(page.label).toMatch(/[\u0600-\u06ff]/);
      expect(page.description).toMatch(/[\u0600-\u06ff]/);
      for (const section of page.sections) expect(section.title).toMatch(/[\u0600-\u06ff]/);
    }
    for (const page of localizedAdminPages(false)) {
      expect(page.label).not.toMatch(/[\u0600-\u06ff]/);
      expect(localizeAdminMetadata(page.label, true)).not.toBe(page.label);
    }
  });
});
