import { zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { Photo } from '../domain/photos/types'
import { buildBackupZip, isZip, readBackupZip, type PhotoEntry } from './backupZip'

const photo = (id: string, fileName: string): Photo => ({
  id, owner: { kind: 'unit', unitId: 'u' }, unitId: 'u', fileName, caption: '', takenAt: 't', createdAt: 't',
  width: 1, height: 1, originalType: 'image/jpeg', originalBytes: 6, displayBytes: 4, hasOriginal: true,
})
const entries: PhotoEntry[] = [
  { photo: photo('p1', 'ultra_a_mt-1_sprue_20261102_01.jpg'), display: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' }), original: new Blob([new Uint8Array([9, 8, 7, 6, 5, 4])], { type: 'image/jpeg' }) },
  { photo: photo('p2', 'ultra_a_mt-1_sprue_20261102_02.heic'), display: new Blob([new Uint8Array([5, 5])], { type: 'image/jpeg' }) },
]
const bytes = async (b?: Blob) => (b ? [...new Uint8Array(await b.arrayBuffer())] : undefined)

describe('backup zip', () => {
  it('full: stores shown copies and originals, with their paths in backup.json', async () => {
    let refs: unknown
    const zip = await buildBackupZip(entries, (r) => JSON.stringify({ hello: 'world', refs: (refs = r) }), true)
    expect(await isZip(zip)).toBe(true)
    expect(refs).toEqual([
      { id: 'p1', shown: 'photos/shown/ultra_a_mt-1_sprue_20261102_01.webp', original: 'photos/original/ultra_a_mt-1_sprue_20261102_01.jpg' },
      { id: 'p2', shown: 'photos/shown/ultra_a_mt-1_sprue_20261102_02.jpg' },
    ])

    const { json, files } = await readBackupZip(zip)
    expect(JSON.parse(json).hello).toBe('world')
    expect(await bytes(files.get('photos/shown/ultra_a_mt-1_sprue_20261102_01.webp'))).toEqual([1, 2, 3, 4])
    expect(await bytes(files.get('photos/original/ultra_a_mt-1_sprue_20261102_01.jpg'))).toEqual([9, 8, 7, 6, 5, 4])
    expect(files.get('photos/shown/ultra_a_mt-1_sprue_20261102_01.webp')?.type).toBe('image/webp')
  })

  it('light: leaves originals out and is smaller', async () => {
    const full = await buildBackupZip(entries, () => '{}', true)
    const light = await buildBackupZip(entries, () => '{}', false)
    const { files } = await readBackupZip(light)
    expect([...files.keys()].some((k) => k.startsWith('photos/original/'))).toBe(false)
    expect(light.size).toBeLessThan(full.size)
  })

  it('accepts lazy (async) photo sources', async () => {
    async function* lazy() {
      for (const e of entries) yield e
    }
    const { files } = await readBackupZip(await buildBackupZip(lazy(), () => '{}', false))
    expect(files.size).toBe(2)
  })

  it('rejects zips that are not backups, and detects non-zip files', async () => {
    const zip = await buildBackupZip([], () => '{}', false)
    expect(await readBackupZip(zip)).toMatchObject({ json: '{}' })
    expect(await isZip(new Blob(['{"format":1}']))).toBe(false)
    const other = new Blob([zipSync({ 'notes.txt': new Uint8Array([1]) }) as BlobPart])
    await expect(readBackupZip(other)).rejects.toThrow(/not a MiniTracker backup/)
  })
})
