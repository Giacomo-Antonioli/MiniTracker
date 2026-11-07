import type { Game } from '../domain/games/games'
import { allChanges, localChanges, mergeChanges, shiftClock, type LiveChange, type Stamps } from '../domain/games/live'
import type { Channel } from './syncChannel'

/** Live game sync over an existing encrypted channel (see domain/games/live for the merge rules). */
export type LiveState = 'connecting' | 'live' | 'reconnecting' | 'ended'

type Message =
  | { live: 1; type: 'hello'; now: number; d: string; reply?: boolean; game?: Game }
  | { live: 1; type: 'changes'; changes: LiveChange[] }

export interface LiveOptions {
  /** This device's id; breaks ties between equal change times. */
  deviceId: string
  /** The game to share (host) or undefined (a guest receives it from the host). */
  game?: Game
  /** Called with the merged game whenever the other device changed something. */
  onGame(g: Game): void
  onState?(s: LiveState): void
  now?: () => number
}

export class LiveSession {
  game?: Game
  state: LiveState = 'connecting'
  private stamps: Stamps = {}
  private channel?: Channel
  private offset = 0
  private readonly now: () => number

  constructor(private readonly o: LiveOptions) {
    this.game = o.game
    this.now = o.now ?? Date.now
  }

  private set(s: LiveState) {
    if (this.state === s) return
    this.state = s
    this.o.onState?.(s)
  }

  private send(m: Message) {
    this.channel?.send(JSON.stringify(m))
  }

  /** Use a (new) channel: the first one, or a reconnect after the connection dropped. */
  attach(channel: Channel) {
    this.channel?.close()
    this.channel = channel
    if (this.state !== 'ended') this.set('connecting')
    channel.onMessage((text) => {
      if (this.channel !== channel) return
      let m: Message
      try {
        m = JSON.parse(text) as Message
      } catch {
        return
      }
      if (m?.live === 1) this.receive(m)
    })
    channel.onClose(() => {
      if (this.channel !== channel) return
      this.channel = undefined
      if (this.state !== 'ended') this.set('reconnecting')
    })
    // The host sends the whole game once; every side then introduces itself.
    this.send({ live: 1, type: 'hello', now: this.now(), d: this.o.deviceId, ...(this.game && this.o.game ? { game: this.game } : {}) })
  }

  private receive(m: Message) {
    if (m.type === 'hello') {
      this.offset = this.now() - m.now
      if (m.game && !this.game) {
        this.game = m.game
        this.o.onGame(m.game)
      }
      if (!m.reply) this.send({ live: 1, type: 'hello', now: this.now(), d: this.o.deviceId, reply: true })
      if (this.state !== 'ended') this.set('live')
      // Whatever was changed while apart (or just now): the other side keeps what is newer.
      if (this.game) {
        const changes = allChanges(this.game, this.stamps)
        if (changes.length) this.send({ live: 1, type: 'changes', changes })
      }
      return
    }
    if (!this.game) return
    const moved = m.changes.map((c) => shiftClock({ ...c, t: c.t + this.offset }, this.offset))
    const merged = mergeChanges(this.game, this.stamps, moved)
    this.stamps = merged.stamps
    if (!merged.applied) return
    this.game = merged.game
    this.o.onGame(merged.game)
    if (merged.game.status === 'done') this.set('ended')
  }

  /** The game was changed on this device: send what differs. Works offline too; a reconnect resends it. */
  push(next: Game) {
    if (!this.game || next.id !== this.game.id || this.state === 'ended') return
    const changes = localChanges(this.game, next, this.now(), this.o.deviceId)
    if (!changes.length) return
    this.stamps = mergeChanges(this.game, this.stamps, changes).stamps
    this.game = next
    if (this.channel) this.send({ live: 1, type: 'changes', changes })
    if (next.status === 'done') this.set('ended')
  }

  stop() {
    const c = this.channel
    this.channel = undefined
    this.set('ended')
    c?.close()
  }
}

// ---------- the one live game on this device ----------

let current: LiveSession | undefined
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((f) => f())

export const currentLive = () => current
export function subscribeLive(f: () => void) {
  listeners.add(f)
  return () => void listeners.delete(f)
}

/** Start sharing/joining a live game; replaces any earlier one. */
export function startLive(o: LiveOptions): LiveSession {
  current?.stop()
  const s = new LiveSession({
    ...o,
    onState: (st) => {
      o.onState?.(st)
      notify()
    },
  })
  current = s
  notify()
  return s
}

export function stopLive() {
  current?.stop()
  current = undefined
  notify()
}

/** For the store: a game was saved on this device. */
export const pushLive = (g: Game) => current?.push(g)
