import { describe, expect, it } from 'vitest'
import hachette from './fixtures/hachette-combat-patrol.json?raw'
import { DEFAULT_PIPELINE, WISHLISTED } from './pipeline'
import { findDuplicates, parseCollectionFile, planCollection, resolveStage, selectEntries } from './collectionFile'

let n = 0
const ctx = () => ({ now: '2026-11-14T10:00:00.000Z', newId: () => `id${++n}` })
const file = (o: object) => JSON.stringify({ format: 'minitracker-collection', version: 1, ...o })
const none = { units: [], tools: [], supplies: [] }

describe('collection file', () => {
  it('rejects other files and newer versions', () => {
    expect(() => parseCollectionFile('nope')).toThrow('not valid JSON')
    expect(() => parseCollectionFile('{"format":"x"}')).toThrow('not a MiniTracker collection file')
    expect(() => parseCollectionFile(file({ version: 9 }))).toThrow('newer version')
  })

  it('maps stage names, ids and wishlist', () => {
    expect(resolveStage('On sprue', DEFAULT_PIPELINE)).toBe('sprue')
    expect(resolveStage('built', DEFAULT_PIPELINE)).toBe('built')
    expect(resolveStage('wishlist', DEFAULT_PIPELINE)).toBe(WISHLISTED)
    expect(resolveStage(undefined, DEFAULT_PIPELINE)).toBe('sprue')
    expect(() => resolveStage('nope', DEFAULT_PIPELINE)).toThrow('Unknown stage')
  })

  it('plans units with tags and tools, and skips what is already there', () => {
    const f = parseCollectionFile(file({
      units: [{ name: 'Farseer', faction: 'Aeldari', status: 'On sprue', tags: ['hachette'] }, { name: 'Kahl', status: 'wishlist', count: 2, tags: ['hachette'] }],
      tools: [{ name: 'Starter Brush', category: 'Brushes' }],
      supplies: [{ name: 'Binder' }],
    }))
    const first = planCollection(f, none, DEFAULT_PIPELINE, ctx())
    expect(first.units.map((u) => [u.customName, u.groups[0].status, u.groups[0].count, u.tags])).toEqual([['Farseer', 'sprue', 1, ['hachette']], ['Kahl', WISHLISTED, 2, ['hachette']]])
    expect(first.tools[0]).toMatchObject({ name: 'Starter Brush', category: 'Brushes', status: 'owned' })
    expect(first.supplies).toHaveLength(1)
    const again = planCollection(f, { units: first.units, tools: first.tools, supplies: first.supplies }, DEFAULT_PIPELINE, ctx())
    expect([again.units.length, again.tools.length, again.supplies.length, again.duplicates]).toEqual([0, 0, 0, 4])
    expect(again.updatedUnits).toHaveLength(0)
  })

  it('adds a second copy to the existing unit and raises quantities when asked', () => {
    const f = parseCollectionFile(file({ units: [{ name: 'Farseer', status: 'On sprue', count: 2, tags: ['hachette'] }, { name: 'Farseer', status: 'wishlist', tags: ['hachette'] }], tools: [{ name: 'Brush', quantity: 2 }] }))
    const base = planCollection(parseCollectionFile(file({ units: [{ name: 'Farseer', status: 'On sprue', tags: ['hachette'] }], tools: [{ name: 'Brush' }] })), none, DEFAULT_PIPELINE, ctx())
    const plan = planCollection(f, { units: base.units, tools: base.tools, supplies: [] }, DEFAULT_PIPELINE, ctx(), 'add')
    expect(plan.units).toHaveLength(0)
    expect(plan.updatedUnits).toHaveLength(1)
    expect(plan.updatedUnits[0].groups.map((g) => [g.status, g.count])).toEqual([['sprue', 3], [WISHLISTED, 1]])
    expect(plan.updatedTools[0].quantity).toBe(3)
    expect(plan.duplicates).toBe(3)
  })

  it('loads the real Hachette Combat Patrol file: owned up to issue 51, the rest on the wishlist, all tagged', () => {
    const f = parseCollectionFile(hachette)
    expect([f.units.length, f.tools.length, f.supplies.length]).toEqual([85, 7, 2])
    const plan = planCollection(f, none, DEFAULT_PIPELINE, ctx())
    expect(plan.duplicates).toBe(0)
    expect(plan.units.every((u) => u.tags.includes('hachette') && u.tags.includes('combat-patrol'))).toBe(true)
    expect(plan.units.filter((u) => u.groups[0].status === 'sprue')).toHaveLength(41)
    expect(plan.units.filter((u) => u.groups[0].status === WISHLISTED)).toHaveLength(44)
    expect(plan.units.find((u) => u.customName === 'Primaris Company Champion')?.groups[0].status).toBe(WISHLISTED)
    expect(plan.units.find((u) => u.customName === 'Hive Tyrant')?.groups[0].status).toBe('sprue')
    expect(plan.tools.map((t) => t.name)).toContain('Citadel Starter Brush')
    // a second load finds everything already there
    const again = planCollection(f, { units: plan.units, tools: plan.tools, supplies: plan.supplies }, DEFAULT_PIPELINE, ctx())
    expect([again.units.length, again.duplicates]).toEqual([0, 94])
  })

  it('explains what is wrong with a damaged file', () => {
    expect(() => parseCollectionFile(file({ units: [{ count: 2 }] }))).toThrow('Unit 1 has no name')
    expect(() => parseCollectionFile(file({ units: [{ name: 'A', count: 0 }] }))).toThrow('invalid model count')
    expect(() => parseCollectionFile(file({ tools: [{}] }))).toThrow('Tool 1 has no name')
    expect(() => parseCollectionFile(file({ supplies: [{ name: 'Glue', quantity: -1 }] }))).toThrow('invalid quantity')
    expect(() => parseCollectionFile(file({ units: 'x' }))).toThrow('damaged')
    expect(() => parseCollectionFile(file({ units: [null] }))).toThrow('Unit 1 has no name')
    expect(() => parseCollectionFile(JSON.stringify({ format: 'minitracker-collection' }))).toThrow('newer version')
    expect(parseCollectionFile(file({}))).toMatchObject({ units: [], tools: [], supplies: [] })
  })

  it('keeps optional fields, wishlist items and the first owned stage by default', () => {
    const f = parseCollectionFile(file({ units: [{ name: ' Kahl ', faction: 'Votann', notes: 'n', tags: [' a ', '', 3] }], tools: [{ name: 'Lamp', status: 'Wishlist', category: 'Lighting', quantity: 0, notes: 'x' }] }))
    expect(f.units[0]).toMatchObject({ name: 'Kahl', faction: 'Votann', notes: 'n', tags: ['a'], count: 1 })
    expect(f.tools[0]).toMatchObject({ status: 'wishlist', category: 'Lighting', quantity: 0, notes: 'x' })
    const plan = planCollection(f, none, DEFAULT_PIPELINE, ctx())
    expect(plan.units[0]).toMatchObject({ factionName: 'Votann', notes: 'n', groups: [{ status: 'sprue' }] })
    expect(plan.tools[0]).toMatchObject({ status: 'wishlist', notes: 'x', category: 'Lighting' })
    expect(findDuplicates(f, { units: plan.units, tools: plan.tools, supplies: [] })).toEqual({ units: [true], tools: [true], supplies: [] })
    expect(selectEntries(f, { units: [false], tools: [true], supplies: [] }).units).toEqual([])
  })

  it('matches untagged units only with untagged ones, and merges repeats inside one file when asked', () => {
    const base = planCollection(parseCollectionFile(file({ units: [{ name: 'Farseer', tags: ['x'] }, { name: 'Kahl' }] })), none, DEFAULT_PIPELINE, ctx())
    const f = parseCollectionFile(file({ units: [{ name: 'Farseer' }, { name: 'Kahl', status: 'wishlist' }, { name: 'New', count: 2 }, { name: 'New', count: 3 }], tools: [{ name: 'Lamp' }, { name: 'lamp', quantity: 2 }], supplies: [{ name: 'Glue' }] }))
    const have = { units: base.units, tools: [], supplies: [] }
    expect(findDuplicates(f, have).units).toEqual([false, true, false, false])
    const plan = planCollection(f, have, DEFAULT_PIPELINE, ctx(), 'add')
    expect(plan.units.map((u) => [u.customName, u.groups.map((g) => g.count)])).toEqual([['Farseer', [1]], ['New', [5]]])
    expect(plan.updatedUnits.map((u) => u.customName)).toEqual(['Kahl'])
    expect(plan.tools.map((t) => t.quantity)).toEqual([3])
    const raised = planCollection(parseCollectionFile(file({ supplies: [{ name: 'Glue', quantity: 2 }] })), { units: [], tools: [], supplies: [{ ...plan.supplies[0] }] }, DEFAULT_PIPELINE, ctx(), 'add')
    expect(raised.updatedSupplies[0].quantity).toBe(3)
    expect(planCollection(f, have, DEFAULT_PIPELINE, ctx(), 'skip').duplicates).toBe(3)
  })
})
