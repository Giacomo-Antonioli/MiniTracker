import { i18n } from '.'

/** Dates, numbers and money in the chosen language's format (Intl). */
const locale = () => (i18n.language === 'zh' ? 'zh-CN' : i18n.language || 'en')

export const formatDate = (d: Date | number | string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
  new Intl.DateTimeFormat(locale(), opts).format(new Date(d))

export const formatNumber = (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale(), opts).format(n)

/** Money in the user's currency: an ISO code (EUR, GBP) gets its proper symbol; anything else (€, pts) goes after the number. */
export function formatMoney(n: number, currency: string): string {
  if (/^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat(locale(), { style: 'currency', currency }).format(n)
    } catch {
      /* unknown code */
    }
  }
  return `${formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`.trim()
}
