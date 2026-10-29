import { describe, it, expect } from 'vitest';
import { BUILTIN_THEMES } from '../builtin-themes';
import { getLuminance, parseColor } from '../color-transform';

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

  it('keeps occasion buttons and selected rows readable in light and dark modes', () => {
    for (const theme of BUILTIN_THEMES.filter(theme => theme.id.startsWith('devshub-'))) {
      for (const selector of [':root', '.dark']) {
        const block = theme.css.split(`${selector} {`)[1]?.split('}')[0] ?? '';
        const tokens = Object.fromEntries(Array.from(block.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi), match => [match[1], match[2]]));
        for (const token of ['primary', 'info', 'accent', 'selection', 'sidebar-accent']) {
          const background = parseColor(tokens[`color-${token}`]);
          const foreground = parseColor(tokens[`color-${token}-foreground`]);
          expect(background, `${theme.id} ${selector} ${token}`).not.toBeNull();
          expect(foreground, `${theme.id} ${selector} ${token} foreground`).not.toBeNull();
          const bg = getLuminance(background!.r, background!.g, background!.b);
          const fg = getLuminance(foreground!.r, foreground!.g, foreground!.b);
          const contrast = (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
          expect(contrast, `${theme.id} ${selector} ${token}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});
