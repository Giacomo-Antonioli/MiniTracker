import { describe, expect, it } from 'vitest'
import type { Datasheet, ModelType } from '../catalogue/types'
import { createUnit } from '../collection/ownedUnit'
import { defaultLoadout, defaultPicks, effectiveLoadout, loadoutFromModels, loadoutProblems } from './loadout'

const opt = (id: string, name = id, max = 1) => ({ id, name, max })
const sergeant: ModelType = {
  id: 'sgt', name: 'Intercessor Sergeant', min: 1, max: 1, fixed: ['Bolt pistol'],
  choices: [
    { id: 'w1', name: 'Weapon 1', min: 1, max: 1, defaultId: 'rifle', options: [opt('rifle', 'Bolt Rifle'), opt('flamer', 'Hand flamer'), opt('sword', 'Chainsword')] },
    { id: 'w2', name: 'Weapon 2', min: 1, max: 1, options: [opt('knives', 'Knives and Fists'), opt('fist', 'Power fist')] },
  ],
}
const trooper: ModelType = { id: 'int', name: 'Intercessor', min: 4, max: 9, fixed: ['Bolt Rifle', 'Bolt pistol'], choices: [] }
const gl: ModelType = { id: 'gl', name: 'Intercessor w/ Grenade Launcher', min: 0, max: 2, fixed: ['Bolt Rifle', 'Grenade Launcher'], choices: [{ id: 'dr', name: 'Drones', min: 0, max: 2, options: [opt('gun', 'Gun Drone', 2), opt('shield', 'Shield Drone')] }] }
const d = { id: 'squad', name: 'Intercessor Squad', minModels: 5, maxModels: 10, models: [sergeant, trooper, gl] } as Datasheet

describe('defaultLoadout', () => {
  it('fills minimums, then the type with most room, with default picks', () => {
    expect(defaultPicks(sergeant)).toEqual(['rifle', 'knives'])
    expect(defaultLoadout(d, 10)).toEqual([
      { modelId: 'sgt', count: 1, picks: ['rifle', 'knives'] },
      { modelId: 'int', count: 9, picks: [] },
    ])
    expect(loadoutProblems(d, 10, defaultLoadout(d, 10))).toEqual([])
    expect(defaultLoadout({ ...d, models: undefined }, 5)).toEqual([])
  })
})

describe('loadoutProblems', () => {
  it('checks the total, model type limits and each choice', () => {
    const rows = [
      { modelId: 'sgt', count: 1, picks: ['flamer', 'sword'] },
      { modelId: 'int', count: 3, picks: [] },
      { modelId: 'gl', count: 3, picks: ['gun', 'gun', 'shield', 'shield'] },
      { modelId: 'ghost', count: 1, picks: [] },
    ]
    expect(loadoutProblems(d, 5, rows)).toEqual([
      'Intercessor Squad: loadout has 8 models, the unit has 5',
      'Intercessor Squad: 3 × Intercessor, allowed 4–9',
      'Intercessor Squad: 3 × Intercessor w/ Grenade Launcher, allowed 0–2',
      'Intercessor Squad: Intercessor Sergeant must take 1 of Weapon 1',
      'Intercessor Squad: Intercessor Sergeant must take 1 of Weapon 2',
      'Intercessor Squad: Intercessor w/ Grenade Launcher must take 0–2 of Drones',
      'Intercessor Squad: Intercessor w/ Grenade Launcher has 2 × Shield Drone, max 1',
      'Intercessor Squad: a model type is not in the catalogue',
    ])
    expect(loadoutProblems({ ...d, models: [] }, 5, rows)).toEqual([])
  })
})

describe('loadout from my models', () => {
  const mine = (groups: [number, string[]][]) =>
    ({ ...createUnit({ customName: 'Mine', datasheetId: 'squad', groups: groups.map(([count, loadout]) => ({ count, status: 'built', loadout })) }, { now: 't', newId: () => Math.random().toString() }) })

  it('matches each group to the best model type and picks the options it names', () => {
    const u = mine([[1, ['bolt pistol', 'Hand flamer', 'Power fist']], [7, ['Bolt Rifle', 'Bolt pistol']], [2, ['Grenade Launcher']], [1, []], [1, ['Banana']]])
    expect(loadoutFromModels(d, [u])).toEqual([
      { modelId: 'sgt', count: 1, picks: ['flamer', 'fist'] },
      { modelId: 'int', count: 7, picks: [] },
      { modelId: 'gl', count: 2, picks: [] },
    ])
    expect(loadoutFromModels(d, [mine([[5, []]])])).toBeUndefined()
    expect(loadoutFromModels({ ...d, models: [] }, [u])).toBeUndefined()
  })

  it('merges groups with the same model type and picks; matches a group by model name; fills required choices', () => {
    const u = mine([[3, ['Bolt Rifle']], [2, ['Bolt Rifle']], [1, ['Intercessor Sergeant']]])
    expect(loadoutFromModels(d, [u])).toEqual([
      { modelId: 'int', count: 5, picks: [] },
      { modelId: 'sgt', count: 1, picks: ['rifle', 'knives'] },
    ])
  })

  it('reports model types the catalogue no longer has, and nothing for units without model types', () => {
    expect(loadoutProblems(d, 1, [{ modelId: 'gone', count: 1, picks: [] }])).toContain('Intercessor Squad: a model type is not in the catalogue')
    expect(loadoutProblems({ ...d, models: undefined }, 5, [])).toEqual([])
  })

  it('effective loadout: the list\'s own, else my models\' when the size matches, else the default', () => {
    const entry = { id: 'e', datasheetId: 'squad', models: 10, wargear: [] }
    const u = mine([[1, ['Bolt pistol', 'Chainsword', 'Power fist']], [9, ['Bolt Rifle']]])
    expect(effectiveLoadout(entry, d, [u]).source).toBe('models')
    expect(effectiveLoadout({ ...entry, models: 5 }, d, [u]).source).toBe('default')
    expect(effectiveLoadout({ ...entry, loadout: [{ modelId: 'int', count: 10, picks: [] }] }, d, [u]).source).toBe('list')
    expect(effectiveLoadout(entry, d, []).rows).toEqual(defaultLoadout(d, 10))
  })
})
