import { describe, expect, it } from 'vitest'
import type { Datasheet } from '../catalogue/types'
import { createUnit } from '../collection/ownedUnit'
import { createScheme } from './scheme'
import { schemeFitsUnit, schemesForUnit } from './match'

let n = 0
const ctx = { now: 't', newId: () => `id${++n}` }
const scheme = (name: string, factionName?: string, appliesTo?: string[], origin: 'official' | 'community' | 'personal' = 'community') =>
  ({ ...createScheme({ name, stage: 'final', factionName, origin, source: origin === 'community' ? { url: 'https://x' } : undefined }, ctx), ...(appliesTo ? { appliesTo } : {}) })

const vior = scheme("Vior'la", "T'au Empire", undefined, 'official')
const vespid = scheme('Vespid Stingwings', "T'au Empire", ['Vespid'])
const stealth = scheme('Stealth Suit', "T'au Empire", ['Stealth'])
const fw = scheme("Fal'shia Fire Warrior", "T'au Empire", ['Fire Warrior'])
const ultra = scheme('Ultramarines', 'Space Marines', undefined, 'official')
const general = scheme('Bone armour', undefined, undefined, 'personal')
const mine = scheme('My farsight red', "T'au Empire", undefined, 'personal')
const all = [vior, vespid, stealth, fw, ultra, general, mine]

const unit = (customName: string, factionName?: string) => createUnit({ customName, factionName, groups: [] }, ctx)
const ds = (name: string, keywords: string[] = []) => ({ name, keywords, factionKeywords: [] }) as unknown as Datasheet

describe('schemeFitsUnit', () => {
  it('army-wide schemes of the faction fit every unit of it', () => {
    expect(schemeFitsUnit(vior, unit('Strike Team', "T'au Empire"))).toBe(true)
    expect(schemeFitsUnit(ultra, unit('Strike Team', "T'au Empire"))).toBe(false)
  })
  it('unit-type schemes fit only units of that type (name or datasheet keywords)', () => {
    expect(schemeFitsUnit(vespid, unit('Vespid Stingwings', "T'au Empire"))).toBe(true)
    expect(schemeFitsUnit(vespid, unit('Strike Team', "T'au Empire"))).toBe(false)
    expect(schemeFitsUnit(fw, unit('Strike Team', "T'au Empire"), ds('Strike Team', ['Infantry', 'Fire Warriors']))).toBe(true)
    expect(schemeFitsUnit(stealth, unit('My ghostkeel squad', "T'au Empire"), ds('Stealth Battlesuits'))).toBe(true)
  })
  it('schemes without faction or unit type fit anything', () => {
    expect(schemeFitsUnit(general, unit('Anything', 'Orks'))).toBe(true)
  })
  it('a unit without faction only gets general schemes', () => {
    expect(schemeFitsUnit(vior, unit('Mystery'))).toBe(false)
  })
})

describe('schemesForUnit', () => {
  it('groups fitting schemes by origin: official, community, mine', () => {
    const g = schemesForUnit(all, unit('Strike Team', "T'au Empire"), ds('Strike Team', ['Fire Warriors']))
    expect(g.map((x) => [x.origin, x.schemes.map((s) => s.name)])).toEqual([
      ['official', ["Vior'la"]],
      ['community', ["Fal'shia Fire Warrior"]],
      ['personal', ['Bone armour', 'My farsight red']],
    ])
  })
  it('always keeps the scheme already linked, even if it no longer fits', () => {
    const u = { ...unit('Strike Team', "T'au Empire"), schemeId: vespid.id }
    expect(schemesForUnit(all, u).flatMap((x) => x.schemes.map((s) => s.name))).toContain('Vespid Stingwings')
  })
})
