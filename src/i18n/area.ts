/** The shape a translation follows: same keys as English, strings (and arrays) in place of the English text. */
export type Shape<T> = T extends string ? string : T extends readonly (infer U)[] ? Shape<U>[] : { [K in keyof T]: Shape<T[K]> }

export type OtherLanguage = 'it' | 'es' | 'de' | 'fr' | 'zh'

/**
 * One area of the app (a page or a group of pages) with its text in all six languages, kept together so a new
 * string is added everywhere at once. Its keys live under the area's name: t('backlog.title').
 */
export function defineArea<T>(en: T, others: Record<OtherLanguage, Shape<T>>): { en: T } & Record<OtherLanguage, Shape<T>> {
  return { en, ...others }
}
