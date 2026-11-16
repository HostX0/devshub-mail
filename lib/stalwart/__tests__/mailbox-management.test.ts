import { describe, expect, it, vi } from 'vitest';
import { allowedMailboxDomains, isEmployeeAccount, MailboxManager, validateMailboxInput } from '../mailbox-management';
import type { StalwartCredentials } from '../credentials';
const credentials: StalwartCredentials = { serverUrl: 'https://mail.example.com', authHeader: 'Basic OWNER', username: 'owner@example.com', accountName: 'owner@example.com', hasSessionCookie: true, slot: 0, trusted: true };
const employee = { id: 'employee', '@type': 'User', name: 'employee', domainId: 'allowed', description: 'Employee', roles: { '@type': 'User' }, permissions: { '@type': 'Inherit' }, quotas: { maxDiskQuota: 1024 ** 3 }, credentials: { 'main/key': { '@type': 'Password', secret: 'MASKED', otpUrl: 'MASKED' }, app: { '@type': 'AppPassword', secret: 'MASKED' } } };
function fixture(options: { deny?: boolean; target?: Record<string, unknown>; failSet?: boolean; unknown?: boolean } = {}) {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'GET') return Response.json({ primaryAccounts: { 'urn:stalwart:jmap': 'owner' } });
    const [method, args, tag] = JSON.parse(String(init?.body)).methodCalls[0]; calls.push([method, args]);
    let result: Record<string, unknown> = {};
    if (method === 'x:Tenant/query' && (options.deny || options.unknown)) return Response.json({ methodResponses: [['error', { type: options.unknown ? 'unknownMethod' : 'forbidden' }, tag]] });
    if (method === 'x:Domain/get') result = { list: [{ id: 'allowed', name: 'example.com' }, { id: 'other', name: 'other.com' }] };
    if (method === 'x:Account/query') result = { ids: ['employee', 'admin', 'outside'] };
    if (method === 'x:Account/get') result = { list: args.ids?.length === 1 ? [options.target ?? employee] : [employee, { ...employee, id: 'admin', roles: { '@type': 'Admin' } }, { ...employee, id: 'outside', domainId: 'other' }] };
    if (method === 'x:Account/set') result = options.failSet ? { notCreated: { employee: { type: 'invalidProperties', description: 'sensitive upstream message' } } } : args.create ? { created: { employee: { id: 'new' } } } : args.destroy ? { destroyed: args.destroy } : { updated: { employee: null } };
    return Response.json({ methodResponses: [[method, result, tag]] });
  });
  return { manager: new MailboxManager(credentials, ['example.com'], fetcher), fetcher, calls };
}
describe('mailbox input boundaries', () => {
  const valid = { action: 'create', email: 'Employee@example.com', quotaBytes: 1024 ** 3, password: 'Strong-pass-1234' };
  it('normalizes addresses and requires a configured domain allowlist', () => {
    expect(validateMailboxInput(valid).email).toBe('employee@example.com');
    expect(allowedMailboxDomains('EXAMPLE.com, example.com,https://evil.com, ,other.com')).toEqual(['example.com', 'other.com']);
    expect(allowedMailboxDomains('')).toEqual([]);
  });
  it.each([{ roles: { '@type': 'Admin' } }, { permissions: {} }, { serverUrl: 'https://evil.example' }, { domainId: 'other' }, { '@type': 'Admin' }])('rejects privilege or upstream injection: %j', extra => {
    expect(() => validateMailboxInput({ ...valid, ...extra })).toThrow('Unexpected mailbox field');
  });
  it.each([0, -1, 1.2, NaN, Infinity, 2 ** 54, '1073741824'])('rejects unsafe quota %s', quotaBytes => { expect(() => validateMailboxInput({ ...valid, quotaBytes })).toThrow('storage limit'); });
  it('rejects weak passwords and unrelated mutation fields', () => {
    expect(() => validateMailboxInput({ ...valid, password: 'short' })).toThrow('password');
    expect(() => validateMailboxInput({ ...valid, password: 'Strong-password\n' })).toThrow('password');
    expect(() => validateMailboxInput({ ...valid, displayName: 'Bad\u0000name' })).toThrow('display name');
    expect(() => validateMailboxInput({ action: 'disable', id: 'employee', password: 'Strong-pass-1234' })).toThrow('Unexpected fields');
    expect(() => validateMailboxInput({ action: 'update', id: 'employee' })).toThrow('Choose a change');
  });
});
describe('super-admin authority and domain boundaries', () => {
  it('refuses a custom mail server before making any network request', async () => {
    const fetcher = vi.fn(); const m = new MailboxManager({ ...credentials, trusted: false }, ['example.com'], fetcher);
    await expect(m.authorize()).rejects.toMatchObject({ status: 403, code: 'untrusted_server' }); expect(fetcher).not.toHaveBeenCalled();
  });
  it('is disabled when operator domains are unset', async () => {
    const fetcher = vi.fn(); const m = new MailboxManager(credentials, [], fetcher);
    await expect(m.authorize()).rejects.toMatchObject({ code: 'not_configured' }); expect(fetcher).not.toHaveBeenCalled();
  });
  it('denies an ordinary user or tenant admin, without exposing domains or accounts', async () => {
    const { manager, calls } = fixture({ deny: true }); await expect(manager.authorize()).rejects.toMatchObject({ status: 403 });
    expect(calls.map(c => c[0])).toEqual(['x:Tenant/query']);
  });
  it('reports unsupported management APIs clearly', async () => {
    await expect(fixture({ unknown: true }).manager.authorize()).rejects.toMatchObject({ status: 501, code: 'unsupported_server' });
  });
  it('lists only ordinary employees in allowed domains and never returns secrets', async () => {
    const { manager } = fixture(); await manager.authorize(); const result = await manager.list();
    expect(result.domains).toEqual(['example.com']); expect(result.mailboxes.map(m => m.email)).toEqual(['employee@example.com']);
    expect(JSON.stringify(result)).not.toMatch(/MASKED|credentials|OWNER/);
  });
  it('rejects an address in another domain before calling Account/set', async () => {
    const { manager, calls } = fixture(); await manager.authorize();
    await expect(manager.mutate(validateMailboxInput({ action: 'create', email: 'new@other.com', quotaBytes: 1024 ** 3, password: 'Strong-pass-1234' }))).rejects.toMatchObject({ code: 'domain_not_allowed' });
    expect(calls.some(c => c[0] === 'x:Account/set')).toBe(false);
  });
  it.each([{ ...employee, roles: { '@type': 'Admin' } }, { ...employee, roles: { '@type': 'Custom' } }, { ...employee, domainId: 'other' }, { ...employee, permissions: { '@type': 'Merge' } }, { ...employee, memberGroupIds: { privilegedGroup: true } }])('protects administrators, custom permissions and other domains', async target => {
    const { manager, calls } = fixture({ target }); await manager.authorize();
    await expect(manager.mutate({ action: 'delete', id: 'employee' })).rejects.toMatchObject({ code: 'protected_account' });
    expect(calls.some(c => c[0] === 'x:Account/set')).toBe(false);
  });
});
describe('employee lifecycle payloads', () => {
  it('creates only User roles, bounded quota and a primary password', async () => {
    const { manager, calls } = fixture(); await manager.authorize();
    const result = await manager.mutate(validateMailboxInput({ action: 'create', email: 'new@example.com', displayName: 'New employee', quotaBytes: 2 * 1024 ** 3, password: 'Strong-pass-1234' }));
    expect(result).toEqual({ id: 'new', email: 'new@example.com' });
    expect(calls.at(-1)?.[1]).toMatchObject({ create: { employee: { '@type': 'User', roles: { '@type': 'User' }, permissions: { '@type': 'Inherit' }, domainId: 'allowed', quotas: { maxDiskQuota: 2 * 1024 ** 3 }, credentials: { '0': { '@type': 'Password', secret: 'Strong-pass-1234' } } } } });
  });
  it('changes quota and only the password secret, preserving MFA and app passwords', async () => {
    const { manager, calls } = fixture(); await manager.authorize(); await manager.mutate({ action: 'update', id: 'employee', quotaBytes: 3 * 1024 ** 3, password: 'Replacement-pass-123' });
    expect(calls.at(-1)?.[1].update).toEqual({ employee: { 'quotas/maxDiskQuota': 3 * 1024 ** 3, 'credentials/main~1key/secret': 'Replacement-pass-123' } });
  });
  it('disables with zero effective permissions and preserves credentials, then restores inherited user permissions', async () => {
    const { manager, calls } = fixture(); await manager.authorize(); await manager.mutate({ action: 'disable', id: 'employee' });
    expect(calls.at(-1)?.[1].update).toEqual({ employee: { permissions: { '@type': 'Replace', enabledPermissions: {}, disabledPermissions: {} } } });
    expect(isEmployeeAccount({ ...employee, permissions: { '@type': 'Replace', enabledPermissions: {}, disabledPermissions: {} } })).toBe(true);
    await manager.mutate({ action: 'enable', id: 'employee' }); expect(calls.at(-1)?.[1].update).toEqual({ employee: { permissions: { '@type': 'Inherit' } } });
  });
  it('deletes only the selected revalidated employee', async () => {
    const { manager, calls } = fixture(); await manager.authorize(); await manager.mutate({ action: 'delete', id: 'employee' }); expect(calls.at(-1)?.[1].destroy).toEqual(['employee']);
  });
  it('does not forward sensitive upstream failure descriptions', async () => {
    const { manager } = fixture({ failSet: true }); await manager.authorize();
    await expect(manager.mutate({ action: 'disable', id: 'employee' })).rejects.toMatchObject({ status: 409, code: 'mailbox_change_failed' });
  });
});
