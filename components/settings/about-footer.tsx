'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useConfig } from '@/hooks/use-config';
import { useUpdateStore } from '@/stores/update-store';
import { ExternalLink } from '@/components/icons';
import { cn } from '@/lib/utils';
import { getPathPrefix, withBasePath } from '@/lib/browser-navigation';

const SpamSiegeGame = dynamic(() => import('./spam-siege-game').then(m => m.SpamSiegeGame));

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";
const GIT_COMMIT = process.env.NEXT_PUBLIC_GIT_COMMIT || "unknown";
const UPSTREAM_SOURCE_URL = "https://github.com/bulwarkmail/webmail";

function VersionUpdateTag() {
  const isArabic = useLocale().startsWith('ar');
  const status = useUpdateStore((s) => s.status);
  const startPolling = useUpdateStore((s) => s.startPolling);

  useEffect(() => {
    startPolling();
  }, [startPolling]);

  if (!status?.updateAvailable) return null;
  if (status.severity === 'unknown' || status.severity === 'none') return null;

  const important = status.severity === 'security' || status.severity === 'deprecated';
  const label =
    status.severity === 'security' ? (isArabic ? 'أمان' : 'security')
    : status.severity === 'deprecated' ? (isArabic ? 'قديم' : 'deprecated')
    : status.latest ?? (isArabic ? 'تحديث' : 'update');

  return (
    <span
      className={cn(
        "ms-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium align-middle",
        important
          ? "bg-red-500/15 text-red-700 dark:text-red-300"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      )}
    >
      {important ? label : `${isArabic ? 'تحديث' : 'update'}: ${label}`}
    </span>
  );
}

/**
 * The About card, on Settings > About and at the foot of the admin's list: logo, version with the
 * update tag, and the source link. A modified build must offer its own
 * source (AGPL-3.0 §13), so a configured URL replaces the upstream link.
 * Three clicks on the logo open Spam Siege, as before.
 */
export function AboutFooter() {
  const t = useTranslations('settings.advanced');
  const { sourceCodeUrl, appName, appLogoLightUrl, appLogoDarkUrl } = useConfig();
  // A branded deployment (APP_NAME / APP_LOGO_*) shows its own name and logo
  // here; without them the card keeps the Bulwark mark and title. (#1160)
  const branded = appName && appName !== 'Webmail';
  const logoLight = withBasePath(appLogoLightUrl || appLogoDarkUrl) || `${getPathPrefix()}/branding/Bulwark_Logo_Color.svg`;
  const logoDark = withBasePath(appLogoDarkUrl || appLogoLightUrl) || `${getPathPrefix()}/branding/Bulwark_Logo_White.svg`;
  const [showGame, setShowGame] = useState(false);
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoClick = () => {
    logoClickCount.current++;
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
    if (logoClickCount.current >= 3) {
      logoClickCount.current = 0;
      setShowGame(true);
    } else {
      logoClickTimer.current = setTimeout(() => { logoClickCount.current = 0; }, 2000);
    }
  };

  return (
    <div data-testid="settings-about" className="px-3 py-2">
      {showGame && <SpamSiegeGame onClose={() => setShowGame(false)} />}
      <div className="flex items-center gap-3">
        {/* Named by what it shows (app name and version), with the focus
            ring every other stop in the sidebar has. */}
        <button
          type="button"
          onClick={handleLogoClick}
          className="flex items-center gap-3 flex-1 min-w-0 text-start rounded-md focus-visible:outline-hidden group/about cursor-pointer"
        >
          <img
            src={logoLight}
            alt={branded ? appName : 'Bulwark'}
            className="w-7 h-7 shrink-0 object-contain dark:hidden group-active/about:scale-95 transition-transform"
          />
          <img
            src={logoDark}
            alt={branded ? appName : 'Bulwark'}
            className="w-7 h-7 shrink-0 object-contain hidden dark:block group-active/about:scale-95 transition-transform"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{branded ? appName : t('about.title')}</p>
            <p className="text-[0.6875rem] text-muted-foreground truncate">
              v{APP_VERSION} <span className="text-muted-foreground">({GIT_COMMIT})</span>
              <VersionUpdateTag />
            </p>
          </div>
        </button>
        <a
          href={sourceCodeUrl || UPSTREAM_SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground hover:text-foreground transition-colors"
        >
          {sourceCodeUrl ? t('about.source_code') : 'GitHub'} <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

