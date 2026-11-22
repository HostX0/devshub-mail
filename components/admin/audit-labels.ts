'use client';

import { useAdminI18n } from './use-admin-i18n';
import type { AuditEntry } from '@/lib/admin/types';
import { formatAuditDetail } from '@/lib/admin/audit-format';

export function useAdminAuditLabels() {
  const { t } = useAdminI18n();
  const actionLabels: Record<string, string> = {
    'admin.login': t('Login', 'تسجيل الدخول'),
    'admin.logout': t('Logout', 'تسجيل الخروج'),
    'admin.login_failed': t('Login failed', 'فشل تسجيل الدخول'),
    'admin.login_blocked': t('Login blocked', 'حظر تسجيل الدخول'),
    'admin.change-password': t('Password change', 'تغيير كلمة المرور'),
    'config.update': t('Configuration update', 'تحديث الإعدادات'),
    'config.revert': t('Configuration revert', 'استعادة الإعدادات'),
    'policy.update': t('Policy update', 'تحديث السياسات'),
    'plugin.install': t('Plugin install', 'تثبيت إضافة'),
    'plugin.update': t('Plugin update', 'تحديث إضافة'),
    'plugin.rollback': t('Plugin rollback', 'استعادة إصدار إضافة'),
    'plugin.delete': t('Plugin removal', 'إزالة إضافة'),
    'theme.install': t('Theme install', 'تثبيت مظهر'),
    'theme.update': t('Theme update', 'تحديث مظهر'),
    'theme.rollback': t('Theme rollback', 'استعادة إصدار مظهر'),
    'theme.delete': t('Theme removal', 'إزالة مظهر'),
    'device.wipe.request': t('Device wipe requested', 'طلب مسح جهاز'),
    'device.wipe.confirm': t('Device wipe confirmed', 'تأكيد مسح جهاز'),
    'device.wipe.cancel': t('Device wipe cancelled', 'إلغاء مسح جهاز'),
    'device.forget': t('Device forgotten', 'إزالة جهاز من القائمة'),
    'mailbox.create': t('Mailbox created', 'إنشاء حساب بريد'),
    'mailbox.update': t('Mailbox updated', 'تحديث حساب بريد'),
    'mailbox.disable': t('Mailbox disabled', 'تعطيل حساب بريد'),
    'mailbox.enable': t('Mailbox enabled', 'تفعيل حساب بريد'),
    'mailbox.delete': t('Mailbox deleted', 'حذف حساب بريد'),
  };
  function auditDetail(detail: AuditEntry['detail']) {
    if (detail && typeof detail.key === 'string' && 'oldValue' in detail) {
      const old = typeof detail.oldValue === 'string' ? detail.oldValue : JSON.stringify(detail.oldValue) ?? t('nothing', 'لا شيء');
      return t(`${detail.key}: reverted from ${old}`, `${detail.key}: استُعيدت القيمة السابقة بدلاً من ${old}`);
    }
    if (detail?.restrictionCount !== undefined) return t(`${detail.restrictionCount} restriction(s)`, `عدد القيود: ${detail.restrictionCount}`);
    return formatAuditDetail(detail);
  }
  return { actionLabels, auditDetail };
}
