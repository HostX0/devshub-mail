"use client";

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSettingsStore } from '@/stores/settings-store';
import { useConfig } from '@/hooks/use-config';
import { SettingsSection, SettingItem, ToggleSwitch } from './settings-section';
import { Button } from '@/components/ui/button';
import { usePolicyStore } from '@/stores/policy-store';
import { clearCachedData } from '@/lib/clear-cached-data';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/stores/toast-store';
import { DebugSettings } from './debug-settings';
import { MailBackupSettings } from '@/components/mail-transfer/mail-backup-settings';
import { productName } from '@/lib/product-name';
import { isDesktopApp } from '@/lib/desktop/bridge';
import { IS_LITE } from '@/lib/lite';
import { DesktopUpdateSettings } from './desktop-update-settings';
import { AboutFooter } from './about-footer';
export { AboutFooter } from './about-footer';

/**
 * Settings > About, the last entry of the page list: the About card with the
 * version and the source link. It was in the sidebar's footer, where it took
 * room from the page list on short screens. In the desktop app it is "About &
 * updates": the app's version, update check and channel follow the card
 * (on General until the settings reorg of 2026-11-05).
 */
export function AboutSettings() {
  const t = useTranslations('uxs_structure.about');
  const appName = productName(useConfig().appName);
  return (
    <div className="space-y-8">
      <SettingsSection id="about" title={t('title', { appName })}>
        <div className="-mx-3">
          <AboutFooter />
        </div>
      </SettingsSection>
      {!IS_LITE && <DesktopUpdateSettings />}
    </div>
  );
}

/**
 * The Backup & import page: keep settings (sync, export, import), bring mail
 * in and save it as files. Offline has a page of its own; fixing a stale
 * view, starting over and debug logging are on Troubleshooting (settings
 * reorg 2026-11-05).
 */
export function AboutDataSettings() {
  const t = useTranslations('settings.advanced');
  const tSettings = useTranslations('settings');
  const { settingsSyncDisabled, updateSetting, exportSettings, importSettings } =
    useSettingsStore();
  const { settingsSyncEnabled } = useConfig();
  const tWords = useTranslations('ux_p3_words');
  // The app has no "other browsers" (settings-p2-4), and its Backup says only what it
  // does: a settings file to export and import (settings-p3-9).
  const [inApp, setInApp] = useState(false);
  useEffect(() => setInApp(isDesktopApp()), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isFeatureEnabled } = usePolicyStore();
  const handleExport = () => {
    const settingsJson = exportSettings();
    const blob = new Blob([settingsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webmail-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      const success = importSettings(json);
      if (success) {
        toast.success(tSettings('import_success'));
      } else {
        toast.error(tSettings('import_error'));
      }
    };
    reader.readAsText(file);
    // The same file can be picked again after fixing it.
    e.target.value = '';
  };

  return (
    <div className="space-y-8">
      <SettingsSection id="backup" title={t('sections.backup')} description={inApp ? tWords('backup_app') : t('sections.backup_description')}>
        {settingsSyncEnabled && (
          <SettingItem label={t('settings_sync.label')} description={inApp ? tWords('sync_app') : t('settings_sync.description')} term="sync">
            <ToggleSwitch checked={!settingsSyncDisabled} onChange={(checked) => updateSetting('settingsSyncDisabled', !checked)} />
          </SettingItem>
        )}

        {isFeatureEnabled('settingsExportEnabled') && (
        <SettingItem label={t('export_settings.label')} description={t('export_settings.description')}>
          <Button variant="outline" size="sm" onClick={handleExport}>
            {t('export_settings.button')}
          </Button>
        </SettingItem>
        )}

        {isFeatureEnabled('settingsExportEnabled') && (
        <SettingItem label={t('import_settings.label')} description={t('import_settings.description')}>
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button variant="outline" size="sm" onClick={handleImport}>
              {t('import_settings.button')}
            </Button>
          </>
        </SettingItem>
        )}
      </SettingsSection>

      <MailBackupSettings />
    </div>
  );
}

/**
 * Settings > Troubleshooting, listed only with "Show advanced settings" on
 * (settings reorg 2026-11-05): fix a stale view or start over, and debugging
 * (detailed logging, the desktop app's developer tools). Every section is
 * advanced, so a search result or link shows its row alone with the switch
 * off. These were on Backup & reset and General.
 */
export function TroubleshootingSettings() {
  const t = useTranslations('settings.advanced');
  const { settingsSyncDisabled, resetToDefaults } = useSettingsStore();
  const { settingsSyncEnabled } = useConfig();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const tP2 = useTranslations('uxp2_settings');
  // A reset keeps the sync choice, so the other devices change only when sync is on (settings-p2-18).
  const syncOn = settingsSyncEnabled && !settingsSyncDisabled;

  const handleReset = () => {
    resetToDefaults();
    toast.success(t('reset_settings.done'));
  };

  return (
    <div className="space-y-8">
      <SettingsSection id="fix" advanced title={t('sections.fix')} description={t('sections.fix_description')}>
        <SettingItem label={t('refresh_cache.label')} description={t('refresh_cache.description')} term="cache">
          <Button variant="outline" size="sm" onClick={() => setShowRefreshConfirm(true)}>
            {t('refresh_cache.button')}
          </Button>
        </SettingItem>

        <SettingItem label={t('reset_settings.label')} description={t('reset_settings.description')}>
          <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(true)}>
            {t('reset_settings.button')}
          </Button>
        </SettingItem>
      </SettingsSection>

      <ConfirmDialog
        isOpen={showRefreshConfirm}
        onClose={() => setShowRefreshConfirm(false)}
        onConfirm={() => clearCachedData() /* reloads the page */}
        title={t('refresh_cache.confirm_title')}
        message={t('refresh_cache.description')}
        confirmText={t('refresh_cache.button')}
      />
      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleReset}
        title={t('reset_settings.confirm_title')}
        message={`${tP2('reset.message')} ${syncOn ? tP2('reset.sync_on') : tP2('reset.sync_off')}`}
        confirmText={t('reset_settings.button')}
        variant="destructive"
      />

      <DebugSettings />
    </div>
  );
}
