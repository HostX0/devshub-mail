'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminPageHeader } from '@/components/admin/page-header';
import { apiFetch } from '@/lib/browser-navigation';
import type { MailboxRow, MailboxInput } from '@/lib/stalwart/mailbox-management';

const GiB = 1024 ** 3;
export function MailboxesPage() {
  const [rows, setRows] = useState<MailboxRow[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
      if (!res.ok) throw new Error(data.error || 'تعذّر تحميل الحسابات.');
      setRows(data.mailboxes); setDomains(data.domains);
      setDomain(old => data.domains.includes(old) ? old : data.domains[0] || '');
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const clear = () => { setEditing(null); setName(''); setDisplayName(''); setQuota('1'); setPassword(''); setShowPassword(false); };
  async function change(input: MailboxInput): Promise<boolean> {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await apiFetch('/api/admin/mailboxes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذّر حفظ التغيير.');
      setNotice('تم حفظ التغيير بنجاح.');
      await refresh(); return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم.'); return false; }
    finally { setBusy(false); }
  }
  function edit(row: MailboxRow) { setEditing(row); setDisplayName(row.displayName); setQuota(String(row.quotaBytes / GiB)); setPassword(''); setShowPassword(false); setNotice(''); }
  function generatePassword() {
    const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    setPassword(Array.from(bytes, b => alphabet[b % alphabet.length]).join('')); setShowPassword(true);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const quotaBytes = Math.round(Number(quota) * GiB);
    if (!Number.isSafeInteger(quotaBytes) || quotaBytes < 1024 ** 2) { setError('حدّد مساحة صحيحة لا تقل عن 1 MiB.'); return; }
    const input: MailboxInput = editing ? { action: 'update', id: editing.id, displayName, quotaBytes, ...(password ? { password } : {}) } : { action: 'create', email: `${name}@${domain}`, displayName, quotaBytes, password };
    if (await change(input)) clear();
  }
  return <div dir="rtl">
    <AdminPageHeader title="إدارة بريد الموظفين" description="حساب السوبر أدمن: إنشاء صناديق البريد، تحديد المساحة، وتحديث كلمات المرور." actions={<Button variant="outline" disabled={busy || loading} onClick={() => void refresh()}>تحديث</Button>} />
    {error && <div role="alert" className="mb-4 rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{error}</div>}
    {notice && <p role="status" className="mb-4 text-sm text-success">{notice}</p>}
    {domains.length > 0 && <form onSubmit={submit} className="mb-6 space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">{editing ? `تعديل ${editing.email}` : 'إنشاء بريد موظف'}</h2>
      {!editing && <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm"><span>اسم البريد قبل @</span><Input dir="ltr" required autoComplete="off" maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9._+\-]*" value={name} onChange={e => setName(e.target.value)} placeholder="employee.name" disabled={busy} /></label>
        <label className="space-y-2 text-sm"><span>الدومين</span><select aria-label="الدومين" dir="ltr" className="h-10 w-full rounded-md border border-input bg-background px-3" value={domain} onChange={e => setDomain(e.target.value)} disabled={busy}>{domains.map(d => <option key={d}>{d}</option>)}</select></label>
      </div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm"><span>اسم الموظف</span><Input maxLength={120} value={displayName} onChange={e => setDisplayName(e.target.value)} disabled={busy} /></label>
        <label className="space-y-2 text-sm"><span>مساحة الصندوق (GiB)</span><Input dir="ltr" type="number" required min={0.000977} max={1048576} step="any" value={quota} onChange={e => setQuota(e.target.value)} disabled={busy} /><span className="text-xs text-muted-foreground">1 GiB = 1024 MiB. المساحة حد أقصى لكل موظف.</span></label>
      </div>
      <label className="block space-y-2 text-sm"><span>{editing ? 'كلمة مرور جديدة — اتركها فارغة للإبقاء على الحالية' : 'كلمة المرور'}</span><Input dir="ltr" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required={!editing} minLength={12} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={generatePassword} disabled={busy}>توليد كلمة مرور</Button><Button type="button" variant="ghost" onClick={() => setShowPassword(v => !v)} disabled={busy}>{showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}</Button></div>
      {editing && password && <p className="text-sm text-muted-foreground">تتغير كلمة المرور مع الإبقاء على إعدادات المصادقة الإضافية ومفاتيح التطبيق.</p>}
      <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديلات' : 'إنشاء البريد'}</Button>{editing && <Button type="button" variant="ghost" onClick={clear} disabled={busy}>إلغاء التعديل</Button>}</div>
    </form>}
    <section className="rounded-xl border border-border bg-card p-5" aria-label="حسابات الموظفين">
      <h2 className="mb-4 text-lg font-semibold">حسابات الموظفين</h2>
      {loading && <p role="status">جارٍ تحميل الحسابات…</p>}
      {!loading && !rows.length && <p className="text-sm text-muted-foreground">لا توجد صناديق موظفين متاحة للإدارة. حسابات الإدارة محمية ولا تظهر هنا.</p>}
      <div className="divide-y divide-border">{rows.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0"><p className="break-all font-medium" dir="ltr">{row.email}</p><p className="text-sm text-muted-foreground">{row.displayName} · {(row.quotaBytes / GiB).toLocaleString('en-US', { maximumFractionDigits: 3 })} GiB · {row.disabled ? 'معطّل' : 'فعّال'}</p></div>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => edit(row)} disabled={busy}>تعديل</Button><Button size="sm" variant="outline" onClick={() => void change({ action: row.disabled ? 'enable' : 'disable', id: row.id })} disabled={busy}>{row.disabled ? 'تفعيل' : 'تعطيل'}</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => { if (window.confirm(`حذف ${row.email} وصندوقه ورسائله نهائياً؟`)) void change({ action: 'delete', id: row.id }).then(ok => { if (ok && editing?.id === row.id) clear(); }); }}>حذف</Button></div>
      </div>)}</div>
    </section>
  </div>;
}
