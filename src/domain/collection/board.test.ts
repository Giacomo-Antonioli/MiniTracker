import { expect, it } from 'vitest'
import { boardColumns } from './board'
import { createUnit } from './ownedUnit'
import { DEFAULT_PIPELINE } from './pipeline'

it('puts one card per model group in its stage column, sorted by name', () => {
  let n = 0
  const c = { now: '2026-11-03T00:00:00.000Z', newId: () => `id${++n}` }
  const squad = createUnit({ customName: 'Squad', groups: [{ count: 4, status: 'painted' }, { count: 6, status: 'built' }] }, c)
  const tank = createUnit({ customName: 'Alpha tank', groups: [{ count: 1, status: 'built' }] }, c)
  const cols = boardColumns([squad, tank], DEFAULT_PIPELINE)
  expect(cols.map((col) => col.stage.id)).toEqual(DEFAULT_PIPELINE.stages.map((s) => s.id))
  const built = cols.find((col) => col.stage.id === 'built')!
  expect(built.cards.map((x) => [x.unit.customName, x.group.count])).toEqual([['Alpha tank', 1], ['Squad', 6]])
  expect(cols.find((col) => col.stage.id === 'painted')!.cards.map((x) => x.group.count)).toEqual([4])
})
