import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The management shell is private, including while authentication is pending.

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/admin/settings',
}));
vi.mock('next-intl', () => ({ useLocale: () => 'ar' }));
const apiFetch = vi.hoisted(() => vi.fn((_url: string, init: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
  init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
})));
vi.mock('@/lib/browser-navigation', () => ({
  apiFetch,
  getPathPrefix: () => '',
  withBasePath: (href: string) => href,
}));
vi.mock('@/components/admin/admin-shell', () => ({
  AdminShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/components/ui/toast', () => ({ ToastContainer: () => null }));
vi.mock('../_unsaved-changes-guard', () => ({ UnsavedChangesGuard: () => null }));

const { AdminLayoutClient } = await import('../_layout-client');

describe('admin layout while the session is checked', () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); apiFetch.mockClear(); });
  it('keeps the management shell hidden until authenticated', () => {
    render(<AdminLayoutClient><p>page</p></AdminLayoutClient>);
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('جارٍ التحقق من تسجيل الدخول…');
    expect(screen.queryByText('page')).toBeNull();
  });
  it('ends a stalled request and only retries when requested', async () => {
    vi.useFakeTimers();
    render(<AdminLayoutClient><p>page</p></AdminLayoutClient>);
    await act(async () => { await vi.advanceTimersByTimeAsync(20001); });
    expect(screen.getByRole('alert').textContent).toContain('أعد المحاولة');
    expect(apiFetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('page')).toBeNull();
  });
});
