// Update-status payload returned by the version server. Mirrors
// repos/dashboard/version-server/src/registry.ts LookupResult.

export type UpdateSeverity = 'normal' | 'security' | 'deprecated' | 'none' | 'unknown';

export interface UpdateStatus {
  schema: 1;
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  severity: UpdateSeverity;
  url: string | null;
  advisory: string | null;
  checkedAt: string;
}

export interface VersionCheckStateFile {
  endpoint: string;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  nextScheduledAt: string | null;
  status: UpdateStatus | null;
  /**
   * With a shared store only: the last status per running version, so
   * replicas on two versions during a rolling update each keep their own.
   */
  statuses?: Record<string, UpdateStatus>;
}

export { PROJECT_RELEASES_API as DEFAULT_VERSION_ENDPOINT } from '@/lib/company-project';
