import { describe, expect, it } from 'vitest'
import type { Catalogue, Datasheet } from '../catalogue/types'
import { addEntry, createList, updateEntry } from './list'
import { listPoints } from './points'
import { COMBAT_PATROL, addUnit, battleSizes, checkList, legalUnits, unitLimit } from './rules'
import type { ArmyList } from './types'

let n = 0
const ctx = { now: 't', newId: () => `id${++n}` }

const sheet = (id: string, over: Partial<Datasheet> = {}): Datasheet => ({
  id, name: id, factionIds: ['tau'], keywords: [], factionKeywords: [], minModels: 1, maxModels: 1,
  points: [{ fromModels: 1, points: 100 }], wargear: [], abilities: [], legends: false, ...over,
})

const cat: Catalogue = {
  gameId: 'g', gameName: 'G', source: { repo: 'r', commit: 'c', fetchedAt: 'f' }, factions: [],
  muster: {
    battleSizes: [{ id: 'inc', name: 'Incursion', pointsLimit: 1000 }, { id: 'sf', name: 'Strike Force', pointsLimit: 2000 }],
    keywordMinimums: [{ keyword: 'Character', min: 1, exemptFactionIds: ['knights'] }],
  },
  datasheets: [
    sheet('commander', { keywords: ['Character'], armyLimit: { max: 3, byBattleSize: { inc: 2 } } }),
    sheet('shadowsun', { keywords: ['Character', 'Epic Hero'] }),
    sheet('crisis', { minModels: 3, maxModels: 6, points: [{ fromModels: 3, points: 80 }, { fromModels: 6, points: 160 }], armyLimit: { max: 3 } }),
    sheet('kroot', { factionIds: ['tau', 'kroot'] }),
    sheet('old', { legends: true }),
    sheet('marine', { factionIds: ['sm'] }),
  ],
}
const sheets = new Map(cat.datasheets.map((d) => [d.id, d]))
const codes = (l: ArmyList) => checkList(l, cat).map((i) => i.code)

function list(battleSize = 'sf', units: [string, number?][] = [], limit = 2000): ArmyList {
  let l = createList({ name: 'L', edition: '11e', battleSize, pointsLimit: limit, factionId: 'tau' }, ctx)
  for (const [id, models] of units) l = addEntry(l, { datasheetId: id, models: models ?? 1 }, ctx)
  return l
}
const warlord = (l: ArmyList, i = 0) => updateEntry(l, l.entries[i].id, { warlord: true }, ctx)

describe('battle sizes', () => {
  it('adds Combat Patrol (500) before the sizes from the data', () => {
    expect(battleSizes(cat).map((b) => [b.name, b.pointsLimit])).toEqual([['Combat Patrol', 500], ['Incursion', 1000], ['Strike Force', 2000]])
    expect(battleSizes({ ...cat, muster: undefined })).toEqual([COMBAT_PATROL])
  })
})

describe('checkList', () => {
  it('a legal list has no issues', () => {
    expect(checkList(warlord(list('sf', [['commander'], ['crisis', 3]])), cat)).toEqual([])
  })

  it('an empty list has no issues except an unknown battle size', () => {
    expect(codes(list('sf'))).toEqual([])
    expect(checkList(list('nope'), cat)).toEqual([{ code: 'battle-size', message: expect.any(String), entryIds: [] }])
  })

  it('flags points over the limit, wrong unit sizes and unknown units', () => {
    const l = warlord(list('sf', [['commander'], ['crisis', 7], ['gone']], 50))
    const issues = checkList(l, cat)
    expect(issues.map((i) => i.code)).toEqual(['unit-size', 'unknown-unit', 'points'])
    expect(issues[0]).toMatchObject({ message: 'crisis must have 3–6 models', entryIds: [l.entries[1].id] })
    expect(issues[2].message).toBe('100 points, limit 50')
  })

  it('limits copies of a unit, with battle size changes and Epic Heroes once', () => {
    const three = (size: string) => warlord(list(size, [['commander'], ['commander'], ['commander']]))
    expect(codes(three('sf'))).toEqual([])
    const inc = checkList(three('inc'), cat)
    expect(inc).toMatchObject([{ code: 'unit-limit', message: 'commander: 3, max 2' }])
    expect(inc[0].entryIds).toHaveLength(3)
    expect(codes(warlord(list('sf', [['shadowsun'], ['shadowsun']])))).toEqual(['unit-limit'])
    expect(unitLimit(sheets.get('kroot')!, 'sf')).toBeUndefined()
  })

  it('needs a Character unless the faction is exempt', () => {
    const l = warlord(list('sf', [['crisis', 3]]))
    expect(codes(l)).toEqual(['keyword-minimum', 'warlord-not-character'])
    expect(codes({ ...l, factionId: 'knights' })).toEqual(['warlord-not-character'])
    const two = { ...cat, muster: { ...cat.muster!, keywordMinimums: [{ keyword: 'Battleline', min: 2, exemptFactionIds: [] }] } }
    expect(checkList(warlord(list('sf', [['commander']])), two).map((i) => i.message)).toEqual(['Needs at least 2 Battleline units'])
  })

  it('needs exactly one Warlord, a Character', () => {
    const l = list('sf', [['commander'], ['commander']])
    expect(codes(l)).toEqual(['no-warlord'])
    expect(checkList(warlord(warlord(l), 1), cat)).toMatchObject([{ code: 'warlords', entryIds: l.entries.map((e) => e.id) }])
    // a Warlord whose unit left the catalogue is reported once, as unknown
    expect(codes(warlord(list('sf', [['commander'], ['gone']]), 1))).toEqual(['unknown-unit'])
  })

  it('Combat Patrol checks points and unit sizes only', () => {
    const l = list(COMBAT_PATROL.id, [['crisis', 6], ['crisis', 6], ['crisis', 6], ['crisis', 6]], 500)
    expect(codes(l)).toEqual(['points'])
  })
})

describe('faction', () => {
  it('lists legal units of a faction, Legends only on request', () => {
    expect(legalUnits(cat, 'tau').map((d) => d.id)).toEqual(['commander', 'shadowsun', 'crisis', 'kroot'])
    expect(legalUnits(cat, 'tau', { legends: true }).map((d) => d.id)).toContain('old')
  })

  it('the first unit sets the faction; later units must belong to it', () => {
    let l = createList({ name: 'L', edition: '11e', battleSize: 'sf', pointsLimit: 2000 }, ctx)
    expect(l.factionId).toBeUndefined()
    expect(() => addUnit(l, sheets.get('kroot')!, 1, ctx)).toThrow(/several factions/)
    l = addUnit(l, sheets.get('crisis')!, 3, ctx)
    expect(l.factionId).toBe('tau')
    expect(() => addUnit(l, sheets.get('marine')!, 1, ctx)).toThrow(/not a unit of this faction/)
    const k = addUnit(createList({ name: 'K', edition: '11e', battleSize: 'sf', pointsLimit: 2000 }, ctx), sheets.get('kroot')!, 1, ctx, 'kroot')
    expect(k.factionId).toBe('kroot')
  })
})

describe('detachments and enhancements', () => {
  const bs = (id: string) => ({ op: 'equalTo' as const, value: 1, id })
  const dcat: Catalogue = {
    ...cat,
    datasheets: [...cat.datasheets, sheet('ethereal', { keywords: ['Character'] })],
    muster: {
      ...cat.muster!,
      forceId: 'army',
      detachmentPoints: { max: 2, modifiers: [{ type: 'set', value: 3, when: { any: [bs('sf'), { all: [bs('inc'), { op: 'atLeast', value: 1, keyword: '3DP' }] }] } }] },
      enhancements: { max: 2, modifiers: [{ type: 'set', value: 4, when: { op: 'equalTo', value: 0, id: 'inc' } }] },
    },
    detachments: [
      { id: 'kauyon', name: 'Kauyon', factionIds: ['tau'], detachmentPoints: 2, keywords: [] },
      { id: 'montka', name: "Mont'ka", factionIds: ['tau'], detachmentPoints: 3, keywords: ['3DP'] },
      { id: 'aux', name: 'Auxiliary', factionIds: ['tau'], detachmentPoints: 1, keywords: [] },
      { id: 'gladius', name: 'Gladius', factionIds: ['sm'], detachmentPoints: 1, keywords: [] },
    ],
    enhancements: [
      { id: 'e1', name: 'Exemplar', points: 20, detachmentId: 'kauyon' },
      { id: 'e2', name: 'Strike Swiftly', points: 45, detachmentId: 'montka' },
      { id: 'e3', name: 'Admired', points: 10, detachmentId: 'aux' },
    ],
    detachmentCounts: { tau: { min: 1, max: { max: -1, modifiers: [{ type: 'set', value: 1, when: { all: [{ op: 'atLeast', value: 1, id: 'inc' }, { op: 'atLeast', value: 1, keyword: '3DP' }] } }] } } },
  }
  const dcodes = (l: ArmyList) => checkList(l, dcat).map((i) => i.code)
  const army = (size: string, dets: string[], units: [string, string?][] = [['commander', undefined]]) => {
    let l: ArmyList = { ...list(size, units.map(([id]) => [id] as [string])), detachmentIds: dets }
    units.forEach(([, enh], i) => {
      if (enh) l = updateEntry(l, l.entries[i].id, { enhancementId: enh }, ctx)
    })
    return warlord(l)
  }

  it('needs a detachment and keeps detachment points within the battle size budget', () => {
    expect(dcodes(army('sf', []))).toEqual(['no-detachment'])
    expect(dcodes(army('sf', ['kauyon', 'aux']))).toEqual([])
    expect(checkList(army('sf', ['kauyon', 'montka']), dcat)).toMatchObject([{ code: 'detachment-points', message: 'Detachments cost 5 detachment points, max 3' }])
    expect(dcodes(army('inc', ['kauyon']))).toEqual([])
    expect(dcodes(army('inc', ['kauyon', 'aux']))).toEqual(['detachment-points'])
    // Incursion: one 3-point detachment is allowed, but then only that one.
    expect(dcodes(army('inc', ['montka']))).toEqual([])
    expect(checkList(army('inc', ['montka', 'aux']), dcat).map((i) => i.message)).toEqual(['2 detachments, max 1 here', 'Detachments cost 4 detachment points, max 3'])
    expect(dcodes(army('sf', ['gladius', 'ghost']))).toEqual(['detachment-faction', 'unknown-detachment'])
  })

  it('counts enhancement points and checks enhancements', () => {
    const l = army('sf', ['kauyon'], [['commander', 'e1'], ['ethereal', 'e1'], ['shadowsun', 'e2'], ['crisis', 'gone']])
    expect(checkList(l, dcat).map((i) => [i.code, i.message])).toEqual([
      ['unit-size', 'crisis must have 3–6 models'],
      ['enhancement-detachment', "Strike Swiftly needs its detachment (Mont'ka)"],
      ['enhancement-unit', "shadowsun can't take an enhancement (Characters only, not Epic Heroes)"],
      ['unknown-enhancement', 'An enhancement is not in the catalogue (removed or renamed?)'],
      ['enhancement-twice', 'Exemplar is taken 2 times'],
    ])
    expect(listPoints(l, new Map(dcat.datasheets.map((d) => [d.id, d])), new Map(dcat.enhancements!.map((e) => [e.id, e]))).total).toBe(100 + 20 + 100 + 20 + 100 + 45)
  })

  it('limits the number of enhancements by battle size; 3 when the data has no limit', () => {
    const chars: [string, string?][] = [['commander', 'e1'], ['commander', 'e3'], ['ethereal', 'e1']]
    expect(dcodes(army('inc', ['kauyon'], chars.slice(0, 2)))).toEqual(['enhancement-detachment'])
    const three = army('inc', ['aux'], [['commander', 'e3'], ['commander', 'e3'], ['ethereal', 'e3']])
    expect(checkList(three, dcat)[0]).toMatchObject({ code: 'enhancements', message: '3 enhancements, max 2' })
    expect(dcodes(army('sf', ['aux'], [['commander', 'e3'], ['commander', 'e3'], ['ethereal', 'e3']]))).toEqual(['enhancement-twice'])
    const tenth = { ...dcat, muster: { ...dcat.muster!, enhancements: undefined, detachmentPoints: undefined } }
    const four = army('sf', ['aux'], [['commander', 'e3'], ['commander', 'e3'], ['ethereal', 'e3'], ['ethereal', 'e3']])
    expect(checkList(four, tenth).map((i) => i.message)).toContain('4 enhancements, max 3')
  })

  it('without a faction or a count rule, one detachment is still needed', () => {
    const none = { ...army('sf', []), factionId: undefined }
    expect(dcodes(none)).toEqual(['no-detachment'])
    expect(dcodes({ ...army('sf', ['kauyon']), detachmentIds: ['kauyon', 'ghost'] })).toEqual(['unknown-detachment'])
    const unknownDet = { ...dcat, enhancements: [...dcat.enhancements!, { id: 'e9', name: 'Lost', points: 5, detachmentId: 'nowhere' }] }
    expect(checkList(army('sf', ['kauyon'], [['commander', 'e9']]), unknownDet).map((i) => i.message)).toEqual(['Lost needs its detachment (not chosen)'])
  })

  it('catalogues without detachment data skip these checks', () => {
    expect(codes(army('sf', []))).toEqual([])
  })
})
