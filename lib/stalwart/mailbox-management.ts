/** Employee provisioning using the signed-in Stalwart superuser, never a stored bootstrap password. */
import { fetchJmapServer } from './server-fetch';
import type { StalwartCredentials } from './credentials';
export class MailboxAdminError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
type Obj = Record<string, unknown>;
type Account = Obj & { id: string; name: string; domainId: string; roles?: Obj; permissions?: Obj; quotas?: Obj };
type Domain = { id: string; name: string };
export type MailboxRow = { id: string; email: string; displayName: string; quotaBytes: number; disabled: boolean };
export type MailboxInput = { action: 'create' | 'update' | 'disable' | 'enable' | 'delete'; id?: string; email?: string; displayName?: string; quotaBytes?: number; password?: string };
const fail = (message: string): never => { throw new MailboxAdminError(400, 'invalid_input', message); };
const isObject = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
export function allowedMailboxDomains(value = process.env.MAILBOX_ADMIN_DOMAINS ?? ''): string[] {
  return [...new Set(value.split(',').map(v => v.trim().toLowerCase()).filter(v => /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(v)))];
}
export function validateMailboxInput(body: unknown): MailboxInput {
  if (!isObject(body)) return fail('A mailbox action is required.');
  const { action, id, email, displayName, quotaBytes, password } = body;
  if (!['create', 'update', 'disable', 'enable', 'delete'].includes(String(action))) return fail('Unknown mailbox action.');
  const keys = new Set(['action', 'id', 'email', 'displayName', 'quotaBytes', 'password']);
  if (Object.keys(body).some(k => !keys.has(k))) return fail('Unexpected mailbox field.');
  if (action !== 'create' && (typeof id !== 'string' || !id || id.length > 128)) return fail('Choose a mailbox.');
  if (action === 'create' && (typeof email !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}@[^@\s]+$/.test(email))) return fail('Enter a valid employee email address.');
  if (action !== 'create' && email !== undefined) return fail('The mailbox address cannot be changed here.');
  if (displayName !== undefined && (typeof displayName !== 'string' || displayName.trim().length > 120 || /[\x00-\x1f\x7f]/.test(displayName))) return fail('Enter a display name of up to 120 characters.');
  if (action === 'create' || quotaBytes !== undefined) {
    if (typeof quotaBytes !== 'number' || !Number.isSafeInteger(quotaBytes) || quotaBytes < 1024 ** 2 || quotaBytes > 1024 ** 5) return fail('Choose a storage limit from 1 MiB to 1 PiB. Unlimited mailboxes are not created here.');
  }
  if (action === 'create' || password !== undefined) {
    if (typeof password !== 'string' || password.length < 12 || password.length > 256 || /[\x00-\x1f\x7f]/.test(password)) return fail('Use a password from 12 to 256 characters.');
  }
  if (['disable', 'enable', 'delete'].includes(String(action)) && Object.keys(body).some(k => k !== 'action' && k !== 'id')) return fail('Unexpected fields for this action.');
  if (action === 'update' && displayName === undefined && quotaBytes === undefined && password === undefined) return fail('Choose a change to save.');
  return { action, id, email: typeof email === 'string' ? email.toLowerCase() : undefined, displayName: typeof displayName === 'string' ? displayName.trim() : undefined, quotaBytes, password } as MailboxInput;
}
function emptyMap(value: unknown): boolean { return isObject(value) && Object.keys(value).length === 0; }
function disabled(account: Account): boolean {
  const p = account.permissions;
  return p?.['@type'] === 'Replace' && emptyMap(p.enabledPermissions) && emptyMap(p.disabledPermissions);
}
export function isEmployeeAccount(account: Obj): boolean {
  const p = account.permissions as Obj | undefined;
  return account['@type'] === 'User' && (account.roles as Obj)?.['@type'] === 'User'
    && (!account.memberGroupIds || emptyMap(account.memberGroupIds))
    && (!p || p['@type'] === 'Inherit' || disabled(account as Account));
}
export class MailboxManager {
  private accountId = '';
  private domains: Domain[] = [];
  constructor(private creds: StalwartCredentials, private allowed: string[], private upstream = fetchJmapServer) {}
  private async request(path: string, body?: Obj): Promise<Obj> {
    const res = await this.upstream(`${this.creds.serverUrl.replace(/\/+$/, '')}${path}`, {
      method: body ? 'POST' : 'GET', headers: { Authorization: this.creds.authHeader, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(15_000),
    }, true);
    if (!res.ok) throw new MailboxAdminError(res.status === 401 || res.status === 403 ? 403 : 502, 'upstream_failed', 'The mail server refused the request. Sign in with a Stalwart super-admin account.');
    return res.json();
  }
  private async call(method: string, args: Obj): Promise<Obj> {
    const response = await this.request('/jmap/', { using: ['urn:ietf:params:jmap:core', 'urn:stalwart:jmap'], methodCalls: [[method, { accountId: this.accountId, ...args }, 'mailboxes']] });
    const first = (response.methodResponses as [string, Obj, string][] | undefined)?.[0];
    if (first?.[0] === 'error' && first[1].type === 'unknownMethod') throw new MailboxAdminError(501, 'unsupported_server', 'Employee mailbox management requires Stalwart 1.1 or newer.');
    if (!first || first[0] !== method) throw new MailboxAdminError(403, 'permission_denied', 'This operation requires Stalwart super-admin permission.');
    const result = first[1];
    if (['notCreated', 'notUpdated', 'notDestroyed'].some(k => isObject(result[k]) && Object.keys(result[k]).length)) {
      throw new MailboxAdminError(409, 'mailbox_change_failed', 'The mail server could not save this change. Check the address, available storage and permissions, then refresh and retry.');
    }
    return result;
  }
  /** A fresh authoritative permission probe on every HTTP request, including mutations. */
  async authorize(): Promise<void> {
    if (!this.creds.trusted) throw new MailboxAdminError(403, 'untrusted_server', 'Mailbox administration is only available on an operator-configured mail server.');
    if (!this.allowed.length) throw new MailboxAdminError(403, 'not_configured', 'The server operator must configure MAILBOX_ADMIN_DOMAINS before mailbox administration is enabled.');
    const session = await this.request('/jmap/session');
    const primary = session.primaryAccounts as Record<string, string> | undefined;
    this.accountId = primary?.['urn:stalwart:jmap'] ?? primary?.['urn:ietf:params:jmap:mail'] ?? '';
    if (!this.accountId) throw new MailboxAdminError(403, 'permission_denied', 'Sign in with a Stalwart super-admin account.');
    await this.call('x:Tenant/query', { limit: 1 });
    const d = await this.call('x:Domain/get', {});
    this.domains = (d.list as Domain[] ?? []).filter(x => this.allowed.includes(x.name.toLowerCase()));
  }
  private async accounts(): Promise<Account[]> {
    const rows: Account[] = [];
    for (let position = 0; position < 10000; position += 100) {
      const q = await this.call('x:Account/query', { position, limit: 100 });
      const ids = q.ids as string[] ?? [];
      if (!ids.length) return rows;
      const got = await this.call('x:Account/get', { ids });
      rows.push(...((got.list as Account[] ?? []).filter(a => this.domains.some(d => d.id === a.domainId) && isEmployeeAccount(a))));
      if (ids.length < 100) return rows;
    }
    throw new MailboxAdminError(422, 'too_many_accounts', 'This mail server has too many accounts for this panel. Use the Stalwart administration console.');
  }
  async list(): Promise<{ domains: string[]; mailboxes: MailboxRow[] }> {
    return { domains: this.domains.map(d => d.name), mailboxes: (await this.accounts()).map(a => ({
      id: a.id, email: `${a.name}@${this.domains.find(d => d.id === a.domainId)!.name}`, displayName: String(a.description ?? ''), quotaBytes: Number(a.quotas?.maxDiskQuota ?? 0), disabled: disabled(a),
    })) };
  }
  async mutate(input: MailboxInput): Promise<{ id: string; email?: string }> {
    if (input.action === 'create') {
      const [name, domain] = input.email!.split('@');
      const target = this.domains.find(d => d.name.toLowerCase() === domain);
      if (!target) throw new MailboxAdminError(403, 'domain_not_allowed', 'Choose one of the configured employee email domains.');
      const result = await this.call('x:Account/set', { create: { employee: {
        '@type': 'User', name, domainId: target.id, description: input.displayName ?? '', roles: { '@type': 'User' }, permissions: { '@type': 'Inherit' },
        credentials: { '0': { '@type': 'Password', secret: input.password } }, quotas: { maxDiskQuota: input.quotaBytes },
      } } });
      const created = (result.created as Record<string, { id: string }> | undefined)?.employee;
      if (!created?.id) throw new MailboxAdminError(502, 'invalid_response', 'The mail server did not return the created mailbox. Refresh before retrying.');
      return { id: created.id, email: input.email };
    }
    const got = await this.call('x:Account/get', { ids: [input.id] });
    const target = (got.list as Account[] ?? []).find(a => a.id === input.id);
    if (!target || target.id === this.accountId || !isEmployeeAccount(target) || !this.domains.some(d => d.id === target.domainId)) throw new MailboxAdminError(403, 'protected_account', 'Only ordinary employee mailboxes in the configured domains can be changed here. Administrator accounts are protected.');
    if (input.action === 'delete') {
      const result = await this.call('x:Account/set', { destroy: [target.id] });
      if (!Array.isArray(result.destroyed) || !result.destroyed.includes(target.id)) throw new MailboxAdminError(502, 'invalid_response', 'The server did not confirm deletion. Refresh before retrying.');
    }
    else {
      const patch: Obj = {};
      if (input.action === 'disable') patch.permissions = { '@type': 'Replace', enabledPermissions: {}, disabledPermissions: {} };
      else if (input.action === 'enable') patch.permissions = { '@type': 'Inherit' };
      else {
        if (input.displayName !== undefined) patch.description = input.displayName;
        if (input.quotaBytes !== undefined) patch['quotas/maxDiskQuota'] = input.quotaBytes;
        if (input.password !== undefined) {
          const credentials = target.credentials;
          const passwords = isObject(credentials) ? Object.entries(credentials).filter(([, c]) => isObject(c) && c['@type'] === 'Password') : [];
          if (passwords.length !== 1) throw new MailboxAdminError(409, 'password_not_available', 'This account does not have one primary password. Manage its credentials in Stalwart.');
          const key = passwords[0][0].replace(/~/g, '~0').replace(/\//g, '~1');
          patch[`credentials/${key}/secret`] = input.password;
        }
      }
      const result = await this.call('x:Account/set', { update: { [target.id]: patch } });
      if (!isObject(result.updated) || !Object.hasOwn(result.updated, target.id)) throw new MailboxAdminError(502, 'invalid_response', 'The server did not confirm this update. Refresh before retrying.');
    }
    return { id: target.id };
  }
}
