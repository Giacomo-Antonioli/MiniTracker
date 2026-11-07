import { describe, expect, it } from 'vitest'
import type { Datasheet } from '../catalogue/types'
import { listPoints, optionPoints } from './points'
import type { ArmyList, ListEntry } from './types'

// A Middle-earth warrior: 8 pts each, one option per model (spear +1, banner +25).
const warrior: Datasheet = {
  id: 'w', name: 'Warrior', factionIds: ['f'], keywords: [], factionKeywords: [], minModels: 1, maxModels: 30, wargear: [], abilities: [], legends: false,
  points: Array.from({ length: 30 }, (_, i) => ({ fromModels: i + 1, points: (i + 1) * 8 })),
  models: [{ id: 'm', name: 'Warrior', min: 0, max: 30, fixed: [], choices: [{ id: 'c', name: 'Option', min: 0, max: 1, options: [{ id: 'spear', name: 'Spear', max: 1, points: 1 }, { id: 'banner', name: 'Banner', max: 1, points: 25 }] }] }],
}
const entry = (o: Partial<ListEntry>): ListEntry => ({ id: 'e', datasheetId: 'w', models: 10, wargear: [], ...o })

describe('option points (Middle-earth, #99)', () => {
  it('adds the points of each model\'s picked options', () => {
    const e = entry({ loadout: [{ modelId: 'm', count: 9, picks: ['spear'] }, { modelId: 'm', count: 1, picks: ['banner'] }] })
    expect(optionPoints(warrior, e)).toBe(9 + 25)
    const l = { id: 'l', name: 'L', edition: 'mesbg24', entries: [e] } as unknown as ArmyList
    expect(listPoints(l, new Map([['w', warrior]])).total).toBe(80 + 34)
  })

  it('no picks or options without points cost nothing', () => {
    expect(optionPoints(warrior, entry({}))).toBe(0)
    const plain = { ...warrior, models: [{ ...warrior.models![0], choices: [{ ...warrior.models![0].choices[0], options: [{ id: 'x', name: 'Bolter', max: 1 }] }] }] }
    expect(optionPoints(plain, entry({ loadout: [{ modelId: 'm', count: 10, picks: ['x'] }] }))).toBe(0)
  })
})
