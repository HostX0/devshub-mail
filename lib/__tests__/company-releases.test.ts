import { afterEach, expect, it, vi } from 'vitest';
import { PROJECT_RELEASES_API, PROJECT_URL } from '@/lib/company-project';
import { fetchStatus } from '@/lib/version-check/fetcher';

afterEach(() => vi.unstubAllGlobals());

it('shows no update when the project has not published a release', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json([]));
  vi.stubGlobal('fetch', fetcher);
  expect(await fetchStatus(PROJECT_RELEASES_API, '1.21.2')).toMatchObject({
    ok: true, status: { latest: null, updateAvailable: false, url: null },
  });
  expect(fetcher.mock.calls[0][0].href).toBe(PROJECT_RELEASES_API);
});

it('offers only a newer stable company release and builds its own link', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([
    { tag_name: '2.0.0', prerelease: true },
    { tag_name: '4.0.0', draft: true },
    { tag_name: '1.2.0' },
    { tag_name: 'v1.10.0', html_url: 'https://example.org/elsewhere' },
  ])));
  expect(await fetchStatus(PROJECT_RELEASES_API, '1.9.0')).toMatchObject({
    ok: true, status: { latest: '1.10.0', updateAvailable: true, url: PROJECT_URL + '/releases/tag/v1.10.0' },
  });
});
