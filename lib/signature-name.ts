import type { Identity } from '@/lib/jmap/types';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

/** Change only the name in a matching branded signature, preserving staff edits. */
export function renameSignature(identity: Identity, newName: string):
  { name: string; textSignature?: string; htmlSignature?: string } {
  const name = newName.trim();
  const previous = identity.name.trim();
  const text = identity.textSignature ?? '';
  const html = identity.htmlSignature ?? '';
  const previousHtml = `<strong>${escapeHtml(previous)}</strong>`;
  if (previous && text.startsWith(`${previous}\n`) && html.includes(previousHtml)) {
    return {
      name,
      textSignature: name + text.slice(previous.length),
      htmlSignature: html.replace(previousHtml, `<strong>${escapeHtml(name)}</strong>`),
    };
  }
  return { name };
}
