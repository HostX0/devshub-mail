import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
const api = vi.hoisted(() => vi.fn());
vi.mock('@/lib/browser-navigation', () => ({ apiFetch: api, withBasePath: (url: string) => url, getPathPrefix: () => '' }));
import { MailboxesPage } from '../_pages/mailboxes';
const employee = { id: 'employee', email: 'employee@example.com', displayName: 'Employee', quotaBytes: 1024 ** 3, disabled: false };
beforeEach(() => {
  api.mockReset();
  api.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === 'POST' ? Response.json({ ok: true, id: 'employee' }) : Response.json({ domains: ['example.com'], mailboxes: [employee] }));
});
describe('employee mailbox controls', () => {
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
    api.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === 'POST' ? Response.json({ error: 'Storage unavailable. Refresh and retry.' }, { status: 409 }) : Response.json({ domains: ['example.com'], mailboxes: [employee] }));
    render(<MailboxesPage />); await screen.findByText('employee@example.com'); fireEvent.click(screen.getByRole('button', { name: 'تعطيل' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable. Refresh and retry.');
  });
});
