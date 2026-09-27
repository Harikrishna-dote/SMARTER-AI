import { createContext, useContext } from 'react';
import type { Locale, TranslationDict } from '../lib/i18n';
import { getLocale, setLocale, t, LOCALE_NAMES } from '../lib/i18n';

export interface TranslationContextValue {
  t: (key: string) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  locales: { value: Locale; label: string }[];
}

export const TranslationContext = createContext<TranslationContextValue | null>(null);

export function useTranslation(): TranslationContextValue {
  const context = useContext(TranslationContext);
  if (!context) {
    const locale = getLocale();
    return {
      t: (key: string) => t(key, locale),
      locale,
      setLocale,
      locales: Object.keys(LOCALE_NAMES).map((value) => ({
        value: value as Locale,
        label: LOCALE_NAMES[value as Locale],
      })),
    };
  }
  return context;
}
