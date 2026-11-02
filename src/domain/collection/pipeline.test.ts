import { describe, expect, it } from 'vitest'
import { createUnit, ownedModels } from './ownedUnit'
import {
  WISHLISTED,
  firstOwnedStage,
  withWishlisted,
  DEFAULT_PIPELINE,
  addStage,
  moveModels,
  progress,
  removeStage,
  removeUnusedStage,
  renameStage,
  reorderStages,
  setFlags,
  setLifecycle,
  validatePipeline,
} from './pipeline'
import type { OwnedUnit } from './types'

const T0 = '2026-11-01T10:00:00.000Z'
const T1 = '2026-11-02T10:00:00.000Z'
let n = 0
const ctx = (now = T1) => ({ now, newId: () => `id-${++n}` })

function squad(): OwnedUnit {
  return createUnit({ customName: 'Squad', groups: [{ count: 10, status: 'built' }] }, ctx(T0))
}

describe('DEFAULT_PIPELINE', () => {
  it('has the agreed stages in order', () => {
    expect(DEFAULT_PIPELINE.stages.map((s) => s.id)).toEqual([
      'wishlisted', 'sprue', 'built', 'primed', 'basecoated', 'painted', 'based', 'varnished',
    ])
    expect(() => validatePipeline(DEFAULT_PIPELINE)).not.toThrow()
  })
})

describe('editing the pipeline', () => {
  it('adds a stage after a given one', () => {
    const p = addStage(DEFAULT_PIPELINE, { id: 'washed', name: 'Washed' }, 'basecoated')
    expect(p.stages.map((s) => s.id).slice(4, 6)).toEqual(['basecoated', 'washed'])
  })

  it('adds at the end when no anchor is given', () => {
    const p = addStage(DEFAULT_PIPELINE, { id: 'display', name: 'On display' })
    expect(p.stages.at(-1)?.id).toBe('display')
  })

  it('rejects a duplicate id and an unknown anchor', () => {
    expect(() => addStage(DEFAULT_PIPELINE, { id: 'built', name: 'Again' })).toThrow(/exists/)
    expect(() => addStage(DEFAULT_PIPELINE, { id: 'x', name: 'X' }, 'nope')).toThrow(/Unknown stage/)
  })

  it('renames a stage but keeps its id', () => {
    const p = renameStage(DEFAULT_PIPELINE, 'primed', 'Undercoated')
    expect(p.stages.find((s) => s.id === 'primed')?.name).toBe('Undercoated')
    expect(() => renameStage(DEFAULT_PIPELINE, 'primed', ' ')).toThrow(/name/)
  })

  it('reorders stages when given the same set of ids', () => {
    const ids = DEFAULT_PIPELINE.stages.map((s) => s.id)
    const swapped = [ids[2], ids[1], ids[0], ...ids.slice(3)]
    // Wishlisted always stays first.
    expect(reorderStages(DEFAULT_PIPELINE, swapped).stages.map((s) => s.id)).toEqual([ids[0], ids[2], ids[1], ...ids.slice(3)])
    expect(reorderStages({ stages: DEFAULT_PIPELINE.stages.slice(1, 3) }, [ids[2], ids[1]]).stages.map((s) => s.id)).toEqual([ids[2], ids[1]])
    expect(() => reorderStages(DEFAULT_PIPELINE, ids.slice(1))).toThrow(/same stages/)
  })

  it('refuses to remove a stage still used by models', () => {
    expect(() => removeStage(DEFAULT_PIPELINE, 'built', [squad()])).toThrow(/in use/)
    expect(removeStage(DEFAULT_PIPELINE, 'varnished', [squad()]).stages).toHaveLength(7)
    expect(() => removeStage(DEFAULT_PIPELINE, 'wishlisted', [])).toThrow(/cannot be removed/)
  })

  it('removeUnusedStage works for any pipeline given a usage count', () => {
    expect(() => removeUnusedStage(DEFAULT_PIPELINE, 'primed', 3)).toThrow(/in use/)
    expect(removeUnusedStage(DEFAULT_PIPELINE, 'primed', 0).stages).toHaveLength(7)
  })

  it('refuses to remove the last stage', () => {
    expect(() => removeStage({ stages: [{ id: 'a', name: 'A' }] }, 'a', [])).toThrow(/at least one/)
  })

  it('validatePipeline catches empty pipelines and duplicates', () => {
    expect(() => validatePipeline({ stages: [] })).toThrow(/at least one/)
    expect(() => validatePipeline({ stages: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }] })).toThrow(/Duplicate/)
  })
})

describe('moveModels', () => {
  it('moves models forward and records an event dated today by default', () => {
    const u = squad()
    const { unit, event } = moveModels(u, u.groups[0].id, 4, 'primed', DEFAULT_PIPELINE, ctx())
    expect(unit.groups.map((g) => [g.status, g.count])).toEqual([['built', 6], ['primed', 4]])
    expect(event).toMatchObject({
      unitId: u.id, from: 'built', to: 'primed', count: 4,
      date: T1, direction: 'forward', note: '',
    })
    expect(event.photoId).toBeUndefined()
  })

  it('accepts a custom date, photo and note', () => {
    const u = squad()
    const { event } = moveModels(u, u.groups[0].id, 10, 'painted', DEFAULT_PIPELINE, ctx(), {
      date: '2026-10-15', photoId: 'p1', note: 'Finally!',
    })
    expect(event).toMatchObject({ date: '2026-10-15', photoId: 'p1', note: 'Finally!' })
  })

  it('rejects an unknown group', () => {
    expect(() => moveModels(squad(), 'nope', 1, 'primed', DEFAULT_PIPELINE, ctx())).toThrow(/Unknown group/)
  })

  it('rejects an invalid date', () => {
    const u = squad()
    expect(() =>
      moveModels(u, u.groups[0].id, 1, 'primed', DEFAULT_PIPELINE, ctx(), { date: 'yesterday' }),
    ).toThrow(/date/)
  })

  it('allows going back and marks it as backward', () => {
    const u = squad()
    const { event } = moveModels(u, u.groups[0].id, 2, 'sprue', DEFAULT_PIPELINE, ctx())
    expect(event.direction).toBe('backward')
  })

  it('rejects a stage not in the pipeline, and moving to the same stage', () => {
    const u = squad()
    expect(() => moveModels(u, u.groups[0].id, 1, 'gilded', DEFAULT_PIPELINE, ctx())).toThrow(/Unknown stage/)
    expect(() => moveModels(u, u.groups[0].id, 1, 'built', DEFAULT_PIPELINE, ctx())).toThrow(/already/)
  })
})

describe('progress', () => {
  it('gives the share of models at or past a target stage', () => {
    let u = squad()
    u = moveModels(u, u.groups[0].id, 4, 'painted', DEFAULT_PIPELINE, ctx()).unit
    u = moveModels(u, u.groups[0].id, 1, 'varnished', DEFAULT_PIPELINE, ctx()).unit
    expect(progress([u], DEFAULT_PIPELINE, 'painted')).toEqual({ done: 5, total: 10, ratio: 0.5 })
  })

  it('ignores units that are sold, traded, gifted or lost', () => {
    const sold = setLifecycle(squad(), 'sold', ctx())
    expect(progress([sold], DEFAULT_PIPELINE, 'painted')).toEqual({ done: 0, total: 0, ratio: 0 })
  })
})

describe('lifecycle and flags', () => {
  it('defaults to active, not favourite, not next up', () => {
    const u = squad()
    expect(u.lifecycle).toBe('active')
    expect(u.favourite).toBe(false)
    expect(u.nextUp).toBe(false)
    expect(u.externalRefs).toEqual([])
  })

  it('sets lifecycle and flags', () => {
    const u = setFlags(setLifecycle(squad(), 'on-hold', ctx()), { favourite: true, nextUp: true }, ctx())
    expect(u).toMatchObject({ lifecycle: 'on-hold', favourite: true, nextUp: true, updatedAt: T1 })
  })
})

describe('Wishlisted stage', () => {
  it('is put first in older pipelines, and new owned models start after it', () => {
    const old = { stages: [{ id: 'built', name: 'Built' }, { id: WISHLISTED, name: 'Want' }] }
    expect(withWishlisted(old).stages.map((s) => s.name)).toEqual(['Want', 'Built'])
    expect(withWishlisted({ stages: [{ id: 'built', name: 'Built' }] }).stages[0]).toEqual({ id: WISHLISTED, name: 'Wishlisted' })
    expect(firstOwnedStage(DEFAULT_PIPELINE)).toBe('sprue')
    expect(firstOwnedStage({ stages: [{ id: WISHLISTED, name: 'W' }] })).toBe(WISHLISTED)
  })

  it('does not count as owned or in progress', () => {
    const u = createUnit({ customName: 'Mixed', groups: [{ count: 3, status: WISHLISTED }, { count: 2, status: 'painted' }] }, ctx(T0))
    expect(ownedModels(u)).toBe(2)
    expect(progress([u], DEFAULT_PIPELINE, 'painted')).toEqual({ done: 2, total: 2, ratio: 1 })
  })
})
