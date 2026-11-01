import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { Catalogue } from '../../domain/catalogue/types'
import { MiniTrackerDb } from '../db'
import { DexieCatalogueRepository } from './dexie'

const cat = (gameId: string): Catalogue => ({
  gameId, gameName: gameId, source: { repo: 'r', commit: 'c', fetchedAt: 't' }, factions: [], datasheets: [],
})

describe('CatalogueRepository', () => {
  it('is empty at first, then replaces the installed catalogue', async () => {
    const db = new MiniTrackerDb(`cat-${Math.random()}`)
    const repo = new DexieCatalogueRepository(db)
    expect(await repo.current()).toBeUndefined()
    await repo.replace(cat('a'))
    await repo.replace(cat('b'))
    expect(await repo.current()).toEqual(cat('b'))
    expect(await db.catalogues.count()).toBe(1)
    await repo.clear()
    expect(await repo.current()).toBeUndefined()
    await db.delete()
  })
})
