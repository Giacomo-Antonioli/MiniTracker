import { useEffect, useRef, useState } from 'react'
import { carried, clampTarget, isSuccess, rerollIndices, saveTarget, sortedDesc, STEP_LABEL, STEPS, successes, unsaved, woundTarget, type Reroll, type Step, type StepRoll } from '../../domain/dice/dice'
import { attachTray, boxEngine, quickEngine, type DiceEngine } from './engine'

const PREF = 'mt.dice3d'
const read3d = () => {
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
    return localStorage.getItem(PREF) !== 'off'
  } catch {
    return true
  }
}
const write3d = (on: boolean) => {
  try {
    localStorage.setItem(PREF, on ? 'on' : 'off')
  } catch {
    // Not saved: the choice lasts until the roller closes.
  }
}

const TARGETS = [2, 3, 4, 5, 6]
const num = (s: string, d: number) => {
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) ? n : d
}

/** Dice roller (#191): hits → wounds → saves, with 3D dice (dice-box) or quick rolls. */
export function DiceRoller({ onClose }: { onClose: () => void }) {
  const [use3d, setUse3d] = useState(read3d)
  const [step, setStep] = useState<Step>('hit')
  const [dice, setDice] = useState(10)
  const [target, setTarget] = useState(3)
  const [s, setS] = useState('4')
  const [t, setT] = useState('4')
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
  const need = step === 'wound' ? woundTarget(num(s, 4), num(t, 4)) : step === 'save' ? (saveTarget(num(sv, 7), num(ap, 0), inv ? num(inv, 7) : undefined) ?? 7) : clampTarget(target)

  const run = async (f: () => Promise<number[]>) => {
    setBusy(true)
    setNote('')
    try {
      setValues(await f())
    } catch {
      // 3D could not start (no WebGL, blocked worker…): fall back to quick rolls.
      setUse3d(false)
      setNote('3D dice could not start on this device; rolling without animation.')
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
    .map((r) => (r.step === 'save' ? `${unsaved(r)} unsaved` : `${carried(r)} ${r.step === 'hit' ? 'hits' : 'wounds'}`))
    .join(' → ')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-label="Dice roller" onClick={onClose}>
      <div className="panel grid max-h-[100dvh] w-full max-w-lg gap-3 overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg">🎲 Dice</h2>
          <ol className="flex gap-1 text-xs" aria-label="Steps">
            {STEPS.map((x) => (
              <li key={x} aria-current={x === step ? 'step' : undefined} className={`rounded px-2 py-0.5 ${x === step ? 'bg-accent text-accent-fg' : 'bg-panel-2 text-muted'}`}>{STEP_LABEL[x]}</li>
            ))}
          </ol>
          <label className="ml-auto flex items-center gap-1 text-xs text-muted">
            <input type="checkbox" checked={use3d} onChange={(e) => { setUse3d(e.target.checked); write3d(e.target.checked) }} /> 3D
          </label>
          <button className="btn px-2 py-0" aria-label="Close dice roller" onClick={onClose}>✕</button>
        </div>

        <div className="flex flex-wrap items-end gap-2 text-sm">
          <label className="grid gap-1">Dice
            <input className="input w-20" type="number" min={0} max={60} value={dice} onChange={(e) => setDice(Math.min(60, Math.max(0, num(e.target.value, 0))))} aria-label="Number of dice" />
          </label>
          {step === 'hit' && (
            <label className="grid gap-1">Hit on
              <select className="input" value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label="Hit on">
                {TARGETS.map((x) => <option key={x} value={x}>{x}+</option>)}
              </select>
            </label>
          )}
          {step === 'wound' && (
            <>
              <label className="grid gap-1">S<input className="input w-16" type="number" min={1} value={s} onChange={(e) => setS(e.target.value)} aria-label="Strength" /></label>
              <label className="grid gap-1">T<input className="input w-16" type="number" min={1} value={t} onChange={(e) => setT(e.target.value)} aria-label="Toughness" /></label>
            </>
          )}
          {step === 'save' && (
            <>
              <label className="grid gap-1">Sv<input className="input w-16" type="number" min={2} max={7} value={sv} onChange={(e) => setSv(e.target.value)} aria-label="Save" /></label>
              <label className="grid gap-1">AP<input className="input w-16" type="number" max={0} value={ap} onChange={(e) => setAp(e.target.value)} aria-label="AP" /></label>
              <label className="grid gap-1">Invuln<input className="input w-16" type="number" min={2} max={6} placeholder="—" value={inv} onChange={(e) => setInv(e.target.value)} aria-label="Invulnerable save" /></label>
            </>
          )}
          <span className="pb-2 font-semibold" aria-label="Target">{noSave ? 'No save' : `${need}+`}</span>
          <button className="btn btn-primary ml-auto" disabled={busy || dice < 1 || noSave} onClick={() => void roll()}>Roll {dice}D6</button>
        </div>

        {use3d && <div ref={slot} className="h-56 overflow-hidden rounded border border-line bg-panel-2" aria-hidden="true" />}
        {noSave && <p className="text-sm font-semibold" role="status">No save possible: all {dice} wounds get through.</p>}
        {note && <p className="text-xs text-muted" role="status">{note}</p>}

        {result && (
          <div className="grid gap-2" aria-label="Result">
            <div className="flex flex-wrap gap-1" aria-label="Dice results">
              {sortedDesc(result.values).map((v, i) => (
                <span key={i} className={`grid h-8 w-8 place-items-center rounded font-semibold tabular-nums ${isSuccess(v, need) ? 'bg-accent text-accent-fg' : 'bg-panel-2 text-muted'}`}>{v}</span>
              ))}
            </div>
            <p className="font-display text-xl" role="status">
              {step === 'save' ? `${unsaved(result)} unsaved · ${ok} saved` : `${ok} ${step === 'hit' ? 'hits' : 'wounds'} of ${result.values.length}`}
              {result.values.length > 0 && <span className="ml-2 text-sm text-muted">({result.values.filter((v) => v === 6).length}× 6)</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn text-sm" disabled={busy || !result.values.includes(1)} onClick={() => void reroll('ones')}>Re-roll 1s</button>
              <button className="btn text-sm" disabled={busy || ok === result.values.length} onClick={() => void reroll('fails')}>Re-roll fails</button>
              {next && <button className="btn btn-primary text-sm" disabled={busy || ok === 0} onClick={goNext}>{next === 'wound' ? `Wound roll with ${ok} ▶` : `Saves for ${ok} ▶`}</button>}
              {(done.length > 0 || step !== 'hit') && <button className="btn text-sm" onClick={reset}>New attack</button>}
            </div>
          </div>
        )}
        {summary && <p className="text-sm text-muted" aria-label="Attack summary">{summary}</p>}
      </div>
    </div>
  )
}
