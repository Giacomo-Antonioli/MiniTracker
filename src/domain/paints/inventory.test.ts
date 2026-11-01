import { describe, expect, it } from 'vitest'
import { adjustQuantity, createCustomPaint, filterPaints, newStock, paintStats, updateStock } from './inventory'
import type { PaintDef, PaintStock } from './types'

const T = '2026-11-02T10:00:00.000Z'
const ctx = { now: T, newId: () => 'abc123' }

const paints: PaintDef[] = [
  { id: 'c/macragge', brand: 'Citadel', name: 'Macragge Blue', type: 'base', family: 'blue', hex: '#0d407f' },
  { id: 'c/nuln', brand: 'Citadel', name: 'Nuln Oil', type: 'shade', family: 'black', hex: '#14100e' },
  { id: 'v/white', brand: 'Vallejo', name: 'Dead White', type: 'layer', family: 'white', hex: '#ffffff' },
]

describe('createCustomPaint', () => {
  it('normalises input and marks it custom', () => {
    expect(createCustomPaint({ brand: ' Green Stuff World ', name: ' Rocket Green ', hex: '#7FD13B', type: 'base' }, ctx)).toEqual({
      id: 'custom/abc123', brand: 'Green Stuff World', name: 'Rocket Green', hex: '#7fd13b', type: 'base', custom: true,
    })
  })
  it('rejects missing names and bad colours', () => {
    expect(() => createCustomPaint({ brand: 'X', name: ' ', hex: '#fff000' }, ctx)).toThrow(/name/)
    expect(() => createCustomPaint({ brand: ' ', name: 'Y', hex: '#fff000' }, ctx)).toThrow(/brand/)
    expect(() => createCustomPaint({ brand: 'X', name: 'Y', hex: 'blue' }, ctx)).toThrow(/colour/)
  })
})

describe('stock', () => {
  it('starts with one pot in the given stage', () => {
    expect(newStock('c/nuln', 'sealed', ctx)).toEqual({ paintId: 'c/nuln', stage: 'sealed', quantity: 1, favourite: false, notes: '', updatedAt: T })
  })
  it('wishlist entries start with zero pots', () => {
    expect(newStock('c/nuln', 'wishlist', ctx).quantity).toBe(0)
  })
  it('adjusts quantity but never below zero', () => {
    const s = newStock('c/nuln', 'in-use', ctx)
    expect(adjustQuantity(s, 2, ctx).quantity).toBe(3)
    expect(adjustQuantity(s, -5, ctx).quantity).toBe(0)
  })
  it('validates rating and price on update', () => {
    const s = newStock('c/nuln', 'in-use', ctx)
    expect(updateStock(s, { rating: 4, price: 5.5, location: 'Drawer A' }, ctx)).toMatchObject({ rating: 4, price: 5.5, location: 'Drawer A' })
    expect(() => updateStock(s, { rating: 6 }, ctx)).toThrow(/rating/)
    expect(() => updateStock(s, { price: -1 }, ctx)).toThrow(/price/)
    expect(() => updateStock(s, { quantity: 1.5 }, ctx)).toThrow(/quantity/)
  })
})

describe('filterPaints', () => {
  const stocks = new Map<string, PaintStock>([
    ['c/macragge', { ...newStock('c/macragge', 'in-use', ctx), quantity: 2, favourite: true }],
    ['v/white', newStock('v/white', 'wishlist', ctx)],
  ])
  const names = (f: Parameters<typeof filterPaints>[2]) => filterPaints(paints, stocks, f).map((p) => p.name)

  it('searches name and brand, all words', () => {
    expect(names({ text: 'citadel blue' })).toEqual(['Macragge Blue'])
  })
  it('filters by brand, type, family and stage', () => {
    expect(names({ brand: 'Citadel' })).toEqual(['Macragge Blue', 'Nuln Oil'])
    expect(names({ type: 'shade' })).toEqual(['Nuln Oil'])
    expect(names({ family: 'white' })).toEqual(['Dead White'])
    expect(names({ stage: 'wishlist' })).toEqual(['Dead White'])
  })
  it('owned = at least one pot; favourites', () => {
    expect(names({ ownedOnly: true })).toEqual(['Macragge Blue'])
    expect(names({ favouritesOnly: true })).toEqual(['Macragge Blue'])
  })
})

describe('paintStats', () => {
  it('counts owned paints, pots, value and running low', () => {
    const stocks = new Map<string, PaintStock>([
      ['c/macragge', { ...newStock('c/macragge', 'in-use', ctx), quantity: 2, price: 5 }],
      ['c/nuln', { ...newStock('c/nuln', 'low', ctx), price: 6.5 }],
      ['v/white', newStock('v/white', 'wishlist', ctx)],
    ])
    expect(paintStats(paints, stocks, 'low')).toEqual({
      owned: 2, pots: 3, value: 16.5, low: 1, wishlist: 1, byBrand: { Citadel: 2 },
    })
  })
})
