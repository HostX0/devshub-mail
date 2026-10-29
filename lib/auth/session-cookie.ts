export const SESSION_COOKIE = 'jmap_session';
const requestedDays = Number(process.env.SESSION_REMEMBER_DAYS ?? 30);
// Browsers cap persistent cookies; refresh the expiry on successful restore.
export const SESSION_COOKIE_MAX_AGE = Math.min(400, Math.max(1,
  Number.isFinite(requestedDays) ? requestedDays : 30)) * 24 * 60 * 60;

/** Get the cookie name for a given account slot. Slot 0 uses the legacy name. */
export function sessionCookieName(slot: number): string {
  return slot === 0 ? SESSION_COOKIE : `${SESSION_COOKIE}_${slot}`;
}
