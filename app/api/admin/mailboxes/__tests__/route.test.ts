import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ serviceCredentials: vi.fn(), managerCredentials: vi.fn(), adminAuth: vi.fn(), credentials: vi.fn(), config: vi.fn(), mode: vi.fn(), audit: vi.fn(), authorize: vi.fn(), list: vi.fn(), mutate: vi.fn() }));
vi.mock('@/lib/stalwart/mailbox-admin-service-credentials', () => ({ readMailboxAdminServiceCredentials: mocks.serviceCredentials }));
vi.mock('@/lib/admin/config-manager', () => ({ configManager: { ensureLoaded: async () => {}, get: mocks.config } }));
vi.mock('@/lib/stalwart/credentials', () => ({ getStalwartCredentials: mocks.credentials }));
vi.mock('@/lib/admin/stalwart-admin-access', () => ({ getStalwartAdminAccessMode: mocks.mode }));
vi.mock('@/lib/admin/audit', () => ({ auditLog: mocks.audit }));
vi.mock('@/lib/admin/session', () => ({ requireAdminAuth: mocks.adminAuth, getClientIP: () => '127.0.0.1' }));
vi.mock('@/lib/stalwart/mailbox-management', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/stalwart/mailbox-management')>();
  return { ...original, MailboxManager: class { constructor(creds: unknown) { mocks.managerCredentials(creds); } authorize = mocks.authorize; list = mocks.list; mutate = mocks.mutate; } };
});
import { GET, POST } from '../route';
const request = (body: unknown, origin = 'https://webmail.example.com') => new NextRequest('https://webmail.example.com/api/admin/mailboxes', { method: 'POST', headers: { origin, host: 'webmail.example.com', 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
beforeEach(() => {
  vi.unstubAllEnvs(); vi.clearAllMocks(); mocks.serviceCredentials.mockResolvedValue({ serverUrl: 'https://mail.example.com', accountName: 'service@example.com', authHeader: 'Basic PRIVATE', trusted: true }); mocks.adminAuth.mockResolvedValue({ payload: {} }); mocks.mode.mockResolvedValue('auto'); mocks.config.mockImplementation((key: string, fallback: unknown) => key === 'jmapServerUrl' ? 'https://mail.example.com' : fallback); mocks.credentials.mockResolvedValue({ serverUrl: 'https://mail.example.com', accountName: 'owner@example.com', trusted: true }); mocks.authorize.mockResolvedValue(undefined); mocks.list.mockResolvedValue({ domains: ['example.com'], mailboxes: [] }); mocks.mutate.mockResolvedValue({ id: 'new', email: 'new@example.com' }); mocks.audit.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());
describe('mailbox HTTP API', () => {
  it('never reads server credentials without a valid separate administrator session', async () => {
    vi.stubEnv('STALWART_MAILBOX_ADMIN_CREDENTIALS_FILE', '/private/admin.json');
    mocks.credentials.mockResolvedValue(null); mocks.adminAuth.mockResolvedValue({ error: 'Unauthorized' });
    expect((await GET(new NextRequest('https://webmail.example.com/api/admin/mailboxes'))).status).toBe(401);
    expect(mocks.serviceCredentials).not.toHaveBeenCalled(); expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it('lets the separate password administrator manage mailboxes without a mailbox session', async () => {
    vi.stubEnv('STALWART_MAILBOX_ADMIN_CREDENTIALS_FILE', '/private/admin.json'); mocks.mode.mockResolvedValue('password'); mocks.credentials.mockResolvedValue(null);
    const res = await POST(request({ action: 'disable', id: 'employee' }));
    expect(res.status).toBe(200); expect(mocks.credentials).not.toHaveBeenCalled(); expect(mocks.authorize).toHaveBeenCalledTimes(1);
    expect(mocks.audit).toHaveBeenCalledWith('mailbox.disable', expect.objectContaining({ actor: 'webmail-administrator' }), '127.0.0.1');
    expect(await res.text()).not.toContain('PRIVATE'); expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain('PRIVATE');
  });
  it('rejects server credentials pointing outside the operator-authorised servers', async () => {
    vi.stubEnv('STALWART_MAILBOX_ADMIN_CREDENTIALS_FILE', '/private/admin.json'); mocks.mode.mockResolvedValue('password');
    mocks.serviceCredentials.mockResolvedValue({ serverUrl: 'https://other.example.com', trusted: true });
    expect((await GET(new NextRequest('https://webmail.example.com/api/admin/mailboxes'))).status).toBe(403); expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it('preserves signed-in JMAP administration when independent mode is not configured', async () => {
    expect((await GET(new NextRequest('https://webmail.example.com/api/admin/mailboxes'))).status).toBe(200);
    expect(mocks.serviceCredentials).not.toHaveBeenCalled(); expect(mocks.managerCredentials).toHaveBeenCalledWith(expect.objectContaining({ accountName: 'owner@example.com' }));
  });
  it('rejects a trusted secondary server without explicit admin authority', async () => {
    mocks.credentials.mockResolvedValue({ serverUrl: 'https://secondary.example.com', accountName: 'owner@example.com', trusted: true });
    mocks.config.mockImplementation((key: string, fallback: unknown) => key === 'jmapServerUrl' ? 'https://mail.example.com' : key === 'jmapServers' ? [{ id: 'secondary', name: 'Secondary', url: 'https://secondary.example.com' }] : fallback);
    const res = await GET(new NextRequest('https://webmail.example.com/api/admin/mailboxes'));
    expect(res.status).toBe(403); expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it('allows an explicitly opted-in admin server, still requiring fresh super-admin verification', async () => {
    mocks.credentials.mockResolvedValue({ serverUrl: 'https://secondary.example.com', accountName: 'owner@example.com', trusted: true });
    mocks.config.mockImplementation((key: string, fallback: unknown) => key === 'jmapServerUrl' ? 'https://mail.example.com' : key === 'jmapServers' ? [{ id: 'secondary', name: 'Secondary', url: 'https://secondary.example.com', adminAccess: true }] : fallback);
    expect((await GET(new NextRequest('https://webmail.example.com/api/admin/mailboxes'))).status).toBe(200); expect(mocks.authorize).toHaveBeenCalledTimes(1);
  });
  it('does not accept form or text bodies for mutations', async () => {
    const req = request({ action: 'disable', id: 'employee' }); req.headers.set('content-type', 'text/plain');
    expect((await POST(req)).status).toBe(415); expect(mocks.credentials).not.toHaveBeenCalled();
  });
  it('does not accept a webmail admin settings cookie as mailbox authority', async () => {
    mocks.credentials.mockResolvedValue(null);
    const res = await GET(new NextRequest('https://webmail.example.com/api/admin/mailboxes', { headers: { cookie: 'admin-session=some-settings-session' } }));
    expect(res.status).toBe(401); expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it('honours password-mode dashboard sign-in in addition to the upstream superuser', async () => {
    mocks.mode.mockResolvedValue('password'); mocks.adminAuth.mockResolvedValue({ error: Response.json({ error: 'Not authenticated' }, { status: 401 }) });
    expect((await GET(new NextRequest('https://webmail.example.com/api/admin/mailboxes'))).status).toBe(401); expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it('honours the operator off switch', async () => {
    mocks.mode.mockResolvedValue('off'); const res = await GET(new NextRequest('https://webmail.example.com/api/admin/mailboxes'));
    expect(res.status).toBe(403); expect(mocks.credentials).not.toHaveBeenCalled();
  });
  it('checks upstream super-admin authority afresh for every request', async () => {
    const r = new NextRequest('https://webmail.example.com/api/admin/mailboxes'); await GET(r); await GET(r);
    expect(mocks.authorize).toHaveBeenCalledTimes(2);
  });
  it('rejects cross-origin mailbox mutations before using any credential', async () => {
    const res = await POST(request({ action: 'disable', id: 'employee' }, 'https://attacker.example'));
    expect(res.status).toBe(403); expect(mocks.credentials).not.toHaveBeenCalled(); expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it('rejects malformed and oversized bodies without contacting the server', async () => {
    expect((await POST(request('{'))).status).toBe(400);
    expect((await POST(request('x'.repeat(8193)))).status).toBe(413);
    expect(mocks.credentials).not.toHaveBeenCalled();
  });
  it('never audits or returns password material', async () => {
    const res = await POST(request({ action: 'create', email: 'new@example.com', password: 'TOP-SECRET-password', quotaBytes: 1024 ** 3 }));
    expect(res.status).toBe(200); expect(res.headers.get('cache-control')).toBe('no-store');
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain('TOP-SECRET'); expect(await res.text()).not.toContain('TOP-SECRET');
    expect(mocks.audit).toHaveBeenCalledWith('mailbox.create', expect.objectContaining({ actor: 'owner@example.com', id: 'new', passwordChanged: true }), '127.0.0.1');
  });
  it('does not return internal exceptions or log a failed mutation as success', async () => {
    mocks.mutate.mockRejectedValue(new Error('sensitive upstream detail'));
    const res = await POST(request({ action: 'disable', id: 'employee' }));
    expect(res.status).toBe(502); expect(await res.text()).not.toContain('sensitive'); expect(mocks.audit).not.toHaveBeenCalled();
  });
});
