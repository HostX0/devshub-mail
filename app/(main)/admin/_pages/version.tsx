'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ExternalLink,
} from '@/components/icons';
import { SettingsSection, SettingItem } from '@/components/settings/settings-section';
import { Button } from '@/components/ui/button';
import { AdminPageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/admin/empty-state';
import { AdminBodySkeleton } from '@/components/boot-skeleton/admin-skeleton';
import { Badge, type BadgeTone } from '@/components/admin/badge';
import { useAdminFeedback } from '@/components/admin/feedback';
import { useAdminI18n } from '@/components/admin/use-admin-i18n';
import { adminPageDef } from '@/lib/admin/admin-nav';
import { apiFetch } from '@/lib/browser-navigation';
import { PROJECT_REPOSITORY, PROJECT_RELEASES_API, PROJECT_URL } from '@/lib/company-project';
import type { UpdateStatus, UpdateSeverity } from '@/lib/version-check/types';

interface VersionAdminStatus {
  current: string;
  build: string;
  endpoint: string;
  defaultEndpoint: string;
  disabledByEnv: boolean;
  disabledByNoThirdPartyTraffic?: boolean;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  nextScheduledAt: string | null;
  status: UpdateStatus | null;
}

const PAGE = adminPageDef('version');

type Translate = (english: string, arabic: string) => string;
function timeAgo(iso: string | null, t: Translate, locale: string): string {
  if (!iso) return t('Never', 'لم يحدث بعد');
  const elapsed = Date.now() - new Date(iso).getTime();
  if (elapsed < 0) return new Date(iso).toLocaleString(locale);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return t('Just now', 'الآن');
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (minutes < 60) return relative.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return relative.format(-hours, 'hour');
  return relative.format(-Math.floor(hours / 24), 'day');
}

function severityChip(severity: UpdateSeverity, t: Translate): { label: string; tone: BadgeTone; Icon: typeof CheckCircle2 } {
  switch (severity) {
    case 'security':
      return { label: t('Security update', 'تحديث أمني'), tone: 'danger', Icon: ShieldAlert };
    case 'deprecated':
      return { label: t('Deprecated', 'إصدار قديم'), tone: 'danger', Icon: ShieldAlert };
    case 'normal':
      return { label: t('Update available', 'يتوفر تحديث'), tone: 'warning', Icon: AlertTriangle };
    case 'unknown':
      return { label: t('Unknown', 'غير معروف'), tone: 'muted', Icon: AlertTriangle };
    case 'none':
    default:
      return { label: t('Up to date', 'محدّث'), tone: 'success', Icon: CheckCircle2 };
  }
}

export function VersionPage() {
  const { t, isArabic } = useAdminI18n();
  const dateLocale = isArabic ? 'ar-u-nu-latn' : 'en-US';
  const [data, setData] = useState<VersionAdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const setMessage = useAdminFeedback();

  async function refresh(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch('/api/admin/version');
      if (!r.ok) throw new Error('failed to load');
      setData((await r.json()) as VersionAdminStatus);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function checkNow(): Promise<void> {
    setChecking(true);
    setMessage(null);
    try {
      const r = await apiFetch('/api/admin/version', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'check-now' }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      setMessage(j.ok
        ? { type: 'success', text: t('Update check completed.', 'اكتمل التحقق من التحديثات.') }
        : { type: 'error', text: t('Could not check for updates. Try again.', 'تعذّر التحقق من التحديثات. حاول مجدداً.') });
      await refresh();
    } catch {
      setMessage({ type: 'error', text: t('Could not connect. Try again.', 'تعذّر الاتصال. حاول مجدداً.') });
    } finally {
      setChecking(false);
    }
  }

  const header = (
    <AdminPageHeader
      title={PAGE.label}
      description={PAGE.description}
      actions={(
        <Button type="button" size="sm" className="gap-2" disabled={checking || loading} onClick={() => void checkNow()}>
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {t('Check now', 'تحقّق الآن')}
        </Button>
      )}
    />
  );

  if (!loading && !data) {
    return (
      <div>
        {header}
        <EmptyState
          title={t('Could not load the update status', 'تعذّر تحميل حالة التحديث')}
          action={<Button type="button" size="sm" onClick={() => void refresh()}>{t('Retry', 'إعادة المحاولة')}</Button>}
        />
      </div>
    );
  }

  // A refresh after a check keeps the page, and with it the scroll position.
  if (!data) {
    return (
      <div>
        {header}
        <AdminBodySkeleton status={t('Loading', 'جارٍ التحميل')} />
      </div>
    );
  }

  const status = data.status;
  const chip = severityChip(status?.severity ?? 'none', t);
  const ChipIcon = chip.Icon;
  const releaseUrl = status?.url ?? null;
  const newer = status?.updateAvailable ? status.latest : null;
  const companyChannel = data.endpoint === PROJECT_RELEASES_API;

  return (
    <div>
      {header}


      <div className="space-y-10">
        <SettingsSection id="status" title={t('Status', 'الحالة')}>
          <SettingItem label={t('Severity', 'أهمية التحديث')}>
            <Badge tone={chip.tone} icon={<ChipIcon className="h-3 w-3" />}>{chip.label}</Badge>
          </SettingItem>
          <SettingItem label={t('Running', 'الإصدار الحالي')} description={data.build !== 'unknown' ? t(`Build ${data.build}`, `رقم البناء ${data.build}`) : undefined}>
            <span className="text-sm font-mono text-foreground">{data.current}</span>
          </SettingItem>
          {companyChannel && status && !status.latest && (
            <SettingItem label={t('Latest release', 'أحدث إصدار')}>
              <span className="text-sm">{t('No release has been published in the project repository yet.', 'لم يُنشر أي إصدار في مستودع المشروع حتى الآن.')}</span>
            </SettingItem>
          )}
          {newer && (
            <SettingItem label={t('Latest release', 'أحدث إصدار')}>
              {releaseUrl ? (
                <a
                  href={releaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-mono text-foreground hover:underline"
                >
                  {newer} <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-sm font-mono text-foreground">{newer}</span>
              )}
            </SettingItem>
          )}
          {status?.advisory && (
            <SettingItem label={t('Advisory', 'تنبيه')}>
              <span className="text-sm font-mono text-red-600 dark:text-red-400">{status.advisory}</span>
            </SettingItem>
          )}
        </SettingsSection>

        <SettingsSection id="schedule" title={t('Schedule', 'الجدول الزمني')} description={t('Hourly polling with ±5 minute jitter.', 'تحقق كل ساعة، مع فارق توقيت يصل إلى 5 دقائق.')}>
          <SettingItem label={t('Last checked', 'آخر تحقق')}>
            <span className="text-sm text-foreground">{timeAgo(data.lastCheckedAt, t, dateLocale)}</span>
          </SettingItem>
          <SettingItem label={t('Last success', 'آخر تحقق ناجح')}>
            <span className="text-sm text-foreground">{timeAgo(data.lastSuccessAt, t, dateLocale)}</span>
          </SettingItem>
          <SettingItem label={t('Next scheduled', 'التحقق القادم')}>
            <span className="text-sm text-foreground">{timeAgo(data.nextScheduledAt, t, dateLocale)}</span>
          </SettingItem>
          {status?.checkedAt && (
            <SettingItem label={t('Server timestamp', 'وقت تحديث الخادم')} description={t('When the server last refreshed its release list.', 'وقت آخر تحديث لقائمة الإصدارات على الخادم.')}>
              <span className="text-sm text-foreground">{new Date(status.checkedAt).toLocaleString(dateLocale)}</span>
            </SettingItem>
          )}
        </SettingsSection>

        <SettingsSection
          id="source"
          title={t('Source', 'المصدر')}
          description={t('Checks for a published update every hour.', 'يتحقق كل ساعة من وجود إصدار منشور أحدث.')}
        >
          <SettingItem
            label={companyChannel ? t('Project repository', 'مستودع المشروع') : t('Endpoint', 'عنوان الخدمة')}
            description={companyChannel ? t('Updates come from published DevsHub Mail releases.', 'مصدر التحديثات هو الإصدارات المنشورة في مستودع DevsHub Mail.') : data.endpoint}
          >
            <a
              href={companyChannel ? PROJECT_URL : data.endpoint}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-foreground hover:underline break-all"
            >
              {companyChannel ? PROJECT_REPOSITORY : data.endpoint} <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </SettingItem>
          <SettingItem label={t('Disabled by env', 'معطّل من إعدادات البيئة')} description={t('Set BULWARK_UPDATE_CHECK=off to disable.', 'استخدم الإعداد BULWARK_UPDATE_CHECK=off لتعطيل التحقق.')}>
            <span className={`text-sm font-medium ${data.disabledByEnv ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
              {data.disabledByEnv ? t('Yes', 'نعم') : t('No', 'لا')}
            </span>
          </SettingItem>
          {data.disabledByNoThirdPartyTraffic && (
            <SettingItem label={t('Off: no third-party traffic', 'معطّل بسبب منع الاتصالات الخارجية')} description={t('NO_THIRD_PARTY_TRAFFIC is on, so this server never asks the version endpoint. See Users > Security.', 'منع الاتصالات الخارجية مفعّل، لذلك لا يتصل الخادم بخدمة الإصدارات. راجع المستخدمون ← الأمان.')}>
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{t('Yes', 'نعم')}</span>
            </SettingItem>
          )}
        </SettingsSection>
      </div>
    </div>
  );
}
