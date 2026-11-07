import { useEffect, useRef, useState } from 'react'
import { flipCoin, rollOffWinner, type Coin, type Winner } from '../../domain/dice/rollOff'
import { useTx } from '../../i18n'
import { attachTray, ME_COLOR, read3d, rollOff, THEM_COLOR } from './engine'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Who goes first (#192): roll-off with the 3D dice (ties roll again) or a coin flip. The winner is picked as first player. */
export function WhoGoesFirst({ mode, opponent, onDone, onClose }: { mode: 'roll' | 'coin'; opponent: string; onDone: (w: Winner) => void; onClose: () => void }) {
  const tx = useTx()
  const [use3d, setUse3d] = useState(read3d)
  const slot = useRef<HTMLDivElement>(null)
  const [rounds, setRounds] = useState<[number, number][]>([])
  const [coin, setCoin] = useState<{ side: Coin; spin: number } | null>(null)
  const [call, setCall] = useState<Coin>('heads')
  const [busy, setBusy] = useState(false)
  const [winner, setWinner] = useState<Winner>()
  const them = opponent || tx('Opponent')

  useEffect(() => {
    if (mode === 'roll' && use3d && slot.current) attachTray(slot.current)
  }, [mode, use3d])

  const doRollOff = async () => {
    setBusy(true)
    setWinner(undefined)
    const all: [number, number][] = []
    try {
      for (let i = 0; i < 10; i++) {
        let r: [number, number]
        try {
          r = await rollOff(use3d)
        } catch {
          setUse3d(false)
          r = await rollOff(false)
        }
        all.push(r)
        setRounds([...all])
        const w = rollOffWinner(...r)
        if (w) return setWinner(w)
        await sleep(use3d ? 900 : 300)
      }
    } finally {
      setBusy(false)
    }
  }

  const doFlip = async () => {
    setBusy(true)
    setWinner(undefined)
    const side = flipCoin()
    // Whole turns plus a half turn for tails, so the coin lands on its result.
    setCoin({ side, spin: (coin?.spin ?? 0) + 5 + (side === 'tails' ? 0.5 : 0) - ((coin?.spin ?? 0) % 1) })
    await sleep(use3d ? 1300 : 0)
    setWinner(side === call ? 'me' : 'them')
    setBusy(false)
  }

  const last = rounds.at(-1)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-label={mode === 'roll' ? tx('Roll off') : tx('Coin flip')} onClick={onClose}>
      <div className="panel grid w-full max-w-md gap-3 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg">{mode === 'roll' ? tx('🎲 Roll off') : tx('🪙 Coin flip')}</h2>
          <button type="button" className="btn ml-auto px-2 py-0" aria-label={tx('Close')} onClick={onClose}>✕</button>
        </div>

        {mode === 'roll' ? (
          <>
            <p className="flex gap-4 text-sm">
              <span><span className="inline-block h-3 w-3 rounded-sm" style={{ background: ME_COLOR }} /> {tx('Me')}</span>
              <span><span className="inline-block h-3 w-3 rounded-sm" style={{ background: THEM_COLOR }} /> {them}</span>
            </p>
            {use3d && <div ref={slot} className="h-48 overflow-hidden rounded border border-line bg-panel-2" aria-hidden="true" />}
            {last && (
              <ol className="grid gap-1 text-sm" aria-label={tx('Roll-off rounds')}>
                {rounds.map(([a, b], i) => <li key={i} className="tabular-nums">{tx('Me')} {a} – {b} {them}{a === b ? ` · ${tx('tie, roll again')}` : ''}</li>)}
              </ol>
            )}
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void doRollOff()}>{rounds.length ? tx('Roll again') : tx('Roll off')}</button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              {tx('I call')}
              {(['heads', 'tails'] as const).map((c) => (
                <button key={c} type="button" className={`btn px-2 py-0.5 ${call === c ? 'btn-primary' : ''}`} aria-pressed={call === c} onClick={() => setCall(c)}>{c === 'heads' ? tx('heads') : tx('tails')}</button>
              ))}
            </div>
            <div className="coin-stage grid h-40 place-items-center">
              <div className="coin" style={{ transform: `rotateX(${(coin?.spin ?? 0) * 360}deg)`, transitionDuration: use3d ? '1.2s' : '0s' }} aria-hidden="true">
                <span className="coin-face">H</span>
                <span className="coin-face coin-back">T</span>
              </div>
            </div>
            {coin && !busy && <p className="text-center text-sm" role="status">{coin.side === 'heads' ? tx('Heads') : tx('Tails')}</p>}
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void doFlip()}>{coin ? tx('Flip again') : tx('Flip')}</button>
          </>
        )}

        {winner && !busy && (
          <div className="grid gap-2 rounded border border-accent/60 p-2" role="status" aria-label={tx('Winner')}>
            <p className="font-display text-lg">{winner === 'me' ? tx('You win') : tx('{{name}} wins', { name: them })}</p>
            <p className="text-xs text-muted">{tx('The winner chooses who goes first.')}</p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary text-sm" onClick={() => onDone(winner)}>{winner === 'me' ? tx('I go first') : tx('{{name}} goes first', { name: them })}</button>
              <button type="button" className="btn text-sm" onClick={() => onDone(winner === 'me' ? 'them' : 'me')}>{winner === 'me' ? tx('{{name}} goes first', { name: them }) : tx('I go first')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
