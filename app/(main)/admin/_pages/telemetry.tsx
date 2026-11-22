'use client';

import { useEffect, useState } from 'react';
import { Loader2, Send, ExternalLink } from '@/components/icons';
import { SettingsSection, SettingItem, ToggleSwitch } from '@/components/settings/settings-section';
import { Button } from '@/components/ui/button';
import { AdminPageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/admin/empty-state';
import { AdminBodySkeleton } from '@/components/boot-skeleton/admin-skeleton';
import { AdminSaveBar } from '@/components/admin/save-bar';
import { useAdminFeedback } from '@/components/admin/feedback';
import { useAdminI18n } from '@/components/admin/use-admin-i18n';
import { ConfigNote, inputClass } from '@/components/admin/config-items';
import { adminPageDef } from '@/lib/admin/admin-nav';
import { apiFetch } from '@/lib/browser-navigation';
import { useAdminUnsavedChanges } from '@/stores/admin-unsaved-store';
import { cn } from '@/lib/utils';

interface TelemetryStatus {
  consent: 'pending' | 'on' | 'off';
  consentSource: 'no-third-party' | 'env' | 'file';
  /** 'on' sends them daily; 'instant' also sends today's as they change. */
  errorsConsent?: ErrorsMode;
  errorsConsentSource?: 'telemetry' | 'no-third-party' | 'env' | 'file';
  endpoint: string;
  defaultEndpoint: string;
  consentedAt: string | null;
  lastSentAt: string | null;
  nextScheduledAt: string | null;
  payloadPreview: Record<string, unknown>;
  errorsPreview?: unknown[];
  instantErrorsPreview?: unknown[];
  accountCounts: { total: number; active7d: number };
}

type ErrorsMode = 'on' | 'off' | 'instant';

const PAGE = adminPageDef('telemetry');

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

/** When the next heartbeat goes out; a time already past means it is due. */
function nextRun(iso: string | null, t: Translate, locale: string): string {
  if (!iso) return '-';
  const at = new Date(iso);
  return at.getTime() <= Date.now() ? t('Due now', 'حان موعد الإرسال') : at.toLocaleString(locale);
}

function failureText(status: number, error: string | undefined, t: Translate): string {
  if (status === 401) return t('Your administrator session has ended. Sign in again.', 'انتهت جلسة الإدارة. سجّل الدخول مجدداً.');
  if (error === 'turn on the heartbeat first') return t('Enable anonymous usage reports first.', 'فعّل تقارير الاستخدام المجهولة أولاً.');
  if (status === 409) return t('These settings are controlled by the server environment. Contact your system administrator.', 'تتحكم إعدادات الخادم بهذه الخيارات. تواصل مع مسؤول النظام.');
  if (error === 'not a URL') return t('not a URL', 'العنوان ليس رابطاً صحيحاً');
  if (status === 400) return t('Check the collector URL and selected settings, then try again.', 'تحقّق من عنوان خدمة جمع البيانات والإعدادات المحددة، ثم حاول مجدداً.');
  return t('The request could not be completed. Try again.', 'تعذّر إكمال الطلب. حاول مجدداً.');
}

export function TelemetryPage() {
  const { t, isArabic } = useAdminI18n();
  const dateLocale = isArabic ? 'ar-u-nu-latn' : 'en-US';
  const [status, setStatus] = useState<TelemetryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [endpointDraft, setEndpointDraft] = useState('');
  const setMessage = useAdminFeedback();
  // The heartbeat switch waits for Save like the endpoint (one page, one
  // save bar).
  const [consentDraft, setConsentDraft] = useState<'on' | 'off' | null>(null);
  const [errorsDraft, setErrorsDraft] = useState<ErrorsMode | null>(null);

  const endpointDirty = status !== null && endpointDraft !== status.endpoint;
  const consentDirty = status !== null && consentDraft !== null && consentDraft !== status.consent;
  const errorsDirty = status !== null && errorsDraft !== null && errorsDraft !== (status.errorsConsent ?? 'off');
  const dirty = endpointDirty || consentDirty || errorsDirty;
  useAdminUnsavedChanges('telemetry', dirty);

  async function refresh(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch('/api/admin/telemetry');
      if (!r.ok) throw new Error('failed to load');
      const data = (await r.json()) as TelemetryStatus;
      setStatus(data);
      setEndpointDraft(data.endpoint);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  /** Sends one change; returns the error text, or null. */
  async function post(body: Record<string, unknown>): Promise<string | null> {
    const r = await apiFetch('/api/admin/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) return null;
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    return failureText(r.status, j.error, t);
  }

  async function save(): Promise<void> {
    setBusy('save');
    setMessage(null);
    try {
      const errors: string[] = [];
      if (consentDirty && consentDraft) {
        const error = await post({ action: 'set-consent', consent: consentDraft });
        if (error) errors.push(t(`Usage reports: ${error}`, `تقارير الاستخدام: ${error}`));
      }
      // After the heartbeat switch: error counts need it on.
      if (errorsDirty && errorsDraft) {
        const error = await post({ action: 'set-errors-consent', consent: errorsDraft });
        if (error) errors.push(t(`Error counts: ${error}`, `أعداد الأخطاء: ${error}`));
      }
      if (endpointDirty) {
        const error = await post({ action: 'set-endpoint', endpoint: endpointDraft });
        if (error) errors.push(t(`Endpoint: ${error}`, `خدمة جمع البيانات: ${error}`));
      }
      setConsentDraft(null);
      setErrorsDraft(null);
      setMessage(errors.length > 0
        ? { type: 'error', text: t(`Couldn't save: ${errors.join('; ')}`, `تعذّر الحفظ: ${errors.join('؛ ')}`) }
        : { type: 'success', text: t('Telemetry settings saved.', 'تم حفظ إعدادات إحصاءات الاستخدام.') });
      await refresh();
    } catch {
      setMessage({ type: 'error', text: t('Connection failed. Please try again.', 'تعذّر الاتصال. أعد المحاولة.') });
    } finally { setBusy(null); }
  }

  async function sendNow(): Promise<void> {
    setBusy('send');
    setMessage(null);
    try {
      const r = await apiFetch('/api/admin/telemetry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'send-now' }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; status?: number; error?: string };
      setMessage(j.ok
        ? { type: 'success', text: t(`Sent successfully (HTTP ${j.status ?? '?'}).`, `تم الإرسال بنجاح (رمز الاستجابة ${j.status ?? '?'}).`) }
        : { type: 'error', text: failureText(r.status, j.error, t) });
      await refresh();
    } catch {
      setMessage({ type: 'error', text: t('Connection failed. Please try again.', 'تعذّر الاتصال. أعد المحاولة.') });
    } finally { setBusy(null); }
  }

  const header = <AdminPageHeader title={PAGE.label} description={PAGE.description} />;

  if (!loading && !status) {
    return (
      <div>
        {header}
        <EmptyState
          title={t('Could not load the usage stats', 'تعذّر تحميل إحصاءات الاستخدام')}
          action={<Button type="button" size="sm" onClick={() => void refresh()}>{t('Retry', 'إعادة المحاولة')}</Button>}
        />
      </div>
    );
  }

  // A refresh after a save keeps the page, and with it the scroll position.
  if (!status) {
    return (
      <div>
        {header}
        <AdminBodySkeleton status={t('Loading', 'جارٍ التحميل')} />
      </div>
    );
  }

  const noThirdParty = status.consentSource === 'no-third-party';
  const envOverridden = status.consentSource === 'env' || noThirdParty;
  const isOn = status.consent === 'on';
  const shownOn = (consentDraft ?? status.consent) === 'on';

  // Error counts follow the heartbeat switch as it is about to be saved.
  const errorsLocked = noThirdParty || status.errorsConsentSource === 'env' || !shownOn;
  const errorsMode: ErrorsMode = shownOn ? (errorsDraft ?? status.errorsConsent ?? 'off') : 'off';
  const errorsShownOn = errorsMode !== 'off';
  const errorsDescription = [
    t("Adds how often each error happened yesterday, the error name and where in the code it happened. No message text, no URLs, no instance id goes to the error tracker.", "يتضمن عدد مرات حدوث كل خطأ بالأمس، واسم الخطأ، وموضعه في الشفرة. لا تُرسل نصوص الرسائل أو الروابط أو معرّف النسخة إلى خدمة تتبّع الأخطاء."),
    !shownOn && t("Needs the heartbeat on.", "يتطلب تفعيل تقارير الاستخدام."),
    status.errorsConsentSource === 'env' && t("Locked by the BULWARK_TELEMETRY_ERRORS env var.", "يتحكم متغير البيئة BULWARK_TELEMETRY_ERRORS بهذا الخيار."),
  ].filter(Boolean).join(' ');
  const instantDescription = [
    t("Also sends today's counts within about a minute when an error is new or happens noticeably more often, so a broken release shows up the same day. The same fields as the daily counts; the collector learns roughly when errors happen.", "يرسل أيضاً أعداد أخطاء اليوم خلال دقيقة تقريباً عند ظهور خطأ جديد أو زيادة تكراره، لتسهيل اكتشاف المشكلات في اليوم نفسه. تُرسل الحقول نفسها الواردة في التقرير اليومي، مع توقيت تقريبي لحدوث الأخطاء."),
    !errorsShownOn && t("Needs error counts on.", "يتطلب تفعيل إرسال أعداد الأخطاء."),
  ].filter(Boolean).join(' ');

  // The payload as it will be once the switches are saved.
  const previewPayload = errorsShownOn
    ? { ...status.payloadPreview, schema: '2', errors: status.errorsPreview ?? [] }
    : (({ errors: _omit, ...v1 }) => ({ ...v1, schema: '1' }))(status.payloadPreview as Record<string, unknown> & { errors?: unknown });

  const consentDescription = [
    status.consent === 'pending' && t("Initialising - no heartbeats sent yet.", "جارٍ التهيئة. لم تُرسل تقارير الاستخدام بعد."),
    status.consent === 'on' && status.endpoint && t("Heartbeats are enabled. Thanks for helping us improve!", "تقارير الاستخدام مفعّلة. شكراً للمساهمة في تحسين المنتج."),
    status.consent === 'on' && !status.endpoint && t("Heartbeats are on, but none are sent because the collector URL is empty.", "تقارير الاستخدام مفعّلة، لكن لا تُرسل لأن عنوان خدمة جمع البيانات فارغ."),
    status.consent === 'off' && t("Heartbeats are off (default).", "تقارير الاستخدام متوقفة، وهذا هو الإعداد الافتراضي."),
    noThirdParty && t("Locked off: no third-party traffic is on (Users > Security).", "متوقف بسبب تفعيل منع الاتصالات الخارجية في المستخدمون ← الأمان."),
    envOverridden && !noThirdParty && t("Locked by the BULWARK_TELEMETRY env var.", "يتحكم متغير البيئة BULWARK_TELEMETRY بهذا الخيار."),
  ].filter(Boolean).join(' ');

  return (
    <div>
      {header}


      <div className="space-y-10">
        <ConfigNote>
          {t('The application can send one anonymous usage report per day to help measure active installations, platforms and features. This is off by default. Enable it below to help improve the product. Email addresses, hostnames and IP addresses are not sent. ', 'يمكن للتطبيق إرسال تقرير استخدام مجهول يومياً لقياس عدد النسخ النشطة، والمنصات، والمزايا المستخدمة. الإرسال متوقف افتراضياً. يمكنك تفعيله أدناه للمساعدة في تحسين المنتج. لا تُرسل عناوين البريد أو أسماء الخوادم أو عناوين الشبكة. ')}
          <a
            href="https://bulwarkmail.org/docs/legal/privacy/telemetry"
            target="_blank"
            rel="noreferrer"
            className="underline inline-flex items-center gap-1"
          >
            {t('Full data schema and policy', 'تفاصيل البيانات والسياسة')} <ExternalLink className="h-3 w-3" />
          </a>
        </ConfigNote>

        <SettingsSection id="status" title={t('Status', 'الحالة')}>
          <SettingItem label={t('Send anonymous heartbeats', 'إرسال تقارير استخدام مجهولة')} description={consentDescription}>
            <ToggleSwitch
              checked={shownOn}
              disabled={busy === 'save' || envOverridden}
              onChange={(checked) => {
                setConsentDraft(checked ? 'on' : 'off');
                if (!checked) setErrorsDraft('off');
                setMessage(null);
              }}
            />
          </SettingItem>
          <SettingItem label={t('Also send anonymous error counts', 'إرسال أعداد الأخطاء بشكل مجهول أيضاً')} description={errorsDescription}>
            <ToggleSwitch
              checked={errorsShownOn}
              disabled={busy === 'save' || errorsLocked}
              onChange={(checked) => { setErrorsDraft(checked ? 'on' : 'off'); setMessage(null); }}
            />
          </SettingItem>
          <SettingItem label={t('Send error counts right away', 'إرسال أعداد الأخطاء فوراً')} description={instantDescription}>
            <ToggleSwitch
              checked={errorsMode === 'instant'}
              disabled={busy === 'save' || errorsLocked || !errorsShownOn}
              onChange={(checked) => { setErrorsDraft(checked ? 'instant' : 'on'); setMessage(null); }}
            />
          </SettingItem>
          <SettingItem label={t('Last sent', 'آخر إرسال')}>
            <span className="text-sm text-foreground">{timeAgo(status.lastSentAt, t, dateLocale)}</span>
          </SettingItem>
          {/* Only a running schedule has a next send and a consent date; with
              heartbeats off they were stale ("Next scheduled: 7 hours ago"). */}
          {isOn && (
            <>
              <SettingItem label={t('Next scheduled', 'موعد الإرسال القادم')}>
                <span className="text-sm text-foreground">{nextRun(status.nextScheduledAt, t, dateLocale)}</span>
              </SettingItem>
              <SettingItem label={t('Consented at', 'وقت التفعيل')}>
                <span className="text-sm text-foreground">{status.consentedAt ? new Date(status.consentedAt).toLocaleString(dateLocale) : '-'}</span>
              </SettingItem>
            </>
          )}
        </SettingsSection>

        <SettingsSection
          id="accounts"
          title={t('Account activity', 'نشاط الحسابات')}
          description={t('Unique accounts that signed in during the last 90 days. Identities are stored as a per-installation HMAC, never as plain usernames. Reports include these counts as ranges.', 'الحسابات الفريدة التي سجّلت الدخول خلال آخر 90 يوماً. تُخزّن الهويات بتوقيع مشفّر خاص بكل نسخة، وليس بأسماء مستخدمين صريحة. تتضمن التقارير هذه الأعداد ضمن نطاقات إحصائية.')}
        >
          <SettingItem label={t('Total (90 days)', 'الإجمالي خلال 90 يوماً')}>
            <span className="text-sm font-mono text-foreground">{status.accountCounts?.total ?? 0}</span>
          </SettingItem>
          <SettingItem label={t('Active (7 days)', 'النشطة خلال 7 أيام')}>
            <span className="text-sm font-mono text-foreground">{status.accountCounts?.active7d ?? 0}</span>
          </SettingItem>
        </SettingsSection>

        <SettingsSection
          id="endpoint"
          title={t('Endpoint', 'خدمة جمع البيانات')}
          description={t(`Where usage reports are sent. The default collector is ${status.defaultEndpoint}. Use your own collector or clear this field to stop sending.`, `عنوان إرسال تقارير الاستخدام. الخدمة الافتراضية هي ${status.defaultEndpoint}. يمكنك استخدام خدمة جمع بيانات خاصة بك أو إفراغ الحقل لإيقاف الإرسال.`)}
        >
          <SettingItem label={t('Collector URL', 'عنوان خدمة جمع البيانات')}>
            <input
              type="url"
              value={endpointDraft}
              onChange={(e) => { setEndpointDraft(e.target.value); setMessage(null); }}
              placeholder={t('Leave empty to stop sending reports', 'اتركه فارغاً لإيقاف إرسال التقارير')}
              aria-label={t('Collector URL', 'عنوان خدمة جمع البيانات')}
              autoComplete="off"
              spellCheck={false}
              className={cn(inputClass, 'w-full sm:w-80')}
            />
          </SettingItem>
        </SettingsSection>

        <SettingsSection
          id="payload"
          title={t('Payload preview', 'معاينة البيانات المُرسلة')}
          description={t('The exact data the next usage report would send from this installation.', 'البيانات التي سيرسلها تقرير الاستخدام القادم من هذه النسخة.')}
        >
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={busy === 'send' || !isOn}
              onClick={() => void sendNow()}
            >
              {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t('Send now', 'إرسال الآن')}
            </Button>
          </div>
          <pre dir="ltr" className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto max-h-96">
            {JSON.stringify(previewPayload, null, 2)}
          </pre>
          {errorsMode === 'instant' && (
            <>
              <p className="text-sm text-muted-foreground">
                {t('Immediate report: today’s error counts as they would be sent now. Each minute includes only new errors or those that reached a higher count range.', 'التقرير الفوري: أعداد أخطاء اليوم كما ستُرسل الآن. تُرسل كل دقيقة الأخطاء الجديدة فقط أو التي ارتفع عددها إلى نطاق أعلى.')}
              </p>
              <pre dir="ltr" className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto max-h-96">
                {JSON.stringify({
                  schema: '1',
                  instance_id: status.payloadPreview.instance_id,
                  day: new Date().toISOString().slice(0, 10),
                  errors: status.instantErrorsPreview ?? [],
                }, null, 2)}
              </pre>
            </>
          )}
        </SettingsSection>
      </div>

      <AdminSaveBar
        dirty={dirty}
        saving={busy === 'save'}
        onSave={() => void save()}
        onDiscard={() => { setEndpointDraft(status.endpoint); setConsentDraft(null); setErrorsDraft(null); }}
        saveLabel={t('Save', 'حفظ')}
      />
    </div>
  );
}
