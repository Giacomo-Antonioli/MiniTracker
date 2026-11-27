import { describe, expect, it } from 'vitest'
import { gameOfRepo } from '../../domain/catalogue/editions'
import { importOprBooks, parseOpr, readOprBook } from './opr'
import { downloadOprBooks, latestOprVersion } from './oprFetch'

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
    const files = await downloadOprBooks(source.repo, (done) => progress.push(done), fake)
    expect(files.map((f) => f.name)).toEqual(['a.json', 'b.json'])
    expect(progress).toEqual([0, 1, 2])
    expect(await latestOprVersion(source.repo, fake)).toMatch(/^[0-9a-f]{40}$/)
  })

  it('explains why the browser cannot download', async () => {
    await expect(downloadOprBooks(source.repo)).rejects.toThrow('browser cannot download')
  })
})
