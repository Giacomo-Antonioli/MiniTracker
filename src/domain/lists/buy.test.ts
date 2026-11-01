import { describe, expect, it } from 'vitest'
import type { Datasheet } from '../catalogue/types'
import { createUnit } from '../collection/ownedUnit'
import { buyList, buyListText } from './buy'
import { addEntry, createList } from './list'
import { listOwnership } from './ownership'
import { listPoints } from './points'

let n = 0
const ctx = { now: 't', newId: () => `id${++n}` }
const sheet = (id: string, pts: number): Datasheet => ({ id, name: id[0].toUpperCase() + id.slice(1), factionIds: ['tau'], keywords: [], factionKeywords: [], minModels: 1, maxModels: 10, points: [{ fromModels: 1, points: pts }], wargear: [], abilities: [], legends: false })
const sheets = new Map([['crisis', sheet('crisis', 120)], ['stealth', sheet('stealth', 70)], ['ghost', sheet('ghost', 0)]])

describe('buyList', () => {
  it('sums what is missing per unit, biggest gap first, and writes it as text', () => {
    let l = createList({ name: 'Tau', edition: '11e', battleSize: 'sf', pointsLimit: 2000 }, ctx)
    for (const [id, m] of [['crisis', 3], ['crisis', 3], ['stealth', 5], ['ghost', 1]] as const) l = addEntry(l, { datasheetId: id, models: m }, ctx)
    l = addEntry(l, { datasheetId: 'unknown', models: 2 }, ctx)
    const units = [createUnit({ customName: 'C', datasheetId: 'crisis', groups: [{ count: 4, status: 'built' }] }, ctx), createUnit({ customName: 'G', datasheetId: 'ghost', groups: [{ count: 1, status: 'built' }] }, ctx)]
    const b = buyList(l, sheets, listOwnership(l, units), listPoints(l, sheets))
    expect(b.rows).toEqual([
      { datasheetId: 'stealth', name: 'Stealth', units: 1, missingModels: 5, points: 70 },
      { datasheetId: 'crisis', name: 'Crisis', units: 1, missingModels: 2, points: 120 },
      { datasheetId: 'unknown', name: 'Unknown unit', units: 1, missingModels: 2, points: 0 },
    ])
    expect(b).toMatchObject({ missingModels: 9, points: 190 })
    expect(buyListText('Tau', b)).toBe('Buy list – Tau\n- Stealth: 5 models\n- Crisis: 2 models\n- Unknown unit: 2 models\nTotal: 9 models')
    const two = addEntry(l, { datasheetId: 'stealth', models: 1 }, ctx)
    expect(buyListText('Tau', buyList(two, sheets, listOwnership(two, units), listPoints(two, sheets)))).toContain('- Stealth: 6 models (2 units)')
    expect(buyListText('Empty', { rows: [], missingModels: 0, points: 0 })).toBe('Empty: nothing to buy')
  })
})
