import { describe, expect, it } from 'vitest'
import { searchDatasheets, factionLabel } from './search'
import type { Catalogue, Datasheet } from './types'

const d = (id: string, name: string, factionIds: string[], extra: Partial<Datasheet> = {}): Datasheet => ({
  id, name, factionIds, keywords: [], factionKeywords: [], minModels: 1, maxModels: 1, points: [{ fromModels: 1, points: 10 }],
  wargear: [], abilities: [], legends: false, ...extra,
})

const cat: Catalogue = {
  gameId: 'g', gameName: 'G', source: { repo: 'r', commit: 'c', fetchedAt: 't' },
  factions: [{ id: 'sm', name: 'Space Marines', fullName: 'Imperium - Space Marines' }, { id: 'um', name: 'Ultramarines', fullName: 'x' }, { id: 'ty', name: 'Tyranids', fullName: 'y' }],
  datasheets: [
    d('1', 'Assault Intercessor Squad', ['sm', 'um']),
    d('2', 'Intercessor Squad', ['sm', 'um']),
    d('3', 'Heavy Intercessor Squad', ['sm', 'um'], { keywords: ['Gravis'] }),
    d('4', 'Termagants', ['ty']),
    d('5', 'Marneus Calgar', ['um']),
    d('6', 'Old Captain', ['sm'], { legends: true }),
  ],
}
const names = (q: string, opts = {}) => searchDatasheets(cat, q, opts).map((x) => x.name)

describe('searchDatasheets', () => {
  it('ranks names starting with the query first, then word starts, then contains', () => {
    expect(names('inter')).toEqual(['Intercessor Squad', 'Assault Intercessor Squad', 'Heavy Intercessor Squad'])
    expect(names('cessor')).toEqual(['Assault Intercessor Squad', 'Heavy Intercessor Squad', 'Intercessor Squad'])
  })

  it('needs every word to match, in any order, case-insensitive', () => {
    expect(names('SQUAD heavy')).toEqual(['Heavy Intercessor Squad'])
  })

  it('also matches keywords', () => {
    expect(names('gravis')).toEqual(['Heavy Intercessor Squad'])
  })

  it('can limit to one faction', () => {
    expect(names('', { factionId: 'ty' })).toEqual(['Termagants'])
    expect(names('squad', { factionId: 'um' })).toEqual(['Assault Intercessor Squad', 'Heavy Intercessor Squad', 'Intercessor Squad'])
    expect(names('', { factionId: 'um' })[0]).toBe('Assault Intercessor Squad')
  })

  it('hides Legends unless asked, and caps the result size', () => {
    expect(names('captain')).toEqual([])
    expect(names('captain', { includeLegends: true })).toEqual(['Old Captain'])
    expect(searchDatasheets(cat, '', { limit: 2 })).toHaveLength(2)
  })
})

describe('factionLabel', () => {
  it('names the preferred faction if the unit has it, else the first one', () => {
    expect(factionLabel(cat, cat.datasheets[1], 'um')).toBe('Ultramarines')
    expect(factionLabel(cat, cat.datasheets[1], 'ty')).toBe('Space Marines')
    expect(factionLabel(cat, cat.datasheets[1])).toBe('Space Marines')
  })
})
