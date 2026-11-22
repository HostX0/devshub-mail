'use client';

import { useCoreAdminI18n } from '@/components/admin/core-i18n';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from '@/components/icons';
import { SettingsSection, SettingItem, ToggleSwitch } from '@/components/settings/settings-section';
import { ConfigNote, RevertButton, SourceBadge } from '@/components/admin/config-items';
import { AdminLink } from '@/components/admin/admin-link';
import { apiFetch } from '@/lib/browser-navigation';
import type { OutgoingHost } from '@/lib/admin/outgoing-hosts-registry';
import type { ReachableHost } from '@/lib/admin/reachable-hosts';
import type { OrgPolicyDraft } from '../use-org-policy-draft';

interface OutgoingHostsState {
  noThirdPartyTraffic: boolean;
  source: 'env' | 'admin' | 'default';
  readOnly: boolean;
  envLocked: boolean;
  builtIn: OutgoingHost[];
  reachable: ReachableHost[];
  networkPlugins: { id: string; name: string }[];
  /** Running in the mode with the servers entered on their admin page; these manifest servers stay off. */
  partlyOffPlugins?: { id: string; name: string; hosts: string[] }[];
}

const SIDE_LABEL: Record<ReachableHost['side'], string> = {
  server: 'this server',
  browser: 'the browser',
  both: 'server and browser',
};

/**
 * Organisation > Security > Third-party traffic (#903). The switch is config,
 * not policy: it is saved through /api/admin/config like the Server page's
 * keys, applies to the whole server whatever scope the scope bar shows, and
 * is read-only when the environment or a read-only config sets it.
 */
export function ThirdPartySection({ draft }: { draft: OrgPolicyDraft }) {
  const tr = useCoreAdminI18n();
  const [state, setState] = useState<OutgoingHostsState | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const { setMessage } = draft;

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/outgoing-hosts');
      if (!res.ok) throw new Error();
      setState(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(on: boolean) {
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noThirdPartyTraffic: on }),
      });
      if (res.ok) {
        setMessage({
          type: 'success',
          text: on
            ? tr("Third-party traffic is off. The server stops at once; browsers follow the next time Bulwark loads.")
            : tr("Third-party traffic is allowed again."),
        });
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: tr(data.error, { fallback: tr("Could not save the setting") }) });
      }
    } catch {
      setMessage({ type: 'error', text: tr("Could not save the setting") });
    } finally {
      await load();
      setSaving(false);
    }
  }

  async function revert() {
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'noThirdPartyTraffic' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: tr(data.error, { fallback: tr("Could not revert the setting") }) });
      }
    } catch {
      setMessage({ type: 'error', text: tr("Could not revert the setting") });
    } finally {
      await load();
      setSaving(false);
    }
  }

  const on = !!state?.noThirdPartyTraffic;
  const locked = !!state && (state.readOnly || state.envLocked);
  const relays = state?.reachable.filter((h) => h.kind === 'Push relay') ?? [];

  return (
    <SettingsSection id="third-party" title={tr("Third-party traffic")} description={tr("Whether Bulwark connects to anything outside your own servers.")}>
      <p className="text-sm text-muted-foreground" data-testid="third-party-scope-note">{' '}{tr("This switch is for the whole server, not per domain or group: most of what it stops, such as telemetry and the version check, runs for no particular user.")}{' '}</p>

      {!state && !failed && (
        <div className="flex items-center py-3 text-sm text-muted-foreground">
          <Loader2 className="me-2 h-4 w-4 animate-spin" />{' '}{tr("Loading")}{' '}</div>
      )}
      {failed && <p className="text-sm text-destructive">{tr("Could not load the outgoing hosts.")}</p>}

      {state && (
        <>
          <SettingItem
            label={tr("No third-party traffic")}
            description={tr("Bulwark and your users' browsers stop contacting services outside your own servers: telemetry, the version check, the built-in push relay, the official extension directory, the connector, sender icons, MyMemory translation, map links and OpenPGP key lookups at other domains. Plugins that declare network access don't run; the others do. The page's security policy then allows only the hosts listed below.")}
          >
            <div className="flex items-center gap-1.5" data-testid="third-party-switch">
              <SourceBadge source={state.source} label={state.source === 'env' ? 'NO_THIRD_PARTY_TRAFFIC' : 'config.json'} />
              <ToggleSwitch checked={on} disabled={saving || locked} onChange={(checked) => void save(checked)} />
              {state.source === 'admin' && !locked && <RevertButton onClick={() => void revert()} />}
            </div>
          </SettingItem>

          {state.envLocked && (
            <ConfigNote>{tr("Set by NO_THIRD_PARTY_TRAFFIC in the environment. Change it there and restart Bulwark.")}</ConfigNote>
          )}
          {state.readOnly && !state.envLocked && (
            <ConfigNote>{tr("The configuration is read-only. Set noThirdPartyTraffic in config.json, or NO_THIRD_PARTY_TRAFFIC in the environment.")}</ConfigNote>
          )}
          {on && relays.length === 0 && (
            <ConfigNote>{' '}{tr("Push notifications now need a relay you run yourself. Add one under")}{' '}
              <AdminLink href="/admin/policy" className="underline underline-offset-2">{tr("Features and settings > Push relays")}</AdminLink>{tr("; until then users get new mail only while Bulwark is open.")}{' '}</ConfigNote>
          )}
          {on && state.networkPlugins.length > 0 && (
            <ConfigNote>{' '}{tr("Not running because they declare network access:")}{' '}{state.networkPlugins.map((p) => p.name).join(', ')}.
            </ConfigNote>
          )}
          {on && (state.partlyOffPlugins?.length ?? 0) > 0 && (
            <ConfigNote>{' '}{tr("Running with only the servers entered on their admin page:")}{' '}{state.partlyOffPlugins!.map((p) => tr("{0} ({1} stays off)", { 0: p.name, 1: p.hosts.join(', ') })).join('; ')}.
            </ConfigNote>
          )}

          <div data-testid="third-party-reachable">
            <h4 className="text-sm font-medium text-foreground">{on ? tr("Still reachable") : tr("Stays reachable with the switch on")}</h4>
            <p className="mt-1 text-xs text-muted-foreground">{tr("Hosts you configured yourself, and what users enter themselves.")}</p>
            {state.reachable.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{tr("None configured.")}</p>
            ) : (
              <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                {state.reachable.map((h) => (
                  <li key={`${tr(h.kind)}|${h.host}|${h.setIn}`} className="flex flex-col gap-0.5 px-3 py-2 text-sm sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
                    <span className="font-medium text-foreground sm:w-44 sm:shrink-0">{tr(h.kind)}</span>
                    <span className={h.origin ? 'min-w-0 break-all font-mono text-xs text-foreground' : 'min-w-0 text-xs italic text-foreground'}>{h.host}</span>
                    <span className="text-xs text-muted-foreground sm:ms-auto sm:text-end">{h.setIn} · {tr(SIDE_LABEL[h.side])}</span>
                    {h.note && <span className="text-xs text-amber-700 dark:text-amber-400 sm:basis-full">{tr(h.note)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <details data-testid="third-party-builtin">
            <summary className="cursor-pointer text-sm font-medium text-foreground">{' '}{tr("Built-in outside hosts (")}{state.builtIn.length}){on ? tr(", all off") : ''}
            </summary>
            <ul className="mt-2 divide-y divide-border rounded-md border border-border">
              {state.builtIn.map((h) => (
                <li key={h.id} className="space-y-0.5 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="break-all font-mono text-xs text-foreground">{h.host}</span>
                    <span className="text-xs text-muted-foreground">{h.side === 'server' ? tr("this server") : tr("the browser")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{tr(h.usedBy)}</p>
                  <p className="text-xs text-muted-foreground">{on ? tr(h.inMode) : tr("Without the switch: {0}", { 0: tr(h.off) })}</p>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </SettingsSection>
  );
}
