import { describe, expect, it } from 'vitest';
import { extensionDate, extensionError, translateExtensionText, type ExtensionTranslator } from '../_pages/extension-translations';
import { pluginTypeLabel } from '../_pages/plugin-type-label';
import { turnOnNote } from '../_pages/turn-on-plugins';

const ar: ExtensionTranslator = (text, ...values) => translateExtensionText(true, text, ...values);
const en: ExtensionTranslator = (text, ...values) => translateExtensionText(false, text, ...values);

describe('extension administration languages', () => {
  it('selects complete Arabic or English interface copy', () => {
    expect(ar('Plugins for users')).toBe('إضافات المستخدمين');
    expect(en('Plugins for users')).toBe('Plugins for users');
    expect(pluginTypeLabel('hook', ar)).toBe('يعمل في الخلفية');
    expect(pluginTypeLabel('hook', en)).toBe('Works in the background');
    expect(turnOnNote('left-off', ar)).toBe(' الإضافات ما زالت معطّلة للمستخدمين، لذلك لن تعمل بعد.');
    expect(turnOnNote('left-off', en)).toBe(" Plugins are still off for users, so it doesn't run yet.");
  });

  it('keeps identifiers, version numbers and plugin names intact', () => {
    expect(ar('"{0}" updated to v{1}{2}{3}', 'Team Mail', '2.3.4', '', '')).toBe('تم تحديث «Team Mail» إلى الإصدار 2.3.4');
    expect(en('"{0}" updated to v{1}{2}{3}', 'Team Mail', '2.3.4', '', '')).toBe('"Team Mail" updated to v2.3.4');
    expect(ar('({0} warning{1})', 3, 's')).toBe('(3 تنبيه)');
  });

  it('does not leak untranslated server error messages into Arabic', () => {
    expect(extensionError('A new upstream error', 'Upload failed', ar)).toBe('تعذّر رفع الملف');
    expect(extensionError('A new upstream error', 'Upload failed', en)).toBe('A new upstream error');
    expect(extensionError('Plugin ZIP exceeds 5 MB size limit', 'Upload failed', ar)).toContain('5 ميغابايت');
  });

  it('preserves the version detail in downgrade warnings', () => {
    expect(extensionError('Version 1.0.0 is older than the installed 2.0.0.', 'Installation failed', ar))
      .toBe('الإصدار 1.0.0 أقدم من الإصدار المثبّت 2.0.0.');
  });

  it('keeps navigation separators as visible characters in both languages', () => {
    expect(en(' &middot; Marketplace')).toBe(' · Marketplace');
    expect(ar(' &middot; Marketplace')).toBe(' · متجر الإضافات');
  });

  it('uses Latin digits for dates in both languages', () => {
    expect(extensionDate('2026-11-22T12:00:00Z', ar)).not.toMatch(/[٠-٩]/);
    expect(extensionDate('2026-11-22T12:00:00Z', en)).toContain('2026');
  });
});
