import { describe, expect, it } from 'vitest'
import { parseOpr } from '../../data/catalogue/opr'
import { unitCards } from './cards'
import { listToText } from './io'
import { listPoints } from './points'
import { checkList } from './rules'
import type { ArmyList } from './types'

const gun = (name: string) => ({ name, type: 'ArmyBookWeapon', count: 1, range: 12, attacks: 1 })
const book = {
  uid: 'a', name: 'Alpha', gameSystemSlug: 'grimdark-future',
  units: [{ id: 'u', name: 'Captain', cost: 50, size: 1, quality: 3, defense: 3, weapons: [gun('Pistol')], upgrades: ['P'] }],
  upgradePackages: [{ uid: 'P', sections: [{ uid: 's', label: 'Replace Pistol', variant: 'replace', targets: ['Pistol'], options: [
    { uid: 'r', label: 'Rifle', costs: [{ unitId: 'u', cost: 5 }], gains: [gun('Rifle'), { type: 'ArmyBookRule', name: 'Scout' }] },
  ] }] }],
}
const cat = parseOpr([{ name: 'a.json', text: JSON.stringify(book) }], { repo: 'army-forge/grimdark-future', commit: 'c', fetchedAt: 't' })
const id = cat.datasheets[0].id
const entry = (eid: string, upgrades?: Record<string, number>) => ({ id: eid, datasheetId: id, models: 1, wargear: [], ...(upgrades ? { upgrades } : {}) })
const list = (...entries: ArmyList['entries']): ArmyList => ({ id: 'l', name: 'L', edition: 'opr-gf', factionId: 'a', battleSize: 'open', pointsLimit: 2000, status: 'planned', entries, notes: '', createdAt: 't', updatedAt: 't' })

describe('unit upgrades in army lists', () => {
  const l = list(entry('1', { 's/r': 1 }), entry('2'))

  it('adds their points', () => {
    expect(listPoints(l, new Map(cat.datasheets.map((d) => [d.id, d]))).total).toBe(105)
  })

  it('asks for no Warlord and reports upgrades that do not fit', () => {
    expect(checkList(l, cat)).toEqual([])
    expect(checkList(list(entry('1', { 's/r': 2 })), cat).map((i) => i.code)).toContain('loadout')
  })

  it('prints a card per set of upgrades, with its weapons and rules', () => {
    const cards = unitCards(l, cat, () => [])
    expect(cards.map((c) => c.weapons.map((w) => w.name))).toEqual([['Rifle'], ['Pistol']])
    expect(cards[0].abilities.map((a) => a.name)).toEqual(['Scout'])
    expect(new Set(cards.map((c) => c.key)).size).toBe(2)
    expect(cards[0].entries[0].points).toBe(55)
  })

  it('writes them in the text export', () => {
    expect(listToText(l, cat, 'Grimdark Future (OPR)')).toContain('• Upgrade: Rifle (+5)')
  })
})
