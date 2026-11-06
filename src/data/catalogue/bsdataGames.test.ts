import { describe, expect, it } from 'vitest'
import { parseBsData } from './bsdata'

// Hand-made catalogues shaped like Age of Sigmar and Kill Team data (#99).
const json = (name: string, o: object) => ({ name, text: JSON.stringify(o) })
const ch = (name: string, v: string) => ({ name, typeId: name, '#text': v })

describe('other game systems (#99)', () => {
  it('Age of Sigmar: points on the faction link, Unit stats, Melee Weapon, abilities with timing', () => {
    const gst = { gameSystem: { id: 'g', name: 'AoS', costTypes: [{ id: 'points', name: 'pts' }] } }
    const lib = {
      catalogue: {
        id: 'lib', name: 'Faction - Library', library: true,
        sharedSelectionEntries: [{
          type: 'unit', id: 'u1', name: 'Ghoul King',
          profiles: [
            { id: 'p1', name: 'Ghoul King', typeName: 'Unit', characteristics: [ch('Move', '6"'), ch('Health', '6')] },
            { id: 'p2', name: 'Talons', typeName: 'Melee Weapon', characteristics: [ch('Atk', '5'), ch('Hit', '3+')] },
            { id: 'p3', name: 'Feast', typeName: 'Ability (Activated)', characteristics: [ch('Timing', 'End of Any Turn'), ch('Effect', 'Heal (3).')] },
          ],
        }],
      },
    }
    const fac = { catalogue: { id: 'fac', name: 'Flesh-eater Courts', library: false, catalogueLinks: [{ id: 'cl', targetId: 'lib', type: 'catalogue', importRootEntries: true }], entryLinks: [{ id: 'l1', name: 'Ghoul King', type: 'selectionEntry', targetId: 'u1', costs: [{ name: 'pts', typeId: 'points', value: 120 }] }] } }
    const c = parseBsData([json('g.json', gst), json('lib.json', lib), json('fac.json', fac)], { repo: 'BSData/age-of-sigmar-4th', commit: 'c', fetchedAt: 'f' })
    const d = c.datasheets.find((x) => x.name === 'Ghoul King')!
    expect(d.points).toEqual([{ fromModels: 1, points: 120 }])
    expect(d.stats).toEqual([{ name: 'Ghoul King', values: [['Move', '6"'], ['Health', '6']] }])
    expect(d.weapons).toEqual([{ name: 'Talons', kind: 'melee', values: [['Atk', '5'], ['Hit', '3+']] }])
    expect(d.abilityTexts).toEqual({ Feast: 'End of Any Turn: Heal (3).' })
  })

  it('Kill Team: Operative stats, ⚔ melee weapons, abilities and unique actions; " Points" cost name', () => {
    const gst = { gameSystem: { id: 'g', name: 'KT', costTypes: [{ id: 'pp', name: ' Points' }] } }
    const fac = {
      catalogue: {
        id: 'fac', name: 'Kasrkin', library: false,
        selectionEntries: [{
          type: 'model', id: 'm1', name: 'Sharpshooter', costs: [{ name: ' Points', typeId: 'pp', value: 5 }],
          profiles: [
            { id: 'p1', name: 'Sharpshooter', typeName: 'Operative', characteristics: [ch('APL', '2'), ch('Wounds', '8')] },
            { id: 'p2', name: '⚔ Gun butt', typeName: 'Weapons', characteristics: [ch('ATK', '3')] },
            { id: 'p3', name: '⌖ Marksman rifle', typeName: 'Weapons', characteristics: [ch('ATK', '4')] },
            { id: 'p4', name: 'Spotter', typeName: 'Abilities', characteristics: [ch('Ability', 'Mark a target.')] },
            { id: 'p5', name: 'Aim (1AP)', typeName: 'Unique Actions', characteristics: [ch('Ability', 'Take aim.')] },
          ],
        }],
      },
    }
    const c = parseBsData([json('g.json', gst), json('fac.json', fac)], { repo: 'BSData/wh40k-killteam', commit: 'c', fetchedAt: 'f' })
    const d = c.datasheets.find((x) => x.name === 'Sharpshooter')!
    expect(d.points[0].points).toBe(5)
    expect(d.stats?.[0].values).toEqual([['APL', '2'], ['Wounds', '8']])
    expect(d.weapons?.map((w) => [w.name, w.kind])).toEqual([['⚔ Gun butt', 'melee'], ['⌖ Marksman rifle', 'ranged']])
    expect(d.abilityTexts).toEqual({ Spotter: 'Mark a target.', 'Aim (1AP)': 'Take aim.' })
  })
})
