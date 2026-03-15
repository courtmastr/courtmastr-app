import { type App, inject, readonly, ref, type InjectionKey, type Ref } from 'vue';
import enMessages from '@/i18n/messages/en';
import esMessages from '@/i18n/messages/es';

const STORAGE_KEY = 'courtmastr:locale';

export type SupportedLocale = 'en' | 'es';
type MessageSchema = {
  [Section in keyof typeof enMessages]: {
    [Key in keyof typeof enMessages[Section]]: string;
  };
};

const supportedLocales: SupportedLocale[] = ['en', 'es'];

const messages: Record<SupportedLocale, MessageSchema> = {
  en: enMessages,
  es: esMessages,
};

const normalizeLocale = (value: unknown): SupportedLocale => {
  if (typeof value !== 'string') return 'en';
  return supportedLocales.includes(value as SupportedLocale)
    ? (value as SupportedLocale)
    : 'en';
};

const getInitialLocale = (): SupportedLocale => {
  if (typeof window === 'undefined') return 'en';

  const savedLocale = window.localStorage.getItem(STORAGE_KEY);
  if (savedLocale) {
    return normalizeLocale(savedLocale);
  }

  return window.navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
};

const locale = ref<SupportedLocale>(getInitialLocale());

const resolveMessageByPath = (
  dictionary: MessageSchema,
  key: string,
): string | undefined => {
  const parts = key.split('.');
  let cursor: unknown = dictionary;

  for (const part of parts) {
    if (typeof cursor !== 'object' || cursor === null || !(part in cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }

  return typeof cursor === 'string' ? cursor : undefined;
};

const t = (key: string): string => (
  resolveMessageByPath(messages[locale.value], key)
  || resolveMessageByPath(messages.en, key)
  || key
);

const setLocale = (nextLocale: SupportedLocale): void => {
  const normalized = normalizeLocale(nextLocale);
  locale.value = normalized;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, normalized);
  }

  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalized;
  }
};

export interface I18nContext {
  locale: Readonly<Ref<SupportedLocale>>;
  supportedLocales: SupportedLocale[];
  setLocale: (nextLocale: SupportedLocale) => void;
  t: (key: string) => string;
}

const i18nContext: I18nContext = {
  locale: readonly(locale),
  supportedLocales,
  setLocale,
  t,
};

const fallbackContext: I18nContext = {
  locale: readonly(ref<SupportedLocale>('en')),
  supportedLocales,
  setLocale: () => undefined,
  t: (key) => resolveMessageByPath(messages.en, key) || key,
};

const I18N_KEY: InjectionKey<I18nContext> = Symbol('courtmastr-i18n');

export const installI18n = (app: App): void => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale.value;
  }

  app.provide(I18N_KEY, i18nContext);
};

export const useI18n = (): I18nContext => inject(I18N_KEY, fallbackContext);

export const resetI18nForTests = (): void => {
  locale.value = 'en';

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  if (typeof document !== 'undefined') {
    document.documentElement.lang = 'en';
  }
};
