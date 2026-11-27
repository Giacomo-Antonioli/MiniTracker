import { describe, expect, it } from 'vitest'
import { gameOfRepo } from '../../domain/catalogue/editions'
import { importOprBooks, parseOpr, readOprBook } from './opr'
import { apiSource, downloadOprBooks, latestOprVersion, siteSource } from './oprFetch'

// Made-up data in the shape of Army Forge's API.
const book = (uid: string, name: string, slug = 'grimdark-future', cost = 100) =>
  JSON.stringify({
    uid, name, gameSystemSlug: slug, upgradePackages: [],
    specialRules: [{ name: 'Brave', description: 'Never runs.' }],
    units: [
      { id: 'u1', name: 'Troopers', cost, size: 5, quality: 4, defense: 5, bases: { round: '32' }, rules: [{ name: 'Tough', label: 'Tough(3)' }], items: [{ name: 'Banner' }],
        weapons: [{ name: 'Rifle', count: 5, range: 24, attacks: 1, specialRules: [{ name: 'AP', label: 'AP(1)' }] }, { name: 'Knife', count: 5, range: 0, attacks: 1 }] },
      { id: 'u2', name: 'Captain', cost: 50, size: 1, quality: 3, defense: 3, rules: [{ name: 'Hero' }] },
    ],
  })
const file = (text: string, name = 'a.json') => ({ name, text })
const source = { repo: 'army-forge/grimdark-future', commit: 'c', fetchedAt: 't' }

describe('parseOpr', () => {
  const cat = parseOpr([file(book('b', 'Beta')), file(book('a', 'Alpha'))], source)

  it('makes one catalogue per game with one faction per book', () => {
    expect(cat).toMatchObject({ gameId: 'opr-gf', gameName: 'Grimdark Future' })
    expect(cat.factions.map((f) => f.name)).toEqual(['Alpha', 'Beta'])
    expect(new Set(cat.datasheets.map((d) => d.id)).size).toBe(4)
    expect(gameOfRepo(cat.source.repo)).toBe('gf')
  })

  it('converts points, size, stats, weapons and rules', () => {
    const d = cat.datasheets.find((x) => x.id === 'a/u1')!
    expect(d).toMatchObject({ minModels: 5, maxModels: 5, points: [{ fromModels: 5, points: 100 }], wargear: ['Rifle', 'Knife', 'Banner'], abilities: ['Tough(3)'] })
    expect(d.stats![0].values).toEqual([['Quality', '4+'], ['Defense', '5+'], ['Base', '32 mm']])
    expect(d.weapons![0]).toEqual({ name: 'Rifle', kind: 'ranged', values: [['Count', '5'], ['Range', '24"'], ['A', '1'], ['Special', 'AP(1)']] })
    expect(d.gear![0]).toMatchObject({ name: 'Rifle', count: 5 })
    expect(d.weapons![1].kind).toBe('melee')
    expect(cat.datasheets.find((x) => x.id === 'a/u2')!.role).toBe('Hero')
  })

  it('rejects other files', () => {
    expect(readOprBook('<xml/>')).toBeUndefined()
    expect(readOprBook('{"gameSystem":{}}')).toBeUndefined()
    expect(() => parseOpr([file('{}')], source)).toThrow('not an Army Forge army book')
  })
})

describe('importOprBooks', () => {
  it('adds books to the installed game and replaces the ones it already has', () => {
    const first = importOprBooks([file(book('a', 'Alpha')), file(book('b', 'Beta'))], [], 't').catalogues
    const next = importOprBooks([file(book('a', 'Alpha', 'grimdark-future', 120))], first, 't').catalogues[0]
    expect(next.factions.map((f) => f.id)).toEqual(['a', 'b'])
    expect(next.datasheets).toHaveLength(4)
    expect(next.rules).toHaveLength(2)
    expect(next.datasheets.find((d) => d.id === 'a/u1')!.points[0].points).toBe(120)
  })

  it('splits games and passes other files on', () => {
    const r = importOprBooks([file(book('a', 'Alpha')), file(book('c', 'Gamma', 'age-of-fantasy')), file('<x/>', 'x.cat')], [], 't')
    expect(r.catalogues.map((c) => c.gameId)).toEqual(['opr-gf', 'opr-aof'])
    expect(r.rest.map((f) => f.name)).toEqual(['x.cat'])
  })
})

describe('Army Forge download', () => {
  const fake = (async (url: string) =>
    new Response(url.includes('filters=') ? JSON.stringify([{ uid: 'a', modifiedAt: '1' }, { uid: 'b', modifiedAt: '2' }]) : book(url.includes('/a?') ? 'a' : 'b', 'X'))) as unknown as typeof fetch

  it('downloads every book in list order and gives a stable version', async () => {
    const progress: number[] = []
    const files = await downloadOprBooks(source.repo, (done) => progress.push(done), apiSource(fake))
    expect(files.map((f) => f.name)).toEqual(['a.json', 'b.json'])
    expect(progress).toEqual([0, 1, 2])
    expect(await latestOprVersion(source.repo, apiSource(fake))).toMatch(/^[0-9a-f]{40}$/)
  })

  it('reads the copy next to the site in the published web app', async () => {
    const asked: string[] = []
    const site = (async (url: string) => {
      asked.push(url)
      return new Response(url.endsWith('index.json') ? JSON.stringify([{ uid: 'a', modifiedAt: '1' }]) : book('a', 'X'))
    }) as unknown as typeof fetch
    await downloadOprBooks(source.repo, undefined, siteSource(site, '/MiniTracker/'))
    expect(asked).toEqual(['/MiniTracker/opr/grimdark-future/index.json', '/MiniTracker/opr/grimdark-future/a.json'])
  })
})

describe('upgrade conversion', () => {
  const raw = {
    uid: 'z', name: 'Zeta', gameSystemSlug: 'grimdark-future',
    units: [
      { id: 'u', name: 'Rider', cost: 40, size: 1, quality: 4, defense: 4, bases: { square: '50' }, upgrades: ['P', 'gone'],
        items: [{ name: 'Bike', content: [{ type: 'ArmyBookWeapon', name: 'Bike Gun', range: 18, attacks: 2 }, { type: 'ArmyBookRule', name: 'Fast' }] }] },
      { id: 'plain', name: 'Walker', cost: 20, size: 1, quality: 4, defense: 4 },
    ],
    upgradePackages: [{ uid: 'P', sections: [
      { uid: 's', label: 'Upgrade up to two', variant: 'upgrade', affects: { type: 'up to', value: 2 }, select: { type: 'any' }, options: [
        { uid: 'o', label: 'Extras', costs: [{ unitId: 'u', cost: 5 }], gains: [
          { type: 'ArmyBookRule', name: 'Scout' }, { type: 'ArmyBookItem', name: 'Charm', count: 2 }, { type: 'ArmyBookWeapon', name: 'Lance' }] },
        { uid: 'other', label: 'Not for this unit', costs: [{ unitId: 'x', cost: 5 }], gains: [] },
      ] },
      { uid: 'empty', label: 'Nothing for this unit', variant: 'upgrade', options: [] },
    ] }],
  }
  // Army Forge files can start with a byte-order mark.
  const cat = parseOpr([file(`﻿${JSON.stringify(raw)}`)], source)
  const [rider, walker] = cat.datasheets

  it('keeps only the options priced for the unit', () => {
    expect(rider.upgrades).toHaveLength(1)
    expect(rider.upgrades![0]).toMatchObject({ targets: [], affects: { type: 'upTo', value: 2 }, select: { type: 'any' } })
    expect(rider.upgrades![0].options.map((o) => o.id)).toEqual(['o'])
    expect(walker).toMatchObject({ upgrades: [], gear: [], weapons: [], wargear: [], abilities: [] })
  })

  it('converts items with their weapons and rules, and every kind of gain', () => {
    expect(rider.gear![0]).toMatchObject({ name: 'Bike', count: 1, rules: ['Fast'] })
    expect(rider.weapons!.map((w) => w.name)).toEqual(['Bike Gun'])
    expect(rider.upgrades![0].options[0].gains).toMatchObject([{ name: 'Scout', count: 1, rules: ['Scout'] }, { name: 'Charm', count: 2 }, { name: 'Lance', weapon: { kind: 'melee' } }])
    expect(rider.stats![0].values.at(-1)).toEqual(['Base', '50 mm'])
  })

  it('rejects an unknown game, mixed games and no books', () => {
    expect(() => parseOpr([file(book('a', 'A', 'warfleets'))], source)).toThrow('Unknown One Page Rules game')
    expect(() => parseOpr([file(book('a', 'A')), file(book('b', 'B', 'age-of-fantasy'))], source)).toThrow('different games')
    expect(() => parseOpr([], source)).toThrow('No army books')
  })
})

describe('Army Forge download errors', () => {
  const answer = (res: Response) => (async () => res) as unknown as typeof fetch
  it('reports HTTP errors and an empty list', async () => {
    await expect(latestOprVersion(source.repo, apiSource(answer(new Response('', { status: 503 }))))).rejects.toThrow('HTTP 503')
    await expect(downloadOprBooks(source.repo, undefined, apiSource(answer(new Response('[]'))))).rejects.toThrow('army books were found')
  })
})
