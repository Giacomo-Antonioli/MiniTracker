import { useEffect, useRef, useState } from 'react'
import { carried, clampTarget, isSuccess, rerollIndices, saveTarget, sortedDesc, STEPS, successes, unsaved, woundTarget, type Reroll, type Step, type StepRoll } from '../../domain/dice/dice'
import { useTx } from '../../i18n'
import { attachTray, boxEngine, quickEngine, read3d, write3d, type DiceEngine } from './engine'

const TARGETS = [2, 3, 4, 5, 6]
const num = (s: string, d: number) => {
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) ? n : d
}

/** Dice roller (#191): hits → wounds → saves, with 3D dice (dice-box) or quick rolls. */
export function DiceRoller({ onClose }: { onClose: () => void }) {
  const tx = useTx()
  const stepName = (x: Step) => (x === 'hit' ? tx('Hit') : x === 'wound' ? tx('Wound') : tx('Save'))
  const [use3d, setUse3d] = useState(read3d)
  const [step, setStep] = useState<Step>('hit')
  const [dice, setDice] = useState(10)
  const [target, setTarget] = useState(3)
  const [s, setS] = useState('4')
  const [t, setT] = useState('4')
  // S vs T (40k) or a fixed wound roll from the weapon (Age of Sigmar, #99).
  const [byST, setByST] = useState(true)
  const [wound, setWound] = useState(4)
  const [sv, setSv] = useState('3')
  const [ap, setAp] = useState('0')
  const [inv, setInv] = useState('')
  const [values, setValues] = useState<number[] | null>(null)
  const [done, setDone] = useState<StepRoll[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const slot = useRef<HTMLDivElement>(null)
  const engine: DiceEngine = use3d ? boxEngine : quickEngine

  useEffect(() => {
    if (use3d && slot.current) attachTray(slot.current)
  }, [use3d])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  // The wound and save targets follow the characteristics typed in.
  const noSave = step === 'save' && saveTarget(num(sv, 7), num(ap, 0), inv ? num(inv, 7) : undefined) === undefined
  const need = step === 'wound' ? (byST ? woundTarget(num(s, 4), num(t, 4)) : wound) : step === 'save' ? (saveTarget(num(sv, 7), num(ap, 0), inv ? num(inv, 7) : undefined) ?? 7) : clampTarget(target)

  const run = async (f: () => Promise<number[]>) => {
    setBusy(true)
    setNote('')
    try {
      setValues(await f())
    } catch {
      // 3D could not start (no WebGL, blocked worker…): fall back to quick rolls.
      setUse3d(false)
      setNote(tx('3D dice could not start on this device; rolling without animation.'))
      setValues(await quickEngine.roll(dice))
    } finally {
      setBusy(false)
    }
  }
  const roll = () => run(() => engine.roll(dice))
  const reroll = (mode: Reroll) => values && run(() => engine.reroll(values, rerollIndices(values, need, mode)))
  const result = values ? { step, dice: values.length, target: need, values } : null
  const ok = result ? successes(result.values, need) : 0
  const next = STEPS[STEPS.indexOf(step) + 1]
  const goNext = () => {
    if (!result || !next) return
    setDone([...done, result])
    setDice(carried(result))
    setStep(next)
    setValues(null)
  }
  const reset = () => {
    setDone([])
    setStep('hit')
    setValues(null)
  }
  const summary = [...done, ...(result ? [result] : [])]
    .map((r) => (r.step === 'save' ? tx('{{n}} unsaved', { n: unsaved(r) }) : r.step === 'hit' ? tx('{{n}} hits', { n: carried(r) }) : tx('{{n}} wounds', { n: carried(r) })))
    .join(' → ')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-label={tx('Dice roller')} onClick={onClose}>
      <div className="panel grid max-h-[100dvh] w-full max-w-lg gap-3 overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg">{tx('🎲 Dice')}</h2>
          <ol className="flex gap-1 text-xs" aria-label={tx('Steps')}>
            {STEPS.map((x) => (
              <li key={x} aria-current={x === step ? 'step' : undefined} className={`rounded px-2 py-0.5 ${x === step ? 'bg-accent text-accent-fg' : 'bg-panel-2 text-muted'}`}>{stepName(x)}</li>
            ))}
          </ol>
          <label className="ml-auto flex items-center gap-1 text-xs text-muted">
            <input type="checkbox" checked={use3d} onChange={(e) => { setUse3d(e.target.checked); write3d(e.target.checked) }} /> 3D
          </label>
          <button className="btn px-2 py-0" aria-label={tx('Close dice roller')} onClick={onClose}>✕</button>
        </div>

        <div className="flex flex-wrap items-end gap-2 text-sm">
          <label className="grid gap-1">{tx('Dice')}
            <input className="input w-20" type="number" min={0} max={60} value={dice} onChange={(e) => setDice(Math.min(60, Math.max(0, num(e.target.value, 0))))} aria-label={tx('Number of dice')} />
          </label>
          {step === 'hit' && (
            <label className="grid gap-1">{tx('Hit on')}
              <select className="input" value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label={tx('Hit on')}>
                {TARGETS.map((x) => <option key={x} value={x}>{x}+</option>)}
              </select>
            </label>
          )}
          {step === 'wound' && (
            <label className="grid gap-1">{tx('Roll')}
              <select className="input" value={byST ? 'st' : 'fixed'} onChange={(e) => setByST(e.target.value === 'st')} aria-label={tx('Wound roll from')}>
                <option value="st">{tx('S vs T')}</option>
                <option value="fixed">{tx('Fixed')}</option>
              </select>
            </label>
          )}
          {step === 'wound' && !byST && (
            <label className="grid gap-1">{tx('Wound on')}
              <select className="input" value={wound} onChange={(e) => setWound(Number(e.target.value))} aria-label={tx('Wound on')}>
                {TARGETS.map((x) => <option key={x} value={x}>{x}+</option>)}
              </select>
            </label>
          )}
          {step === 'wound' && byST && (
            <>
              <label className="grid gap-1">S<input className="input w-16" type="number" min={1} value={s} onChange={(e) => setS(e.target.value)} aria-label={tx('Strength')} /></label>
              <label className="grid gap-1">T<input className="input w-16" type="number" min={1} value={t} onChange={(e) => setT(e.target.value)} aria-label={tx('Toughness')} /></label>
            </>
          )}
          {step === 'save' && (
            <>
              <label className="grid gap-1">{tx('Sv')}<input className="input w-16" type="number" min={2} max={7} value={sv} onChange={(e) => setSv(e.target.value)} aria-label={tx('Save')} /></label>
              <label className="grid gap-1">{tx('AP/Rend')}<input className="input w-16" type="number" max={0} value={ap} onChange={(e) => setAp(e.target.value)} aria-label={tx('AP')} /></label>
              <label className="grid gap-1">{tx('Invuln')}<input className="input w-16" type="number" min={2} max={6} placeholder="—" value={inv} onChange={(e) => setInv(e.target.value)} aria-label={tx('Invulnerable save')} /></label>
            </>
          )}
          <span className="pb-2 font-semibold" aria-label={tx('Target')}>{noSave ? tx('No save') : `${need}+`}</span>
          <button className="btn btn-primary ml-auto" disabled={busy || dice < 1 || noSave} onClick={() => void roll()}>{tx('Roll {{n}}D6', { n: dice })}</button>
        </div>

        {use3d && <div ref={slot} className="h-56 overflow-hidden rounded border border-line bg-panel-2" aria-hidden="true" />}
        {noSave && <p className="text-sm font-semibold" role="status">{tx('No save possible: all {{n}} wounds get through.', { n: dice })}</p>}
        {note && <p className="text-xs text-muted" role="status">{note}</p>}

        {result && (
          <div className="grid gap-2" aria-label={tx('Result')}>
            <div className="flex flex-wrap gap-1" aria-label={tx('Dice results')}>
              {sortedDesc(result.values).map((v, i) => (
                <span key={i} className={`grid h-8 w-8 place-items-center rounded font-semibold tabular-nums ${isSuccess(v, need) ? 'bg-accent text-accent-fg' : 'bg-panel-2 text-muted'}`}>{v}</span>
              ))}
            </div>
            <p className="font-display text-xl" role="status">
              {step === 'save' ? tx('{{unsaved}} unsaved · {{ok}} saved', { unsaved: unsaved(result), ok }) : step === 'hit' ? tx('{{ok}} hits of {{n}}', { ok, n: result.values.length }) : tx('{{ok}} wounds of {{n}}', { ok, n: result.values.length })}
              {result.values.length > 0 && <span className="ml-2 text-sm text-muted">({tx('{{n}}× 6', { n: result.values.filter((v) => v === 6).length })})</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn text-sm" disabled={busy || !result.values.includes(1)} onClick={() => void reroll('ones')}>{tx('Re-roll 1s')}</button>
              <button className="btn text-sm" disabled={busy || ok === result.values.length} onClick={() => void reroll('fails')}>{tx('Re-roll fails')}</button>
              {next && <button className="btn btn-primary text-sm" disabled={busy || ok === 0} onClick={goNext}>{next === 'wound' ? tx('Wound roll with {{n}} ▶', { n: ok }) : tx('Saves for {{n}} ▶', { n: ok })}</button>}
              {(done.length > 0 || step !== 'hit') && <button className="btn text-sm" onClick={reset}>{tx('New attack')}</button>}
            </div>
          </div>
        )}
        {summary && <p className="text-sm text-muted" aria-label={tx('Attack summary')}>{summary}</p>}
      </div>
    </div>
  )
}
