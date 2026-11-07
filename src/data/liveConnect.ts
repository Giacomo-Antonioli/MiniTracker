import type { Game } from '../domain/games/games'
import { hostByCode, joinByCode, type ConnectOptions } from './syncChannel'
import { startLive, type LiveSession } from './liveSession'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Options {
  code: string
  deviceId: string
  turn?: ConnectOptions
  onGame(g: Game): void
  retryMs?: number
}

/** Wait for the other device under a pairing code; if the connection drops, wait again under the same code. */
export async function shareLive(game: Game, o: Options): Promise<LiveSession> {
  let cancel: (() => void) | undefined
  let session: LiveSession
  let again: (() => void) | undefined
  const first = await hostByCode(o.code, o.turn)
  cancel = first.cancel
  session = startLive({
    deviceId: o.deviceId,
    game,
    onGame: o.onGame,
    onState: (s) => {
      if (s === 'reconnecting') again?.()
      if (s === 'ended') cancel?.()
    },
  })
  void (async () => {
    let h = first
    while (session.state !== 'ended') {
      try {
        session.attach(await h.channel)
        await new Promise<void>((r) => (again = r))
        if (session.state === 'ended') break
        h = await hostByCode(o.code, o.turn)
        cancel = h.cancel
      } catch {
        await sleep(o.retryMs ?? 3000)
        try {
          h = await hostByCode(o.code, o.turn)
          cancel = h.cancel
        } catch {
          /* keep trying */
        }
      }
    }
  })()
  return session
}

/** Join the live game under a pairing code. The first attempt reports its error; later ones (after a drop) retry quietly. */
export async function joinLive(o: Options): Promise<LiveSession> {
  const first = await joinByCode(o.code, o.turn)
  let again: (() => void) | undefined
  const session = startLive({
    deviceId: o.deviceId,
    onGame: o.onGame,
    onState: (s) => s === 'reconnecting' && again?.(),
  })
  session.attach(first)
  void (async () => {
    while (session.state !== 'ended') {
      await new Promise<void>((r) => (again = r))
      while (session.state === 'reconnecting') {
        try {
          session.attach(await joinByCode(o.code, o.turn))
        } catch {
          await sleep(o.retryMs ?? 3000)
        }
      }
    }
  })()
  return session
}
