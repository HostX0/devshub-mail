import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/browser-navigation', () => ({ apiFetch: vi.fn(async () => Response.json({ ok: true })) }));
import { useSettingsStore } from '../settings-store';
import { useThemeStore } from '../theme-store';
const PHOTO = 'data:image/jpeg;base64,YWJj';
beforeEach(() => {
  useSettingsStore.getState().disableSync();
  useSettingsStore.setState({ profileAvatarDataUrls: {}, settingsSyncDisabled: false });
  useThemeStore.setState({ preferredThemeId: null, seasonalAuto: true, themeChosen: false });
  localStorage.removeItem('settings-sync-stamps');
});
afterEach(() => useSettingsStore.getState().disableSync());
describe('custom account photo and theme preservation across upstream settings sync', () => {
  it('exports only the owning account photo into an account sync blob', () => {
    useSettingsStore.setState({ profileAvatarDataUrls: { alice: PHOTO, bob: PHOTO + 'AA' } });
    const blob = JSON.parse(useSettingsStore.getState().exportSettings({ forSync: true, accountId: 'alice' }));
    expect(blob.profileAvatarDataUrls).toEqual({ alice: PHOTO });
  });
  it('fails closed instead of exporting every account photo when no sync owner is known', () => {
    useSettingsStore.setState({ profileAvatarDataUrls: { alice: PHOTO } });
    expect(JSON.parse(useSettingsStore.getState().exportSettings({ forSync: true })).profileAvatarDataUrls).toEqual({});
  });
  it('merges one server account photo without overwriting another account', () => {
    useSettingsStore.setState({ profileAvatarDataUrls: { bob: PHOTO + 'AA' } });
    useSettingsStore.getState().importSettings(JSON.stringify({ profileAvatarDataUrls: { alice: PHOTO } }), { serverAccountId: 'alice' });
    expect(useSettingsStore.getState().profileAvatarDataUrls).toEqual({ alice: PHOTO, bob: PHOTO + 'AA' });
  });
  it('does not resurrect a locally removed photo from an older server blob', () => {
    useSettingsStore.setState({ profileAvatarDataUrls: { bob: PHOTO + 'AA' } });
    localStorage.setItem('settings-sync-stamps', JSON.stringify({ stamps: { profileAvatarDataUrls: 100 }, dirty: { profileAvatarDataUrls: 100 } }));
    useSettingsStore.getState().importSettings(JSON.stringify({ profileAvatarDataUrls: { alice: PHOTO }, settingsModifiedAt: { profileAvatarDataUrls: 1 } }), { serverAccountId: 'alice' });
    expect(useSettingsStore.getState().profileAvatarDataUrls).toEqual({ bob: PHOTO + 'AA' });
  });
  it('retains newer local occasion preferences rather than applying stale server choices', () => {
    useThemeStore.setState({ preferredThemeId: 'builtin-nord', seasonalAuto: false, themeChosen: false });
    localStorage.setItem('settings-sync-stamps', JSON.stringify({ stamps: { preferredThemeId: 100, seasonalAuto: 100 }, dirty: { preferredThemeId: 100, seasonalAuto: 100 } }));
    useSettingsStore.getState().importSettings(JSON.stringify({ preferredThemeId: 'builtin-catppuccin', seasonalAuto: true, settingsModifiedAt: { preferredThemeId: 1, seasonalAuto: 1 } }), { serverAccountId: 'alice' });
    expect(useThemeStore.getState().preferredThemeId).toBe('builtin-nord'); expect(useThemeStore.getState().seasonalAuto).toBe(false);
  });
  it('stamps a changed custom theme preference even when the user has not chosen light or dark mode', () => {
    useThemeStore.setState({ preferredThemeId: 'builtin-nord', seasonalAuto: false, themeChosen: false });
    const stamps = JSON.parse(localStorage.getItem('settings-sync-stamps') || '{}');
    expect(stamps.dirty.preferredThemeId).toBeGreaterThan(0); expect(stamps.dirty.seasonalAuto).toBeGreaterThan(0);
  });
});
