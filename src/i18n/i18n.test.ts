// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { deviceLanguage, i18n, LANGUAGES, readLanguageChoice, setLanguageChoice } from '.'
import { formatMoney, formatNumber } from './format'
import { en } from './locales/en'
import { it as itIT } from './locales/it'
import { es } from './locales/es'
import { de } from './locales/de'
import { fr } from './locales/fr'
import { zh } from './locales/zh'
import { AREAS } from './areas'

/** Every key path with the length of each array, so missing tour steps or list items show up. */
function shape(o: unknown, path = ''): string[] {
  if (typeof o === 'string') return [path]
  if (Array.isArray(o)) return [`${path}[${o.length}]`, ...o.flatMap((v, i) => shape(v, `${path}[${i}]`))]
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k))
}

/** {{placeholders}} used by each string. */
function vars(o: unknown, path = ''): string[] {
  if (typeof o === 'string') return [...o.matchAll(/{{(\w+)}}/g)].map((m) => `${path}:${m[1]}`)
  if (Array.isArray(o)) return o.flatMap((v, i) => vars(v, `${path}[${i}]`))
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => vars(v, path ? `${path}.${k}` : k))
}

afterEach(() => setLanguageChoice('en'))

describe('translations', () => {
  const all = { it: itIT, es, de, fr, zh }
  it.each(Object.entries(all))('%s has every English key, list item and placeholder', (_, strings) => {
    expect(shape(strings)).toEqual(shape(en))
    expect(vars(strings).sort()).toEqual(vars(en).sort())
  })
  describe.each(Object.entries(AREAS))('area %s', (_, area) => {
    it.each(['it', 'es', 'de', 'fr', 'zh'] as const)('%s has every English key, list item and placeholder', (lang) => {
      expect(shape(area[lang])).toEqual(shape(area.en))
      expect(vars(area[lang]).sort()).toEqual(vars(area.en).sort())
    })
  })
  it('covers every language in the picker', () => {
    expect(Object.keys(LANGUAGES).sort()).toEqual(['de', 'en', 'es', 'fr', 'it', 'zh'])
  })
})

describe('language choice', () => {
  it('follows the device language, English when not available', () => {
    expect(deviceLanguage(['it-IT', 'en'])).toBe('it')
    expect(deviceLanguage(['zh-Hans-CN'])).toBe('zh')
    expect(deviceLanguage(['pt-BR', 'de-AT'])).toBe('de')
    expect(deviceLanguage(['ja'])).toBe('en')
  })
  it('switches and remembers the language', () => {
    setLanguageChoice('fr')
    expect(i18n.t('menu.paints')).toBe('Peintures')
    expect(readLanguageChoice()).toBe('fr')
    expect(document.documentElement.lang).toBe('fr')
  })
})

describe('formats', () => {
  it('formats numbers and money for the language', () => {
    setLanguageChoice('de')
    expect(formatNumber(1234.5)).toBe('1.234,5')
    expect(formatMoney(12.5, 'EUR')).toMatch(/12,50\s€/)
    expect(formatMoney(3, 'pts')).toBe('3 pts')
    expect(formatMoney(4.5, '€')).toMatch(/4,50\s€/)
    setLanguageChoice('en')
    expect(formatMoney(12.5, 'GBP')).toBe('£12.50')
    expect(formatMoney(12, '€')).toBe('€12')
  })
})
