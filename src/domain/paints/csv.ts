import type { Ctx } from '../collection/types'
import { createCustomPaint, newStock, updateStock } from './inventory'
import type { PaintDef, PaintStock } from './types'

const COLUMNS = ['brand', 'name', 'type', 'hex', 'stage', 'quantity', 'price', 'purchaseDate', 'shop', 'location', 'barcode', 'rating', 'favourite', 'notes'] as const

const cell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Inventory as CSV (one row per paint you have a record for). */
export function inventoryToCsv(paints: PaintDef[], stocks: Map<string, PaintStock>): string {
  const byId = new Map(paints.map((p) => [p.id, p]))
  const rows = [...stocks.values()]
    .map((s) => ({ s, p: byId.get(s.paintId) }))
    .filter((x): x is { s: PaintStock; p: PaintDef } => !!x.p)
    .sort((a, b) => a.p.brand.localeCompare(b.p.brand) || a.p.name.localeCompare(b.p.name))
    .map(({ s, p }) => [p.brand, p.name, p.type, p.hex, s.stage, s.quantity, s.price, s.purchaseDate, s.shop, s.location, s.barcode, s.rating, s.favourite ? 'yes' : '', s.notes].map(cell).join(','))
  return [COLUMNS.join(','), ...rows].join('\n') + '\n'
}

/** Minimal RFC 4180 parser: quotes, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') quoted = false
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cur)
      cur = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur)
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
      cur = ''
    } else cur += c
  }
  row.push(cur)
  if (row.some((x) => x !== '')) rows.push(row)
  return rows
}

export interface CsvImport {
  stocks: PaintStock[]
  newPaints: PaintDef[]
  skipped: { line: number; reason: string }[]
}

/**
 * Read an inventory CSV. Needs at least "brand" and "name" columns (any order, case-insensitive).
 * Known paints are matched by brand + name; unknown ones become custom paints.
 */
export function inventoryFromCsv(text: string, paints: PaintDef[], defaultStage: string, ctx: Ctx): CsvImport {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ''))
  if (!header) throw new Error('The CSV file is empty')
  const col = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]))
  if (!col.has('brand') || !col.has('name')) throw new Error('The CSV needs at least "brand" and "name" columns')
  const get = (r: string[], k: string) => (col.has(k.toLowerCase()) ? (r[col.get(k.toLowerCase())!] ?? '').trim() : '')

  const key = (brand: string, name: string) => `${brand.toLowerCase()}|${name.toLowerCase()}`
  const known = new Map(paints.map((p) => [key(p.brand, p.name), p]))
  const out: CsvImport = { stocks: [], newPaints: [], skipped: [] }

  rows.forEach((r, i) => {
    const line = i + 2
    const brand = get(r, 'brand')
    const name = get(r, 'name')
    if (!brand || !name) return out.skipped.push({ line, reason: 'missing brand or name' })
    try {
      const existing = known.get(key(brand, name))
      const hex = get(r, 'hex')
      const paint = existing ?? createCustomPaint({ brand, name, hex: /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#888888', type: get(r, 'type') || undefined }, ctx)
      const num = (k: string) => (get(r, k) === '' ? undefined : Number(get(r, k).replace(',', '.')))
      const stage = get(r, 'stage') || defaultStage
      const base = newStock(paint.id, stage, ctx)
      out.stocks.push(
        updateStock(
          base,
          {
            quantity: num('quantity') ?? base.quantity,
            price: num('price'),
            purchaseDate: get(r, 'purchaseDate') || undefined,
            shop: get(r, 'shop') || undefined,
            location: get(r, 'location') || undefined,
            barcode: get(r, 'barcode') || undefined,
            rating: num('rating'),
            favourite: /^(yes|true|1|y)$/i.test(get(r, 'favourite')),
            notes: get(r, 'notes'),
          },
          ctx,
        ),
      )
      // Only keep a new custom paint once its row is fully valid.
      if (!existing) {
        known.set(key(brand, name), paint)
        out.newPaints.push(paint)
      }
    } catch (e) {
      out.skipped.push({ line, reason: (e as Error).message })
    }
  })
  return out
}
