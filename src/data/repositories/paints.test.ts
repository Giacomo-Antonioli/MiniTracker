import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { MiniTrackerDb } from '../db'
import { DexiePaintRepository } from './dexie'

describe('PaintRepository', () => {
  it('saves stock and custom paints; deleting a custom paint removes its stock', async () => {
    const db = new MiniTrackerDb(`p-${Math.random()}`)
    const repo = new DexiePaintRepository(db)
    const custom = { id: 'custom/1', brand: 'GSW', name: 'Rocket', hex: '#00ff00', custom: true as const }
    await repo.saveCustom(custom)
    await repo.saveStock({ paintId: 'custom/1', stage: 'in-use', quantity: 1, favourite: false, notes: '', updatedAt: 't' })
    await repo.saveStock({ paintId: 'c/nuln', stage: 'sealed', quantity: 1, favourite: false, notes: '', updatedAt: 't' })
    expect(await repo.listCustom()).toEqual([custom])
    expect(await repo.listStock()).toHaveLength(2)

    await repo.deleteCustom('custom/1')
    expect(await repo.listCustom()).toEqual([])
    expect((await repo.listStock()).map((s) => s.paintId)).toEqual(['c/nuln'])

    await repo.deleteStock('c/nuln')
    expect(await repo.listStock()).toEqual([])
    await expect(repo.saveCustom({ ...custom, custom: undefined as never })).rejects.toThrow(/custom/)
    await db.delete()
  })
})
