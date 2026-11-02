import { describe, expect, it } from 'vitest'
import { groupUnits, sortGroups } from './groups'
import { createUnit } from './ownedUnit'
import { DEFAULT_PIPELINE } from './pipeline'

let n = 0
const c = (at: string) => ({ now: at, newId: () => `id${++n}` })
const a = { ...createUnit({ customName: 'Intercessors A', datasheetId: 'int', factionId: 'um', factionName: 'Ultramarines', schemeId: 's1', groups: [{ count: 5, status: 'built' }] }, c('2026-01-01')), favourite: true }
const b = createUnit({ customName: 'Intercessors B', datasheetId: 'int', factionId: 'um', factionName: 'Ultramarines', schemeId: 's2', groups: [{ count: 5, status: 'painted' }, { count: 2, status: 'wishlisted' }] }, c('2026-02-01'))
const other = createUnit({ customName: 'Intercessors', datasheetId: 'int', factionId: 'ba', factionName: 'Blood Angels', groups: [{ count: 10, status: 'sprue' }] }, c('2026-01-15'))
const loose = createUnit({ customName: 'Proxy tank', groups: [{ count: 1, status: 'based' }] }, c('2025-12-01'))
const sold = { ...createUnit({ customName: 'proxy tank ', groups: [{ count: 1, status: 'built' }] }, c('2025-01-01')), lifecycle: 'sold' as const }

describe('groupUnits', () => {
  const groups = groupUnits([b, other, a, loose, sold], DEFAULT_PIPELINE, (id) => (id === 'int' ? 'Intercessor Squad' : undefined))
  it('groups by datasheet and faction (or name), summing models, stages, painted and schemes', () => {
    expect(groups.map((g) => [g.name, g.factionName, g.units.map((u) => u.customName)])).toEqual([
      ['Intercessor Squad', 'Ultramarines', ['Intercessors A', 'Intercessors B']],
      ['Intercessors', 'Blood Angels', ['Intercessors']],
      ['Proxy tank', undefined, ['proxy tank', 'Proxy tank']],
    ])
    expect(groups[0]).toMatchObject({ models: 10, wishlisted: 2, painted: { done: 5, total: 10 }, schemeIds: ['s1', 's2'], favourite: true, nextUp: false, updatedAt: '2026-02-01' })
    expect(groups[0].stages.map((s) => [s.id, s.count])).toEqual([['wishlisted', 2], ['built', 5], ['painted', 5]])
    // Sold entries are listed but not counted.
    expect(groups[2]).toMatchObject({ models: 1, painted: { done: 1, total: 1 } })
  })

  it('sorts by any column, both ways', () => {
    expect(sortGroups(groups, 'name').map((g) => g.name)).toEqual(['Intercessor Squad', 'Intercessors', 'Proxy tank'])
    expect(sortGroups(groups, 'faction').map((g) => g.factionName)).toEqual([undefined, 'Blood Angels', 'Ultramarines'])
    expect(sortGroups(groups, 'models', true).map((g) => g.models + g.wishlisted)).toEqual([12, 10, 1])
    expect(sortGroups(groups, 'painted').map((g) => g.name)).toEqual(['Intercessors', 'Intercessor Squad', 'Proxy tank'])
    expect(sortGroups(groups, 'updated', true)[0].name).toBe('Intercessor Squad')
    expect(sortGroups([groups[1], { ...groups[1], name: 'A' }], 'faction').map((g) => g.name)).toEqual(['A', 'Intercessors'])
  })
})
