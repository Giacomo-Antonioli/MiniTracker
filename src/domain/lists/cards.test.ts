import { describe, expect, it } from 'vitest'
import type { Catalogue, Datasheet } from '../catalogue/types'
import { carriedWeapons, keywordLegend, unitCards } from './cards'
import type { ArmyList } from './types'

const w = (name: string, kind: 'ranged' | 'melee' = 'ranged') => ({ name, kind, values: [['A', '1']] as [string, string][] })
const squad = {
  id: 'squad', name: 'Squad', minModels: 2, maxModels: 5, points: [{ fromModels: 2, points: 40 }, { fromModels: 4, points: 80 }],
  role: 'Battleline', keywords: ['Infantry'], factionKeywords: ['Testers'], wargear: [], legends: false, factionIds: [],
  abilities: ['Hold', 'Mystery'], abilityTexts: { Hold: 'Stay put.' }, ruleIds: ['r-ds', 'gone'],
  stats: [{ name: 'Squad', values: [['M', '6"']] }],
  weapons: [w('Bolt rifle'), w('Plasma gun - standard'), w('Plasma gun - supercharge'), w('Close combat weapon', 'melee'), w('Power fist', 'melee')],
  models: [
    { id: 'sgt', name: 'Sergeant', min: 1, max: 1, fixed: ['Close combat weapon'], choices: [{ id: 'c', name: 'Melee', min: 0, max: 1, options: [{ id: 'pf', name: 'Power fist', max: 1 }] }] },
    { id: 'tr', name: 'Trooper', min: 1, max: 4, fixed: ['Bolt rifle', 'Close combat weapon'], choices: [{ id: 'g', name: 'Gun', min: 0, max: 1, options: [{ id: 'pg', name: 'Plasma gun', max: 1 }] }] },
  ],
} as unknown as Datasheet
const hero = { ...squad, id: 'hero', name: 'Hero', minModels: 1, maxModels: 1, points: [{ fromModels: 1, points: 90 }], models: undefined, weapons: [w('Sword', 'melee')], abilities: [], abilityTexts: undefined, ruleIds: undefined } as Datasheet
const cat = { datasheets: [squad, hero], rules: [{ id: 'r-ds', name: 'Deep Strike', text: '', kind: 'core' }], enhancements: [{ id: 'enh', name: 'Charm', points: 15 }] } as unknown as Catalogue

describe('unit cards', () => {
  it('keeps the weapons a loadout carries, matching profile names', () => {
    expect(carriedWeapons(squad, [{ modelId: 'sgt', count: 1, picks: [] }, { modelId: 'tr', count: 3, picks: ['pg'] }]).map((x) => x.name)).toEqual(['Bolt rifle', 'Plasma gun - standard', 'Plasma gun - supercharge', 'Close combat weapon'])
    expect(carriedWeapons(squad, [{ modelId: 'sgt', count: 0, picks: ['pf'] }, { modelId: 'tr', count: 2, picks: [] }]).map((x) => x.name)).toEqual(['Bolt rifle', 'Close combat weapon'])
    // Nothing matches (or no model types): every weapon.
    expect(carriedWeapons(squad, [{ modelId: 'zz', count: 1, picks: [] }])).toHaveLength(5)
    expect(carriedWeapons(hero, [])).toHaveLength(1)
  })

  it('makes one card per unit type in list order, with each entry, abilities and rules', () => {
    const list = {
      entries: [
        { id: 'a', datasheetId: 'squad', models: 4, wargear: [], loadout: [{ modelId: 'sgt', count: 1, picks: ['pf'] }, { modelId: 'tr', count: 3, picks: [] }] },
        { id: 'b', datasheetId: 'hero', models: 1, wargear: [], warlord: true, enhancementId: 'enh' },
        { id: 'c', datasheetId: 'squad', models: 2, wargear: [], loadout: [{ modelId: 'sgt', count: 1, picks: [] }, { modelId: 'tr', count: 1, picks: ['pg'] }] },
        { id: 'd', datasheetId: 'gone', models: 1, wargear: [] },
        { id: 'e', datasheetId: 'squad', models: 9, wargear: [] },
      ],
    } as unknown as ArmyList
    const cards = unitCards(list, cat, () => [])
    expect(cards.map((c) => c.datasheet.id)).toEqual(['squad', 'hero'])
    expect(cards[0].entries).toEqual([{ models: 4, points: 80 }, { models: 2, points: 40 }, { models: 9, points: undefined }])
    expect(cards[0].weapons).toHaveLength(5)
    expect(cards[0].abilities).toEqual([{ name: 'Hold', text: 'Stay put.' }, { name: 'Mystery', text: undefined }])
    expect(cards[0].rules).toEqual(['Deep Strike'])
    expect(cards[1].entries).toEqual([{ models: 1, points: 90, warlord: true, enhancement: { name: 'Charm', points: 15 } }])
    expect(cards[1].rules).toEqual([])
  })
})

describe('keyword legend', () => {
  it('collects the rules behind core rules, weapon keywords and unit keywords, once each', () => {
    const rules = [
      { id: 'ds', name: 'Deep Strike', text: 'Arrive later.', kind: 'core' },
      { id: 'sh', name: 'Sustained Hits', text: 'Extra hits.', kind: 'core' },
      { id: 'as', name: 'Assault', text: 'Shoot after advancing.', kind: 'core' },
      { id: 'inf', name: 'Infantry', text: '', kind: 'core' },
      { id: 'unused', name: 'Lone Operative', text: 'x', kind: 'core' },
    ] as never
    const weapon = (kw: string) => ({ name: 'g', kind: 'ranged', values: [['A', '1'], ['Keywords', kw]] })
    const card = (keywords: string[], weapons: object[], r: string[]) => ({ datasheet: { keywords }, entries: [], abilities: [], rules: r, weapons }) as never
    const legend = keywordLegend([card(['Infantry'], [weapon('Assault, Sustained Hits 1')], ['Deep Strike']), card([], [weapon('-'), weapon('Sustained Hits 2')], [])], rules)
    expect(legend.map((r) => r.name)).toEqual(['Assault', 'Deep Strike', 'Sustained Hits'])
  })
})
