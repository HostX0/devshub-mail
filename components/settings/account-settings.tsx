"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Check, GripVertical, Plus, Star, AlertCircle, ChevronRight } from '@/components/icons';
import { useAuthStore } from '@/stores/auth-store';
import { useEmailStore } from '@/stores/email-store';
import { useAccountStore, type AccountEntry } from '@/stores/account-store';
import { useManagedAccountStore } from '@/stores/managed-account-store';
import type { SharedAccount } from '@/lib/jmap/types';
import { SettingsSection, SettingItem } from './settings-section';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { getMaxAccounts } from '@/lib/account-utils';
import { formatFileSize, cn } from '@/lib/utils';
import { toUnicodeDomain, toUnicodeEmail } from '@/lib/idn';
import { IS_LITE } from '@/lib/lite';
import { usePolicyStore } from '@/stores/policy-store';
import { AccountArchiveSettings } from './account-archive-settings';
import { DisplayNameSection } from './account-security-settings';
import { EmailAddressesSection } from './identity-settings';
import { MultipleAccountsSection } from './layout-settings';
import { useAccountSecurityStore } from '@/stores/account-security-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useLocaleStore } from '@/stores/locale-store';

async function prepareAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) throw new Error('Choose an image under 8 MB');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 160;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable');
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2,
      side, side, 0, 0, 160, 160);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
    if (dataUrl.length > 120_000) throw new Error('Image is too large');
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function hostnameOf(serverUrl: string): string {
  try { return toUnicodeDomain(new URL(serverUrl).hostname); } catch { return serverUrl; }
}

// First scoped settings tab to land on for a shared account, by capability.
// Mirrors the scoped-tab gating in the settings page. null = nothing editable.
function firstScopedTab(caps: SharedAccount['capabilities']): string | null {
  if (caps.sieve) return 'filters';
  if (caps.mail) return 'vacation';
  if (caps.calendars) return 'calendar';
  if (caps.contacts) return 'contacts';
  return null;
}

export function AccountSettings() {
  const t = useTranslations('settings.account');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { username, serverUrl, isDemoMode, primaryIdentity, authMode, client } = useAuthStore();
  const activeAccountId = useAuthStore((s) => s.activeAccountId);
  const switchAccount = useAuthStore((s) => s.switchAccount);
  const setManagedAccount = useManagedAccountStore((s) => s.setManagedAccount);
  const archiveEnabled = usePolicyStore((s) => s.isFeatureEnabled('accountArchiveEnabled')) && !IS_LITE && !isDemoMode;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // The display name is editable on Stalwart (the principal's name) for
  // password sign-ins; OAuth and token sessions cannot manage the principal.
  const { isStalwart, probe, fetchPrincipal } = useAccountSecurityStore();
  const canEditDisplayName = isStalwart === true && authMode !== 'oauth' && authMode !== 'token';
  // Wait for `client` before probing, as the Security page does: on reload
  // the persisted session flips authenticated before the client reconnects.
  useEffect(() => {
    if (!isAuthenticated || !client) return;
    if (isStalwart === null) {
      void probe().then((detected) => { if (detected) void fetchPrincipal(); });
    } else if (isStalwart) {
      void fetchPrincipal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, client, isStalwart]);

  // Shared/group accounts delegated to this session (excludes the user's own
  // primary account). These can be drilled into for scoped settings editing.
  const sharedAccounts = useMemo<SharedAccount[]>(
    () => (client?.getSharedAccounts() ?? []).filter((a) => !a.isPrimary),
    [client],
  );
  const { quota } = useEmailStore();
  const accounts = useAccountStore((s) => s.accounts);
  const setDefaultAccount = useAccountStore((s) => s.setDefaultAccount);
  const reorderAccounts = useAccountStore((s) => s.reorderAccounts);
  const account = useAccountStore((s) => activeAccountId ? s.getAccountById(activeAccountId) : undefined);
  const profileAvatarDataUrls = useSettingsStore((s) => s.profileAvatarDataUrls);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const locale = useLocaleStore((s) => s.locale);
  const isArabic = locale === 'ar';

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const draggedIndexRef = useRef<number | null>(null);

  const quotaPercentage = quota && quota.total > 0 ? Math.min(Math.round((quota.used / quota.total) * 100), 100) : 0;
  // `account.displayName` is refreshed from the server on every login/restore
  // (Stalwart principal "Full name" when available - #900); the identity name
  // is only a fallback until that entry exists.
  const displayName = account?.displayName || primaryIdentity?.name || (isDemoMode ? 'Nora Lindqvist' : undefined);
  const email = primaryIdentity?.email || account?.email || username;
  const max = getMaxAccounts();

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    draggedIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    const fromIndex = draggedIndexRef.current;
    if (fromIndex === null || fromIndex === dropIndex) return;
    const next = accounts.map((a) => a.id);
    const [moved] = next.splice(fromIndex, 1);
    next.splice(dropIndex, 0, moved);
    reorderAccounts(next);
  }, [accounts, reorderAccounts]);

  const handleDragEnd = useCallback(() => {
    draggedIndexRef.current = null;
    setDragOverIndex(null);
  }, []);

  const moveAccount = useCallback((from: number, to: number) => {
    if (to < 0 || to >= accounts.length || from === to) return;
    const next = accounts.map((a) => a.id);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    reorderAccounts(next);
  }, [accounts, reorderAccounts]);

  const handleSwitch = useCallback((id: string) => {
    if (id === activeAccountId) return;
    void switchAccount(id);
  }, [activeAccountId, switchAccount]);

  const handleAddAccount = useCallback(() => {
    router.push(`/login?mode=add-account` as never);
  }, [router]);

  // Enter scoped settings mode for a shared/group account: set the managed
  // account, then steer the settings panel to its first editable tab via the
  // existing 'settings-tab-change' event the page already listens for.
  const handleManageShared = useCallback((account: SharedAccount) => {
    const tab = firstScopedTab(account.capabilities);
    if (!tab) return;
    setManagedAccount(account);
    window.dispatchEvent(new CustomEvent('settings-tab-change', { detail: tab }));
  }, [setManagedAccount]);

  return (
    <div className="space-y-8">
      <SettingsSection id="profile" title={t('title')} description={t('description')}>
        {account && (
          <div className="mb-5 flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <Avatar name={displayName || undefined} email={email || undefined} size="lg" disableFavicon className="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">{isArabic ? 'صورتك الشخصية' : 'Profile photo'}</div>
              <p className="mt-1 text-xs text-muted-foreground">{isArabic ? 'تظهر في حسابك وتتزامن مع أجهزتك.' : 'Shown on your account and synced across devices.'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer text-sm font-medium text-primary hover:underline">
                  {isArabic ? 'تغيير الصورة' : 'Change photo'}
                  <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    try {
                      const dataUrl = await prepareAvatar(file);
                      updateSetting('profileAvatarDataUrls', { ...profileAvatarDataUrls, [account.id]: dataUrl });
                      setAvatarError(null);
                    } catch (error) { setAvatarError(error instanceof Error ? error.message : 'Invalid image'); }
                  }} />
                </label>
                {profileAvatarDataUrls[account.id] && (
                  <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => {
                    const next = { ...profileAvatarDataUrls };
                    delete next[account.id];
                    updateSetting('profileAvatarDataUrls', next);
                  }}>{isArabic ? 'إزالة' : 'Remove'}</button>
                )}
              </div>
              {avatarError && <p role="alert" className="mt-2 text-xs text-destructive">{avatarError}</p>}
            </div>
          </div>
        )}
        {/* Display Name: editable where the server lets us, read-only otherwise. */}
        {canEditDisplayName ? (
          <DisplayNameSection />
        ) : (
          <SettingItem label={t('name_label')}>
            <span className="text-sm text-foreground">{displayName || tCommon('unknown')}</span>
          </SettingItem>
        )}

        {/* Email Address */}
        <SettingItem label={t('email.label')}>
          <span className="text-sm text-foreground">{email ? toUnicodeEmail(email) : tCommon('unknown')}</span>
        </SettingItem>

        {/* Username / Login (show when it differs from email) */}
        {username && username !== email && (
          <SettingItem label={t('username_label')}>
            <span className="text-sm text-foreground">{toUnicodeEmail(username)}</span>
          </SettingItem>
        )}

        {/* Authentication Method */}
        <SettingItem label={t('auth_method_label')}>
          <span className="text-sm text-foreground">
            {authMode === 'oauth'
              ? t('auth_method_oauth')
              : authMode === 'token' ? t('auth_method_token') : t('auth_method_basic')}
          </span>
        </SettingItem>

        {/* Server */}
        <SettingItem label={t('server.label')} advanced>
          <span className="text-sm text-foreground truncate max-w-xs">
            {serverUrl || tCommon('unknown')}
          </span>
        </SettingItem>

        {/* Storage */}
        {quota && quota.total > 0 && (
          <SettingItem
            label={t('storage.label')}
            description={t('storage.used', {
              used: formatFileSize(quota.used),
              total: formatFileSize(quota.total),
            })}
          >
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm text-foreground">
                {t('storage.percentage', { percent: quotaPercentage })}
              </span>
              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${quotaPercentage}%` }}
                />
              </div>
            </div>
          </SettingItem>
        )}

        {/* Demo mode indicator */}
        {isDemoMode && (
          <SettingItem label={t('account_type_label')}>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              {t('demo_account')}
            </span>
          </SettingItem>
        )}
      </SettingsSection>

      <EmailAddressesSection />

      {email && serverUrl && (
        <SettingsSection title={isArabic ? 'استخدم بريدك على أي جهاز' : 'Use your mail on any device'}
          description={isArabic ? 'إعدادات Apple Mail وOutlook وGmail. اختر إضافة حساب آخر ثم IMAP.' : 'Settings for Apple Mail, Outlook, and Gmail. Add another account and choose IMAP.'}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold text-foreground">{isArabic ? 'البريد الوارد · IMAP' : 'Incoming · IMAP'}</div>
              <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div><dt className="inline">{isArabic ? 'الخادم: ' : 'Server: '}</dt><dd className="inline font-medium text-foreground select-all">{hostnameOf(serverUrl)}</dd></div>
                <div><dt className="inline">{isArabic ? 'المنفذ: ' : 'Port: '}</dt><dd className="inline font-medium text-foreground">993 · SSL/TLS</dd></div>
              </dl>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold text-foreground">{isArabic ? 'البريد الصادر · SMTP' : 'Outgoing · SMTP'}</div>
              <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div><dt className="inline">{isArabic ? 'الخادم: ' : 'Server: '}</dt><dd className="inline font-medium text-foreground select-all">{hostnameOf(serverUrl)}</dd></div>
                <div><dt className="inline">{isArabic ? 'المنفذ: ' : 'Port: '}</dt><dd className="inline font-medium text-foreground">465 · SSL/TLS</dd></div>
              </dl>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {isArabic ? 'اسم المستخدم هو عنوان بريدك كاملاً: ' : 'Use your full email address as the username: '}
            <span className="font-medium text-foreground select-all">{email}</span>
            {isArabic ? '. كلمة المرور نفسها للبريد، وفعّل المصادقة للبريد الصادر.' : '. Use the same mailbox password and enable outgoing authentication.'}
          </p>
        </SettingsSection>
      )}

      {/* Logged-in accounts list */}
      {accounts.length > 0 && (
        <SettingsSection id="browser" title={t('accounts.title')} description={t('accounts.description')}>
          <div className="space-y-2">
            {accounts.map((a, index) => (
              <AccountRow
                key={a.id}
                account={a}
                index={index}
                isActive={a.id === activeAccountId}
                isFirst={index === 0}
                isLast={index === accounts.length - 1}
                isDragOver={dragOverIndex === index}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onMoveUp={() => moveAccount(index, index - 1)}
                onMoveDown={() => moveAccount(index, index + 1)}
                onSwitch={() => handleSwitch(a.id)}
                onSetDefault={() => setDefaultAccount(a.id)}
                labels={{
                  active: t('accounts.active'),
                  default: t('accounts.default_badge'),
                  setDefault: t('accounts.set_default'),
                  switchTo: t('accounts.switch_to'),
                  moveUp: t('accounts.move_up'),
                  moveDown: t('accounts.move_down'),
                  dragHandle: t('accounts.drag_handle'),
                }}
              />
            ))}

            {accounts.length < max && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddAccount}
                className="w-full"
              >
                <Plus className="w-4 h-4 me-2" />
                {t('accounts.add')}
              </Button>
            )}
          </div>
        </SettingsSection>
      )}

      {archiveEnabled && <AccountArchiveSettings />}

      <MultipleAccountsSection />

      {/* Shared / group accounts delegated to this session. Clicking one drills
          into a scoped settings view (filters, vacation, calendars, contacts). */}
      {sharedAccounts.length > 0 && (
        <SettingsSection id="shared" title={t('shared_accounts.title')} description={t('shared_accounts.description')}>
          <div className="space-y-2">
            {sharedAccounts.map((acc) => {
              const editable = firstScopedTab(acc.capabilities) !== null;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleManageShared(acc)}
                  disabled={!editable}
                  className={cn(
                    'flex items-center gap-3 w-full p-3 border border-border rounded-lg text-start transition-colors',
                    editable ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <Avatar
                    name={acc.name}
                    size="sm"
                    className="w-9 h-9 text-sm flex-shrink-0"
                    disableFavicon
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{acc.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t('shared_accounts.shared_label')}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </SettingsSection>
      )}
    </div>
  );
}

interface AccountRowProps {
  account: AccountEntry;
  index: number;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSwitch: () => void;
  onSetDefault: () => void;
  labels: {
    active: string;
    default: string;
    setDefault: string;
    switchTo: string;
    moveUp: string;
    moveDown: string;
    dragHandle: string;
  };
}

function AccountRow({
  account,
  index,
  isActive,
  isFirst,
  isLast,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onSwitch,
  onSetDefault,
  labels,
}: AccountRowProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={cn(
        'flex items-center gap-3 p-3 border rounded-lg transition-colors',
        isDragOver
          ? 'border-primary bg-primary/5'
          : isActive
            ? 'border-border bg-accent/30'
            : 'border-border hover:bg-muted/50'
      )}
    >
      <div
        className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground flex-shrink-0"
        title={labels.dragHandle}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="relative flex-shrink-0">
        <Avatar
          name={account.displayName || account.label}
          email={account.email || account.username}
          size="sm"
          className="w-9 h-9 text-sm"
          disableFavicon
          fallbackColor={account.avatarColor}
        />
        {isActive && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-primary-foreground" />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onSwitch}
        disabled={isActive}
        className={cn(
          'min-w-0 flex-1 text-start',
          !isActive && 'cursor-pointer'
        )}
        title={isActive ? labels.active : labels.switchTo}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">
            {toUnicodeEmail(account.displayName || account.label)}
          </span>
          {account.isDefault && (
            <Star className="w-3 h-3 text-amber-500 flex-shrink-0 fill-amber-500" aria-label={labels.default} />
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {toUnicodeEmail(account.email || account.username)}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          {account.hasError ? (
            <AlertCircle className="w-3 h-3 text-destructive" />
          ) : (
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              account.isConnected ? 'bg-green-500' : 'bg-muted-foreground/40'
            )} />
          )}
          <span className="text-[10px] text-muted-foreground truncate">
            {hostnameOf(account.serverUrl)}
          </span>
        </div>
      </button>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        {!account.isDefault && (
          <button
            type="button"
            onClick={onSetDefault}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-amber-500 transition-colors"
            title={labels.setDefault}
            aria-label={labels.setDefault}
          >
            <Star className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          title={labels.moveUp}
          aria-label={labels.moveUp}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 10l4-4 4 4" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          title={labels.moveDown}
          aria-label={labels.moveDown}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
