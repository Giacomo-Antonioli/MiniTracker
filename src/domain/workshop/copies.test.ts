import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './categories'
import { copiesAt, copyPlaces, moveCopies, copyOf, editCopies, fitCopies, isLiquid, isLow, newItem, parseItems, searchItems, setRepresentative, sortItems } from './item'

let n = 0
const ctx = () => ({ now: '2026-11-14T10:00:00.000Z', newId: () => `id${++n}` })
const glue = () => newItem({ name: 'Extra Thin Cement', category: 'Glue', quantity: 2, lowAt: 0 }, ctx())

describe('copies of a tool or supply', () => {
  it('stay alike until one is edited on its own', () => {
    const t = glue()
    const all = editCopies(t, 'all', { price: 5 })
    expect(all.copies).toBeUndefined()
    expect(all.price).toBe(5)
    const one = editCopies(all, 1, { level: 'low', notes: 'opened' })
    expect(one.copies).toHaveLength(2)
    expect(copyOf(one, 0)).toMatchObject({ price: 5, notes: '' })
    expect(copyOf(one, 1)).toMatchObject({ price: 5, level: 'low', notes: 'opened' })
    // the item mirrors the representative (first) copy
    expect(one.level).toBeUndefined()
    expect(one.notes).toBe('')
  })

  it('lets one copy stand for the group, and an edit of all copies reaches each', () => {
    let t = editCopies(glue(), 1, { placeId: 'shelf', price: 7 })
    t = setRepresentative(t, 1)
    expect([t.rep, t.placeId, t.price]).toEqual([1, 'shelf', 7])
    t = editCopies(t, 'all', { condition: 'worn' })
    expect(t.copies!.map((c) => c.condition)).toEqual(['worn', 'worn'])
    expect(t.copies!.map((c) => c.price)).toEqual([undefined, 7])
  })

  it('follows the quantity: new copies start like the representative, extra ones go', () => {
    let t = editCopies(glue(), 0, { notes: 'first' })
    t = fitCopies({ ...t, quantity: 3 })
    expect(t.copies!.map((c) => c.notes)).toEqual(['first', '', 'first'])
    t = fitCopies({ ...t, quantity: 1, rep: 2 })
    expect(t.copies).toHaveLength(1)
    expect(t.rep).toBe(0)
    const alike = glue()
    expect(fitCopies(alike)).toBe(alike)
  })

  it('is low on level only when every copy is low', () => {
    const t = editCopies(glue(), 0, { level: 'low' })
    expect(isLow(t)).toBe(false)
    expect(isLow(editCopies(t, 1, { level: 'empty' }))).toBe(true)
    expect(isLow({ ...glue(), level: 'low' })).toBe(true)
  })

  it('is read back from saved data, ignoring junk', () => {
    const t = editCopies(glue(), 1, { notes: 'x' })
    const saved = JSON.parse(JSON.stringify({ ...t, rep: 1, copies: [...t.copies!, null, { condition: 'odd', notes: 5 }] }))
    const back = parseItems([saved], { quantity: 1 })[0]
    expect(back.rep).toBe(1)
    expect(back.copies).toHaveLength(3)
    expect(back.copies![2]).toMatchObject({ condition: 'good', notes: '' })
  })

  it('is a liquid by category unless marked by hand', () => {
    const tool = newItem({ name: 'Cleaner pot', category: 'Other' }, ctx())
    expect(isLiquid(tool, 'tool', DEFAULT_CATEGORIES)).toBe(false)
    expect(isLiquid({ ...tool, liquid: true }, 'tool', DEFAULT_CATEGORIES)).toBe(true)
    expect(isLiquid(glue(), 'supply', DEFAULT_CATEGORIES)).toBe(true)
    expect(isLiquid({ ...glue(), liquid: false }, 'supply', DEFAULT_CATEGORIES)).toBe(false)
  })

  it('searches name, brand, category and notes by every word, and sorts several ways', () => {
    const a = { ...newItem({ name: 'Brush', category: 'Brushes', quantity: 5 }, ctx()), brand: 'Citadel', updatedAt: '2026-01-01' }
    const b = { ...newItem({ name: 'Glue', category: 'Glue', quantity: 1 }, ctx()), notes: 'thin cement', updatedAt: '2026-03-01' }
    const c = { ...newItem({ name: 'Clippers', category: 'Cutting', quantity: 3, lowAt: 3 }, ctx()), updatedAt: '2026-02-01' }
    expect(searchItems([a, b, c], '')).toHaveLength(3)
    expect(searchItems([a, b, c], 'CITADEL brush')).toEqual([a])
    expect(searchItems([a, b, c], 'thin')).toEqual([b])
    expect(searchItems([a, b, c], 'nothing')).toEqual([])
    expect(sortItems([a, b, c], 'name').map((x) => x.name)).toEqual(['Brush', 'Clippers', 'Glue'])
    expect(sortItems([a, b, c], 'category').map((x) => x.name)).toEqual(['Brush', 'Clippers', 'Glue'])
    expect(sortItems([a, b, c], 'stock').map((x) => x.name)).toEqual(['Glue', 'Clippers', 'Brush'])
    expect(sortItems([a, b, c], 'recent').map((x) => x.name)).toEqual(['Glue', 'Clippers', 'Brush'])
    expect(sortItems([a, b, c], 'attention').map((x) => x.name)).toEqual(['Clippers', 'Brush', 'Glue'])
  })

  it('keeps a place per copy, and moves only the copies kept in a place', () => {
    let t = editCopies(glue(), 1, { placeId: 'boxB' })
    t = editCopies(t, 0, { placeId: 'boxA' })
    expect(copyPlaces(t)).toEqual(['boxA', 'boxB'])
    expect([copiesAt(t, 'boxA'), copiesAt(t, 'boxB'), copiesAt(t, 'none')]).toEqual([1, 1, 0])
    const moved = moveCopies(t, 'boxB', 'boxC')
    expect(copyPlaces(moved)).toEqual(['boxA', 'boxC'])
    expect(moveCopies(t, undefined, 'boxZ').copies!.map((c) => c.placeId)).toEqual(['boxZ', 'boxZ'])
    // all copies in the one place: the whole item moves, no per-copy records needed
    const alike = moveCopies({ ...glue(), placeId: 'boxA' }, 'boxA', 'boxB')
    expect([alike.placeId, alike.copies]).toEqual(['boxB', undefined])
  })
})
