import type { OwnedUnit } from '../collection/types'
import type { ShopItem } from '../shopping/types'

/**
 * Box barcodes (#93). The app learns which box a barcode is (you teach it, helped by an
 * open product database); scanning a known box shows what you own and ticks it off the shopping list.
 */
export interface BoxContent {
  datasheetId?: string
  name: string
  models: number
}

export interface BoxMapping {
  code: string
  name: string
  contents: BoxContent[]
  createdAt: string
}

/** EAN-8 / UPC-A / EAN-13 / GTIN-14 with a valid check digit. */
export function isBarcode(text: string): boolean {
  const t = text.trim()
  if (!/^\d{8}$|^\d{12,14}$/.test(t)) return false
  const d = [...t].map(Number)
  const check = d.pop()!
  const sum = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

/** Games Workshop's GS1 company prefix. */
export const isGamesWorkshop = (code: string) => code.startsWith('5011921')

export function validateMapping(m: BoxMapping): void {
  if (!isBarcode(m.code)) throw new Error('Not a valid barcode')
  if (!m.name.trim()) throw new Error('Give the box a name')
  if (!m.contents.length) throw new Error('Add at least one unit in the box')
  for (const c of m.contents) {
    if (!c.name.trim()) throw new Error('Every unit in the box needs a name')
    if (!Number.isInteger(c.models) || c.models < 1) throw new Error('Models must be a whole number above 0')
  }
}

export function saveMapping(list: BoxMapping[], m: BoxMapping): BoxMapping[] {
  validateMapping(m)
  const clean = { ...m, name: m.name.trim() }
  return list.some((x) => x.code === m.code) ? list.map((x) => (x.code === m.code ? clean : x)) : [...list, clean]
}

const words = (s: string) => s.toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2)
const STOP = new Set(['warhammer', '40000', '40k', 'games', 'workshop', 'citadel', 'miniatures', 'the', 'and', 'age', 'sigmar', 'box', 'set'])

/** Datasheets whose name best matches a product name, best first (e.g. "T'au Empire Commander" → Commander…). */
export function suggestDatasheets<T extends { id: string; name: string }>(product: string, sheets: T[], max = 5): T[] {
  const want = new Set(words(product).filter((w) => !STOP.has(w)))
  if (!want.size) return []
  return sheets
    .map((d) => {
      const ws = words(d.name)
      const hit = ws.filter((w) => want.has(w)).length
      return { d, score: hit ? hit / ws.length + hit : 0 }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.d.name.localeCompare(b.d.name))
    .slice(0, max)
    .map((x) => x.d)
}

export interface ContentStatus {
  content: BoxContent
  /** Owned (not wishlisted, not gone) models of that datasheet or, without one, of units with that name. */
  owned: number
  units: OwnedUnit[]
  /** Open shopping lines for it. */
  shopping: ShopItem[]
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function boxStatus(m: BoxMapping, units: OwnedUnit[], shop: ShopItem[], owned: (u: OwnedUnit) => number): ContentStatus[] {
  return m.contents.map((c) => {
    const mine = units.filter((u) => (c.datasheetId ? u.datasheetId === c.datasheetId : sameName(u.customName, c.name)))
    return {
      content: c,
      units: mine,
      owned: mine.reduce((a, u) => a + owned(u), 0),
      shopping: shop.filter((i) => !i.bought && i.kind === 'model' && (c.datasheetId ? i.refId === c.datasheetId : sameName(i.name, c.name))),
    }
  })
}

export function parseMappings(x: unknown): BoxMapping[] {
  if (!Array.isArray(x)) return []
  return x.filter((m): m is BoxMapping => !!m && typeof m === 'object' && typeof m.code === 'string' && typeof m.name === 'string' && Array.isArray(m.contents))
}

/** Product name from Open Products Facts (open data, ODbL); undefined when unknown or offline. */
export async function lookupProduct(code: string, fetcher: typeof fetch = fetch): Promise<string | undefined> {
  try {
    const r = await fetcher(`https://world.openproductsfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands`)
    if (!r.ok) return undefined
    const j = (await r.json()) as { status?: number; product?: { product_name?: string; brands?: string } }
    const name = j.product?.product_name?.trim()
    return j.status === 1 && name ? name : undefined
  } catch {
    return undefined
  }
}
