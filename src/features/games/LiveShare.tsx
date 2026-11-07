import { useState, useSyncExternalStore } from 'react'
import { appDb, useStore } from '../../app/store'
import { joinLive, shareLive } from '../../data/liveConnect'
import { currentLive, stopLive, subscribeLive } from '../../data/liveSession'
import { getDevice, getSyncPrefs } from '../../data/syncDevice'
import type { Game } from '../../domain/games/games'
import { formatPairCode, newPairCode, parsePairCode } from '../../domain/sync/protocol'
import { Dialog } from '../../ui/Dialog'

const useLiveSession = () => useSyncExternalStore(subscribeLive, () => currentLive()?.state ?? 'none')

/** "● live" / "reconnecting…" for the game being shared, with a way to stop. Nothing when the game is not shared. */
export function LiveStatus({ game }: { game: Game }) {
  const state = useLiveSession()
  const s = currentLive()
  if (!s || state === 'none' || s.game?.id !== game.id) return null
  const text = state === 'live' ? '● live' : state === 'ended' ? 'Game ended on both devices' : state === 'connecting' ? 'connecting…' : 'reconnecting…'
  return (
    <span className="flex items-center gap-2 text-sm" role="status" aria-label="Live sync">
      <span className={state === 'live' ? 'text-accent' : 'text-muted'}>{text}</span>
      <button className="btn px-2 py-0 text-xs" onClick={stopLive}>{state === 'ended' ? 'Close' : 'Stop sharing'}</button>
    </span>
  )
}

/** Share the live game with another device under a pairing code (the other device taps "Join live game"). */
export function ShareLive({ game, onClose }: { game: Game; onClose: () => void }) {
  const { saveGame } = useStore()
  const [code, setCode] = useState<string>()
  const [error, setError] = useState('')
  const start = async () => {
    setError('')
    try {
      const me = await getDevice(appDb)
      const prefs = await getSyncPrefs(appDb)
      const c = newPairCode()
      await shareLive(game, { code: c, deviceId: me.deviceId, turn: prefs.turn?.urls ? { turn: prefs.turn } : undefined, onGame: (g) => void saveGame(g) })
      setCode(c)
    } catch (e) {
      setError((e as Error).message || 'Could not start sharing')
    }
  }
  return (
    <Dialog title="Share this game live" onClose={onClose}>
      <div className="grid gap-3">
        {!code ? (
          <>
            <p className="text-sm text-muted">Your other device (phone or PC) can follow and change this game live. Both keep working if the connection drops.</p>
            <button className="btn btn-primary" onClick={() => void start()}>Get a code</button>
          </>
        ) : (
          <>
            <p className="text-sm">On the other device open Games → <b>Join live game</b> and enter:</p>
            <p className="text-center font-display text-3xl tracking-widest" aria-label="Pairing code">{formatPairCode(code)}</p>
            <p className="text-xs text-muted">Keep this app open until the other device has joined.</p>
          </>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button className="btn" onClick={onClose}>{code ? 'Done' : 'Cancel'}</button>
      </div>
    </Dialog>
  )
}

/** Enter the code shown on the other device; the game arrives and opens in the Companion. */
export function JoinLive({ onClose, onJoined }: { onClose: () => void; onJoined: () => void }) {
  const { saveGame } = useStore()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const join = async () => {
    const code = parsePairCode(text)
    if (!code) return setError('That is not a pairing code; it looks like K7P-42QX.')
    setBusy(true)
    setError('')
    try {
      const me = await getDevice(appDb)
      const prefs = await getSyncPrefs(appDb)
      let opened = false
      await joinLive({
        code,
        deviceId: me.deviceId,
        turn: prefs.turn?.urls ? { turn: prefs.turn } : undefined,
        onGame: (g) => {
          void saveGame(g)
          if (!opened) {
            opened = true
            onJoined()
          }
        },
      })
      onClose()
    } catch (e) {
      setError((e as Error).message || 'Could not join')
      setBusy(false)
    }
  }
  return (
    <Dialog title="Join live game" onClose={onClose}>
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">Code shown on the other device
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="K7P-42QX" autoFocus />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={busy || !text.trim()} onClick={() => void join()}>{busy ? 'Connecting…' : 'Join'}</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Dialog>
  )
}
