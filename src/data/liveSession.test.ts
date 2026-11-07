import { describe, expect, it } from 'vitest'
import { startClock } from '../domain/games/companion'
import { addPoints, endGame, newGame, setCp, type Game } from '../domain/games/games'
import { LiveSession } from './liveSession'
import type { Channel } from './syncChannel'

class FakeEnd implements Channel {
  peer!: FakeEnd
  down = false
  private m: ((t: string) => void)[] = []
  private c: (() => void)[] = []
  send(t: string) {
    if (!this.down) setTimeout(() => !this.peer.down && this.peer.m.forEach((f) => f(t)), 0)
  }
  onMessage(f: (t: string) => void) { this.m.push(f) }
  onClose(f: () => void) { this.c.push(f) }
  close() { setTimeout(() => this.peer.c.forEach((f) => f()), 0) }
  drop() { this.down = this.peer.down = true; this.c.forEach((f) => f()); this.peer.c.forEach((f) => f()) }
}
const pair = (): [FakeEnd, FakeEnd] => { const a = new FakeEnd(), b = new FakeEnd(); a.peer = b; b.peer = a; return [a, b] }
const tick = () => new Promise((r) => setTimeout(r, 20))
const ctx = (now = '2026-11-07T10:00:00.000Z') => ({ now, newId: () => 'g1' })

function setup(guestSkew = 0) {
  let t = 1_000_000
  const clock = () => t
  const game = newGame({}, ctx())
  const seen: { host: Game[]; guest: Game[] } = { host: [], guest: [] }
  const host = new LiveSession({ deviceId: 'PC', game, now: clock, onGame: (g) => seen.host.push(g) })
  const guest = new LiveSession({ deviceId: 'Phone', now: () => clock() + guestSkew, onGame: (g) => seen.guest.push(g) })
  return { host, guest, seen, game, advance: (ms: number) => (t += ms) }
}

describe('live session', () => {
  it('the guest gets the whole game, then both stay in step', async () => {
    const { host, guest, game } = setup()
    const [a, b] = pair()
    host.attach(a)
    guest.attach(b)
    await tick()
    expect(guest.game?.id).toBe('g1')
    expect(host.state).toBe('live')
    expect(guest.state).toBe('live')
    host.push(setCp(game, 'me', 2, ctx()))
    await tick()
    expect(guest.game?.me.cp).toBe(2)
    guest.push(addPoints(guest.game!, 'me', 'primary', 5, ctx()))
    await tick()
    expect(host.game?.me.rounds[0].primary).toBe(5)
    expect(host.game?.me.cp).toBe(2)
  })

  it('ending the game on one device ends it on both', async () => {
    const { host, guest, game } = setup()
    const [a, b] = pair()
    host.attach(a)
    guest.attach(b)
    await tick()
    guest.push(endGame(guest.game!, 'gg', ctx()))
    await tick()
    expect(host.game?.status).toBe('done')
    expect(host.state).toBe('ended')
    expect(guest.state).toBe('ended')
    void game
  })

  it('a dropped connection: both keep working, and they converge on reconnect', async () => {
    const { host, guest, game } = setup()
    const [a, b] = pair()
    host.attach(a)
    guest.attach(b)
    await tick()
    a.drop()
    await tick()
    expect(host.state).toBe('reconnecting')
    expect(guest.state).toBe('reconnecting')
    host.push(setCp(game, 'me', 3, ctx()))
    guest.push(addPoints(guest.game!, 'them', 'secondary', 2, ctx()))
    const [a2, b2] = pair()
    host.attach(a2)
    guest.attach(b2)
    await tick()
    expect(host.state).toBe('live')
    expect(host.game?.me.cp).toBe(3)
    expect(host.game?.them.rounds[0].secondary).toBe(2)
    expect(guest.game?.me.cp).toBe(3)
    expect(guest.game?.them.rounds[0].secondary).toBe(2)
  })

  it('the newer change wins when both edited the same field while apart', async () => {
    const { host, guest, game, advance } = setup()
    const [a, b] = pair()
    host.attach(a)
    guest.attach(b)
    await tick()
    a.drop()
    host.push(setCp(game, 'me', 1, ctx()))
    advance(1000)
    guest.push(setCp(guest.game!, 'me', 9, ctx()))
    const [a2, b2] = pair()
    host.attach(a2)
    guest.attach(b2)
    await tick()
    expect(host.game?.me.cp).toBe(9)
    expect(guest.game?.me.cp).toBe(9)
  })

  it('a running clock stays correct when the phone clock is 5 s ahead', async () => {
    const { host, guest, game } = setup(5000)
    const [a, b] = pair()
    host.attach(a)
    guest.attach(b)
    await tick()
    host.push(startClock(game, ctx('2026-11-07T10:00:00.000Z')))
    await tick()
    // The host started it at 10:00:00 on its clock; on the phone's clock (5 s ahead) that is 10:00:05.
    expect(guest.game?.clock?.since).toBe('2026-11-07T10:00:05.000Z')
  })

  it('ignores junk and other games', async () => {
    const { host, guest } = setup()
    const [a, b] = pair()
    host.attach(a)
    guest.attach(b)
    await tick()
    a.send('not json')
    host.push(newGame({}, { now: '2026-11-07T11:00:00.000Z', newId: () => 'other' }))
    await tick()
    expect(guest.game?.id).toBe('g1')
  })
})
