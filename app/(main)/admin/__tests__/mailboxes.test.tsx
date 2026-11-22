import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const api = vi.hoisted(() => vi.fn());
vi.mock('@/components/admin/use-admin-i18n', () => ({ useAdminI18n: () => ({ t: (_english: string, arabic: string) => arabic, isArabic: true, locale: 'ar', dir: 'rtl' }) }));
vi.mock('@/lib/browser-navigation', () => ({ apiFetch: api, withBasePath: (url: string) => url, getPathPrefix: () => '' }));
import { MailboxesPage } from '../_pages/mailboxes';
const employee = { id: 'employee', email: 'employee@example.com', displayName: 'Employee', quotaBytes: 1024 ** 3, disabled: false };
beforeEach(() => {
  api.mockReset();
  api.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === 'POST' ? Response.json({ ok: true, id: 'employee' }) : Response.json({ domains: ['example.com'], mailboxes: [employee] }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('employee mailbox controls', () => {
  it('ends a stalled response body and lets the administrator retry without replaying the request', async () => {
    vi.useFakeTimers();
    api.mockImplementationOnce(async (_path: string, init: RequestInit) => ({
      ok: true,
      json: () => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })),
    }));
    render(<MailboxesPage />);
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByRole('button', { name: 'تحديث' })).toBeEnabled();
    expect(api).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'تحديث' })); });
    expect(screen.getByText('employee@example.com')).toBeVisible();
  });
  it('creates an employee with an exact GiB quota and clears the password after success', async () => {
    render(<MailboxesPage />); await screen.findByText('employee@example.com');
    fireEvent.change(screen.getByLabelText('اسم البريد قبل @'), { target: { value: 'new' } });
    fireEvent.change(screen.getByLabelText('اسم الموظف'), { target: { value: 'New employee' } });
    fireEvent.change(screen.getByLabelText(/مساحة الصندوق/), { target: { value: '2.5' } });
    fireEvent.change(screen.getByLabelText('كلمة المرور'), { target: { value: 'New-strong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء البريد' }));
    await waitFor(() => expect(api.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true));
    const call = api.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(call[1].body)).toEqual({ action: 'create', email: 'new@example.com', displayName: 'New employee', quotaBytes: 2.5 * 1024 ** 3, password: 'New-strong-password' });
    await waitFor(() => expect(screen.getByLabelText('كلمة المرور')).toHaveValue(''));
  });
  it('leaves the existing password untouched when editing without a replacement', async () => {
    render(<MailboxesPage />); await screen.findByText('employee@example.com'); fireEvent.click(screen.getByRole('button', { name: 'تعديل' }));
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
    await waitFor(() => expect(api.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true));
    const call = api.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(call[1].body)).toEqual({ action: 'update', id: 'employee', displayName: 'Employee', quotaBytes: 1024 ** 3 });
  });
  it('sends disable directly and shows an actionable server error', async () => {
    api.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === 'POST' ? Response.json({ code: 'mailbox_change_failed', error: 'Storage unavailable. Refresh and retry.' }, { status: 409 }) : Response.json({ domains: ['example.com'], mailboxes: [employee] }));
    render(<MailboxesPage />); await screen.findByText('employee@example.com'); fireEvent.click(screen.getByRole('button', { name: 'تعطيل' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذّر حفظ التغيير. تحقّق من عنوان البريد والمساحة المتاحة، ثم حدّث الصفحة وحاول مجدداً.');
  });
});
