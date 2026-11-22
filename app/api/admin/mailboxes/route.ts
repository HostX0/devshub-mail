import { NextRequest, NextResponse } from 'next/server';
import { getStalwartCredentials } from '@/lib/stalwart/credentials';
import { allowedMailboxDomains, MailboxAdminError, MailboxManager, validateMailboxInput } from '@/lib/stalwart/mailbox-management';
import { rejectCrossOriginRequest } from '@/lib/security/same-origin';
import { getStalwartAdminAccessMode } from '@/lib/admin/stalwart-admin-access';
import { auditLog } from '@/lib/admin/audit';
import { configManager } from '@/lib/admin/config-manager';
import { grantsAdminAccess, parseJmapServers } from '@/lib/admin/jmap-servers';
import { rejectNonJsonBody } from '@/app/api/auth/json-request';
import { requireAdminAuth, getClientIP } from '@/lib/admin/session';
import { readMailboxAdminServiceCredentials } from '@/lib/stalwart/mailbox-admin-service-credentials';
async function manager(request: NextRequest) {
  const mode = await getStalwartAdminAccessMode();
  if (mode === 'off') throw new MailboxAdminError(403, 'disabled', 'Stalwart administration is disabled by the server operator.');
  let separateAdmin = false;
  if (mode === 'password') {
    const admin = await requireAdminAuth(request);
    if ('error' in admin) throw new MailboxAdminError(401, 'admin_sign_in_required', 'Sign in to the webmail administrator dashboard first.');
    separateAdmin = true;
  }
  let creds = mode === 'password' && process.env.STALWART_MAILBOX_ADMIN_CREDENTIALS_FILE
    ? await readMailboxAdminServiceCredentials() : await getStalwartCredentials(request);
  let serviceCredentials = mode === 'password' && !!process.env.STALWART_MAILBOX_ADMIN_CREDENTIALS_FILE;
  if (!creds && process.env.STALWART_MAILBOX_ADMIN_CREDENTIALS_FILE) {
    if (!separateAdmin) {
      const admin = await requireAdminAuth(request);
      if ('error' in admin) throw new MailboxAdminError(401, 'admin_sign_in_required', 'Sign in to the webmail administrator dashboard first.');
    }
    creds = await readMailboxAdminServiceCredentials();
    serviceCredentials = true;
  }
  if (!creds) throw new MailboxAdminError(401, 'sign_in_required', 'Sign in to your Stalwart super-admin mailbox, or ask the server operator to enable independent mailbox administration.');
  await configManager.ensureLoaded();
  // A configured secondary JMAP server can be another organisation's service.
  // Its superuser is not this webmail's administrator without operator opt-in.
  const primary = configManager.get<string>('jmapServerUrl', '') || process.env.JMAP_SERVER_URL || process.env.NEXT_PUBLIC_JMAP_SERVER_URL || '';
  const servers = parseJmapServers(configManager.get<unknown>('jmapServers', []));
  if (configManager.get<boolean>('allowCustomJmapEndpoint', false) || !grantsAdminAccess(creds.serverUrl, primary, servers)) {
    throw new MailboxAdminError(403, 'admin_server_not_allowed', 'This mail server is not authorised to administer this webmail.');
  }
  const m = new MailboxManager(creds, allowedMailboxDomains());
  await m.authorize();
  return { m, actor: serviceCredentials ? 'webmail-administrator' : creds.accountName };
}
function errorResponse(error: unknown) {
  const e = error instanceof MailboxAdminError ? error : new MailboxAdminError(502, 'server_unavailable', 'The mail server could not be reached. Refresh and retry.');
  return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: { 'Cache-Control': 'no-store' } });
}
export async function GET(request: NextRequest) {
  try {
    const { m } = await manager(request);
    return NextResponse.json(await m.list(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  const rejected = rejectCrossOriginRequest(request);
  if (rejected) return rejected;
  const nonJson = rejectNonJsonBody(request);
  if (nonJson) return nonJson;
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 8192) throw new MailboxAdminError(413, 'too_large', 'Mailbox request is too large.');
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) { await reader.cancel(); throw new MailboxAdminError(413, 'too_large', 'Mailbox request is too large.'); }
        chunks.push(value);
      }
    }
    const body = Buffer.concat(chunks).toString('utf8');
    let data: unknown;
    try { data = JSON.parse(body); } catch { throw new MailboxAdminError(400, 'invalid_input', 'Enter a valid mailbox request.'); }
    const input = validateMailboxInput(data);
    const { m, actor } = await manager(request);
    const result = await m.mutate(input);
    await auditLog(`mailbox.${input.action}`, { actor, id: result.id, ...(result.email ? { email: result.email } : {}), ...(input.quotaBytes !== undefined ? { quotaBytes: input.quotaBytes } : {}), passwordChanged: input.password !== undefined }, getClientIP(request));
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
