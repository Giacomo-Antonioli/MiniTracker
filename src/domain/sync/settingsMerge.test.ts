import { describe, expect, it } from 'vitest'
import { itemsOf, mergeSetting, stampChanges, SETTINGS_SHAPES } from './settingsMerge'
import type { Tombstone } from './merge'

const P = (...parts: string[]) => JSON.stringify(parts)
const opts = { tombstones: [] as Tombstone[], applyDeletions: true }

describe('itemsOf', () => {
  it('splits storage into its items', () => {
    const s = { sites: [{ id: 's1' }], kinds: [], places: [{ id: 'p1' }], flow: { box: 'x' }, codes: {}, homes: { u1: { placeId: 'p1' } }, out: {}, log: [] }
    expect([...itemsOf(SETTINGS_SHAPES.storage, s, ['storage']).keys()]).toEqual([
      P('storage', 'sites', 's1'),
      P('storage', 'places', 'p1'),
      P('storage', 'flow', 'box'),
      P('storage', 'homes', 'u1'),
    ])
  })
  it('unknown and plain values are one item', () => {
    expect([...itemsOf({ kind: 'value' }, '€', ['currency']).keys()]).toEqual([P('currency')])
    expect(itemsOf({ kind: 'value' }, undefined, ['x']).size).toBe(0)
  })
})

describe('stampChanges', () => {
  it('finds added, changed and removed items', () => {
    const before = [{ id: 'a', n: 1 }, { id: 'b', n: 1 }, { id: 'c', n: 1 }]
    const after = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'd', n: 1 }]
    expect(stampChanges('games', before, after)).toEqual({ changed: [P('games', 'b'), P('games', 'd')], removed: [P('games', 'c')] })
  })
  it('ignores sync bookkeeping keys', () => {
    expect(stampChanges('syncStamps', {}, { a: '1' })).toEqual({ changed: [], removed: [] })
  })
})

describe('mergeSetting', () => {
  it('keeps edits to different items from both devices', () => {
    const local = [{ id: 'a', v: 'L' }, { id: 'b', v: 'L' }]
    const remote = [{ id: 'a', v: 'R' }, { id: 'b', v: 'R' }, { id: 'c', v: 'R' }]
    const stamps = { local: { [P('games', 'a')]: '2' }, remote: { [P('games', 'b')]: '2', [P('games', 'c')]: '1' } }
    const out = mergeSetting('games', local, remote, stamps, opts)
    expect(out.value).toEqual([{ id: 'a', v: 'L' }, { id: 'b', v: 'R' }, { id: 'c', v: 'R' }])
    expect(out.summary).toMatchObject({ added: 1, updated: 1, kept: 1 })
  })

  it('merges inside storage and keeps unlisted fields', () => {
    const local = { sites: [], kinds: [], places: [{ id: 'p1', name: 'L' }], flow: {}, codes: { A1: 'u1' }, homes: {}, out: {}, log: [], extra: 1 }
    const remote = { sites: [], kinds: [], places: [{ id: 'p2', name: 'R' }], flow: {}, codes: { B2: 'u2' }, homes: {}, out: {}, log: [] }
    const out = mergeSetting('storage', local, remote, { local: {}, remote: {} }, opts).value as typeof local
    expect(out.places.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(out.codes).toEqual({ A1: 'u1', B2: 'u2' })
    expect(out.extra).toBe(1)
  })

  it('applies a deletion marker to an item', () => {
    const tomb = { table: 'settings', id: P('supplies', 'x'), deletedAt: '5' }
    const out = mergeSetting('supplies', [{ id: 'x' }, { id: 'y' }], [], { local: { [P('supplies', 'x')]: '1' }, remote: {} }, { tombstones: [tomb], applyDeletions: true })
    expect(out.value).toEqual([{ id: 'y' }])
  })

  it('plain values: newest wins, and missing on both stays missing', () => {
    const s = { local: { [P('currency')]: '1' }, remote: { [P('currency')]: '2' } }
    expect(mergeSetting('currency', '€', '$', s, opts).value).toBe('$')
    expect(mergeSetting('currency', undefined, undefined, { local: {}, remote: {} }, opts).value).toBeUndefined()
  })

  it('maps rebuild from the remote side when local is missing', () => {
    expect(mergeSetting('companionTicks', undefined, { u1: ['a'] }, { local: {}, remote: {} }, opts).value).toEqual({ u1: ['a'] })
  })
})
