import { describe, expect, it } from 'vitest'
import { inventoryFromCsv, inventoryToCsv, parseCsv } from './csv'
import { newStock } from './inventory'
import type { PaintDef, PaintStock } from './types'

let n = 0
const ctx = { now: 't', newId: () => `id${++n}` }
const paints: PaintDef[] = [
  { id: 'c/macragge', brand: 'Citadel', name: 'Macragge Blue', type: 'base', hex: '#0d407f' },
  { id: 'c/nuln', brand: 'Citadel', name: 'Nuln Oil', type: 'shade', hex: '#14100e' },
]

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas and newlines in fields, CRLF and blank lines', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n\n1,2')).toEqual([['a', 'b'], ['x, y', 'say "hi"\nthere'], ['1', '2']])
  })
})

describe('inventory CSV', () => {
  it('round-trips export → import', () => {
    const stocks = new Map<string, PaintStock>([
      ['c/nuln', { ...newStock('c/nuln', 'low', ctx), quantity: 2, price: 5.5, location: 'Drawer "A", left', favourite: true, rating: 4, notes: 'great\nshade' }],
    ])
    const csv = inventoryToCsv(paints, stocks)
    expect(csv.split('\n')[0]).toBe('brand,name,type,hex,stage,quantity,price,purchaseDate,shop,location,barcode,rating,favourite,notes')
    const back = inventoryFromCsv(csv, paints, 'sealed', ctx)
    expect(back.newPaints).toEqual([])
    expect(back.skipped).toEqual([])
    expect(back.stocks).toEqual([{ ...stocks.get('c/nuln'), updatedAt: 't' }])
  })

  it('matches case-insensitively, creates custom paints for unknown ones, and reports bad rows', () => {
    const csv = 'Name,BRAND,quantity,hex,rating\nmacragge blue,citadel,3,,\nRocket Green,Green Stuff World,1,#7fd13b,\n,Citadel,1,,\nBad,Citadel,1,,9\n'
    const r = inventoryFromCsv(csv, paints, 'sealed', ctx)
    expect(r.stocks.map((s) => [s.paintId, s.quantity, s.stage])).toEqual([
      ['c/macragge', 3, 'sealed'],
      [r.newPaints[0].id, 1, 'sealed'],
    ])
    expect(r.newPaints.map((p) => [p.brand, p.name, p.hex])).toEqual([
      ['Green Stuff World', 'Rocket Green', '#7fd13b'],
    ])
    expect(r.skipped).toEqual([
      { line: 4, reason: 'missing brand or name' },
      { line: 5, reason: 'Invalid rating (1–5)' },
    ])
  })

  it('needs brand and name columns', () => {
    expect(() => inventoryFromCsv('colour,qty\nx,1', paints, 'sealed', ctx)).toThrow(/brand/)
    expect(() => inventoryFromCsv('', paints, 'sealed', ctx)).toThrow(/empty/)
  })
})
