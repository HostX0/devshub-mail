// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chmod, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readMailboxAdminServiceCredentials } from '../mailbox-admin-service-credentials';
let directory: string;
let path: string;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'mailbox-service-')); path = join(directory, 'credentials.json'); vi.stubEnv('STALWART_MAILBOX_ADMIN_CREDENTIALS_FILE', path); });
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
const credentials = { serverUrl: 'https://mail.example.com/', username: 'service@example.com', password: 'private-service-password' };
const save = async (value: unknown) => writeFile(path, JSON.stringify(value), { mode: 0o600 });
describe('private operator mailbox credentials', () => {
  it('is disabled unless explicitly configured', async () => { vi.stubEnv('STALWART_MAILBOX_ADMIN_CREDENTIALS_FILE', ''); expect(await readMailboxAdminServiceCredentials()).toBeNull(); });
  it('loads a private file and derives credentials without a browser session', async () => {
    await save(credentials); const result = await readMailboxAdminServiceCredentials();
    expect(result).toMatchObject({ serverUrl: 'https://mail.example.com', trusted: true, hasSessionCookie: false });
    expect(result?.authHeader).toBe(`Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`);
  });
  it('rejects a group/world-readable file with a sanitized error', async () => {
    await save(credentials); await chmod(path, 0o644);
    await expect(readMailboxAdminServiceCredentials()).rejects.toMatchObject({ status: 503, code: 'service_credentials_unavailable' });
  });
  it('refuses symbolic links', async () => { await save(credentials); const link = join(directory, 'link'); await symlink(path, link); vi.stubEnv('STALWART_MAILBOX_ADMIN_CREDENTIALS_FILE', link); await expect(readMailboxAdminServiceCredentials()).rejects.toMatchObject({ status: 503 }); });
  it.each(['http://mail.example.com', 'https://user:secret@mail.example.com', 'https://mail.example.com/another', 'https://mail.example.com?secret=value'])('refuses an invalid service origin: %s', async serverUrl => { await save({ ...credentials, serverUrl }); await expect(readMailboxAdminServiceCredentials()).rejects.toMatchObject({ status: 503 }); });
  it('never exposes malformed file contents in an error', async () => { await writeFile(path, 'private-service-password invalid-json', { mode: 0o600 }); try { await readMailboxAdminServiceCredentials(); throw new Error('expected failure'); } catch (error) { expect(String(error)).not.toContain('private-service-password'); } });
});
