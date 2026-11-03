import { describe, expect, it } from 'vitest'
import { syncSnapshots, type Snapshot } from './snapshot'

const keys = { units: 'id', paintStock: 'paintId', photos: 'id' }
const NOW = '2026-11-04T00:00:00Z'
const P = (...p: string[]) => JSON.stringify(p)
const snap = (tables: Snapshot['tables'], settings: Snapshot['settings'] = []): Snapshot => ({ tables, settings })
const merge = { mode: 'merge' as const, applyDeletions: true, now: NOW }

describe('syncSnapshots', () => {
  it('merges tables by edit time and lists photos to fetch', () => {
    const local = snap({ units: [{ id: 'a', n: 'L', syncAt: '2026-11-02' }], photos: [{ id: 'p1' }] })
    const remote = snap({ units: [{ id: 'a', n: 'R', syncAt: '2026-11-03' }, { id: 'b', syncAt: '2026-11-01' }], paintStock: [{ paintId: 'x' }], photos: [{ id: 'p1' }, { id: 'p2' }] })
    const out = syncSnapshots(local, remote, keys, merge)
    expect(out.snapshot.tables.units).toEqual([{ id: 'a', n: 'R', syncAt: '2026-11-03' }, { id: 'b', syncAt: '2026-11-01' }])
    expect(out.snapshot.tables.paintStock).toEqual([{ paintId: 'x' }])
    expect(out.summary.units).toEqual({ added: 1, updated: 1, deleted: 0, kept: 0 })
    expect(out.needPhotos).toEqual(['p2'])
  })

  it('uses deletion markers from both devices and keeps them', () => {
    const tomb = { table: 'units', id: 'a', deletedAt: '2026-11-03T00:00:00Z' }
    const local = snap({ units: [{ id: 'a', syncAt: '2026-11-01' }] })
    const remote = snap({ units: [] }, [{ key: 'syncTombstones', value: [tomb] }])
    const out = syncSnapshots(local, remote, keys, merge)
    expect(out.snapshot.tables.units).toEqual([])
    expect(out.snapshot.settings.find((r) => r.key === 'syncTombstones')?.value).toEqual([tomb])
    expect(syncSnapshots(local, remote, keys, { ...merge, applyDeletions: false }).snapshot.tables.units).toHaveLength(1)
  })

  it('merges settings item by item and combines edit times', () => {
    const local = snap({}, [{ key: 'games', value: [{ id: 'g1', v: 'L' }] }, { key: 'syncStamps', value: { [P('games', 'g1')]: '2' } }, { key: 'deviceName', value: 'PC' }])
    const remote = snap({}, [{ key: 'games', value: [{ id: 'g1', v: 'R' }, { id: 'g2' }] }, { key: 'syncStamps', value: { [P('games', 'g1')]: '1', [P('games', 'g2')]: '3' } }, { key: 'deviceName', value: 'Phone' }, { key: 'currency', value: '$' }])
    const out = syncSnapshots(local, remote, keys, merge)
    const get = (k: string) => out.snapshot.settings.find((r) => r.key === k)?.value
    expect(get('games')).toEqual([{ id: 'g1', v: 'L' }, { id: 'g2' }])
    expect(get('currency')).toBe('$')
    expect(get('deviceName')).toBe('PC')
    expect(get('syncStamps')).toEqual({ [P('games', 'g1')]: '2', [P('games', 'g2')]: '3' })
    expect(out.summary.settings).toMatchObject({ added: 2, kept: 1 })
  })

  it('overwrite takes the remote data but keeps device-only settings', () => {
    const local = snap({ units: [{ id: 'a' }, { id: 'c' }] }, [{ key: 'deviceName', value: 'PC' }, { key: 'currency', value: '€' }])
    const remote = snap({ units: [{ id: 'b' }, { id: 'c', x: 1 }] }, [{ key: 'deviceName', value: 'Phone' }, { key: 'goals', value: [] }])
    const out = syncSnapshots(local, remote, keys, { ...merge, mode: 'overwrite' })
    expect(out.snapshot.tables.units).toEqual([{ id: 'b' }, { id: 'c', x: 1 }])
    expect(out.snapshot.settings).toEqual([{ key: 'deviceName', value: 'PC' }, { key: 'goals', value: [] }])
    expect(out.summary.units).toEqual({ added: 1, updated: 1, deleted: 1, kept: 0 })
    expect(out.summary.settings).toEqual({ added: 1, updated: 0, deleted: 1, kept: 0 })
  })
})
