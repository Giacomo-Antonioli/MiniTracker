import { describe, expect, it } from 'vitest'
import { moveAllAt, modelsAt, withTag } from './bulk'
import { createUnit } from './ownedUnit'
import { DEFAULT_PIPELINE } from './pipeline'

let n = 0
const ctx = () => ({ now: '2026-11-14T10:00:00.000Z', newId: () => `id${++n}` })

describe('bulk edits', () => {
  it('moves every group at a stage and records one event each', () => {
    let u = createUnit({ customName: 'Termagants', groups: [{ count: 10, status: 'sprue' }, { count: 5, status: 'built' }] }, ctx())
    u = { ...u, groups: [...u.groups, { id: 'x', count: 3, status: 'sprue', loadout: ['fleshborer'], magnetised: [] }] }
    const r = moveAllAt(u, 'sprue', 'built', DEFAULT_PIPELINE, ctx())
    expect(modelsAt(r.unit, 'sprue')).toBe(0)
    expect(modelsAt(r.unit, 'built')).toBe(18)
    expect(r.events.map((e) => [e.from, e.to, e.count, e.direction])).toEqual([['sprue', 'built', 10, 'forward'], ['sprue', 'built', 3, 'forward']])
  })

  it('does nothing for a unit with no models at that stage, and rejects the same stage', () => {
    const u = createUnit({ customName: 'Kahl', groups: [{ count: 1, status: 'built' }] }, ctx())
    expect(moveAllAt(u, 'sprue', 'built', DEFAULT_PIPELINE, ctx()).events).toEqual([])
    expect(() => moveAllAt(u, 'built', 'built', DEFAULT_PIPELINE, ctx())).toThrow('two different stages')
  })

  it('adds and removes tags without duplicates', () => {
    const u = createUnit({ customName: 'Kahl', tags: ['Hachette'], groups: [{ count: 1, status: 'sprue' }] }, ctx())
    expect(withTag(u, '#hachette', true, ctx())).toBe(u)
    expect(withTag(u, 'premium', true, ctx()).tags).toEqual(['Hachette', 'premium'])
    expect(withTag(u, 'HACHETTE', false, ctx()).tags).toEqual([])
    expect(() => withTag(u, '  ', true, ctx())).toThrow('Type a tag')
  })
})
