import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { Catalogue } from '../../domain/catalogue/types'
import { MiniTrackerDb } from '../db'
import { DexieCatalogueRepository } from './dexie'

const cat = (gameId: string): Catalogue => ({
  gameId, gameName: gameId, source: { repo: 'r', commit: 'c', fetchedAt: 't' }, factions: [], datasheets: [],
})

describe('CatalogueRepository', () => {
  it('keeps several editions side by side, updates and removes one', async () => {
    const db = new MiniTrackerDb(`cat-${Math.random()}`)
    const repo = new DexieCatalogueRepository(db)
    expect(await repo.list()).toEqual([])
    await repo.save(cat('10e'))
    await repo.save(cat('11e'))
    await repo.save({ ...cat('11e'), gameName: 'updated' })
    expect((await repo.list()).map((c) => [c.gameId, c.gameName])).toEqual([['10e', '10e'], ['11e', 'updated']])
    await repo.remove('10e')
    expect((await repo.list()).map((c) => c.gameId)).toEqual(['11e'])
    await db.delete()
  })
})
