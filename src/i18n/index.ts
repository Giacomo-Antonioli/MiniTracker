import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import { en } from './locales/en'
import { it } from './locales/it'
import { es } from './locales/es'
import { de } from './locales/de'
import { fr } from './locales/fr'
import { zh } from './locales/zh'
import { AREAS } from './areas'
import { TEXT } from './text'

/** The app's languages, each named in its own language. BSData game data (unit names, rules) stays English. */
export const LANGUAGES = { en: 'English', it: 'Italiano', es: 'Español', de: 'Deutsch', fr: 'Français', zh: '中文' } as const
export type Language = keyof typeof LANGUAGES
/** 'auto' follows the device language. */
export type LanguageChoice = Language | 'auto'

const KEY = 'mt.language'

/** The best match for the device's languages (it-IT → it, zh-Hans-CN → zh), English when none fits. */
export function deviceLanguage(langs: readonly string[] = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])): Language {
  for (const l of langs) {
    const base = l?.toLowerCase().split('-')[0]
    if (base && base in LANGUAGES) return base as Language
  }
  return 'en'
}

export function readLanguageChoice(): LanguageChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v && (v === 'auto' || v in LANGUAGES)) return v as LanguageChoice
  } catch {
    /* storage blocked: device language */
  }
  return 'auto'
}

/** Page text keyed by its English wording (see tx): this language's dictionary. */
function uiStrings(lang: Language): Record<string, string> {
  if (lang === 'en') return {}
  const i = (['it', 'es', 'de', 'fr', 'zh'] as const).indexOf(lang)
  return Object.fromEntries(Object.values(TEXT).flatMap((area) => Object.entries(area).map(([k, v]) => [k, v[i]])))
}

const resolve = (c: LanguageChoice): Language => (c === 'auto' ? deviceLanguage() : c)

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    Object.entries({ en, it, es, de, fr, zh }).map(([lang, core]) => [
      lang,
      { translation: { ...core, ...Object.fromEntries(Object.entries(AREAS).map(([name, a]) => [name, a[lang as Language]])) }, ui: uiStrings(lang as Language) },
    ]),
  ),
  lng: resolve(readLanguageChoice()),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnObjects: true,
  initAsync: false,
})
if (typeof document !== 'undefined') document.documentElement.lang = i18n.language

/** Change the language now and remember the choice on this device. */
export function setLanguageChoice(c: LanguageChoice) {
  try {
    localStorage.setItem(KEY, c)
  } catch {
    /* not remembered */
  }
  void i18n.changeLanguage(resolve(c))
  document.documentElement.lang = i18n.language
}

export const useT = () => useTranslation().t
export { i18n }

/** For text built outside components (domain helpers): the current language at the time of the call. */
export const tr = (key: string, options: Record<string, unknown> = {}): string => i18n.t(key, options) as string

const UI = { ns: 'ui', keySeparator: false, nsSeparator: false } as const

/**
 * Page text by its English wording: tx('Add unit'), tx('{{n}} models', { n }). English needs no entry; the other
 * languages look it up in src/i18n/text (a test checks every tx('…') in the code has all five translations).
 */
export const txr = (english: string, options: Record<string, unknown> = {}): string => i18n.t(english, { ...UI, ...options }) as string

/** tx for components: re-renders when the language changes. */
export function useTx() {
  useTranslation()
  return txr
}
