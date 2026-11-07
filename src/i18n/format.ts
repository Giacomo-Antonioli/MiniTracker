import { i18n } from '.'

/** Dates, numbers and money in the chosen language's format (Intl). */
export const locale = () => (i18n.language === 'zh' ? 'zh-CN' : i18n.language || 'en')

export const formatDate = (d: Date | number | string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
  new Intl.DateTimeFormat(locale(), opts).format(new Date(d))

export const formatNumber = (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale(), opts).format(n)

const SYMBOLS: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP', '¥': 'JPY', CHF: 'CHF', kr: 'SEK' }

/**
 * Money in the user's currency, in the language's format (€4.50, 4,50 €). The currency setting is a symbol
 * (€, $, £) or an ISO code (EUR, GBP); anything else (pts) goes after the number. Whole amounts drop the cents.
 */
export function formatMoney(n: number, currency: string): string {
  const v = Math.round(n * 100) / 100
  const digits = Number.isInteger(v) ? 0 : 2
  const code = SYMBOLS[currency] ?? (/^[A-Z]{3}$/.test(currency) ? currency : undefined)
  if (code) {
    try {
      return new Intl.NumberFormat(locale(), { style: 'currency', currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)
    } catch {
      /* unknown code */
    }
  }
  return `${formatNumber(v, { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${currency}`.trim()
}
