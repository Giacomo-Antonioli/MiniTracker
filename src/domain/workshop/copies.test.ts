import { describe, expect, it } from 'vitest'
import { copyOf, editCopies, fitCopies, isLow, newItem, parseItems, setRepresentative } from './item'

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
})
