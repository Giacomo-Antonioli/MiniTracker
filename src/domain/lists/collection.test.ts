import { describe, expect, it } from 'vitest'
import type { Catalogue, Datasheet } from '../catalogue/types'
import { createUnit } from '../collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../collection/pipeline'
import type { OwnedUnit } from '../collection/types'
import type { PaintScheme } from '../schemes/types'
import { addFromCollection, collectionPlan } from './collection'
import { addEntry, createList } from './list'
import { listOwnership } from './ownership'

let n = 0
const ctx = { now: 't', newId: () => `id${++n}` }
const sheet = (id: string, min: number, max: number, over: Partial<Datasheet> = {}): Datasheet => ({ id, name: id, factionIds: ['tau'], keywords: [], factionKeywords: [], minModels: min, maxModels: max, points: [{ fromModels: min, points: 10 }], wargear: [], abilities: [], legends: false, ...over })
const cat = { gameId: 'g', gameName: 'G', source: { repo: 'r', commit: 'c', fetchedAt: 'f' }, factions: [], datasheets: [sheet('crisis', 3, 6), sheet('stealth', 3, 6), sheet('old', 1, 1, { legends: true }), sheet('marine', 5, 10, { factionIds: ['sm'] })] } as Catalogue
const unit = (name: string, datasheetId: string, groups: [number, string][], over: Partial<OwnedUnit> = {}) =>
  ({ ...createUnit({ customName: name, datasheetId, groups: groups.map(([count, status]) => ({ count, status })) }, ctx), ...over })
const base = () => createList({ name: 'L', edition: '11e', battleSize: 'sf', pointsLimit: 2000, factionId: 'tau' }, ctx)

describe('listOwnership with sources and painting', () => {
  it('records which units supply each entry, uses painted models first, and links a unit once', () => {
    const a = unit('A', 'crisis', [[2, 'built'], [1, 'painted']])
    const b = unit('B', 'crisis', [[3, 'varnished']])
    let l = addEntry(base(), { datasheetId: 'crisis', models: 4 }, ctx)
    l = addEntry(l, { datasheetId: 'crisis', models: 3, ownedUnitId: a.id }, ctx)
    l = addEntry(l, { datasheetId: 'crisis', models: 3, ownedUnitId: a.id }, ctx) // second link to A is ignored
    const o = listOwnership(l, [a, b], DEFAULT_PIPELINE)
    const [e1, e2, e3] = l.entries.map((e) => o.byEntry.get(e.id)!)
    expect(e2).toMatchObject({ state: 'owned', from: [{ unitId: a.id, models: 3 }], painted: 1 })
    expect(e1).toMatchObject({ state: 'partial', have: 3, from: [{ unitId: b.id, models: 3 }], painted: 3 })
    expect(e3).toMatchObject({ state: 'missing', have: 0, from: [] })
    expect(o).toMatchObject({ missingModels: 4, unpaintedModels: 2 })
    expect(listOwnership(l, [a, b]).unpaintedModels).toBe(0)
  })
})

describe('collectionPlan', () => {
  it('lists units to paint and paints their schemes need that you lack', () => {
    const scheme = { id: 's1', name: 'Sept', sections: [{ id: 'x', area: 'Armour', steps: [{ id: 'y', paints: [{ paintId: 'p-white' }, { paintId: 'p-blue' }, { paintId: 'p-red' }] }] }] } as unknown as PaintScheme
    const a = unit('A', 'crisis', [[2, 'built'], [1, 'painted']], { schemeId: 's1' })
    const b = unit('B', 'stealth', [[3, 'primed']], { factionName: 'Tau' })
    const c = unit('C', 'stealth', [[3, 'painted']], { schemeId: 'gone' })
    let l = addEntry(base(), { datasheetId: 'crisis', models: 3 }, ctx)
    l = addEntry(l, { datasheetId: 'stealth', models: 3, ownedUnitId: b.id }, ctx)
    l = addEntry(l, { datasheetId: 'stealth', models: 3, ownedUnitId: c.id }, ctx)
    const stock = new Map([
      ['p-white', { paintId: 'p-white', stage: 'in-use' }],
      ['p-blue', { paintId: 'p-blue', stage: 'wishlist' }],
    ]) as never
    const plan = collectionPlan(listOwnership(l, [a, b, c], DEFAULT_PIPELINE), [a, b, c], [scheme], stock, { Tau: 's1' })
    expect(plan.toPaint.map((x) => [x.unit.customName, x.models])).toEqual([['B', 3], ['A', 2]])
    expect(plan.missingPaints).toEqual([{ paintId: 'p-blue', schemes: ['Sept'] }, { paintId: 'p-red', schemes: ['Sept'] }])
  })
})

describe('addFromCollection', () => {
  it('adds owned units of the faction, linked, within allowed sizes; skips others and ones already in', () => {
    const big = unit('Big', 'crisis', [[8, 'built']])
    const small = unit('Small', 'stealth', [[1, 'built']])
    const sold = unit('Sold', 'crisis', [[3, 'built']], { lifecycle: 'sold' })
    const other = unit('M', 'marine', [[5, 'built']])
    const old = unit('Old', 'old', [[1, 'built']])
    const noSheet = unit('Free', '', [[1, 'built']])
    const units = [big, small, sold, other, old, noSheet]
    const l = addFromCollection(base(), cat, units, ctx)
    expect(l.entries.map((e) => [e.datasheetId, e.models, e.ownedUnitId])).toEqual([['crisis', 6, big.id], ['stealth', 3, small.id]])
    expect(addFromCollection(l, cat, units, ctx, { legends: true }).entries.map((e) => e.datasheetId)).toEqual(['crisis', 'stealth', 'old'])
    expect(() => addFromCollection({ ...base(), factionId: undefined }, cat, units, ctx)).toThrow(/faction/)
  })
})
