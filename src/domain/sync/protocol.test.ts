import { describe, expect, it } from 'vitest'
import { clockSkewSeconds, formatPairCode, newPairCode, pairLink, parsePairCode, peerIdFor, pieceFromText, pieceToText, Reassembler, toPieces } from './protocol'

describe('pair codes', () => {
  it('makes readable codes and reads them back from text or links', () => {
    let i = 0
    const code = newPairCode(() => (i++ % 26) / 26)
    expect(code).toBe('ACDEFGH')
    expect(formatPairCode(code)).toBe('ACD-EFGH')
    expect(parsePairCode(' acd-efgh ')).toBe(code)
    expect(parsePairCode(pairLink('https://x.io/MiniTracker/', code))).toBe(code)
    expect(parsePairCode('AC0-EFGH')).toBeUndefined()
    expect(parsePairCode('ACD')).toBeUndefined()
    expect(peerIdFor(code)).toBe('minitracker-sync-acdefgh')
  })
})

it('clock skew', () => {
  const hello = { type: 'hello' as const, protocol: 1, deviceId: 'd', deviceName: 'PC', clock: '2026-11-04T10:02:00Z' }
  expect(clockSkewSeconds(hello, '2026-11-04T10:00:00Z')).toBe(120)
})

describe('pieces', () => {
  it('round-trip through text in any order with repeats', () => {
    const text = 'abcdefghij'.repeat(5)
    const pieces = toPieces('m1', text, 7).map(pieceToText)
    expect(pieces).toHaveLength(8)
    const r = new Reassembler()
    let out: string | undefined
    for (const t of [...pieces].reverse().concat(pieces[0])) out = r.add(pieceFromText(t)!) ?? out
    expect(out).toBe(text)
    expect(r.progress).toEqual({ have: 8, total: 8 })
  })
  it('a new message restarts collection; bad lines are ignored', () => {
    const r = new Reassembler()
    expect(r.add(toPieces('a', 'xxxx', 2)[0])).toBeUndefined()
    expect(r.add(toPieces('b', 'yy', 2)[0])).toBe('yy')
    expect(pieceFromText('hello')).toBeUndefined()
    expect(pieceFromText('MT9|a|0|1|x')).toBeUndefined()
    expect(pieceFromText('MT1|a|3|2|x')).toBeUndefined()
    expect(toPieces('e', '', 5)).toEqual([{ id: 'e', seq: 0, total: 1, data: '' }])
  })
})
