import { PROJECT_RELEASES_API, PROJECT_URL } from '@/lib/company-project';
import { compareVersions } from '@/lib/version-compare';
import { logger } from '@/lib/logger';
import type { UpdateStatus, UpdateSeverity } from './types';

const SEVERITIES: ReadonlySet<UpdateSeverity> = new Set([
  'normal', 'security', 'deprecated', 'none', 'unknown',
]);

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

// Validate the response from the version server before we trust it. Returns
// null on any malformed field so a hostile or buggy upstream can't poison the
// UI with arbitrary strings (the URL, in particular, is rendered in <a href>).
export function parseStatus(raw: unknown): UpdateStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.schema !== 1) return null;
  if (!isString(r.current)) return null;
  if (!isNullableString(r.latest)) return null;
  if (typeof r.updateAvailable !== 'boolean') return null;
  if (!isString(r.severity) || !SEVERITIES.has(r.severity as UpdateSeverity)) return null;
  if (!isNullableString(r.url)) return null;
  if (!isNullableString(r.advisory)) return null;
  if (!isString(r.checkedAt)) return null;

  // Only http(s) URLs are renderable; reject anything else so we don't end
  // up with a javascript: link in the banner.
  if (r.url && !/^https?:\/\//i.test(r.url)) return null;

  return {
    schema: 1,
    current: r.current,
    latest: r.latest,
    updateAvailable: r.updateAvailable,
    severity: r.severity as UpdateSeverity,
    url: r.url,
    advisory: r.advisory,
    checkedAt: r.checkedAt,
  };
}

export async function fetchStatus(
  endpoint: string,
  currentVersion: string,
): Promise<{ ok: true; status: UpdateStatus } | { ok: false; error: string }> {
  if (!endpoint) return { ok: false, error: 'endpoint blank' };
  if (!currentVersion) return { ok: false, error: 'current version blank' };

  // Build the URL safely - never inject the version as a raw path component.
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { ok: false, error: 'endpoint not a URL' };
  }
  const projectReleases = url.href === PROJECT_RELEASES_API;
  if (!projectReleases) url.searchParams.set('v', currentVersion);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const body: unknown = await res.json();
    if (projectReleases) {
      if (!Array.isArray(body)) return { ok: false, error: 'malformed releases list' };
      const releases = body.filter(release => release && !release.draft && !release.prerelease
        && typeof release.tag_name === 'string' && /^v?\d+\.\d+\.\d+$/.test(release.tag_name));
      releases.sort((a, b) => compareVersions(b.tag_name, a.tag_name));
      const tag = releases[0]?.tag_name as string | undefined;
      const latest = tag?.replace(/^v/, '') ?? null;
      const updateAvailable = latest !== null && compareVersions(latest, currentVersion) > 0;
      return { ok: true, status: {
        schema: 1, current: currentVersion, latest, updateAvailable,
        severity: updateAvailable ? 'normal' : 'none',
        url: tag ? `${PROJECT_URL}/releases/tag/${encodeURIComponent(tag)}` : null,
        advisory: null, checkedAt: new Date().toISOString(),
      } };
    }
    const parsed = parseStatus(body);
    if (!parsed) return { ok: false, error: 'malformed response' };
    return { ok: true, status: parsed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('version-check: fetch failed', { error: msg });
    return { ok: false, error: msg };
  }
}
