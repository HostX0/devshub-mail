import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seasonalThemeId } from '../seasonal-themes';
import { useThemeStore } from '@/stores/theme-store';
import { usePolicyStore } from '@/stores/policy-store';
import { DEFAULT_POLICY } from '@/lib/admin/types';
import { ThemeProvider } from '@/components/providers/theme-provider';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 29, 19, 0));
  localStorage.clear();
  usePolicyStore.setState({ policy: { ...DEFAULT_POLICY }, loaded: false });
  useThemeStore.setState({ seasonalAuto: true, preferredThemeId: null, activeThemeId: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('occasion selection', () => {
  it.each([
    [24, 'devshub-pink-october'],
    [25, 'devshub-halloween'],
    [29, 'devshub-halloween'],
    [31, 'devshub-halloween'],
  ])('uses the expected October palette on day %s', (day, expected) => {
    expect(seasonalThemeId(new Date(2026, 9, day))).toBe(expected);
  });

  it('ends Halloween when November starts', () => {
    expect(seasonalThemeId(new Date(2026, 10, 1))).toBeNull();
  });

  it('applies Halloween now for automatic users without changing their preferred theme', () => {
    useThemeStore.setState({ preferredThemeId: 'builtin-nord' });
    useThemeStore.getState().applySeasonalTheme();
    expect(useThemeStore.getState().activeThemeId).toBe('devshub-halloween');
    expect(useThemeStore.getState().preferredThemeId).toBe('builtin-nord');
  });

  it('preserves a manually chosen theme until automatic occasions are reenabled', () => {
    useThemeStore.getState().activateTheme('builtin-nord');
    useThemeStore.getState().applySeasonalTheme();
    expect(useThemeStore.getState().seasonalAuto).toBe(false);
    expect(useThemeStore.getState().activeThemeId).toBe('builtin-nord');
    useThemeStore.getState().setSeasonalAuto(true);
    expect(useThemeStore.getState().activeThemeId).toBe('devshub-halloween');
  });

  it('updates an open session at midnight and restores the chosen theme after Halloween', () => {
    const schedule = vi.spyOn(window, 'setTimeout');
    const cancel = vi.spyOn(window, 'clearTimeout');
    vi.setSystemTime(new Date(2026, 9, 24, 23, 59, 59));
    useThemeStore.setState({ preferredThemeId: 'builtin-nord' });
    const view = render(<ThemeProvider><span>Mail</span></ThemeProvider>);
    expect(useThemeStore.getState().activeThemeId).toBe('devshub-pink-october');
    act(() => vi.advanceTimersByTime(1000));
    expect(useThemeStore.getState().activeThemeId).toBe('devshub-halloween');
    act(() => {
      vi.setSystemTime(new Date(2026, 10, 1, 9, 0));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(useThemeStore.getState().activeThemeId).toBe('builtin-nord');
    const midnightCall = schedule.mock.calls.findLastIndex(([, delay]) => delay === 15 * 60 * 60 * 1000);
    expect(midnightCall).toBeGreaterThanOrEqual(0);
    const midnightTimer = schedule.mock.results[midnightCall].value;
    cancel.mockClear();
    view.unmount();
    expect(cancel).toHaveBeenCalledWith(midnightTimer);
  });
});
