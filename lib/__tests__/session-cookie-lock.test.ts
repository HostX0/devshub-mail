import { afterEach, describe, expect, it } from 'vitest';
import { hasSessionCookieLocks, sessionCookieLockName, withSessionCookieLocks } from '@/lib/auth/session-cookie-lock';
function fakeLocks() {
  const queues = new Map<string, Promise<unknown>>(); const names: string[] = [];
  return { names, request(name: string, options: { signal?: AbortSignal }, work: (lock: unknown) => unknown) {
    names.push(name); const previous = queues.get(name) ?? Promise.resolve();
    const run = previous.catch(() => {}).then(() => {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return work({ name });
    });
    queues.set(name, run.catch(() => {})); return run;
  } };
}
const setLocks = (value: unknown) => Object.defineProperty(navigator, 'locks', { value, configurable: true });
afterEach(() => setLocks(undefined));
describe('cross-tab cookie write / sign-out ordering', () => {
  it('clears cookies after a late renewal response from another tab', async () => {
    setLocks(fakeLocks()); let cookie: string | undefined = 'remembered'; const order: string[] = [];
    let respond!: () => void;
    const network = new Promise<void>(resolve => { respond = resolve; });
    const tabBRenewal = withSessionCookieLocks([0], async () => { order.push('renew starts'); await network; cookie = 'renewed'; order.push('renew response'); });
    await new Promise(resolve => setTimeout(resolve, 0));
    const tabALogout = withSessionCookieLocks([0], async () => { cookie = undefined; order.push('logout clears'); });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(order).toEqual(['renew starts']); respond(); await Promise.all([tabBRenewal, tabALogout]);
    expect(order).toEqual(['renew starts', 'renew response', 'logout clears']); expect(cookie).toBeUndefined();
  });
  it('a renewal queued after logout reads the cleared cookie and cannot restore it', async () => {
    setLocks(fakeLocks()); let cookie: string | undefined = 'remembered'; let finishLogout!: () => void;
    const deleting = new Promise<void>(resolve => { finishLogout = resolve; });
    const tabALogout = withSessionCookieLocks([0], async () => { await deleting; cookie = undefined; });
    const tabBRenewal = withSessionCookieLocks([0], async () => { if (!cookie) return 401; cookie = 'renewed'; return 200; });
    finishLogout(); await tabALogout; expect(await tabBRenewal).toBe(401); expect(cookie).toBeUndefined();
  });
  it('takes all-slot locks once in ascending order', async () => {
    const locks = fakeLocks(); setLocks(locks);
    await withSessionCookieLocks([2, 0, 1, 2], async () => {});
    expect(locks.names).toEqual([0, 1, 2].map(sessionCookieLockName));
  });
  it('never fails open when the lock manager refuses a write', async () => {
    setLocks({ request: async () => { throw new Error('lock refused'); } }); let written = false;
    await expect(withSessionCookieLocks([0], async () => { written = true; })).rejects.toThrow('lock refused'); expect(written).toBe(false);
  });
  it('detects unsupported browsers so background renewal can be skipped', async () => {
    setLocks(undefined); expect(hasSessionCookieLocks()).toBe(false);
    await expect(withSessionCookieLocks([0], async () => 'ordinary restore')).resolves.toBe('ordinary restore');
  });
});
