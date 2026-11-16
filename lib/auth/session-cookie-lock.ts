/** Cookie writes and logout share one exclusive browser-origin lock per slot.
 * Never fail open after a lock error. Slot order is stable for logout-all.
 */
interface SessionLocks {
  request<T>(name: string, options: { signal?: AbortSignal }, work: (lock: unknown) => T | Promise<T>): Promise<T>;
}
function manager(): SessionLocks | null {
  const locks = typeof navigator !== 'undefined' ? (navigator as { locks?: SessionLocks }).locks : undefined;
  return locks && typeof locks.request === 'function' ? locks : null;
}
export const sessionCookieLockName = (slot: number): string => `devshub-session-cookie:${slot}`;
export function hasSessionCookieLocks(): boolean { return manager() !== null; }
export async function withSessionCookieLocks<T>(slots: readonly number[], work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const locks = manager();
  // Legacy sign-in/restore keeps working without Web Locks. New rolling
  // renewal is separately disabled by hasSessionCookieLocks().
  if (!locks) return work();
  const ordered = [...new Set(slots)].sort((a, b) => a - b);
  const next = (index: number): Promise<T> => index === ordered.length ? work()
    : locks.request(sessionCookieLockName(ordered[index]), { ...(signal ? { signal } : {}) }, () => next(index + 1));
  return next(0);
}
const generationKey = (slot: number) => `devshub-session-generation:${slot}`;
export function sessionCookieGeneration(slot: number): string {
  try { return localStorage.getItem(generationKey(slot)) ?? ''; } catch { return ''; }
}
export function revokeQueuedSessionWrites(slots: readonly number[]): void {
  for (const slot of slots) {
    try { localStorage.setItem(generationKey(slot), crypto.randomUUID()); } catch { /* Web Lock ordering still protects in-flight responses. */ }
  }
}
