import { describe, expect, it } from 'vitest'
import {
  createUnit,
  mergeGroups,
  setMagnetSlots,
  splitGroup,
  totalModels,
  modelsByStatus,
} from './ownedUnit'
import type { OwnedUnit } from './types'

const T0 = '2026-11-01T10:00:00.000Z'
const T1 = '2026-11-02T10:00:00.000Z'

let n = 0
const ids = () => `id-${++n}`

function intercessors(): OwnedUnit {
  return createUnit(
    {
      customName: 'Intercessor Squad',
      groups: [{ count: 10, status: 'built', loadout: ['bolt rifle'] }],
    },
    { now: T0, newId: ids },
  )
}

describe('createUnit', () => {
  it('fills ids, timestamps and empty defaults', () => {
    const u = intercessors()
    expect(u.id).toMatch(/^id-/)
    expect(u.createdAt).toBe(T0)
    expect(u.updatedAt).toBe(T0)
    expect(u.groups).toHaveLength(1)
    expect(u.groups[0].id).toMatch(/^id-/)
    expect(u.groups[0].magnetised).toEqual([])
    expect(u.tutorials).toEqual([])
    expect(u.tags).toEqual([])
    expect(u.notes).toBe('')
  })

  it.each([0, -1, 1.5])('rejects group count %s', (count) => {
    expect(() =>
      createUnit({ customName: 'X', groups: [{ count, status: 'built' }] }, { now: T0, newId: ids }),
    ).toThrow(/count/)
  })

  it('rejects an empty name', () => {
    expect(() => createUnit({ customName: '  ', groups: [] }, { now: T0, newId: ids })).toThrow(/name/)
  })
})

describe('totals', () => {
  it('counts models across groups and by status', () => {
    let u = intercessors()
    u = splitGroup(u, u.groups[0].id, 4, 'painted', { now: T1, newId: ids })
    expect(totalModels(u)).toBe(10)
    expect(modelsByStatus(u)).toEqual({ built: 6, painted: 4 })
  })
})

describe('splitGroup', () => {
  it('moves n models to a new group, keeping loadout and magnets', () => {
    let u = intercessors()
    u = setMagnetSlots(u, u.groups[0].id, [{ slot: 'arms', optionIds: ['bolt rifle', 'auto bolt rifle'] }], { now: T0 })
    const before = u.groups[0]
    const after = splitGroup(u, before.id, 4, 'painted', { now: T1, newId: ids })

    expect(after.groups).toHaveLength(2)
    const [rest, moved] = after.groups
    expect(rest).toMatchObject({ id: before.id, count: 6, status: 'built' })
    expect(moved).toMatchObject({ count: 4, status: 'painted', loadout: ['bolt rifle'] })
    expect(moved.magnetised).toEqual(before.magnetised)
    expect(moved.id).not.toBe(before.id)
    expect(after.updatedAt).toBe(T1)
  })

  it('moving the whole group just changes its status', () => {
    const u = intercessors()
    const after = splitGroup(u, u.groups[0].id, 10, 'primed', { now: T1, newId: ids })
    expect(after.groups).toHaveLength(1)
    expect(after.groups[0]).toMatchObject({ id: u.groups[0].id, count: 10, status: 'primed' })
  })

  it('does not mutate the input', () => {
    const u = intercessors()
    const snapshot = structuredClone(u)
    splitGroup(u, u.groups[0].id, 3, 'painted', { now: T1, newId: ids })
    expect(u).toEqual(snapshot)
  })

  it.each([0, 11, -2, 2.5])('rejects moving %s models', (k) => {
    const u = intercessors()
    expect(() => splitGroup(u, u.groups[0].id, k, 'painted', { now: T1, newId: ids })).toThrow(/count/)
  })

  it('rejects an unknown group', () => {
    expect(() => splitGroup(intercessors(), 'nope', 1, 'painted', { now: T1, newId: ids })).toThrow(/group/)
  })

  it('merges into an existing identical group instead of duplicating', () => {
    let u = intercessors()
    u = splitGroup(u, u.groups[0].id, 4, 'painted', { now: T1, newId: ids })
    u = splitGroup(u, u.groups[0].id, 2, 'painted', { now: T1, newId: ids })
    expect(u.groups.map((g) => [g.status, g.count])).toEqual([
      ['built', 4],
      ['painted', 6],
    ])
  })
})

describe('mergeGroups', () => {
  it('merges groups with same status, loadout and magnets; keeps others apart', () => {
    const u = createUnit(
      {
        customName: 'Mixed',
        groups: [
          { count: 2, status: 'built', loadout: ['plasma'] },
          { count: 3, status: 'built', loadout: ['plasma'] },
          { count: 1, status: 'built', loadout: ['melta'] },
          { count: 4, status: 'painted', loadout: ['plasma'] },
        ],
      },
      { now: T0, newId: ids },
    )
    const m = mergeGroups(u, { now: T1 })
    expect(m.groups.map((g) => [g.status, g.loadout.join(), g.count])).toEqual([
      ['built', 'plasma', 5],
      ['built', 'melta', 1],
      ['painted', 'plasma', 4],
    ])
    expect(totalModels(m)).toBe(10)
  })

  it('treats loadout order as irrelevant', () => {
    const u = createUnit(
      {
        customName: 'Order',
        groups: [
          { count: 1, status: 'built', loadout: ['a', 'b'] },
          { count: 1, status: 'built', loadout: ['b', 'a'] },
        ],
      },
      { now: T0, newId: ids },
    )
    expect(mergeGroups(u, { now: T1 }).groups).toHaveLength(1)
  })

  it('keeps groups with different magnet slots apart', () => {
    let u = createUnit(
      {
        customName: 'Mag',
        groups: [
          { count: 1, status: 'built' },
          { count: 1, status: 'built' },
        ],
      },
      { now: T0, newId: ids },
    )
    u = setMagnetSlots(u, u.groups[0].id, [{ slot: 'arm', optionIds: ['x', 'y'] }], { now: T0 })
    expect(mergeGroups(u, { now: T1 }).groups).toHaveLength(2)
  })
})

describe('setMagnetSlots', () => {
  it('ignores slot order when comparing groups', () => {
    let u = createUnit(
      { customName: 'Two slots', groups: [{ count: 1, status: 'built' }, { count: 1, status: 'built' }] },
      { now: T0, newId: ids },
    )
    const a = { slot: 'left', optionIds: ['x', 'y'] }
    const b = { slot: 'right', optionIds: ['p', 'q'] }
    u = setMagnetSlots(u, u.groups[0].id, [a, b], { now: T0 })
    u = setMagnetSlots(u, u.groups[1].id, [b, a], { now: T0 })
    expect(mergeGroups(u, { now: T1 }).groups).toHaveLength(1)
  })

  it('rejects a slot with fewer than two options', () => {
    const u = intercessors()
    expect(() => setMagnetSlots(u, u.groups[0].id, [{ slot: 'arm', optionIds: ['x'] }], { now: T1 })).toThrow(/option/)
  })

  it('rejects duplicate slot names', () => {
    const u = intercessors()
    expect(() =>
      setMagnetSlots(
        u,
        u.groups[0].id,
        [
          { slot: 'arm', optionIds: ['x', 'y'] },
          { slot: 'arm', optionIds: ['a', 'b'] },
        ],
        { now: T1 },
      ),
    ).toThrow(/slot/)
  })
})
