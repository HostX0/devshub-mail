'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAdminI18n } from './use-admin-i18n';
import translations from './core-translations.json';

const arabic: Readonly<Record<string, string>> = translations;
const english = new Map(Object.entries(arabic).map(([en, ar]) => [ar, en]));
export type CoreAdminTranslator = (text: string | undefined, values?: Record<string, string | number | null | undefined>) => string;

/** Localizes administration copy while preserving supplied account names, URLs and technical identifiers. */
export function translateCoreAdmin(text: string | undefined, isArabic: boolean, values?: Record<string, string | number | null | undefined>): string {
  if (text === undefined) return String(values?.fallback ?? '');
  const normalized = text.replace(/\s+/g, ' ').trim();
  const canonical = english.get(normalized) ?? normalized;
  const translated = isArabic ? arabic[canonical] ?? String(values?.fallback ?? text) : english.get(normalized) ?? text;
  return values ? translated.replace(/\{(\w+)\}/g, (match, key: string) => values[key] === undefined ? match : String(values[key] ?? '')) : translated;
}

export function useCoreAdminI18n(): CoreAdminTranslator {
  const { isArabic } = useAdminI18n();
  return useCallback((text, values) => translateCoreAdmin(text, isArabic, values), [isArabic]);
}

/** Stable translation for asynchronous callbacks; language changes do not restart requests or discard edits. */
export function useCoreAdminAsyncI18n(): CoreAdminTranslator {
  const tr = useCoreAdminI18n();
  const current = useRef(tr);
  useEffect(() => { current.current = tr; }, [tr]);
  return useCallback((text, values) => current.current(text, values), []);
}
