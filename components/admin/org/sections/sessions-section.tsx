'use client';

import { useCoreAdminI18n } from '@/components/admin/core-i18n';

import { SettingItem, SettingsSection } from '@/components/settings/settings-section';
import { InheritNote } from '../org-page';
import type { OrgPolicyDraft } from '../use-org-policy-draft';

interface SessionField {
  key: 'idleMinutes' | 'maxHours' | 'warnSeconds';
  label: string;
  description: string;
  unit: string;
  max: number;
  /** What 0 means. */
  zero: string;
}

const FIELDS: SessionField[] = [
  {
    key: 'idleMinutes',
    label: 'Sign out after inactivity',
    description: 'Signs users out of every account in the browser after this many minutes without activity in any Bulwark tab. Open messages are saved as drafts first.',
    unit: 'minutes',
    max: 7 * 24 * 60,
    zero: 'Off',
  },
  {
    key: 'maxHours',
    label: 'Maximum session length',
    description: 'Signs users out this many hours after they signed in, active or not, also with "Remember me". The server enforces domain values too; group values only apply in the browser.',
    unit: 'hours',
    max: 24 * 365,
    zero: 'Off',
  },
  {
    key: 'warnSeconds',
    label: 'Warning before signing out',
    description: 'How long a countdown shows before either limit signs users out. During the inactivity warning users can choose to stay signed in.',
    unit: 'seconds',
    max: 600,
    zero: 'No warning',
  },
];

/** Organisation > Security > Sessions: the idle timeout and the maximum session length. */
export function SessionsSection({ draft }: { draft: OrgPolicyDraft }) {
  const tr = useCoreAdminI18n();
  return (
    <SettingsSection id="sessions" title={tr("Sessions")} description={tr("Sign users out after a time without activity, or a fixed time after they signed in. Both are off until you set them.")}>
      {FIELDS.map((field) => {
        const { value, own, everyone } = draft.orgValue('session', field.key);
        const inputId = `org-session-${field.key}`;
        return (
          <SettingItem key={field.key} label={tr(field.label)} description={tr(field.description)}>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <div className="flex items-center gap-2">
                <input
                  id={inputId}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={field.max}
                  step={1}
                  aria-label={`${tr(field.label)} (${tr(field.unit)})`}
                  placeholder={tr(field.zero)}
                  value={value > 0 ? value : ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    const parsed = raw === '' ? 0 : Math.round(Number(raw));
                    if (!Number.isFinite(parsed)) return;
                    draft.setOrgValue('session', field.key, Math.min(field.max, Math.max(0, parsed)));
                  }}
                  className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden"
                />
                <span className="text-sm text-muted-foreground">{tr(field.unit)}</span>
              </div>
              <InheritNote
                draft={draft}
                own={own}
                everyone={everyone > 0 ? `${everyone} ${tr(field.unit)}` : tr(field.zero)}
                onReset={() => draft.clearOrgValue('session', field.key)}
              />
            </div>
          </SettingItem>
        );
      })}
    </SettingsSection>
  );
}
