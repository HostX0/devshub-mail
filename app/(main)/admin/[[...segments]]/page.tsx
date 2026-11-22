'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAdminI18n } from '@/components/admin/use-admin-i18n';
import { useAdminLocation, navigateAdmin } from '@/hooks/use-admin-navigation';
import { adminPath, isAdminPageId } from '@/lib/admin/admin-nav';
import { MailboxesPage } from '../_pages/mailboxes';
import { DashboardPage } from '../_pages/dashboard';
const SettingsPage = dynamic(() => import('../_pages/settings').then(m => m.SettingsPage), { loading: AdminPageLoading });
const BrandingPage = dynamic(() => import('../_pages/branding').then(m => m.BrandingPage), { loading: AdminPageLoading });
const AuthPage = dynamic(() => import('../_pages/auth').then(m => m.AuthPage), { loading: AdminPageLoading });
const PolicyPage = dynamic(() => import('../_pages/policy').then(m => m.PolicyPage), { loading: AdminPageLoading });
const OrganisationPage = dynamic(() => import('../_pages/organisation').then(m => m.OrganisationPage), { loading: AdminPageLoading });
const OrgSignaturesPage = dynamic(() => import('../_pages/org-signatures').then(m => m.OrgSignaturesPage), { loading: AdminPageLoading });
const OrgTemplatesPage = dynamic(() => import('../_pages/org-templates').then(m => m.OrgTemplatesPage), { loading: AdminPageLoading });
const OrgSecurityPage = dynamic(() => import('../_pages/org-security').then(m => m.OrgSecurityPage), { loading: AdminPageLoading });
const OrgSharingPage = dynamic(() => import('../_pages/org-sharing').then(m => m.OrgSharingPage), { loading: AdminPageLoading });
const OrgLabelsPage = dynamic(() => import('../_pages/org-labels').then(m => m.OrgLabelsPage), { loading: AdminPageLoading });
const OrgProofreadingPage = dynamic(() => import('../_pages/org-proofreading').then(m => m.OrgProofreadingPage), { loading: AdminPageLoading });
const OrgCalendarsPage = dynamic(() => import('../_pages/org-calendars').then(m => m.OrgCalendarsPage), { loading: AdminPageLoading });
const OrgNoticesPage = dynamic(() => import('../_pages/org-notices').then(m => m.OrgNoticesPage), { loading: AdminPageLoading });
const OrgDevicesPage = dynamic(() => import('../_pages/org-devices').then(m => m.OrgDevicesPage), { loading: AdminPageLoading });
const PluginsPage = dynamic(() => import('../_pages/plugins').then(m => m.PluginsPage), { loading: AdminPageLoading });
const ThemesPage = dynamic(() => import('../_pages/themes').then(m => m.ThemesPage), { loading: AdminPageLoading });
const MarketplacePage = dynamic(() => import('../_pages/marketplace').then(m => m.MarketplacePage), { loading: AdminPageLoading });
const MarketplaceDetailPage = dynamic(() => import('../_pages/marketplace-detail').then(m => m.MarketplaceDetailPage), { loading: AdminPageLoading });
const ExtensionDetailPage = dynamic(() => import('../_pages/extension-detail').then(m => m.ExtensionDetailPage), { loading: AdminPageLoading });
const VersionPage = dynamic(() => import('../_pages/version').then(m => m.VersionPage), { loading: AdminPageLoading });
const TelemetryPage = dynamic(() => import('../_pages/telemetry').then(m => m.TelemetryPage), { loading: AdminPageLoading });
const MonitoringPage = dynamic(() => import('../_pages/monitoring').then(m => m.MonitoringPage), { loading: AdminPageLoading });
const LogsPage = dynamic(() => import('../_pages/logs').then(m => m.LogsPage), { loading: AdminPageLoading });

function AdminPageLoading() {
  const { t } = useAdminI18n();
  return <p role="status" className="p-6 text-sm text-muted-foreground">{t('Loading page…', 'جارٍ تحميل الصفحة…')}</p>;
}

/**
 * Admin pages, loaded on demand from the address bar. Employee mailboxes
 * and the overview stay ready; editors and extension tools load only when opened. One route for the whole
 * panel: the sidebar switches pages with history.pushState and this
 * component re-renders from `usePathname()`, so there is never a route
 * transition between pages (lib/admin/admin-nav.ts).
 */
export default function AdminPage() {
  const { page, detail } = useAdminLocation();

  // Links from before the pages had URLs: /admin?tab=settings.
  useEffect(() => {
    const url = new URL(window.location.href);
    const tab = url.searchParams.get('tab');
    if (!isAdminPageId(tab)) return;
    url.searchParams.delete('tab');
    navigateAdmin(`${adminPath(tab)}${url.search}${url.hash}`, { replace: true });
  }, []);

  switch (page ?? 'dashboard') {
    case 'mailboxes': return <MailboxesPage />;
    case 'dashboard': return <DashboardPage />;
    case 'settings': return <SettingsPage />;
    case 'branding': return <BrandingPage />;
    case 'auth': return <AuthPage />;
    case 'policy': return <PolicyPage />;
    case 'organisation': return <OrganisationPage />;
    case 'org-signatures': return <OrgSignaturesPage />;
    case 'org-templates': return <OrgTemplatesPage />;
    case 'org-security': return <OrgSecurityPage />;
    case 'org-sharing': return <OrgSharingPage />;
    case 'org-labels': return <OrgLabelsPage />;
    case 'org-proofreading': return <OrgProofreadingPage />;
    case 'org-calendars': return <OrgCalendarsPage />;
    case 'org-notices': return <OrgNoticesPage />;
    case 'org-devices': return <OrgDevicesPage />;
    case 'plugins': return detail ? <ExtensionDetailPage key={detail} kind="plugin" id={detail} /> : <PluginsPage />;
    case 'themes': return detail ? <ExtensionDetailPage key={detail} kind="theme" id={detail} /> : <ThemesPage />;
    case 'marketplace': return detail ? <MarketplaceDetailPage key={detail} slug={detail} /> : <MarketplacePage />;
    case 'version': return <VersionPage />;
    case 'telemetry': return <TelemetryPage />;
    case 'monitoring': return <MonitoringPage />;
    case 'logs': return <LogsPage />;
  }
}
