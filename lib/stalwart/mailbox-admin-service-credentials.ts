import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { StalwartCredentials } from './credentials';
import { MailboxAdminError } from './mailbox-management';

/** Operator opt-in only. Call after verifying the separate administrator session. */
export async function readMailboxAdminServiceCredentials(): Promise<StalwartCredentials | null> {
  const path = process.env.STALWART_MAILBOX_ADMIN_CREDENTIALS_FILE;
  if (!path) return null;
  try {
    if (!isAbsolute(path)) throw new Error('invalid file');
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 8192 || (stat.mode & 0o077) !== 0) throw new Error('invalid file');
      // Read a fixed maximum even if a file grows after stat().
      const bytes = Buffer.alloc(8193);
      const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
      if (bytesRead > 8192) throw new Error('invalid file');
      const value = JSON.parse(bytes.subarray(0, bytesRead).toString('utf8'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid file');
      const { serverUrl, username, password } = value;
      if (typeof serverUrl !== 'string' || typeof username !== 'string' || typeof password !== 'string'
        || !username || username.length > 320 || username.includes(':') || !password || password.length > 4096
        || /[\r\n\0]/.test(username + password)) throw new Error('invalid credentials');
      const url = new URL(serverUrl);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error('invalid server');
      return {
        serverUrl: url.origin, username, accountName: username,
        authHeader: `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`,
        hasSessionCookie: false, slot: 0, trusted: true,
      };
    } finally { await file.close(); }
  } catch {
    throw new MailboxAdminError(503, 'service_credentials_unavailable', 'Mailbox administration credentials are unavailable. Ask the server operator to check the private credentials file.');
  }
}
