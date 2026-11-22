'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { Input } from '@/components/ui/input';
import { AdminPageHeader } from '@/components/admin/page-header';
import { useAdminI18n } from '@/components/admin/use-admin-i18n';
import { apiFetch } from '@/lib/browser-navigation';
import type { MailboxRow, MailboxInput } from '@/lib/stalwart/mailbox-management';

const GiB = 1024 ** 3;
type MailboxFailure = { code?: string; error?: string; status?: number };
type Translate = (english: string, arabic: string) => string;

/** Translate known server errors without showing arbitrary upstream text in the UI. */
function failureText(failure: MailboxFailure, t: Translate): string {
  const inputErrors: Record<string, string> = {
    'A mailbox action is required.': 'اختر إجراءً لحساب البريد.',
    'Unknown mailbox action.': 'الإجراء المطلوب غير معروف. حدّث الصفحة وحاول مجدداً.',
    'Unexpected mailbox field.': 'تحتوي البيانات على حقل غير متوقع. حدّث الصفحة وحاول مجدداً.',
    'Choose a mailbox.': 'اختر حساب بريد.',
    'Enter a valid employee email address.': 'أدخل عنوان بريد صحيحاً للموظف.',
    'The mailbox address cannot be changed here.': 'لا يمكن تغيير عنوان البريد من هنا.',
    'Enter a display name of up to 120 characters.': 'أدخل اسم موظف لا يتجاوز 120 حرفاً.',
    'Choose a storage limit from 1 MiB to 1 PiB. Unlimited mailboxes are not created here.': 'حدّد مساحة من 1 ميبيبايت إلى 1 بيبيبايت. يجب تحديد مساحة لكل حساب.',
    'Use a password from 12 to 256 characters.': 'استخدم كلمة مرور تتكوّن من 12 إلى 256 حرفاً.',
    'Unexpected fields for this action.': 'تحتوي البيانات على حقول لا تناسب هذا الإجراء. حدّث الصفحة وحاول مجدداً.',
    'Choose a change to save.': 'أدخل التعديل المطلوب حفظه.',
    'Enter a valid mailbox request.': 'تحقّق من بيانات الحساب وحاول مجدداً.',
  };
  if (failure.code === 'invalid_input' && failure.error && inputErrors[failure.error]) {
    return t(failure.error, inputErrors[failure.error]);
  }
  switch (failure.code) {
    case 'invalid_quota': return t('Enter a valid storage limit of at least 1 MiB.', 'حدّد مساحة صحيحة لا تقل عن 1 ميبيبايت.');
    case 'admin_sign_in_required':
    case 'sign_in_required': return t('Your administrator session has ended. Sign in to administration again.', 'انتهت جلسة الإدارة. سجّل الدخول إلى الإدارة مجدداً.');
    case 'disabled': return t('Mailbox administration is disabled. Contact your system administrator.', 'إدارة حسابات البريد معطّلة. تواصل مع مسؤول النظام.');
    case 'upstream_failed': return t('The mail server refused the request. Contact your system administrator.', 'رفض خادم البريد الطلب. تواصل مع مسؤول النظام.');
    case 'unsupported_server': return t('Mailbox management requires Stalwart 1.1 or newer.', 'تتطلب إدارة الحسابات الإصدار 1.1 أو أحدث من خادم البريد ستالوارت.');
    case 'permission_denied': return t('You do not have permission to manage these mailboxes. Contact your system administrator.', 'ليست لديك صلاحية إدارة هذه الحسابات. تواصل مع مسؤول النظام.');
    case 'mailbox_change_failed': return t('The change could not be saved. Check the email address and available storage, then refresh and retry.', 'تعذّر حفظ التغيير. تحقّق من عنوان البريد والمساحة المتاحة، ثم حدّث الصفحة وحاول مجدداً.');
    case 'untrusted_server':
    case 'not_configured':
    case 'admin_server_not_allowed': return t('Mailbox administration is not configured for this server. Contact your system administrator.', 'لم تُضبط إدارة حسابات البريد لهذا الخادم. تواصل مع مسؤول النظام.');
    case 'too_many_accounts': return t('There are too many accounts for this panel. Contact your system administrator.', 'عدد الحسابات يتجاوز سعة هذه اللوحة. تواصل مع مسؤول النظام.');
    case 'domain_not_allowed': return t('Choose one of the available employee email domains.', 'اختر أحد نطاقات بريد الموظفين المتاحة.');
    case 'invalid_response': return t('The mail server did not confirm the change. Refresh the accounts before trying again.', 'لم يؤكد خادم البريد تنفيذ التغيير. حدّث قائمة الحسابات قبل المحاولة مجدداً.');
    case 'protected_account': return t('Only employee mailboxes can be changed here. Administrator accounts are protected.', 'يمكن تعديل حسابات الموظفين فقط من هنا. حسابات الإدارة محمية.');
    case 'password_not_available': return t('This account needs a different password update method. Contact your system administrator.', 'يتطلب هذا الحساب طريقة أخرى لتغيير كلمة المرور. تواصل مع مسؤول النظام.');
    case 'too_large': return t('The request is too large. Shorten the entered details and retry.', 'حجم الطلب أكبر من المسموح. اختصر البيانات المدخلة وحاول مجدداً.');
    case 'invalid_input': return t('Check the account details and try again.', 'تحقّق من بيانات الحساب وحاول مجدداً.');
  }
  if (failure.status === 401) return t('Your administrator session has ended. Sign in to administration again.', 'انتهت جلسة الإدارة. سجّل الدخول إلى الإدارة مجدداً.');
  if (failure.status === 403) return t('This action is not allowed. Refresh the page or contact your system administrator.', 'هذا الإجراء غير مسموح. حدّث الصفحة أو تواصل مع مسؤول النظام.');
  if (failure.status === 429) return t('Too many attempts. Wait a moment and try again.', 'محاولات كثيرة. انتظر قليلاً وحاول مجدداً.');
  return t('The mail server could not be reached or could not complete this request. Refresh and retry.', 'تعذّر الاتصال بخادم البريد أو إكمال الطلب. حدّث الصفحة وحاول مجدداً.');
}

export function MailboxesPage() {
  const { t, dir } = useAdminI18n();
  const { confirm, dialogProps } = useConfirmDialog();
  const [rows, setRows] = useState<MailboxRow[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MailboxFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<MailboxRow | null>(null);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [quota, setQuota] = useState('1');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/mailboxes');
      const data = await res.json();
      if (!res.ok) { setError({ code: data.code, error: data.error, status: res.status }); return; }
      setRows(data.mailboxes); setDomains(data.domains);
      setDomain(old => data.domains.includes(old) ? old : data.domains[0] || '');
      setError(null);
    } catch { setError({ code: 'server_unavailable' }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const clear = () => { setEditing(null); setName(''); setDisplayName(''); setQuota('1'); setPassword(''); setShowPassword(false); };
  async function change(input: MailboxInput): Promise<boolean> {
    setBusy(true); setError(null); setSaved(false);
    try {
      const res = await apiFetch('/api/admin/mailboxes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const data = await res.json();
      if (!res.ok) { setError({ code: data.code, error: data.error, status: res.status }); return false; }
      setSaved(true);
      await refresh(); return true;
    } catch { setError({ code: 'server_unavailable' }); return false; }
    finally { setBusy(false); }
  }
  async function remove(row: MailboxRow) {
    if (!await confirm({ title: t('Delete employee mailbox', 'حذف بريد الموظف'), message: t(`Permanently delete ${row.email}, its mailbox and all its messages?`, `حذف ${row.email} وصندوقه ورسائله نهائياً؟`), confirmText: t('Delete permanently', 'حذف نهائياً'), cancelText: t('Cancel', 'إلغاء'), variant: 'destructive' })) return;
    if (await change({ action: 'delete', id: row.id }) && editing?.id === row.id) clear();
  }
  function edit(row: MailboxRow) { setEditing(row); setDisplayName(row.displayName); setQuota(String(row.quotaBytes / GiB)); setPassword(''); setShowPassword(false); setSaved(false); }
  function generatePassword() {
    const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    setPassword(Array.from(bytes, b => alphabet[b % alphabet.length]).join('')); setShowPassword(true);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const quotaBytes = Math.round(Number(quota) * GiB);
    if (!Number.isSafeInteger(quotaBytes) || quotaBytes < 1024 ** 2) { setError({ code: 'invalid_quota' }); return; }
    const input: MailboxInput = editing ? { action: 'update', id: editing.id, displayName, quotaBytes, ...(password ? { password } : {}) } : { action: 'create', email: `${name}@${domain}`, displayName, quotaBytes, password };
    if (await change(input)) clear();
  }
  return <div dir={dir}>
    <AdminPageHeader title={t('Employee mail administration', 'إدارة بريد الموظفين')} description={t('Create employee mailboxes, set storage limits and update passwords.', 'إنشاء حسابات بريد الموظفين، وتحديد المساحة، وتحديث كلمات المرور.')} actions={<Button variant="outline" disabled={busy || loading} onClick={() => void refresh()}>{t('Refresh', 'تحديث')}</Button>} />
    {error && <div role="alert" className="mb-4 rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{failureText(error, t)}</div>}
    {saved && <p role="status" className="mb-4 text-sm text-success">{t('The change was saved successfully.', 'تم حفظ التغيير بنجاح.')}</p>}
    {domains.length > 0 && <form onSubmit={submit} className="mb-6 space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">{editing ? t(`Edit ${editing.email}`, `تعديل ${editing.email}`) : t('Create employee mailbox', 'إنشاء بريد موظف')}</h2>
      {!editing && <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm"><span>{t('Email name before @', 'اسم البريد قبل @')}</span><Input dir="ltr" required autoComplete="off" maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9._+\-]*" value={name} onChange={e => setName(e.target.value)} placeholder={t('employee.name', 'اسم البريد بالأحرف الإنجليزية')} disabled={busy} /></label>
        <label className="space-y-2 text-sm"><span>{t('Domain', 'النطاق')}</span><select aria-label={t('Domain', 'النطاق')} dir="ltr" className="h-10 w-full rounded-md border border-input bg-background px-3" value={domain} onChange={e => setDomain(e.target.value)} disabled={busy}>{domains.map(d => <option key={d}>{d}</option>)}</select></label>
      </div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm"><span>{t('Employee name', 'اسم الموظف')}</span><Input maxLength={120} value={displayName} onChange={e => setDisplayName(e.target.value)} disabled={busy} /></label>
        <label className="space-y-2 text-sm"><span>{t('Mailbox storage (GiB)', 'مساحة الصندوق (جيبيبايت)')}</span><Input dir="ltr" type="number" required min={0.000977} max={1048576} step="any" value={quota} onChange={e => setQuota(e.target.value)} disabled={busy} /><span className="text-xs text-muted-foreground">{t('1 GiB = 1024 MiB. This is the maximum storage per employee.', '1 جيبيبايت = 1024 ميبيبايت. المساحة حد أقصى لكل موظف.')}</span></label>
      </div>
      <label className="block space-y-2 text-sm"><span>{editing ? t('New password — leave blank to keep the current password', 'كلمة مرور جديدة — اتركها فارغة للإبقاء على الحالية') : t('Password', 'كلمة المرور')}</span><Input dir="ltr" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required={!editing} minLength={12} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={generatePassword} disabled={busy}>{t('Generate password', 'توليد كلمة مرور')}</Button><Button type="button" variant="ghost" onClick={() => setShowPassword(v => !v)} disabled={busy}>{showPassword ? t('Hide password', 'إخفاء كلمة المرور') : t('Show password', 'إظهار كلمة المرور')}</Button></div>
      {editing && password && <p className="text-sm text-muted-foreground">{t('The password changes without affecting other authentication settings or app passwords.', 'تتغير كلمة المرور مع الإبقاء على إعدادات المصادقة الإضافية ومفاتيح التطبيق.')}</p>}
      <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? t('Saving…', 'جارٍ الحفظ…') : editing ? t('Save changes', 'حفظ التعديلات') : t('Create mailbox', 'إنشاء البريد')}</Button>{editing && <Button type="button" variant="ghost" onClick={clear} disabled={busy}>{t('Cancel edit', 'إلغاء التعديل')}</Button>}</div>
    </form>}
    <section className="rounded-xl border border-border bg-card p-5" aria-label={t('Employee accounts', 'حسابات الموظفين')}>
      <h2 className="mb-4 text-lg font-semibold">{t('Employee accounts', 'حسابات الموظفين')}</h2>
      {loading && <p role="status">{t('Loading accounts…', 'جارٍ تحميل الحسابات…')}</p>}
      {!loading && !rows.length && <p className="text-sm text-muted-foreground">{t('There are no employee mailboxes available to manage. Administrator accounts are protected and are not listed here.', 'لا توجد صناديق موظفين متاحة للإدارة. حسابات الإدارة محمية ولا تظهر هنا.')}</p>}
      <div className="divide-y divide-border">{rows.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0"><p className="break-all font-medium" dir="ltr">{row.email}</p><p className="text-sm text-muted-foreground">{row.displayName} · {(row.quotaBytes / GiB).toLocaleString('en-US', { maximumFractionDigits: 3 })} {t('GiB', 'جيبيبايت')} · {row.disabled ? t('Disabled', 'معطّل') : t('Active', 'فعّال')}</p></div>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => edit(row)} disabled={busy}>{t('Edit', 'تعديل')}</Button><Button size="sm" variant="outline" onClick={() => void change({ action: row.disabled ? 'enable' : 'disable', id: row.id })} disabled={busy}>{row.disabled ? t('Enable', 'تفعيل') : t('Disable', 'تعطيل')}</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => void remove(row)}>{t('Delete', 'حذف')}</Button></div>
      </div>)}</div>
    </section>
    <ConfirmDialog {...dialogProps} />
  </div>;
}
