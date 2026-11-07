import { describe, expect, it } from 'vitest'
import { newGame, addPoints, setCp, toggleDestroyed } from './games'
import { damage, nextPhase, startClock } from './companion'
import { allChanges, applyField, diffGames, localChanges, mergeChanges, mirror, shiftClock } from './live'

const ctx = (now = '2026-11-07T10:00:00.000Z') => ({ now, newId: () => 'g1' })
const base = () => newGame({}, ctx())

describe('live fields', () => {
  it('diff lists only what changed, as totals', () => {
    const g = base()
    const n = addPoints(setCp(g, 'me', 2, ctx()), 'me', 'primary', 5, ctx())
    expect(diffGames(g, n)).toEqual([
      { field: 'cp:me', value: 2 },
      { field: 'score:me:0', value: { primary: 5, secondary: 0 } },
    ])
    expect(diffGames(n, n)).toEqual([])
  })
  it('applying the diff reproduces the game', () => {
    const g = base()
    let n = toggleDestroyed(addPoints(g, 'them', 'secondary', 3, ctx()), 'me', 'e1', ctx())
    n = damage(n, 'e1', [3, 3], -1, ctx())
    n = nextPhase(startClock(n, ctx('2026-11-07T10:05:00.000Z')), ctx())
    const out = diffGames(g, n).reduce((acc, c) => applyField(acc, c.field, c.value), g)
    expect(diffGames(out, n)).toEqual([])
    expect(out.me.destroyed).toEqual(n.me.destroyed)
  })
  it('a field that vanishes comes back as false / null', () => {
    const g = toggleDestroyed(base(), 'me', 'e1', ctx())
    const n = toggleDestroyed(g, 'me', 'e1', ctx())
    expect(diffGames(g, n)).toEqual([{ field: 'destroyed:me:e1', value: false }])
    expect(applyField(g, 'destroyed:me:e1', false).me.destroyed).toEqual([])
  })
})

describe('last writer wins per field', () => {
  it('different fields from two devices both survive', () => {
    const g = base()
    const a = localChanges(g, setCp(g, 'me', 1, ctx()), 100, 'A')
    const b = localChanges(g, addPoints(g, 'me', 'primary', 4, ctx()), 101, 'B')
    const m1 = mergeChanges(mergeChanges(g, {}, a).game, mergeChanges(g, {}, a).stamps, b)
    expect(m1.game.me.cp).toBe(1)
    expect(m1.game.me.rounds[0].primary).toBe(4)
  })
  it('same field: the newer change wins whatever the arrival order', () => {
    const g = base()
    const old = { field: 'cp:me', value: 1, t: 100, d: 'A' }
    const recent = { field: 'cp:me', value: 7, t: 200, d: 'B' }
    const x = mergeChanges(g, {}, [old, recent])
    const y = mergeChanges(g, {}, [recent, old])
    expect(x.game.me.cp).toBe(7)
    expect(y.game.me.cp).toBe(7)
    expect(y.applied).toBe(1)
  })
  it('equal times break the tie by device id, the same on both sides', () => {
    const g = base()
    const c = [{ field: 'round', value: 2, t: 5, d: 'A' }, { field: 'round', value: 3, t: 5, d: 'B' }]
    expect(mergeChanges(g, {}, c).game.round).toBe(3)
    expect(mergeChanges(g, {}, [...c].reverse()).game.round).toBe(3)
  })
  it('the same change twice is harmless', () => {
    const g = base()
    const c = [{ field: 'cp:them', value: 3, t: 1, d: 'A' }]
    const once = mergeChanges(g, {}, c)
    const twice = mergeChanges(once.game, once.stamps, c)
    expect(twice.applied).toBe(0)
    expect(twice.game).toBe(once.game)
  })
  it('ending the game on one device ends it on the other', () => {
    const g = base()
    const m = mergeChanges(g, {}, [{ field: 'status', value: { status: 'done', notes: 'gg' }, t: 9, d: 'A' }])
    expect(m.game.status).toBe('done')
    expect(m.game.notes).toBe('gg')
  })
})

describe('reconnect, offset and mirror', () => {
  it('resending everything after a reconnect leaves the newer side alone', () => {
    const g = base()
    const a = mergeChanges(g, {}, [{ field: 'cp:me', value: 2, t: 10, d: 'A' }])
    const b = mergeChanges(g, {}, [{ field: 'cp:me', value: 5, t: 20, d: 'B' }])
    const intoB = mergeChanges(b.game, b.stamps, allChanges(a.game, a.stamps))
    const intoA = mergeChanges(a.game, a.stamps, allChanges(b.game, b.stamps))
    expect(intoB.game.me.cp).toBe(5)
    expect(intoA.game.me.cp).toBe(5)
  })
  it('a running clock is moved by the clock offset', () => {
    const c = { field: 'clock', value: { me: 0, them: 0, since: '2026-11-07T10:00:00.000Z' }, t: 1, d: 'A' }
    expect((shiftClock(c, 2000).value as { since: string }).since).toBe('2026-11-07T10:00:02.000Z')
    expect(shiftClock({ ...c, field: 'cp:me' }, 2000)).toEqual({ ...c, field: 'cp:me' })
  })
  it('mirror swaps me and them for a second player', () => {
    expect(mirror({ field: 'cp:me', value: 2, t: 1, d: 'A' }).field).toBe('cp:them')
    expect(mirror({ field: 'score:them:3', value: {}, t: 1, d: 'A' }).field).toBe('score:me:3')
    expect(mirror({ field: 'turn', value: 'me', t: 1, d: 'A' }).value).toBe('them')
    expect(mirror({ field: 'clock', value: { me: 5, them: 9 }, t: 1, d: 'A' }).value).toMatchObject({ me: 9, them: 5 })
    expect(mirror({ field: 'phase', value: 2, t: 1, d: 'A' })).toEqual({ field: 'phase', value: 2, t: 1, d: 'A' })
  })
})
