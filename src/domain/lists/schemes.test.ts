import { describe, expect, it } from 'vitest'
import type { Datasheet } from '../catalogue/types'
import { createUnit } from '../collection/ownedUnit'
import { DEFAULT_PIPELINE } from '../collection/pipeline'
import type { OwnedUnit } from '../collection/types'
import type { PaintScheme } from '../schemes/types'
import { addEntry, createList, updateEntry } from './list'
import { listOwnership } from './ownership'
import { armySchemeChoices, paintPlan, resolveScheme, schemesToApply, unitSchemeChoices, type SchemeContext } from './schemes'
import type { ArmyList } from './types'

let n = 0
const ctx = { now: 't', newId: () => `id${++n}` }
const sheet = (id: string, name: string, keywords: string[] = []): Datasheet => ({ id, name, factionIds: ['tau'], keywords, factionKeywords: ["T'au Empire"], minModels: 1, maxModels: 10, points: [{ fromModels: 1, points: 10 }], wargear: [], abilities: [], legends: false })
const sheets = new Map([['crisis', sheet('crisis', 'Crisis Battlesuits', ['Battlesuit'])], ['stealth', sheet('stealth', 'Stealth Battlesuits', ['Battlesuit', 'Stealth'])], ['strike', sheet('strike', 'Strike Team')]])
const scheme = (id: string, name: string, paints: string[], over: Partial<PaintScheme> = {}): PaintScheme =>
  ({ id, name, origin: 'personal', factionName: "T'au Empire", sections: [{ id: 's', area: 'Armour', steps: [{ id: 'x', paints: paints.map((paintId) => ({ paintId })) }] }], ...over }) as unknown as PaintScheme
const schemes = [
  scheme('viorla', "Vior'la", ['red', 'white']),
  scheme('viorla-stealth', "Vior'la Stealth", ['red', 'black'], { basedOn: 'viorla', appliesTo: ['Stealth'] }),
  scheme('farsight', 'Farsight', ['red', 'blue'], { origin: 'official' }),
  scheme('ultra', 'Ultramarines', ['blue'], { factionName: 'Ultramarines' }),
  scheme('crisis-only', 'Crisis team', ['grey'], { appliesTo: ['Crisis'] }),
]
const unit = (datasheetId: string, groups: [number, string][], over: Partial<OwnedUnit> = {}) =>
  ({ ...createUnit({ customName: datasheetId, datasheetId, groups: groups.map(([count, status]) => ({ count, status })) }, ctx), ...over })

function setup(units: OwnedUnit[], edit: (l: ArmyList) => ArmyList = (l) => l) {
  let l = createList({ name: 'T', edition: '11e', battleSize: 'sf', pointsLimit: 2000, factionId: 'tau' }, ctx)
  for (const [id, m] of [['crisis', 3], ['stealth', 3], ['strike', 10]] as const) l = addEntry(l, { datasheetId: id, models: m }, ctx)
  l = edit(l)
  const own = listOwnership(l, units, DEFAULT_PIPELINE)
  const c: SchemeContext = { schemes, sheets, units, own, factionName: "T'au Empire", defaults: { "T'au Empire": 'farsight' } }
  return { l, c }
}

describe('scheme choices', () => {
  it('army: army-wide schemes of the faction; unit: those that fit the unit', () => {
    expect(armySchemeChoices(schemes, "T'au Empire").map((g) => [g.origin, g.schemes.map((s) => s.id)])).toEqual([['official', ['farsight']], ['personal', ['viorla']]])
    expect(armySchemeChoices(schemes, "T'au Empire", 'ultra').flatMap((g) => g.schemes.map((s) => s.id))).toContain('ultra')
    expect(unitSchemeChoices(schemes, sheets.get('stealth'), "T'au Empire").flatMap((g) => g.schemes.map((s) => s.id)).sort()).toEqual(['farsight', 'viorla', 'viorla-stealth'])
    expect(unitSchemeChoices(schemes, sheets.get('crisis'), "T'au Empire").flatMap((g) => g.schemes.map((s) => s.id)).sort()).toEqual(['crisis-only', 'farsight', 'viorla'])
  })
})

describe('resolveScheme', () => {
  it('list choice → model scheme → army variant → army → faction default → none', () => {
    const crisis = unit('crisis', [[3, 'painted']], { schemeId: 'crisis-only' })
    const { l, c } = setup([crisis], (x) => ({ ...updateEntry(x, x.entries[2].id, { schemeId: 'farsight' }, ctx), schemeId: 'viorla' }))
    const src = l.entries.map((e) => { const r = resolveScheme(l, e, c); return [r.source, r.scheme?.id] })
    expect(src).toEqual([['model', 'crisis-only'], ['variant', 'viorla-stealth'], ['list', 'farsight']])
    const { l: l2, c: c2 } = setup([])
    expect(resolveScheme(l2, l2.entries[0], c2)).toMatchObject({ source: 'default', scheme: { id: 'farsight' } })
    expect(resolveScheme(l2, l2.entries[0], { ...c2, defaults: {} })).toEqual({ source: 'none' })
    expect(resolveScheme({ ...l2, schemeId: 'gone' }, { ...l2.entries[0], schemeId: 'gone' }, { ...c2, defaults: {} })).toEqual({ source: 'none' })
  })
})

describe('paintPlan', () => {
  it('groups units by scheme with their status, ticks paints you have, reports painted units too', () => {
    const crisis = unit('crisis', [[3, 'painted']])
    const stealth = unit('stealth', [[2, 'painted'], [1, 'primed']])
    const { l, c } = setup([crisis, stealth], (x) => ({ ...x, schemeId: 'viorla' }))
    const stock = new Map([['red', { paintId: 'red', stage: 'in-use' }], ['white', { paintId: 'white', stage: 'wishlist' }]]) as never
    const plan = paintPlan(l, c, stock)
    expect(plan.groups.map((g) => [g.scheme.id, g.units.map((u) => [u.name, u.status]), g.paints.map((p) => [p.paintId, p.have])])).toEqual([
      ['viorla', [['Crisis Battlesuits', 'painted'], ['Strike Team', 'buy']], [['red', true], ['white', false]]],
      ['viorla-stealth', [['Stealth Battlesuits', 'unpainted']], [['red', true], ['black', false]]],
    ])
    expect(plan.missing).toEqual([{ paintId: 'black', schemes: ["Vior'la Stealth"] }, { paintId: 'white', schemes: ["Vior'la"] }])
    expect(paintPlan(l, { ...c, defaults: {} }, stock).withoutScheme).toEqual([])
    const none = setup([])
    expect(paintPlan(none.l, { ...none.c, defaults: {} }, stock)).toEqual({ groups: [], withoutScheme: none.l.entries.map((e) => ({ entryId: e.id, name: sheets.get(e.datasheetId)!.name })), missing: [] })
  })
})

describe('schemesToApply', () => {
  it('sets schemes on linked models without one and asks before changing others', () => {
    const crisis = unit('crisis', [[3, 'built']])
    const stealth = unit('stealth', [[3, 'built']], { schemeId: 'farsight' })
    const strike = unit('strike', [[10, 'built']], { schemeId: 'viorla' })
    const { l, c } = setup([crisis, stealth, strike], (x) => ({ ...x, schemeId: 'viorla' }))
    const r = schemesToApply(l, c)
    expect(r.set.map((x) => [x.unit.datasheetId, x.schemeId])).toEqual([['crisis', 'viorla']])
    expect(r.change.map((x) => [x.unit.datasheetId, x.schemeId])).toEqual([['stealth', 'viorla-stealth']])
  })
})
