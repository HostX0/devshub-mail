import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const state = vi.hoisted(() => ({ locale: 'ar', api: vi.fn() }));
vi.mock('@/components/admin/use-admin-i18n', () => {
  const t = (english: string, arabic: string) => state.locale === 'ar' ? arabic : english;
  return { useAdminI18n: () => ({ t, isArabic: state.locale === 'ar', locale: state.locale, dir: state.locale === 'ar' ? 'rtl' : 'ltr' }) };
});
vi.mock('@/lib/browser-navigation', () => ({ apiFetch: state.api, withBasePath: (url: string) => url, getPathPrefix: () => '' }));
import { LogsPage } from '../_pages/logs';
import { VersionPage } from '../_pages/version';
import { MonitoringPage } from '../_pages/monitoring';
import { TelemetryPage } from '../_pages/telemetry';

beforeEach(() => {
  cleanup(); state.locale = 'ar'; state.api.mockReset();
});

describe('administrator system languages', () => {
  it('translates audit actions and dates while preserving actual event data', async () => {
    state.api.mockResolvedValue(Response.json({ total: 1, entries: [{ ts: '2026-11-20T15:24:00Z', action: 'mailbox.create', detail: { email: 'employee@example.com' }, ip: '192.0.2.1' }] }));
    const view = render(<LogsPage />);
    await screen.findAllByText('إنشاء حساب بريد');
    expect(screen.getByLabelText('تصفية حسب الإجراء')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'الوقت' })).toBeInTheDocument();
    expect(view.container.textContent).toContain('employee@example.com');
    expect(view.container.textContent).not.toMatch(/[٠-٩]/);
    state.locale = 'en'; view.rerender(<LogsPage />);
    expect(screen.getByLabelText('Filter by action')).toBeInTheDocument();
    expect(screen.getAllByText('Mailbox created').length).toBeGreaterThan(0);
    expect(view.container.textContent).not.toMatch(/[\u0600-\u06ff]/);
  });

  it('translates update status, relative dates and disabled states', async () => {
    state.api.mockResolvedValue(Response.json({ current: '1.21.2', build: 'build123', endpoint: 'https://updates.example', defaultEndpoint: 'https://updates.example', disabledByEnv: true, lastCheckedAt: new Date(Date.now() - 5 * 60000).toISOString(), lastSuccessAt: null, nextScheduledAt: null, status: { severity: 'security' } }));
    const view = render(<VersionPage />);
    await screen.findByText('تحديث أمني');
    expect(screen.getByRole('button', { name: 'تحقّق الآن' })).toBeInTheDocument();
    expect(screen.getByText('نعم')).toBeInTheDocument();
    expect(view.container.textContent).not.toMatch(/[٠-٩]/);
    state.locale = 'en'; view.rerender(<VersionPage />);
    expect(screen.getByText('Security update')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check now' })).toBeInTheDocument();
    expect(view.container.textContent).not.toMatch(/[\u0600-\u06ff]/);
  });

  it('translates monitoring settings and explanatory copy', async () => {
    state.api.mockImplementation(async (url: string) => Response.json(url.endsWith('/config') ? {} : { collecting: false, day: '2026-11-20', errorsToday: { total: 0, top: [] }, metrics: { enabled: false }, tracing: { configured: false, active: false, endpointHost: null } }));
    const view = render(<MonitoringPage />);
    await screen.findByRole('heading', { name: 'الإبلاغ عن الأخطاء', level: 3 });
    expect(screen.getByRole('link', { name: 'البيانات المُرسلة' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'تتبّع الطلبات', level: 3 })).toBeInTheDocument();
    state.locale = 'en'; view.rerender(<MonitoringPage />);
    expect(screen.getByRole('heading', { name: 'Error reporting', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'What is sent' })).toBeInTheDocument();
    await waitFor(() => expect(view.container.textContent).not.toMatch(/[\u0600-\u06ff]/));
  });

  it('translates reporting controls while leaving raw payload data intact', async () => {
    state.api.mockResolvedValue(Response.json({ consent: 'off', consentSource: 'file', endpoint: 'https://collector.example', defaultEndpoint: 'https://collector.example', consentedAt: null, lastSentAt: null, nextScheduledAt: null, payloadPreview: { version: '1.21.2' }, accountCounts: { total: 12, active7d: 3 } }));
    const view = render(<TelemetryPage />);
    await screen.findByRole('switch', { name: 'إرسال تقارير استخدام مجهولة' });
    expect(screen.getByLabelText('عنوان خدمة جمع البيانات')).toBeInTheDocument();
    expect(view.container.querySelector('pre')).toHaveAttribute('dir', 'ltr');
    expect(view.container.querySelector('pre')).toHaveTextContent('"version": "1.21.2"');
    state.locale = 'en'; view.rerender(<TelemetryPage />);
    expect(screen.getByRole('switch', { name: 'Send anonymous heartbeats' })).toBeInTheDocument();
    expect(screen.getByLabelText('Collector URL')).toBeInTheDocument();
    expect(view.container.textContent).not.toMatch(/[\u0600-\u06ff]/);
  });
});
