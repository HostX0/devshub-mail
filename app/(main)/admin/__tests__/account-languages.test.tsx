import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const state = vi.hoisted(() => ({ locale: 'ar', api: vi.fn(), feedback: vi.fn(), push: vi.fn() }));
vi.mock('@/components/admin/use-admin-i18n', () => ({
  useAdminI18n: () => ({
    t: (english: string, arabic: string) => state.locale === 'ar' ? arabic : english,
    isArabic: state.locale === 'ar', locale: state.locale, dir: state.locale === 'ar' ? 'rtl' : 'ltr',
  }),
}));
vi.mock('@/components/admin/language-switcher', () => ({ AdminLanguageSwitcher: () => <span data-testid="language-switcher" /> }));
vi.mock('@/lib/browser-navigation', () => ({ apiFetch: state.api, withBasePath: (url: string) => url, getPathPrefix: () => '' }));
vi.mock('@/components/admin/feedback', () => ({ useAdminFeedback: () => state.feedback }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }), usePathname: () => '/admin' }));
vi.mock('@/hooks/use-config', () => ({ useConfig: () => ({ appName: 'Company', loginLogoLightUrl: '', loginLogoDarkUrl: '' }) }));

import { MailboxesPage } from '../_pages/mailboxes';
import AdminLoginPage from '../login/page';
import ChangePasswordPage from '../change-password/page';

const employee = { id: 'employee', email: 'employee@example.com', displayName: 'Employee', quotaBytes: 1024 ** 3, disabled: false };
function mockMailboxes(error?: { code: string; error: string }) {
  state.api.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === 'POST'
    ? Response.json(error ?? { ok: true, id: 'employee' }, { status: error ? 400 : 200 })
    : Response.json({ domains: ['example.com'], mailboxes: [employee] }));
}

beforeEach(() => {
  cleanup();
  state.locale = 'ar';
  state.api.mockReset();
  state.feedback.mockReset();
  state.push.mockReset();
  mockMailboxes();
});

describe('company account languages', () => {
  it('switches the entire mailbox form to English without clearing input or refetching', async () => {
    const view = render(<MailboxesPage />);
    await screen.findByText('employee@example.com');
    fireEvent.change(screen.getByLabelText('اسم البريد قبل @'), { target: { value: 'new.employee' } });
    expect(view.container.firstChild).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('button', { name: 'إنشاء البريد' })).toBeVisible();
    state.locale = 'en';
    view.rerender(<MailboxesPage />);
    expect(view.container.firstChild).toHaveAttribute('dir', 'ltr');
    expect(screen.getByLabelText('Email name before @')).toHaveValue('new.employee');
    expect(screen.getByRole('button', { name: 'Create mailbox' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Disable' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Generate password' })).toBeVisible();
    expect(view.container.textContent).not.toMatch(/[\u0600-\u06ff]/);
    expect(state.api).toHaveBeenCalledTimes(1);
  });

  it('translates a retained validation error when the language changes', async () => {
    mockMailboxes({ code: 'invalid_input', error: 'Use a password from 12 to 256 characters.' });
    const view = render(<MailboxesPage />);
    await screen.findByText('employee@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'تعطيل' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('استخدم كلمة مرور تتكوّن من 12 إلى 256 حرفاً.');
    state.locale = 'en';
    view.rerender(<MailboxesPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Use a password from 12 to 256 characters.');
  });

  it('provides an English deletion confirmation and waits for the destructive action', async () => {
    state.locale = 'en';
    render(<MailboxesPage />);
    await screen.findByText('employee@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Permanently delete employee@example.com, its mailbox and all its messages?');
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeVisible();
    expect(state.api.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  });

  it.each([
    ['ar', 'كلمة مرور الإدارة', 'دخول الإدارة', 'تعذّر الدخول. تحقّق من كلمة مرور الإدارة.'],
    ['en', 'Administrator password', 'Sign in', 'Could not sign in. Check your administrator password.'],
  ])('localizes the admin sign-in and its error in %s', async (locale, label, submit, error) => {
    state.locale = locale;
    state.api.mockResolvedValue(Response.json({ error: 'Invalid password' }, { status: 401 }));
    const view = render(<AdminLoginPage />);
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(label), { target: { value: 'incorrect-password' } });
    fireEvent.click(screen.getByRole('button', { name: submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(error);
    expect(view.container.firstChild).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    expect(state.push).not.toHaveBeenCalled();
  });

  it.each([
    ['ar', 'كلمة المرور الحالية', 'كلمة المرور الجديدة', 'تأكيد كلمة المرور الجديدة', 'تغيير كلمة المرور', 'كلمة المرور الحالية غير صحيحة.'],
    ['en', 'Current password', 'New password', 'Confirm new password', 'Change password', 'The current password is incorrect.'],
  ])('localizes password changes and server feedback in %s', async (locale, current, next, confirm, submit, error) => {
    state.locale = locale;
    state.api.mockResolvedValue(Response.json({ error: 'Current password is incorrect' }, { status: 401 }));
    render(<ChangePasswordPage />);
    fireEvent.change(screen.getByLabelText(current, { exact: true }), { target: { value: 'incorrect-current' } });
    fireEvent.change(screen.getByLabelText(next, { exact: true }), { target: { value: 'valid-new-password' } });
    fireEvent.change(screen.getByLabelText(confirm, { exact: true }), { target: { value: 'valid-new-password' } });
    fireEvent.click(screen.getByRole('button', { name: submit }));
    await waitFor(() => expect(state.feedback).toHaveBeenCalledWith({ type: 'error', text: error }));
    expect(state.push).not.toHaveBeenCalled();
  });
});
