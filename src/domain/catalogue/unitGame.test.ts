import { describe, expect, it } from 'vitest'
import type { OwnedUnit } from '../collection/types'
import type { Catalogue } from './types'
import { gameOfEdition, installedGames, unitsOfGame } from './unitGame'

const cat = (repo: string, faction: string, unit: string): Catalogue => ({
  gameId: repo, gameName: repo, source: { repo, commit: 'c', fetchedAt: 'f' },
  factions: [{ id: `f-${faction}`, name: faction, fullName: faction }],
  datasheets: [{ id: `d-${unit}`, name: unit, factionIds: [`f-${faction}`], keywords: [], factionKeywords: [], minModels: 1, maxModels: 1, points: [], wargear: [], abilities: [], legends: false }],
})
const cats = [cat('BSData/wh40k-11e', 'Necrons', 'Warriors'), cat('BSData/age-of-sigmar-4th', 'Seraphon', 'Saurus'), cat('mhollink/mesbg-list-builder-v2024', 'Moria', 'Goblin')]
const unit = (id: string, o: Partial<OwnedUnit>) => ({ id, customName: id, ...o }) as OwnedUnit
const units = [unit('a', { datasheetId: 'd-Warriors' }), unit('b', { factionId: 'f-Seraphon' }), unit('c', { factionName: 'Moria' }), unit('d', { factionName: 'Homebrew' })]

describe('game picker (#99)', () => {
  it('filters units by the game of their datasheet, faction or faction name', () => {
    expect(unitsOfGame(units, cats, '40k').map((u) => u.id)).toEqual(['a'])
    expect(unitsOfGame(units, cats, 'aos').map((u) => u.id)).toEqual(['b'])
    expect(unitsOfGame(units, cats, 'mesbg').map((u) => u.id)).toEqual(['c'])
  })

  it('"all" keeps every unit, also those no catalogue knows', () => {
    expect(unitsOfGame(units, cats, 'all')).toHaveLength(4)
  })

  it('lists installed games in menu order and maps editions to games', () => {
    expect(installedGames(cats)).toEqual(['40k', 'aos', 'mesbg'])
    expect(gameOfEdition('kt24')).toBe('kt')
    expect(gameOfEdition('unknown')).toBe('40k')
  })
})
