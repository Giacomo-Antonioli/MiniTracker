import { describe, expect, it } from 'vitest'
import { createUnit } from '../collection/ownedUnit'
import type { Datasheet } from '../catalogue/types'
import { addEntry, createList, removeEntry, updateEntry, validateList } from './list'
import { listOwnership } from './ownership'
import { listPoints } from './points'

let n = 0
const ctx = { now: 't', newId: () => `id${++n}` }
const base = { name: 'Tau 1k', edition: '11e' as const, factionId: 'tau', battleSize: 'strike', pointsLimit: 1000 }

const sheet = (id: string, min: number, max: number, points: [number, number][]): Datasheet =>
  ({ id, name: id, factionIds: ['tau'], keywords: [], factionKeywords: [], minModels: min, maxModels: max, points: points.map(([fromModels, p]) => ({ fromModels, points: p })), wargear: [], abilities: [], legends: false }) as Datasheet

const unit = (datasheetId: string, models: number, lifecycle: 'active' | 'sold' = 'active') =>
  ({ ...createUnit({ customName: datasheetId, datasheetId, groups: [{ count: models, status: 'built' }] }, ctx), lifecycle })

describe('army list', () => {
  it('creates a planned list and edits entries', () => {
    let l = createList(base, ctx)
    expect(l).toMatchObject({ status: 'planned', notes: '', entries: [] })
    l = addEntry(l, { datasheetId: 'crisis', models: 3 }, ctx)
    l = addEntry(l, { datasheetId: 'commander', models: 1, attachedTo: l.entries[0].id }, ctx)
    l = updateEntry(l, l.entries[0].id, { models: 6 }, ctx)
    expect(l.entries[0]).toMatchObject({ models: 6, wargear: [] })
    l = removeEntry(l, l.entries[0].id, ctx)
    expect(l.entries).toHaveLength(1)
    expect(l.entries[0].attachedTo).toBeUndefined()
  })

  it('rejects data that cannot be stored, but not rule problems', () => {
    expect(() => createList({ ...base, name: ' ' }, ctx)).toThrow(/name/)
    expect(() => createList({ ...base, pointsLimit: -1 }, ctx)).toThrow(/Points/)
    const l = createList({ ...base, pointsLimit: 5 }, ctx)
    expect(() => addEntry(l, { datasheetId: 'x', models: 0 }, ctx)).toThrow(/model/)
    expect(() => addEntry(l, { datasheetId: 'x', models: 1, attachedTo: 'nope' }, ctx)).toThrow(/attached/)
    // over the points limit is fine to store
    expect(() => validateList(addEntry(l, { datasheetId: 'x', models: 99 }, ctx))).not.toThrow()
  })
})

describe('listPoints', () => {
  it('uses the price step for the model count; unknown or wrong size count 0', () => {
    let l = createList(base, ctx)
    l = addEntry(l, { datasheetId: 'crisis', models: 6 }, ctx)
    l = addEntry(l, { datasheetId: 'crisis', models: 3 }, ctx)
    l = addEntry(l, { datasheetId: 'gone', models: 1 }, ctx)
    l = addEntry(l, { datasheetId: 'crisis', models: 7 }, ctx)
    const sheets = new Map([['crisis', sheet('crisis', 3, 6, [[3, 80], [6, 160]])]])
    const p = listPoints(l, sheets)
    expect(p.total).toBe(240)
    expect([...p.byEntry.values()]).toEqual([160, 80, undefined, undefined])
  })
})

describe('listOwnership', () => {
  it('marks owned, partial and missing; models are used once per list', () => {
    let l = createList(base, ctx)
    l = addEntry(l, { datasheetId: 'crisis', models: 3 }, ctx)
    l = addEntry(l, { datasheetId: 'crisis', models: 3 }, ctx)
    l = addEntry(l, { datasheetId: 'stealth', models: 3 }, ctx)
    const o = listOwnership(l, [unit('crisis', 4), unit('stealth', 3, 'sold')])
    expect([...o.byEntry.values()].map((x) => [x.state, x.have])).toEqual([['owned', 3], ['partial', 1], ['missing', 0]])
    expect(o).toMatchObject({ complete: false, missingModels: 5 })
  })

  it('counts the same unit in every list', () => {
    const crisis = unit('crisis', 3)
    const a = addEntry(createList(base, ctx), { datasheetId: 'crisis', models: 3 }, ctx)
    const b = addEntry(createList(base, ctx), { datasheetId: 'crisis', models: 3 }, ctx)
    expect(listOwnership(a, [crisis]).complete).toBe(true)
    expect(listOwnership(b, [crisis]).complete).toBe(true)
  })

  it('a linked unit is used first and topped up from other units', () => {
    const big = unit('crisis', 3)
    const small = unit('crisis', 2)
    let l = createList(base, ctx)
    l = addEntry(l, { datasheetId: 'crisis', models: 3 }, ctx)
    l = addEntry(l, { datasheetId: 'crisis', models: 3, ownedUnitId: small.id }, ctx)
    const o = listOwnership(l, [big, small])
    expect([...o.byEntry.values()].map((x) => x.have)).toEqual([3, 2])
    expect(o.missingModels).toBe(1)
    // a link to a sold or wrong unit is ignored
    const wrong = addEntry(createList(base, ctx), { datasheetId: 'stealth', models: 1, ownedUnitId: big.id }, ctx)
    expect(listOwnership(wrong, [big]).complete).toBe(false)
  })
})
