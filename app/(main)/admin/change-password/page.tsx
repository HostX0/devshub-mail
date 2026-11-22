'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from '@/components/icons';
import { apiFetch } from '@/lib/browser-navigation';
import { Button } from '@/components/ui/button';
import { AdminPageHeader } from '@/components/admin/page-header';
import { useAdminFeedback } from '@/components/admin/feedback';
import { useAdminI18n } from '@/components/admin/use-admin-i18n';
import { inputClass } from '@/components/admin/config-items';
import { cn } from '@/lib/utils';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { t, dir } = useAdminI18n();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const setMessage = useAdminFeedback();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: t('The new password must be at least 8 characters.', 'يجب أن تتكوّن كلمة المرور الجديدة من 8 أحرف على الأقل.') });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: t('The new passwords do not match.', 'كلمتا المرور الجديدتان غير متطابقتين.') });
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
        signal: AbortSignal.timeout(20000),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: t('Password changed. Taking you back to the overview.', 'تم تغيير كلمة المرور. جارٍ العودة إلى النظرة العامة.') });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => router.push('/admin'), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        let text = t('Could not change the password. Try again or contact your system administrator.', 'تعذّر تغيير كلمة المرور. حاول مجدداً أو تواصل مع مسؤول النظام.');
        if (data.error === 'Current password is incorrect') text = t('The current password is incorrect.', 'كلمة المرور الحالية غير صحيحة.');
        else if (res.status === 401) text = t('Your administrator session has ended. Sign in again.', 'انتهت جلسة الإدارة. سجّل الدخول مجدداً.');
        else if (res.status === 409) text = t('The password was changed in another session. Sign in again with the latest password.', 'تغيّرت كلمة المرور في جلسة أخرى. سجّل الدخول مجدداً بكلمة المرور الجديدة.');
        else if (res.status === 429) text = t('Too many attempts. Wait a moment and try again.', 'محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.');
        else if (data.error === 'Both current and new password are required') text = t('Enter both the current and new password.', 'أدخل كلمتي المرور الحالية والجديدة.');
        else if (data.error === 'New password must be at least 8 characters') text = t('The new password must be at least 8 characters.', 'يجب أن تتكوّن كلمة المرور الجديدة من 8 أحرف على الأقل.');
        setMessage({ type: 'error', text });
      }
    } catch {
      setMessage({ type: 'error', text: t('Connection failed. Please try again.', 'تعذّر الاتصال. أعد المحاولة.') });
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    { id: 'current', label: t('Current password', 'كلمة المرور الحالية'), value: currentPassword, set: setCurrentPassword, autoComplete: 'current-password' },
    { id: 'new', label: t('New password', 'كلمة المرور الجديدة'), value: newPassword, set: setNewPassword, autoComplete: 'new-password' },
    { id: 'confirm', label: t('Confirm new password', 'تأكيد كلمة المرور الجديدة'), value: confirmPassword, set: setConfirmPassword, autoComplete: 'new-password' },
  ] as const;

  return (
    <div className="max-w-md" dir={dir}>
      <AdminPageHeader title={t('Change password', 'تغيير كلمة المرور')} description={t('The password for this admin panel. At least 8 characters.', 'كلمة المرور الخاصة بلوحة الإدارة. يجب أن تتكوّن من 8 أحرف على الأقل.')} back={{ href: '/admin', label: t('Overview', 'نظرة عامة') }} />

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field.id} className="space-y-1.5">
            <label htmlFor={`password-${field.id}`} className="text-sm font-medium text-foreground">{field.label}</label>
            <input
              id={`password-${field.id}`}
              type="password"
              dir="ltr"
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
              required
              minLength={field.id === 'current' ? undefined : 8}
              autoComplete={field.autoComplete}
              className={cn(inputClass, 'w-full')}
            />
          </div>
        ))}

        <Button type="submit" size="sm" disabled={loading} className="gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? t('Saving…', 'جارٍ الحفظ…') : t('Change password', 'تغيير كلمة المرور')}
        </Button>
      </form>
    </div>
  );
}
