import { describe, expect, it } from 'vitest'
import { pointsFor } from '../../domain/catalogue/points'
import { applyModifier, parseBsData } from './bsdata'

const raw = import.meta.glob('./fixtures/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const files = Object.entries(raw).map(([path, text]) => ({ name: path.split('/').pop()!, text }))
const source = { repo: 'test/repo', commit: 'abc', fetchedAt: '2026-11-01T00:00:00.000Z' }
const cat = parseBsData(files, source)
const ds = (name: string) => cat.datasheets.find((d) => d.name === name)!

describe('parseBsData', () => {
  it('reads the game system', () => {
    expect(cat).toMatchObject({ gameId: 'sys-test', gameName: 'Test Game', source })
  })

  it('lists only non-library catalogues as factions, with short names', () => {
    expect(cat.factions).toEqual([
      { id: 'cat-sub', name: 'Sub Testers', fullName: 'Test - Testers - Sub Testers' },
      { id: 'cat-testers', name: 'Testers', fullName: 'Test - Testers' },
    ])
  })

  it('follows library imports and entry links to assign factions', () => {
    expect(ds('Line Troopers').factionIds).toEqual(['cat-sub', 'cat-testers'])
    expect(ds('Big Walker').factionIds).toEqual(['cat-sub', 'cat-testers'])
    expect(ds('Old Hero').factionIds).toEqual(['cat-sub'])
  })

  it('skips hidden links and non-unit entries', () => {
    expect(cat.datasheets.map((d) => d.name)).toEqual(['Big Beasts', 'Big Walker', 'Line Troopers', 'Old Hero', 'Optional Band'])
  })

  it('reads model counts from group constraints', () => {
    expect(ds('Line Troopers')).toMatchObject({ minModels: 5, maxModels: 10 })
    expect(ds('Big Walker')).toMatchObject({ minModels: 1, maxModels: 1 })
  })

  it('reads points per unit size, ignoring other cost types and unrelated modifiers', () => {
    expect(ds('Line Troopers').points).toEqual([
      { fromModels: 5, points: 80 },
      { fromModels: 6, points: 160 },
    ])
    expect(ds('Old Hero').points).toEqual([{ fromModels: 1, points: 95 }])
  })

  it('prices per model when costs sit on the models', () => {
    expect(ds('Big Beasts')).toMatchObject({ minModels: 1, maxModels: 3 })
    expect(ds('Big Beasts').points).toEqual([
      { fromModels: 1, points: 90 },
      { fromModels: 2, points: 180 },
      { fromModels: 3, points: 270 },
    ])
  })

  it('never allows fewer than one model', () => {
    expect(ds('Optional Band')).toMatchObject({ minModels: 1, maxModels: 1, points: [{ fromModels: 1, points: 15 }] })
  })

  it('reads role, keywords, faction keywords, abilities and wargear', () => {
    expect(ds('Line Troopers')).toMatchObject({
      role: 'Battleline',
      keywords: ['Battleline', 'Infantry'],
      factionKeywords: ['Testers'],
      abilities: ['Hold the Line'],
      wargear: ['Flamer', 'Rifle', 'Sword'],
    })
  })

  it('flags Legends units and strips the tag from the name', () => {
    expect(ds('Old Hero')).toMatchObject({ legends: true, role: 'Character' })
  })

  it('fails clearly without a game system file', () => {
    expect(() => parseBsData(files.filter((f) => !f.name.endsWith('.gst')), source)).toThrow(/game system/)
  })
})

describe('rules', () => {
  it('reads core rules from the game system and faction rules from catalogues', () => {
    expect(cat.formatVersion).toBe(6)
    expect(cat.rules!.map((r) => [r.name, r.kind])).toEqual([
      ['Assault', 'core'],
      ['Deep Strike', 'core'],
      ['Sustained Hits', 'core'],
      ['Testers Doctrine', 'faction'],
    ])
    expect(cat.rules![0]).toMatchObject({ id: 'r-assault', text: 'Weapons with **[ASSAULT]** can shoot after Advancing.', aliases: ['ASSAULT'] })
    expect(cat.rules![3]).toMatchObject({ factionId: 'cat-testers' })
  })

  it('links units to their rules, ability texts and weapon keywords', () => {
    const d = ds('Line Troopers')
    expect(d.ruleIds).toEqual(['r-deepstrike', 'r-doctrine'])
    expect(d.abilityTexts).toEqual({ 'Hold the Line': 'Once per battle, this unit can **hold** its ground.' })
    expect(d.weaponKeywords).toEqual(['Assault', 'Sustained Hits 1'])
  })
})

describe('pointsFor', () => {
  it('picks the price for a unit size', () => {
    const d = ds('Line Troopers')
    expect(pointsFor(d, 5)).toBe(80)
    expect(pointsFor(d, 10)).toBe(160)
    expect(() => pointsFor(d, 4)).toThrow(/5–10/)
    expect(() => pointsFor(d, 11)).toThrow(/5–10/)
  })

  it('reads battle sizes and keyword minimums from the main force', () => {
    expect(cat.formatVersion).toBe(6)
    expect(cat.muster).toMatchObject({
      battleSizes: [
        { id: 'bs-inc', name: 'Incursion', pointsLimit: 1000 },
        { id: 'bs-sf', name: 'Strike Force', pointsLimit: 2000 },
      ],
      keywordMinimums: [{ keyword: 'Character', min: 1, exemptFactionIds: ['cat-sub'] }],
      forceId: 'f-army',
    })
  })

  it('reads army limits, with battle size changes, from the unit or a keyword only it has', () => {
    expect(ds('Big Walker').armyLimit).toEqual({ max: 3, byBattleSize: { 'bs-inc': 2 } })
    expect(ds('Old Hero').armyLimit).toEqual({ max: 1 })
  })

  it('skips limits changed by conditions it cannot read', () => {
    expect(ds('Line Troopers').armyLimit).toBeUndefined()
  })
})

describe('detachments and enhancements', () => {
  it('reads the detachment points and enhancement limits with their conditions; skips modifiers with repeats', () => {
    expect(cat.muster!.detachmentPoints).toEqual({
      max: 2,
      modifiers: [
        {
          type: 'set',
          value: 3,
          when: { any: [{ op: 'equalTo', value: 1, id: 'bs-sf' }, { all: [{ op: 'equalTo', value: 1, id: 'bs-inc' }, { op: 'atLeast', value: 1, keyword: '3DP Detachment' }] }] },
        },
      ],
    })
    expect(cat.muster!.enhancements).toEqual({ max: 2, modifiers: [{ type: 'set', value: 4, when: { op: 'equalTo', value: 0, id: 'bs-inc' } }] })
  })

  it('finds detachments through links, for the faction and the factions that import it; skips Boarding Actions ones', () => {
    expect(cat.detachments).toEqual([
      { id: 'det-heavy', name: 'Heavy Doctrine', factionIds: ['cat-sub', 'cat-testers'], detachmentPoints: 3, keywords: ['3DP Detachment'] },
      { id: 'det-line', name: 'Line Doctrine', factionIds: ['cat-sub', 'cat-testers'], detachmentPoints: 1, keywords: [] },
    ])
    expect(cat.detachmentCounts!['cat-testers']).toEqual({
      min: 1,
      max: { max: -1, modifiers: [{ type: 'set', value: 1, when: { op: 'atLeast', value: 1, id: 'bs-inc' } }] },
    })
  })

  it('links each enhancement to its detachment from the group or its own condition', () => {
    expect(cat.enhancements).toMatchObject([
      { id: 'enh-banner', name: 'Big Banner', points: 20, detachmentId: 'det-heavy' },
      { id: 'enh-charm', name: 'Lucky Charm', points: 15, detachmentId: 'det-line' },
    ])
    // Their "hidden unless the detachment is chosen" conditions are kept, to check which units may take them.
    expect(cat.enhancements![1].notFor).toEqual({ op: 'lessThan', value: 1, id: 'det-line' })
  })
})

describe('stat lines and weapon profiles', () => {
  it('reads unit stats and weapons, following links to shared weapons', () => {
    expect(ds('Big Walker').stats).toEqual([{ name: 'Big Walker', values: [['M', '8"'], ['T', '9'], ['Sv', '3+'], ['W', '10'], ['LD', '7+'], ['OC', '3']] }])
    expect(ds('Line Troopers').weapons).toEqual([{ name: 'Rifle', kind: 'ranged', values: [['Range', '24"'], ['Keywords', 'Assault, Sustained Hits 1']] }])
    expect(ds('Old Hero').weapons).toBeUndefined()
    // Stat line in a shared profile, reached through an info link.
    expect(ds('Old Hero').stats).toEqual([{ name: 'Old Hero', values: [['M', '6"'], ['W', '5']] }])
  })
})

describe('applyModifier', () => {
  it('sets, increments and decrements limits; ignores other types', () => {
    const m = (type: string, value: string) => ({ type, value }) as never
    expect([applyModifier(3, m('set', '2')), applyModifier(3, m('increment', '1')), applyModifier(3, m('decrement', '1')), applyModifier(3, m('append', '9'))]).toEqual([2, 4, 2, 3])
  })
})
