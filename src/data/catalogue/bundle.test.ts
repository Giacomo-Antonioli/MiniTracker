import { describe, expect, it } from 'vitest'
import type { Catalogue } from '../../domain/catalogue/types'
import { buildBundle, readBundle } from './bundle'

const cat = (gameId: string): Catalogue => ({
  gameId, gameName: gameId, source: { repo: 'o/r', commit: 'abc', fetchedAt: '2026-11-01T00:00:00Z' },
  factions: [{ id: 'f', name: 'F', fullName: 'F' }], datasheets: [],
})

describe('catalogue bundle', () => {
  it('round-trips catalogues, compressed', async () => {
    const bytes = await buildBundle([cat('a'), cat('b')], '2026-11-14T00:00:00Z')
    expect(bytes[0]).toBe(0x1f)
    expect((await readBundle(bytes))?.map((c) => c.gameId)).toEqual(['a', 'b'])
  })
  it('reads the plain JSON form too', async () => {
    const raw = new TextEncoder().encode(JSON.stringify({ format: 'minitracker-catalogues', version: 1, exportedAt: 'x', catalogues: [cat('a')] }))
    expect((await readBundle(raw))?.[0].gameId).toBe('a')
  })
  it('lets other files through so they are read as BSData', async () => {
    expect(await readBundle(new TextEncoder().encode('<?xml version="1.0"?><gameSystem/>'))).toBeUndefined()
    expect(await readBundle(new TextEncoder().encode('{"gameSystem":[]}'))).toBeUndefined()
  })
  it('refuses damaged or newer files', async () => {
    const bad = new TextEncoder().encode(JSON.stringify({ format: 'minitracker-catalogues', version: 1, catalogues: [{ gameId: 1 }] }))
    await expect(readBundle(bad)).rejects.toThrow(/damaged/)
    const newer = new TextEncoder().encode(JSON.stringify({ format: 'minitracker-catalogues', version: 99, catalogues: [] }))
    await expect(readBundle(newer)).rejects.toThrow(/newer/)
  })
})
