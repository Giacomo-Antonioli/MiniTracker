import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import { en } from './locales/en'
import { it } from './locales/it'
import { es } from './locales/es'
import { de } from './locales/de'
import { fr } from './locales/fr'
import { zh } from './locales/zh'
import { AREAS } from './areas'

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

const resolve = (c: LanguageChoice): Language => (c === 'auto' ? deviceLanguage() : c)

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    Object.entries({ en, it, es, de, fr, zh }).map(([lang, core]) => [
      lang,
      { translation: { ...core, ...Object.fromEntries(Object.entries(AREAS).map(([name, a]) => [name, a[lang as Language]])) } },
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
