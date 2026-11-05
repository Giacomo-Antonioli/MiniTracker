import { expect, it } from 'vitest'
import { pieceFromText, Reassembler } from '../domain/sync/protocol'
import { carouselFrames, packSyncFile, unpackSyncFile } from './syncCarousel'
import type { SyncFile } from './syncFile'

const file: SyncFile = {
  format: 'minitracker-sync', protocol: 1, device: { deviceId: 'pc', deviceName: 'PC' }, createdAt: '2026-11-05T00:00:00Z',
  snapshot: { tables: { units: Array.from({ length: 200 }, (_, i) => ({ id: `u${i}`, customName: `Intercessor squad ${i}` })) }, settings: [] },
  photos: [{ id: 'p', display: 'AAAA', displayType: 'image/jpeg' }],
}

it('packs, splits into frames, survives any order and repeats, and unpacks without photos', async () => {
  const packed = await packSyncFile(file)
  expect(packed[0]).toBe('z')
  expect(packed.length).toBeLessThan(JSON.stringify(file).length / 3)
  const frames = carouselFrames(packed, 'small', 'abc')
  expect(frames.length).toBe(Math.ceil(packed.length / 300))
  expect(frames.every((f) => f.length < 330)).toBe(true)
  const r = new Reassembler()
  let out: string | undefined
  for (const f of [...frames].reverse().concat(frames)) out = r.add(pieceFromText(f)!) ?? out
  const back = await unpackSyncFile(out!)
  expect(back.snapshot.tables.units).toHaveLength(200)
  expect(back.photos).toBeUndefined()
})

it('rejects other QR codes', async () => {
  await expect(unpackSyncFile('hello')).rejects.toThrow(/not a MiniTracker sync/)
  await expect(unpackSyncFile('j{"format":"x"}')).rejects.toThrow(/not a MiniTracker sync file/)
})
