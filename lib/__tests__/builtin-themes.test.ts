import { describe, it, expect } from 'vitest';
import { BUILTIN_THEMES } from '../builtin-themes';

describe('BUILTIN_THEMES', () => {
  it('includes the standard themes and the seven occasion palettes', () => {
    expect(BUILTIN_THEMES.filter(theme => theme.id.startsWith('builtin-')).length).toBeGreaterThanOrEqual(7);
    expect(BUILTIN_THEMES.filter(theme => theme.id.startsWith('devshub-'))).toHaveLength(7);
  });

  it('all themes have required fields', () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.id).toBeTruthy();
      expect(theme.name).toBeTruthy();
      expect(theme.version).toBeTruthy();
      expect(theme.author).toBe(theme.id.startsWith('devshub-') ? 'DevsHub Mail' : 'Built-in');
      expect(theme.css).toBeTruthy();
      expect(theme.variants).toEqual(['light', 'dark']);
      expect(theme.enabled).toBe(true);
      expect(theme.builtIn).toBe(true);
    }
  });

  it('all IDs use a built-in or DevsHub namespace', () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.id).toMatch(/^(builtin|devshub)-/);
    }
  });

  it('all themes have both :root and .dark selectors', () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.css).toContain(':root');
      expect(theme.css).toContain('.dark');
    }
  });

  it('all themes set --color-primary', () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.css).toContain('--color-primary:');
    }
  });

  it('themes have correct names', () => {
    const names = BUILTIN_THEMES.map(t => t.name);
    expect(names).toContain('Flat fields');
    expect(names).toContain('Nord');
    expect(names).toContain('Catppuccin');
    expect(names).toContain('Solarized');
    expect(names).toContain('Roundcube Elastic');
    expect(names).toContain('Aurora Glass');
  });

  it('theme IDs are unique', () => {
    const ids = BUILTIN_THEMES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
