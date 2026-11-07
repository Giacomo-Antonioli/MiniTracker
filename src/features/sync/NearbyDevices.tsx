import { useEffect, useRef, useState } from 'react'
import type { Channel } from '../../data/syncChannel'
import type { Device, KnownDevice } from '../../data/syncDevice'
import { lanAnswer, lanBridge, lanStart, type LanBridge, type LanOptions, type NearbyPeer, type PairPrompt, type Pipe } from '../../data/syncLan'
import { Dialog } from '../../ui/Dialog'
import { LAN_TEXT as T } from './lanText'

interface Props {
  me: Device
  busy: boolean
  known: KnownDevice[]
  turn?: LanOptions['turn']
  /** A confirmed, open channel: run the sync on it. */
  onChannel(ch: Channel, starts: boolean, other: Device): void
  onStatus(text: string): void
  onError(text: string): void
  bridge?: () => Promise<LanBridge>
}

/** "Nearby devices" on the Sync page (#168): MiniTracker apps on the same network, paired once by a 6-digit code. */
export function NearbyDevices({ me, busy, known, turn, onChannel, onStatus, onError, bridge = lanBridge }: Props) {
  const [peers, setPeers] = useState<NearbyPeer[]>()
  const [unavailable, setUnavailable] = useState(false)
  const [prompt, setPrompt] = useState<PairPrompt & { resolve: (ok: boolean) => void }>()
  const ref = useRef({ busy, known, turn, onChannel, onStatus, onError })
  ref.current = { busy, known, turn, onChannel, onStatus, onError }

  const options = (): LanOptions => ({
    me,
    turn: ref.current.turn,
    isKnown: (id) => ref.current.known.some((d) => d.id === id && d.lanPaired),
    decide: (p) => new Promise((resolve) => setPrompt({ ...p, resolve })),
  })

  // advertise and look while the page is open; answer devices that pair with this one
  useEffect(() => {
    let dead = false
    const offs: (() => void)[] = []
    void bridge().then(async (b) => {
      if (dead) return
      offs.push(b.onPeers((p) => !dead && setPeers(p)))
      offs.push(b.onIncoming((pipe: Pipe) => {
        if (ref.current.busy) return pipe.close()
        void lanAnswer(pipe, options()).then(
          ({ channel, other }) => ref.current.onChannel(channel, false, other),
          (e: Error) => ref.current.onError(e.message),
        ).finally(() => setPrompt(undefined))
      }))
      await b.start(me)
    }).catch(() => !dead && setUnavailable(true))
    return () => {
      dead = true
      offs.forEach((f) => f())
      void bridge().then((b) => b.stop()).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.deviceId])

  const go = async (peer: NearbyPeer) => {
    ref.current.onStatus(T.connecting(peer.name))
    let pipe: Pipe
    try {
      pipe = await (await bridge()).connect(peer)
    } catch {
      return ref.current.onError(T.unreachable(peer.name))
    }
    try {
      const { channel, other } = await lanStart(pipe, options())
      ref.current.onChannel(channel, true, other)
    } catch (e) {
      ref.current.onError((e as Error).message)
    } finally {
      setPrompt(undefined)
    }
  }

  const answer = (ok: boolean) => {
    prompt?.resolve(ok)
    setPrompt(undefined)
  }

  return (
    <section className="panel grid gap-2 p-4" aria-label={T.title}>
      <h2 className="font-display text-lg">📡 {T.title}</h2>
      <p className="text-sm text-muted">{T.intro}</p>
      {unavailable ? <p className="text-sm text-muted">{T.unavailable}</p> : peers?.length ? (
        <ul className="grid gap-1 text-sm">
          {peers.map((p) => {
            const paired = known.some((d) => d.id === p.id && d.lanPaired)
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span>{p.name}</span>
                {paired && <span className="text-xs text-ok">✓ {T.paired}</span>}
                <button className={`btn px-2 py-0.5 text-xs ${paired ? 'btn-primary' : ''}`} disabled={busy} aria-label={paired ? T.syncNow(p.name) : T.pair(p.name)} onClick={() => void go(p)}>
                  {paired ? T.syncLabel : T.pairLabel}
                </button>
              </li>
            )
          })}
        </ul>
      ) : <p className="text-sm text-muted">{T.none}</p>}
      {prompt && (
        <Dialog title={T.confirmTitle} onClose={() => answer(false)}>
          <div className="grid gap-2 text-sm">
            <p>{T.confirmBody(prompt.other.deviceName)}</p>
            <p className="text-center font-mono text-4xl font-bold tracking-widest" aria-label="Pairing number">{prompt.code.slice(0, 3)} {prompt.code.slice(3)}</p>
            <p className="text-xs text-muted">{T.confirmHint}</p>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => answer(true)}>{T.confirm}</button>
              <button className="btn" onClick={() => answer(false)}>{T.cancel}</button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  )
}
