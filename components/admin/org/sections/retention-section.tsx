'use client';

import { useCoreAdminI18n } from '@/components/admin/core-i18n';

import { SettingItem, SettingsSection } from '@/components/settings/settings-section';
import { InheritNote } from '../org-page';
import type { OrgPolicyDraft } from '../use-org-policy-draft';

const MAX_DAYS = 3650;
const DOCS_URL = 'https://bulwarkmail.org/docs/guides/organisation/announcements#how-long-trash-and-junk-keep-mail';

function DaysInput({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (days: number) => void }) {
  const tr = useCoreAdminI18n();
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        data-testid={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_DAYS}
        step={1}
        aria-label={tr("{0} (days)", { 0: label })}
        placeholder={tr("Off")}
        value={value > 0 ? value : ''}
        onChange={(e) => {
          const raw = e.target.value.trim();
          const parsed = raw === '' ? 0 : Math.round(Number(raw));
          if (!Number.isFinite(parsed)) return;
          onChange(Math.min(MAX_DAYS, Math.max(0, parsed)));
        }}
        className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden"
      />
      <span className="text-sm text-muted-foreground">{tr("days")}</span>
    </div>
  );
}

/**
 * Organisation > Notices > Trash and Junk (enterprise pack item 12): the
 * days the mail server keeps mail there, as the admin set them in the
 * server, for one quiet line in those folders. Bulwark can't read the
 * server's value as a normal user, so the admin types it.
 */
export function RetentionSection({ draft }: { draft: OrgPolicyDraft }) {
  const tr = useCoreAdminI18n();
  const trash = draft.orgValue('retention', 'trashDays');
  const junk = draft.orgValue('retention', 'junkDays');
  return (
    <SettingsSection
      id="retention"
      title={tr("Trash and Junk")}
      description={tr("One quiet line in Trash and in Junk: “Messages here are deleted 30 days after they were moved here.” Empty shows no line.")}
    >
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground" data-testid="org-retention-stalwart">{' '}{tr("Enter what your mail server does: Bulwark only shows the number. Stalwart uses one setting for both folders, Data Retention > Trash (expungeTrashAfter, 30 days unless you changed it), counted from when a message was moved into Trash or Junk. Bulwark can't read it with a user's sign-in, so type the same number here. Give Junk a smaller number only if something else (a filter or a clean-up job) really deletes it sooner.")}{' '}
        <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">{' '}{tr("More about this")}{' '}</a>
      </div>

      <SettingItem label={tr("Trash keeps mail for")} description={tr("Shown in every Trash folder, shared ones included.")}>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <DaysInput id="org-retention-trash" label={tr("Trash keeps mail for")} value={trash.value} onChange={(d) => draft.setOrgValue('retention', 'trashDays', d)} />
          <InheritNote draft={draft} own={trash.own} everyone={trash.everyone > 0 ? tr('{0} days', { 0: trash.everyone }) : tr('no line')} onReset={() => draft.clearOrgValue('retention', 'trashDays')} />
        </div>
      </SettingItem>
      <SettingItem label={tr("Junk keeps mail for")} description={tr("Shown in every Junk folder.")}>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <DaysInput id="org-retention-junk" label={tr("Junk keeps mail for")} value={junk.value} onChange={(d) => draft.setOrgValue('retention', 'junkDays', d)} />
          <InheritNote draft={draft} own={junk.own} everyone={junk.everyone > 0 ? tr('{0} days', { 0: junk.everyone }) : tr('no line')} onReset={() => draft.clearOrgValue('retention', 'junkDays')} />
        </div>
      </SettingItem>
    </SettingsSection>
  );
}
