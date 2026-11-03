/** Cards the Home page can show, in a user-chosen order and size (#117). */
export type CardSize = 'S' | 'M' | 'L'

export interface CardDef {
  id: string
  title: string
  size: CardSize
  /** Choices for the card, e.g. how many rows; the first value is the default. */
  options?: Record<string, { label: string; values: number[] }>
}

export const CARDS: CardDef[] = [
  { id: 'tiles', title: 'Summary', size: 'L' },
  { id: 'activity', title: 'Activity', size: 'L' },
  { id: 'continue', title: 'Continue painting', size: 'M', options: { count: { label: 'Units', values: [3, 5, 8] } } },
  { id: 'painted', title: 'Painted per month', size: 'M', options: { months: { label: 'Months', values: [6, 12, 24] } } },
  { id: 'records', title: 'Records', size: 'M' },
  { id: 'oldest', title: 'Oldest in the pile', size: 'M', options: { count: { label: 'Units', values: [3, 5, 10] } } },
  { id: 'closest', title: 'Closest to done', size: 'M', options: { count: { label: 'Factions', values: [3, 5, 10] } } },
  { id: 'recent', title: 'Recent activity', size: 'M', options: { count: { label: 'Moves', values: [5, 10, 20] } } },
  { id: 'shopping', title: 'Shopping', size: 'M' },
  { id: 'low', title: 'Running low', size: 'M' },
  { id: 'points', title: 'Points painted', size: 'M', options: { months: { label: 'Months', values: [12, 6, 24] } } },
  { id: 'pile-age', title: 'Pile age', size: 'M' },
  { id: 'stage-flow', title: 'Where the work goes', size: 'M', options: { months: { label: 'Months', values: [6, 12, 24] } } },
  { id: 'spending', title: 'Spending', size: 'M', options: { months: { label: 'Months', values: [6, 12, 24] } } },
  { id: 'paints', title: 'Paint usage', size: 'S' },
  { id: 'roles', title: 'By role', size: 'S' },
]

export interface CardLayout {
  id: string
  size: CardSize
  options?: Record<string, number>
}

const DEFAULT_IDS = ['tiles', 'activity', 'continue', 'painted', 'records', 'oldest', 'closest', 'recent', 'shopping', 'low']
export const DEFAULT_LAYOUT: CardLayout[] = DEFAULT_IDS.map((id) => ({ id, size: CARDS.find((c) => c.id === id)!.size }))

const SIZES: CardSize[] = ['S', 'M', 'L']
const def = (id: string) => CARDS.find((c) => c.id === id)

export const hiddenCards = (l: CardLayout[]) => CARDS.filter((c) => !l.some((x) => x.id === c.id))

/** Move a card to position `to` (clamped). */
export function moveCard(l: CardLayout[], id: string, to: number): CardLayout[] {
  const card = l.find((c) => c.id === id)
  if (!card) return l
  const rest = l.filter((c) => c.id !== id)
  rest.splice(Math.max(0, Math.min(to, rest.length)), 0, card)
  return rest
}

export const setSize = (l: CardLayout[], id: string, size: CardSize) => l.map((c) => (c.id === id ? { ...c, size } : c))
export const setOption = (l: CardLayout[], id: string, key: string, value: number) => l.map((c) => (c.id === id ? { ...c, options: { ...c.options, [key]: value } } : c))
export const removeCard = (l: CardLayout[], id: string) => l.filter((c) => c.id !== id)

/** Add a card at `at` (default: the end) in its default size; nothing changes if it is already shown. */
export function addCard(l: CardLayout[], id: string, at = l.length): CardLayout[] {
  const d = def(id)
  if (!d || l.some((c) => c.id === id)) return l
  const out = [...l]
  out.splice(at, 0, { id, size: d.size })
  return out
}

/** Saved layout from storage; unknown cards, repeats and bad sizes are dropped or fixed. */
export function parseLayout(text: string | null): CardLayout[] {
  try {
    const raw: unknown = JSON.parse(text ?? '')
    if (!Array.isArray(raw)) return DEFAULT_LAYOUT
    const out: CardLayout[] = []
    for (const x of raw as Partial<CardLayout>[]) {
      const d = x && typeof x.id === 'string' ? def(x.id) : undefined
      if (!d || out.some((c) => c.id === d.id)) continue
      const card: CardLayout = { id: d.id, size: SIZES.includes(x.size as CardSize) ? x.size! : d.size }
      if (x.options && typeof x.options === 'object') card.options = x.options
      out.push(card)
    }
    return out
  } catch {
    return DEFAULT_LAYOUT
  }
}

/** The card's chosen option, else its default. */
export function optionOf(card: CardLayout, key: string): number {
  return card.options?.[key] ?? def(card.id)?.options?.[key]?.values[0] ?? 0
}
