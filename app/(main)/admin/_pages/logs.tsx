'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Loader2, ScrollText } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { AdminPageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/admin/badge';
import { EmptyState } from '@/components/admin/empty-state';
import { useAdminFeedback } from '@/components/admin/feedback';
import { useAdminI18n } from '@/components/admin/use-admin-i18n';
import { inputClass } from '@/components/admin/config-items';
import type { AuditEntry } from '@/lib/admin/types';
import { useAdminAuditLabels } from '@/components/admin/audit-labels';
import { adminPageDef } from '@/lib/admin/admin-nav';
import { apiFetch } from '@/lib/browser-navigation';
import { cn } from '@/lib/utils';

const PAGE = adminPageDef('logs');

export function LogsPage() {
  const { t, isArabic } = useAdminI18n();
  const dateLocale = isArabic ? 'ar-u-nu-latn' : 'en-US';
  const { actionLabels, auditDetail } = useAdminAuditLabels();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const setMessage = useAdminFeedback();
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (actionFilter) params.set('action', actionFilter);

    try {
      const res = await apiFetch(`/api/admin/audit?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch {
      setLoadFailed(true);
      setMessage({ type: 'error', text: t('Could not load the audit log', 'تعذّر تحميل سجل النشاط') });
    }
    setLoading(false);
  }, [page, actionFilter, setMessage, t]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const initialLoading = loading && entries.length === 0;

  return (
    <div>
      <AdminPageHeader
        title={PAGE.label}
        description={t(`Administrator actions and changes · ${total} total entries`, `إجراءات الإدارة والتغييرات · إجمالي السجلات: ${total}`)}
        actions={(
          <>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              aria-label={t('Filter by action', 'تصفية حسب الإجراء')}
              className={cn(inputClass, 'pe-8 cursor-pointer')}
            >
              <option value="">{t('All actions', 'جميع الإجراءات')}</option>
              {Object.entries(actionLabels).map(([action, label]) => <option key={action} value={action}>{label}</option>)}
            </select>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin [animation-direction:reverse]')} />
              {t('Refresh', 'تحديث')}
            </Button>
          </>
        )}
      />

      {initialLoading ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="me-2 h-4 w-4 animate-spin" /> {t('Loading', 'جارٍ التحميل')}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={loadFailed ? t('Could not load the audit log', 'تعذّر تحميل سجل النشاط') : t('No entries found', 'لا توجد سجلات')}
          hint={loadFailed ? undefined : actionFilter ? t('Nothing matches this action filter.', 'لا توجد سجلات تطابق الإجراء المحدد.') : t('Admin actions show up here as they happen.', 'تظهر إجراءات الإدارة هنا فور تنفيذها.')}
        />
      ) : (
        <>
          <div className="md:hidden space-y-2">
            {entries.map((entry, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge className="font-mono text-xs truncate">{actionLabels[entry.action] ?? entry.action}</Badge>
                  <span className="text-[0.6875rem] text-muted-foreground whitespace-nowrap">
                    {new Date(entry.ts).toLocaleString(dateLocale)}
                  </span>
                </div>
                <div className="text-xs text-foreground break-words">
                  {auditDetail(entry.detail) || '-'}
                </div>
                <div className="text-[0.6875rem] text-muted-foreground font-mono">
                  {entry.ip}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start px-4 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">{t('Time', 'الوقت')}</th>
                  <th className="text-start px-4 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">{t('Action', 'الإجراء')}</th>
                  <th className="text-start px-4 py-2 text-xs font-medium text-muted-foreground">{t('Details', 'التفاصيل')}</th>
                  <th className="text-start px-4 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">{t('IP', 'عنوان الشبكة')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.ts).toLocaleString(dateLocale)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge className="font-mono text-xs">{actionLabels[entry.action] ?? entry.action}</Badge>
                    </td>
                    <td className="w-full max-w-0 truncate px-4 py-2 text-xs text-foreground" title={auditDetail(entry.detail)}>
                      {auditDetail(entry.detail) || '-'}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground font-mono">
                      {/* A fixed width, so a full IPv6 address wraps instead of pushing the table wide. */}
                      <div className="w-28 break-all">{entry.ip}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t(`Page ${page} of ${totalPages}`, `الصفحة ${page} من ${totalPages}`)}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              {t('Previous', 'السابق')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              {t('Next', 'التالي')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
