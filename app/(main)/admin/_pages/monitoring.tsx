'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/browser-navigation';
import { adminPageDef } from '@/lib/admin/admin-nav';
import { useAdminUnsavedChanges } from '@/stores/admin-unsaved-store';
import { SettingsSection, SectionNav } from '@/components/settings/settings-section';
import { AdminPageHeader } from '@/components/admin/page-header';
import { AdminBodySkeleton } from '@/components/boot-skeleton/admin-skeleton';
import { AdminSaveBar } from '@/components/admin/save-bar';
import { withEdit } from '@/lib/admin/edits';
import { useAdminFeedback } from '@/components/admin/feedback';
import { useAdminI18n } from '@/components/admin/use-admin-i18n';
import { ConfigTextItem, ConfigNote } from '@/components/admin/config-items';

interface ConfigEntry {
  value?: unknown;
  source: 'admin' | 'env' | 'default';
}

interface ErrorEntry {
  fingerprint: string;
  name: string;
  code?: string;
  version: string;
  runtime: 'browser' | 'server';
  count: number;
  frames: Array<{ path: string; line?: number; column?: number }>;
}

interface MonitoringState {
  collecting: boolean;
  day: string;
  errorsToday: { total: number; top: ErrorEntry[] };
  metrics?: { enabled: boolean };
  tracing?: { configured: boolean; active: boolean; endpointHost: string | null };
}

const PAGE = adminPageDef('monitoring');
const KEYS = ['errorReportingDsn', 'errorReportingSampleRate', 'errorReportingEnvironment'] as const;
const DOCS = 'https://bulwarkmail.org/docs/deployment/monitoring';

export function MonitoringPage() {
  const { t } = useAdminI18n();
  const [config, setConfig] = useState<Record<string, ConfigEntry>>({});
  const [state, setState] = useState<MonitoringState | null>(null);
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const setMessage = useAdminFeedback();

  const load = useCallback(async () => {
    try {
      const [configRes, stateRes] = await Promise.all([apiFetch('/api/admin/config'), apiFetch('/api/admin/monitoring')]);
      if (configRes.ok) setConfig(await configRes.json());
      if (stateRes.ok) setState(await stateRes.json());
      if (!configRes.ok || !stateRes.ok) throw new Error();
    } catch {
      setMessage({ type: 'error', text: t('Could not load the settings', 'تعذّر تحميل الإعدادات') });
    }
    setLoading(false);
  }, [setMessage, t]);

  useEffect(() => { void load(); }, [load]);

  function handleChange(key: string, value: unknown) {
    setEdits((prev) => withEdit(prev, key, value, config[key]?.value));
    setMessage(null);
  }

  function currentValue(key: string): string {
    const value = key in edits ? edits[key] : config[key]?.value;
    return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
  }

  async function handleSave() {
    if (Object.keys(edits).length === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edits),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: t('Saved. Browsers pick it up on their next page load.', 'تم الحفظ. تُطبّق الإعدادات عند فتح الصفحة مجدداً.') });
        setEdits({});
        await load();
      } else {
        setMessage({ type: 'error', text: t('Could not save the settings. Try again.', 'تعذّر حفظ الإعدادات. حاول مجدداً.') });
      }
    } catch {
      setMessage({ type: 'error', text: t('Connection failed. Please try again.', 'تعذّر الاتصال. أعد المحاولة.') });
    } finally { setSaving(false); }
  }

  async function handleRevert(key: string) {
    try {
      const res = await apiFetch('/api/admin/config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) throw new Error();
      setEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await load();
    } catch {
      setMessage({ type: 'error', text: t('Could not restore the setting. Try again.', 'تعذّر استعادة الإعداد. حاول مجدداً.') });
    }
  }

  const hasEdits = KEYS.some((key) => key in edits);
  useAdminUnsavedChanges('monitoring', hasEdits);

  if (loading) {
    return (
      <div>
        <AdminPageHeader title={PAGE.label} description={PAGE.description} />
        <AdminBodySkeleton status={t('Loading', 'جارٍ التحميل')} />
      </div>
    );
  }

  const today = state?.errorsToday;

  return (
    <div>
      <AdminPageHeader title={PAGE.label} description={PAGE.description} />
      <div className="space-y-10">
        <SectionNav />

        <SettingsSection id="errors" title={t('Error reporting', 'الإبلاغ عن الأخطاء')}>
          <ConfigNote>
            {t('Send errors from browsers and this server to your error tracker: Bugsink, GlitchTip or Sentry. Disabled while the address is empty. Message text, addresses, file names, tokens and URLs are removed before sending.', 'أرسل أخطاء المتصفحات والخادم إلى خدمة تتبّع الأخطاء الخاصة بك، مثل Bugsink أو GlitchTip أو Sentry. يتوقف الإرسال عندما يكون العنوان فارغاً. تُحذف نصوص الرسائل والعناوين وأسماء الملفات والرموز والروابط قبل الإرسال.')} <a className="underline" href={DOCS} target="_blank" rel="noreferrer">{t('What is sent', 'البيانات المُرسلة')}</a>
          </ConfigNote>
          <ConfigTextItem label={t('Error reporting address (DSN)', 'عنوان الإبلاغ عن الأخطاء')} configKey="errorReportingDsn" value={currentValue('errorReportingDsn')} source={config.errorReportingDsn?.source} onChange={handleChange} onRevert={handleRevert} placeholder="https://<key>@errors.example.com/1" wide />
          <ConfigTextItem label={t('Sample rate', 'نسبة أخذ العيّنات')} configKey="errorReportingSampleRate" value={currentValue('errorReportingSampleRate')} source={config.errorReportingSampleRate?.source} onChange={handleChange} onRevert={handleRevert} placeholder="1" />
          <ConfigTextItem label={t('Environment', 'بيئة التشغيل')} configKey="errorReportingEnvironment" value={currentValue('errorReportingEnvironment')} source={config.errorReportingEnvironment?.source} onChange={handleChange} onRevert={handleRevert} placeholder={t('production', 'مثال: production')} />
        </SettingsSection>

        <SettingsSection id="errors-today" title={t('Errors today', 'أخطاء اليوم')}>
          {!state?.collecting ? (
            <ConfigNote>
              {t('Error counting is off. It starts when an error reporting address is set, metrics are enabled, or error counts are included in usage statistics.', 'احتساب الأخطاء متوقف. يبدأ عند ضبط عنوان الإبلاغ عن الأخطاء، أو تفعيل المؤشرات، أو إرسال أعداد الأخطاء مع إحصاءات الاستخدام.')}
            </ConfigNote>
          ) : !today || today.total === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No errors so far today (UTC).', 'لا توجد أخطاء اليوم حتى الآن، بحسب التوقيت العالمي.')}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t(`${today.total} errors today (UTC), most frequent first.`, `عدد أخطاء اليوم بالتوقيت العالمي: ${today.total}، مرتبة من الأكثر تكراراً.`)}</p>
              <ul className="divide-y divide-border rounded-md border border-border text-sm">
                {today.top.map((entry) => (
                  <li key={entry.fingerprint} className="flex items-start justify-between gap-4 px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-medium">{entry.name}{entry.code ? `: ${entry.code}` : ''}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {entry.frames[0] ? `${entry.frames[0].path}:${entry.frames[0].line ?? ''}:${entry.frames[0].column ?? ''}` : t('no stack', 'لا تتوفر تفاصيل التتبّع')}
                        {' · '}{entry.runtime === 'browser' ? t('Browser', 'المتصفح') : t('Server', 'الخادم')}{' · '}{entry.version}
                      </div>
                    </div>
                    <span className="shrink-0 tabular-nums">{entry.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SettingsSection>

        <SettingsSection id="metrics" title={t('Metrics', 'المؤشرات')}>
          <p className="text-sm">
            {state?.metrics?.enabled
              ? t('Enabled. Prometheus reads /api/metrics on each replica using bearer-token authentication.', 'مفعّل. يقرأ نظام Prometheus المؤشرات من /api/metrics في كل نسخة باستخدام رمز المصادقة.')
              : t('Disabled. Set METRICS_TOKEN or METRICS_TOKEN_FILE in the environment to enable /api/metrics.', 'معطّل. اضبط METRICS_TOKEN أو METRICS_TOKEN_FILE في بيئة التشغيل لتفعيل /api/metrics.')}
          </p>
          <ConfigNote>
            {t('Requests per route group, sign-ins, calls to Stalwart and other services, browser errors, memory and event-loop lag.', 'تشمل المؤشرات الطلبات بحسب مساراتها، وتسجيلات الدخول، والاتصالات بخادم البريد والخدمات الأخرى، وأخطاء المتصفح، والذاكرة، وتأخر معالجة الأحداث.')} <a className="underline" href={`${DOCS}#metrics`} target="_blank" rel="noreferrer">{t('Metric list and collection settings', 'قائمة المؤشرات وإعدادات جمعها')}</a>
          </ConfigNote>
        </SettingsSection>

        <SettingsSection id="health" title={t('Health checks', 'فحوص الجاهزية')}>
          <ul className="space-y-1 text-sm">
            <li><code className="font-mono">/api/health/live</code>: {t('The process responds. For liveness probes and the Docker health check.', 'تستجيب الخدمة. يُستخدم لفحص عمل الخدمة وفحص الحاوية.')}</li>
            <li><code className="font-mono">/api/health/ready</code>: {t('Configuration loaded, data folders writable, mail server reachable. For readiness probes.', 'الإعدادات محمّلة، ومجلدات البيانات قابلة للكتابة، وخادم البريد متاح. يُستخدم لفحص الجاهزية.')}</li>
          </ul>
        </SettingsSection>

        <SettingsSection id="tracing" title={t('Tracing', 'تتبّع الطلبات')}>
          <p className="text-sm">
            {state?.tracing?.active
              ? t(`Enabled. Traces are sent to ${state.tracing.endpointHost ?? 'the OTLP endpoint'} over OTLP/HTTP.`, `مفعّل. تُرسل بيانات التتبّع إلى ${state.tracing.endpointHost ?? 'خدمة التتبّع'} عبر OTLP/HTTP.`)
              : state?.tracing?.configured
                ? t('Configured but not running in this process. Restart the application after setting the OTEL_* variables.', 'تم ضبط التتبّع لكنه غير فعّال في هذه العملية. أعد تشغيل التطبيق بعد ضبط متغيرات OTEL_*.')
                : t('Disabled. Set OTEL_EXPORTER_OTLP_ENDPOINT and the other required OTEL_* variables to send traces.', 'معطّل. اضبط OTEL_EXPORTER_OTLP_ENDPOINT ومتغيرات OTEL_* المطلوبة لإرسال بيانات التتبّع.')}
          </p>
          <ConfigNote>
            {t('Includes application requests and calls to the mail server and other services. The mail server receives the trace context to link its operations. URLs, user agents and addresses are removed.', 'يشمل طلبات التطبيق واتصالات خادم البريد والخدمات الأخرى. يستقبل خادم البريد سياق التتبّع لربط عملياته به. تُحذف الروابط وبيانات المتصفح والعناوين.')} <a className="underline" href={`${DOCS}#tracing`} target="_blank" rel="noreferrer">{t('Setup instructions', 'تعليمات الإعداد')}</a>
          </ConfigNote>
        </SettingsSection>
      </div>

      <AdminSaveBar
        dirty={hasEdits}
        saving={saving}
        onSave={handleSave}
        onDiscard={() => setEdits({})}
        note={t('Browsers apply this on their next page load', 'تُطبّق الإعدادات عند فتح الصفحة مجدداً')}
      />
    </div>
  );
}
