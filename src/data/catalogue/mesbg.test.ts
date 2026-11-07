import { describe, expect, it } from 'vitest'
import { parseCatalogue } from './parse'

// Hand-made data shaped like the MESBG list builder's files (#99).
const file = (name: string, o: object, bom = false) => ({ name: `src/assets/data/${name}`, text: (bom ? '﻿' : '') + JSON.stringify(o) })
const source = { repo: 'mhollink/mesbg-list-builder-v2024', commit: 'c', fetchedAt: 'f' }

const units = {
  a: { model_id: '[gondor] captain', army_type: 'Good', army_list: 'Minas Tirith', profile_origin: 'Gondor', name: 'Captain', unit_type: 'Hero of Fortitude', base_points: 60, MWFW: [['', '2:1:1:2']], options: [{ id: 'o1', name: 'Shield', points: 5 }], unique: false },
  b: { model_id: '[gondor] warrior', army_type: 'Good', army_list: 'Minas Tirith', profile_origin: 'Gondor', name: 'Warrior', unit_type: 'Warrior', base_points: 8, MWFW: [], options: [{ id: 'o2', name: 'Spear', points: 1 }] },
  c: { model_id: '[gondor] boromir', army_type: 'Good', army_list: "Boromir's Company", profile_origin: 'Gondor', name: 'Boromir', unit_type: 'Hero of Valour', base_points: 105, MWFW: [['', '6:3:1:1']], options: [], unique: true, legacy: true },
}
const profiles = {
  Gondor: {
    Captain: { Mv: '6"', Fv: '4', S: '4', active_or_passive_rules: [{ name: 'Lead', type: 'Passive', description: 'Stands firm.' }], heroic_actions: ['Heroic March'], special_rules: ['Bodyguard'], wargear: ['Armour'] },
    Warrior: { Mv: '6"', Fv: '3', wargear: ['hand weapon'] },
  },
}
const armies = { 'Minas Tirith': { special_rules: [{ title: 'Discipline', description: 'Re-roll Courage.' }], additional_rules: [{ description: 'Must include a Captain.' }] } }
const parse = () => parseCatalogue([file('mesbg_data.json', units), file('profile_data.json', profiles, true), file('army_list_data.json', armies)], source)

describe('Middle-earth (MESBG list builder data, #99)', () => {
  it('makes a faction per army list and reads army rules', () => {
    const c = parse()
    expect(c.gameName).toBe('Middle-earth Strategy Battle Game')
    expect(c.factions.map((f) => f.name)).toEqual(["Boromir's Company", 'Minas Tirith'])
    expect(c.factions.find((f) => f.name === 'Minas Tirith')!.fullName).toBe('Good - Gondor - Minas Tirith')
    expect(c.rules!.map((r) => [r.name, r.text])).toEqual([['Discipline', 'Re-roll Courage.'], ['Army composition', 'Must include a Captain.']])
  })

  it('heroes are single models; warriors are bought per model', () => {
    const c = parse()
    const captain = c.datasheets.find((d) => d.name === 'Captain')!
    expect(captain).toMatchObject({ role: 'Hero of Fortitude', minModels: 1, maxModels: 1, points: [{ fromModels: 1, points: 60 }] })
    const warrior = c.datasheets.find((d) => d.name === 'Warrior')!
    expect(warrior.maxModels).toBe(30)
    expect(warrior.points[2]).toEqual({ fromModels: 3, points: 24 })
  })

  it('reads stats, Might/Will/Fate/Wounds, abilities, wargear and options (profile file has a BOM)', () => {
    const captain = parse().datasheets.find((d) => d.name === 'Captain')!
    expect(captain.stats).toEqual([{ name: 'Captain', values: [['Mv', '6"'], ['Fv', '4'], ['S', '4'], ['M:W:F:W', '2:1:1:2']] }])
    expect(captain.abilityTexts).toEqual({ Lead: 'Passive: Stands firm.' })
    expect(captain.abilities).toEqual(['Lead', 'Bodyguard', 'Heroic action: Heroic March'])
    expect(captain.wargear).toEqual(['Armour', 'Shield (+5 pts)'])
  })

  it('unique heroes are limited to one; legacy profiles are marked like Legends', () => {
    const boromir = parse().datasheets.find((d) => d.name === 'Boromir')!
    expect(boromir).toMatchObject({ armyLimit: { max: 1 }, legends: true })
    expect(boromir.stats).toEqual([{ name: 'Boromir', values: [['M:W:F:W', '6:3:1:1']] }])
  })

  it('says which file is missing', () => {
    expect(() => parseCatalogue([file('mesbg_data.json', units)], source)).toThrow(/profile_data\.json/)
  })
})
