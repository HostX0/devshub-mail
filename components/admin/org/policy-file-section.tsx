'use client';

import { useCoreAdminI18n, type CoreAdminTranslator } from '@/components/admin/core-i18n';

import { useRef, useState } from 'react';
import { Download, Loader2, Upload } from '@/components/icons';
import { SettingsSection } from '@/components/settings/settings-section';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/browser-navigation';
import type { KeyChanges, PolicyChangeSummary } from '@/lib/admin/policy-diff';
import type { OrgPolicyDraft } from './use-org-policy-draft';

/** "contrast, fontSize and 3 more": which keys, so an admin can tell what the file does. */
function names(keys: string[], tr: CoreAdminTranslator): string {
  const shown = keys.slice(0, 5).join(', ');
  return keys.length > 5 ? tr('{0} and {1} more', { 0: shown, 1: keys.length - 5 }) : shown;
}

function describe(label: string, changes: KeyChanges, tr: CoreAdminTranslator): string | null {
  const parts = [
    changes.added.length ? tr('{0} added ({1})', { 0: changes.added.length, 1: names(changes.added, tr) }) : null,
    changes.changed.length ? tr('{0} changed ({1})', { 0: changes.changed.length, 1: names(changes.changed, tr) }) : null,
    changes.removed.length ? tr('{0} removed ({1})', { 0: changes.removed.length, 1: names(changes.removed, tr) }) : null,
  ].filter(Boolean);
  return parts.length ? `${tr(label)}: ${parts.join(', ')}` : null;
}

function summaryLines(summary: PolicyChangeSummary, tr: CoreAdminTranslator): string[] {
  return [
    describe('Domains and groups', summary.scopes, tr),
    describe('Organisation settings', summary.organisation, tr),
    describe('Locked, limited and hidden settings', summary.restrictions, tr),
    describe('Features', summary.features, tr),
    describe('Defaults', summary.defaults, tr),
    summary.other.length ? tr('Also: {0}', { 0: summary.other.join(', ') }) : null,
  ].filter((line): line is string => !!line);
}

/**
 * Export and import of the whole user policy as policy.json, so the policy
 * can live in git, move to another instance or go next to a Lite build.
 * An import shows what it changes before it replaces anything.
 */
export function PolicyFileSection({ draft }: { draft: OrgPolicyDraft }) {
  const tr = useCoreAdminI18n();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; text: string; summary: PolicyChangeSummary } | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportFile() {
    const res = await apiFetch('/api/admin/policy/file');
    if (!res.ok) {
      draft.setMessage({ type: 'error', text: tr("Could not export the policy") });
      return;
    }
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'bulwark-policy.json';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function pick(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const res = await apiFetch('/api/admin/policy/file?preview=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        draft.setMessage({ type: 'error', text: tr(data.error, { fallback: tr("Could not read the file") }) });
        return;
      }
      setPending({ name: file.name, text, summary: data.summary });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function apply() {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await apiFetch('/api/admin/policy/file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: pending.text });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        draft.setMessage({ type: 'error', text: tr(data.error, { fallback: tr("Could not import the file") }) });
        return;
      }
      setPending(null);
      await draft.reload();
      draft.setMessage({ type: 'success', text: tr("Imported {0}.", { 0: pending.name }) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection
      id="policy-file"
      title={tr("Policy file")}
      description={tr("Everything on the pages under Users is one file, policy.json. Export it to keep it in git or copy it to another Bulwark or a Lite build; importing replaces the current policy.")}
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void exportFile()}>
          <Download className="h-3.5 w-3.5" />{' '}{tr("Export policy.json")}{' '}</Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={busy || draft.dirty}
          onClick={() => input.current?.click()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}{' '}{tr("Import a file")}{' '}</Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label={tr("Policy file to import")}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) void pick(file); }}
        />
      </div>
      {draft.dirty && <p className="text-xs text-muted-foreground">{tr("Save or discard your changes first.")}</p>}
      {pending && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2" data-testid="policy-import-preview">
          <p className="text-sm font-medium text-foreground">{tr("Importing")}{' '}{pending.name}</p>
          {pending.summary.unchanged ? (
            <p className="text-sm text-muted-foreground">{tr("It matches the current policy; nothing would change.")}</p>
          ) : (
            <ul className="list-disc ps-5 text-sm text-foreground">
              {summaryLines(pending.summary, tr).map((line) => <li key={line}>{line}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="h-8 text-xs" disabled={busy || pending.summary.unchanged} onClick={() => void apply()}>{' '}{tr("Replace the current policy")}{' '}</Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={busy} onClick={() => setPending(null)}>{' '}{tr("Cancel")}{' '}</Button>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
