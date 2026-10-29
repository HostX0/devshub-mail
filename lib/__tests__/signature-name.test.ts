import { describe, expect, it } from 'vitest';
import { renameSignature } from '../signature-name';
import type { Identity } from '@/lib/jmap/types';

const identity = {
  name: 'فريق سلامة',
  textSignature: 'فريق سلامة\nفريق سلامة | Salama\ninfo@salama.health',
  htmlSignature: '<div><strong>فريق سلامة</strong><br>فريق سلامة | Salama</div>',
} as Identity;

describe('renameSignature', () => {
  it('changes only the name in the standard signature', () => {
    const updated = renameSignature(identity, 'سارة علي');
    expect(updated.textSignature).toBe('سارة علي\nفريق سلامة | Salama\ninfo@salama.health');
    expect(updated.htmlSignature).toBe('<div><strong>سارة علي</strong><br>فريق سلامة | Salama</div>');
  });

  it('preserves a custom signature instead of overwriting it', () => {
    expect(renameSignature({ ...identity, textSignature: 'مرحبا من العيادة' }, 'سارة علي'))
      .toEqual({ name: 'سارة علي' });
  });

  it('escapes a name used in HTML', () => {
    expect(renameSignature(identity, 'A&B <C>').htmlSignature)
      .toContain('<strong>A&amp;B &lt;C&gt;</strong>');
  });
});
