import { describe, expect, it } from 'vitest'
import boxes from '../../data/spearhead/boxes.json'
import type { Catalogue, Datasheet } from '../catalogue/types'
import { boxContents, candidates, matchDatasheet, unitsForBox, type SpearheadBox } from './spearhead'

const sheet = (id: string, name: string, factionIds = ['syl'], legends = false): Datasheet => ({ id, name, factionIds, keywords: [], factionKeywords: [], minModels: 1, maxModels: 1, points: [], wargear: [], abilities: [], legends })
const cat: Catalogue = {
  gameId: 'aos', gameName: 'AoS', source: { repo: 'BSData/age-of-sigmar-4th', commit: 'c', fetchedAt: 'f' },
  factions: [{ id: 'syl', name: 'Sylvaneth', fullName: 'Sylvaneth' }, { id: 'sob', name: 'Sons of Behemat', fullName: 'Sons of Behemat' }, { id: 'ogr', name: 'Ogor Mawtribes', fullName: 'Ogor Mawtribes' }],
  datasheets: [
    sheet('bw', 'Branchwych'),
    sheet('tl', 'Treelord'),
    sheet('kh1', 'Kurnoth Hunters with Kurnoth Greatswords (Scourge of Aqshy)'),
    sheet('kh2', 'Kurnoth Hunters with Kurnoth Scythes'),
    sheet('kh3', 'Kurnoth Hunters with Kurnoth Greatbows'),
    sheet('rh', 'Rock-hurlers', ['sob']),
    sheet('gl', 'Gluttons', ['ogr']),
    sheet('old', 'Treelord', ['syl'], true),
  ],
}

describe('Spearhead boxes (#99)', () => {
  it('matches exact names, then the closest longer or shorter name, skipping Scourge and Legends', () => {
    expect(matchDatasheet('Treelord', cat, 'Sylvaneth')?.id).toBe('tl')
    expect(candidates('Kurnoth Hunters', cat, 'Sylvaneth').map((d) => d.id)).toEqual(['kh2', 'kh3'])
    expect(matchDatasheet('Rock-hurler', cat, 'Sons of Behemat')?.id).toBe('rh')
    expect(matchDatasheet('Ogor Gluttons', cat, 'Ogor Mawtribes')?.id).toBe('gl')
    expect(matchDatasheet('Freeguild Command Corps Arch-Knight and Retinue', cat)).toBeUndefined()
  })

  it('adds up repeated units and keeps unmatched ones by name', () => {
    const box: SpearheadBox = { id: 'x', name: 'Test', faction: 'Sylvaneth', general: { name: 'Branchwych', models: 1 }, units: [{ name: 'Kurnoth Hunters', models: 3 }, { name: 'Kurnoth Hunters', models: 3 }, { name: 'Spite Gnome', models: 2 }], source: 's' }
    expect(boxContents(box, cat)).toEqual([
      { entry: 'Branchwych', datasheetId: 'bw', name: 'Branchwych', models: 1 },
      { entry: 'Kurnoth Hunters', datasheetId: 'kh2', name: 'Kurnoth Hunters with Kurnoth Scythes', models: 6 },
      { entry: 'Spite Gnome', name: 'Spite Gnome', models: 2 },
    ])
    expect(boxContents(box).map((c) => c.name)).toEqual(['Branchwych', 'Kurnoth Hunters', 'Spite Gnome'])
  })

  it('makes backlog units tagged with the box, linked to the catalogue and its faction', () => {
    const box = (boxes.boxes as SpearheadBox[]).find((b) => b.name === 'Bitterbark Copse')!
    const units = unitsForBox(box, cat, 'wishlisted')
    expect(units[0]).toMatchObject({ customName: 'Branchwych', datasheetId: 'bw', factionId: 'syl', factionName: 'Sylvaneth', tags: ['Spearhead', 'Bitterbark Copse'], groups: [{ count: 1, status: 'wishlisted' }] })
    expect(units.map((u) => u.groups[0].count)).toEqual([1, 1, 3, 5])
    const picked = unitsForBox(box, cat, 'wishlisted', { 'Kurnoth Hunters': 'kh3', Treelord: '' })
    expect(picked.map((u) => [u.customName, u.datasheetId])).toEqual([['Branchwych', 'bw'], ['Treelord', undefined], ['Kurnoth Hunters with Kurnoth Greatbows', 'kh3'], ['Tree-Revenants', undefined]])
  })

  it('the bundled data is sane: every army has a general and units with model counts', () => {
    const all = boxes.boxes as SpearheadBox[]
    expect(all.length).toBeGreaterThanOrEqual(40)
    expect(new Set(all.map((b) => b.id)).size).toBe(all.length)
    for (const b of all) {
      expect(b.general.name, b.name).toBeTruthy()
      expect(b.units.length, b.name).toBeGreaterThan(0)
      for (const e of [b.general, ...b.units]) expect(e.models, `${b.name}: ${e.name}`).toBeGreaterThan(0)
      expect(b.source).toMatch(/^https:\/\/assets\.warhammer-community\.com\//)
    }
  })
})
