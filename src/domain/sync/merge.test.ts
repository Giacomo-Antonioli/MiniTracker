import { describe, expect, it } from 'vitest'
import { diffRecords, mergeRecords, pruneTombstones, type Tombstone } from './merge'

type R = { id: string; v: string; updatedAt: string }
const r = (id: string, v: string, updatedAt: string): R => ({ id, v, updatedAt })
const t = (id: string, deletedAt: string): Tombstone => ({ table: 'units', id, deletedAt })

describe('mergeRecords', () => {
  it('keeps records found on only one side', () => {
    const out = mergeRecords([r('a', 'L', '1')], [r('b', 'R', '1')], { tombstones: [], applyDeletions: true })
    expect(out.records.map((x) => x.id)).toEqual(['a', 'b'])
    expect(out.summary).toEqual({ added: 1, updated: 0, deleted: 0, kept: 1 })
  })

  it('newest edit wins; ties keep local', () => {
    const local = [r('a', 'L', '2026-11-02'), r('b', 'L', '2026-11-01'), r('c', 'L', '2026-11-01')]
    const remote = [r('a', 'R', '2026-11-01'), r('b', 'R', '2026-11-02'), r('c', 'R', '2026-11-01')]
    const out = mergeRecords(local, remote, { tombstones: [], applyDeletions: true })
    expect(out.records.map((x) => x.v)).toEqual(['L', 'R', 'L'])
    expect(out.summary.updated).toBe(1)
  })

  it('applies a deletion only when newer than the last edit', () => {
    const local = [r('a', 'L', '2026-11-01'), r('b', 'L', '2026-11-05')]
    const tombs = [t('a', '2026-11-03'), t('b', '2026-11-03')]
    const out = mergeRecords(local, [], { tombstones: tombs, applyDeletions: true })
    expect(out.records.map((x) => x.id)).toEqual(['b'])
    expect(out.summary.deleted).toBe(1)
  })

  it('ignores deletions when asked to', () => {
    const out = mergeRecords([r('a', 'L', '1')], [], { tombstones: [t('a', '9')], applyDeletions: false })
    expect(out.records).toHaveLength(1)
  })

  it('does not bring back a remote record deleted locally later', () => {
    const out = mergeRecords([], [r('a', 'R', '2026-11-01')], { tombstones: [t('a', '2026-11-02')], applyDeletions: true })
    expect(out.records).toEqual([])
    expect(out.summary).toEqual({ added: 0, updated: 0, deleted: 0, kept: 0 })
  })

  it('records without updatedAt count as oldest', () => {
    const out = mergeRecords([{ id: 'a', v: 'L' }], [{ id: 'a', v: 'R', updatedAt: '1' }], { tombstones: [], applyDeletions: true })
    expect(out.records[0].v).toBe('R')
  })

  it('supports a custom key', () => {
    const out = mergeRecords([{ paintId: 'p', updatedAt: '1' }], [{ paintId: 'p', updatedAt: '2', n: 1 }], { tombstones: [], applyDeletions: true, key: (x) => x.paintId })
    expect(out.records).toEqual([{ paintId: 'p', updatedAt: '2', n: 1 }])
  })
})

describe('diffRecords (overwrite preview)', () => {
  it('counts what replacing local with remote changes', () => {
    const local = [r('a', 'L', '1'), r('b', 'L', '1'), r('c', 'L', '1')]
    const remote = [r('a', 'L', '1'), r('b', 'R', '2'), r('d', 'R', '1')]
    expect(diffRecords(local, remote)).toEqual({ added: 1, updated: 1, deleted: 1, kept: 1 })
  })
})

describe('pruneTombstones', () => {
  it('drops markers older than 90 days and keeps the newest per record', () => {
    const now = '2026-11-03T00:00:00Z'
    const out = pruneTombstones([t('old', '2026-07-01T00:00:00Z'), t('a', '2026-10-01T00:00:00Z'), t('a', '2026-10-05T00:00:00Z')], now)
    expect(out).toEqual([t('a', '2026-10-05T00:00:00Z')])
  })
})
