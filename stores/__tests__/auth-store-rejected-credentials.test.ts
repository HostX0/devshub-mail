import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createConfig } from '@/lib/__tests__/fixtures/config';

const state = vi.hoisted(() => ({
  connectError: null as Error | null,
  rejected: null as ((reason: 'credentials' | 'server_blocked') => void) | null,
}));

vi.mock('@/lib/jmap/client', () => {
  class JMAPClient {
    constructor(public serverUrl: string, public username: string) {}
    async connect() { if (state.connectError) throw state.connectError; }
    getSessionUsername() { return this.username; }
    getUsername() { return this.username; }
    async getIdentities() { return [{ id: 'a', email: this.username, name: this.username, mayDelete: false }]; }
    getAuthHeader() { return 'Basic eA=='; }
    onConnectionChange() {}
    onAuthenticationRequired(callback: typeof state.rejected) { state.rejected = callback; }
    onRateLimit() {}
    getRateLimitRemainingMs() { return 0; }
    supportsContacts() { return false; }
    supportsPrincipals() { return false; }
    supportsVacationResponse() { return false; }
    supportsCalendars() { return false; }
    supportsSieve() { return false; }
    disconnect() {}
    getAccountId() { return 'acct'; }
  }
  class RateLimitError extends Error {
    constructor(public retryAfterMs: number) { super('Rate limited by server'); }
  }
  class RequestTimeoutError extends Error {}
  return { JMAPClient, RateLimitError, RequestTimeoutError };
});
vi.mock('@/lib/stalwart/principal', () => ({ fetchPrincipalDisplayName: async () => null }));

import { RateLimitError } from '@/lib/jmap/client';
import * as nav from '@/lib/browser-navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useAccountStore } from '@/stores/account-store';

const SERVER = 'https://mail.example.com';
const fetchMock = vi.fn(async (input: unknown) => {
  const url = String(input);
  if (url === '/api/auth/verify') return new Response('{"result":"ok"}');
  if (url.includes('/api/config')) return new Response(JSON.stringify(createConfig()));
  return new Response('{}');
});

beforeEach(() => {
  state.connectError = null;
  state.rejected = null;
  sessionStorage.clear();
  localStorage.clear();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(nav, 'replaceWindowLocation').mockImplementation(() => {});
  useAccountStore.setState({ accounts: [], activeAccountId: null, defaultAccountId: null });
  useAuthStore.setState({ isAuthenticated: false, client: null, activeAccountId: null, error: null, isRateLimited: false, rateLimitUntil: null });
});

afterEach(async () => {
  await useAuthStore.getState().logout({ endProviderSession: false });
  vi.restoreAllMocks();
});

it('keeps the retry deadline on the sign-in form and sends no attempts before it', async () => {
  state.connectError = new RateLimitError(900_000);
  const before = Date.now();
  expect(await useAuthStore.getState().login(SERVER, 'bob@example.com', 'pw')).toBe(false);
  expect(useAuthStore.getState()).toMatchObject({ isRateLimited: true, error: 'rate_limited' });
  expect(useAuthStore.getState().rateLimitUntil).toBeGreaterThanOrEqual(before + 900_000);
  fetchMock.mockClear();
  expect(await useAuthStore.getState().login(SERVER, 'bob@example.com', 'corrected')).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('requires sign-in after revoked credentials instead of leaving reconnecting active', async () => {
  expect(await useAuthStore.getState().login(SERVER, 'bob@example.com', 'pw')).toBe(true);
  state.rejected?.('credentials');
  await vi.waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false));
  expect(sessionStorage.getItem('session_expired')).toBe('true');
  expect(useAuthStore.getState().connectionLost).toBe(false);
});

it('shows a server refusal without falsely claiming a password or CORS problem', async () => {
  state.connectError = new Error('SERVER_BLOCKED');
  expect(await useAuthStore.getState().login(SERVER, 'bob@example.com', 'pw')).toBe(false);
  expect(useAuthStore.getState()).toMatchObject({ error: 'server_blocked', isRateLimited: false });
});

it('ignores a replaced client rejecting credentials after a new sign-in', async () => {
  expect(await useAuthStore.getState().login(SERVER, 'bob@example.com', 'old')).toBe(true);
  const oldRejected = state.rejected;
  expect(await useAuthStore.getState().login(SERVER, 'bob@example.com', 'new')).toBe(true);
  oldRejected?.('credentials');
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
  expect(sessionStorage.getItem('session_expired')).toBeNull();
});
