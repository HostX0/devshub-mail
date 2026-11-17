// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/admin/config-manager', () => ({ configManager: { get: (_key: string, fallback: unknown) => fallback } }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it('uses the operator long remembered window while keeping unticked sign-ins browser-scoped', async () => {
  vi.stubEnv('SESSION_REMEMBER_DAYS', '400'); vi.resetModules();
  const { getSignInCookieOptions } = await import('@/lib/oauth/cookie-config');
  expect(getSignInCookieOptions(true)).toMatchObject({ maxAge: 400 * 24 * 60 * 60 });
  expect(getSignInCookieOptions(false)).not.toHaveProperty('maxAge');
});
