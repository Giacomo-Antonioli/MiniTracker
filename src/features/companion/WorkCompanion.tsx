import { useEffect, useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { buildChecklist, paintChecklist, type CheckItem, type CompanionMode } from '../../domain/companion/companion'
import type { ModelGroup } from '../../domain/collection/types'
import { WISHLISTED } from '../../domain/collection/pipeline'
import { newTimer, pauseOthers, resumeTimer, timersForUnit } from '../../domain/paintTime/paintTime'
import { MoveDialog } from '../backlog/MoveDialog'
import { StageSelect, TimerPanel, TimerRow, useLabels, useTick } from '../paintTime/PaintTime'

const TITLE: Record<CompanionMode, string> = { paint: '🎨 Painter companion', build: '🔨 Builder companion' }

function Checklist({ unitId, items, empty }: { unitId: string; items: CheckItem[]; empty: string }) {
  const { companionTicks, toggleTick, paints } = useStore()
  const ticked = companionTicks[unitId] ?? []
  const paintName = new Map(paints.map((p) => [p.id, p]))
  if (!items.length) return <p className="text-sm text-muted">{empty}</p>
  let area: string | undefined
  return (
    <ul className="grid gap-1" aria-label="Checklist">
      {items.map((it) => {
        const head = it.area && it.area !== area ? (area = it.area) : undefined
        const on = ticked.includes(it.key)
        return (
          <li key={it.key} className="grid gap-0.5">
            {head && <h4 className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted">{head}</h4>}
            <label className={`flex items-start gap-2 ${on ? 'text-muted line-through' : ''}`}>
              <input type="checkbox" className="mt-1" checked={on} onChange={() => void toggleTick(unitId, it.key)} />
              <span>
                {it.label}
                {it.paintIds?.length ? (
                  <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                    {it.paintIds.map((id) => {
                      const p = paintName.get(id)
                      return <span key={id} className="inline-flex items-center gap-1 rounded border border-line px-1 text-xs"><span className="inline-block size-3 rounded-full border border-line" style={{ background: p?.hex }} />{p?.name ?? id}</span>
                    })}
                  </span>
                ) : null}
                {it.detail && <span className="block text-xs text-muted">{it.detail}</span>}
              </span>
            </label>
            {it.tip && !on && <p className="ml-6 text-xs text-muted">💡 {it.tip}</p>}
          </li>
        )
      })}
    </ul>
  )
}

/** Full page next to the hobby desk: timers, what to do, and quick actions for one unit. */
export function WorkCompanion({ backTo }: { backTo?: { label: string; go: () => void } } = {}) {
  const { companion, closeCompanion, openCompanion, units, paintTimers, saveTimer, stopTimer, schemes, library, paints, loadPaints, loadLibrary, pipeline, supplies, saveSupply, addPhotos, saveUnit, clearTicks, companionTicks } = useStore()
  const unit = units.find((u) => u.id === companion?.unitId)
  const mode = companion?.mode ?? 'paint'
  const { group } = useLabels()
  const mine = unit ? timersForUnit(paintTimers, unit.id) : []
  const now = useTick(mine.some((t) => t.runningSince))
  const [stage, setStage] = useState<string | undefined>(mode === 'build' ? pipeline.stages.find((s) => s.id === 'built')?.id : undefined)
  const [pauseRest, setPauseRest] = useState(true)
  const [moving, setMoving] = useState<ModelGroup | null>(null)
  const [notes, setNotes] = useState(unit?.notes ?? '')
  const [saved, setSaved] = useState('')
  const [paused, setPaused] = useState(false)
  const scheme = unit?.schemeId ? [...schemes, ...library].find((s) => s.id === unit.schemeId) : undefined

  useEffect(() => {
    if (mode === 'paint' && !paints.length) void loadPaints()
    if (mode === 'paint' && unit?.schemeId && !schemes.some((s) => s.id === unit.schemeId)) void loadLibrary()
  }, [mode, paints.length, loadPaints, loadLibrary, unit?.schemeId, schemes])

  if (!companion) return null
  if (!unit) {
    return (
      <div className="grid gap-3">
        <p className="text-muted">This unit no longer exists.</p>
        <button className="btn w-fit" onClick={closeCompanion}>← Back</button>
      </div>
    )
  }
  const groups = unit.groups.filter((g) => g.status !== WISHLISTED)
  const others = paintTimers.filter((t) => !mine.includes(t))
  const items = mode === 'paint' ? (scheme ? paintChecklist(scheme) : []) : buildChecklist(unit)
  const reset = async () => {
    for (const p of mode === 'paint' ? ['paint:'] : ['wargear:', 'magnet:']) await clearTicks(unit.id, p)
  }
  const done = items.filter((i) => (companionTicks[unit.id] ?? []).includes(i.key)).length
  const stamp = () => new Date().toISOString()

  const start = async () => {
    if (pauseRest) for (const t of pauseOthers(paintTimers, undefined, stamp())) await saveTimer(t)
    await saveTimer(newTimer(groups.map((g) => ({ unitId: unit.id, groupId: g.id, count: g.count })), ctx(), stage))
  }
  const switchTo = async (id: string) => {
    const t = paintTimers.find((x) => x.id === id)!
    for (const x of pauseOthers(paintTimers, id, stamp())) await saveTimer(x)
    await saveTimer(resumeTimer(t, stamp()))
    openCompanion(mode, t.targets[0].unitId, id)
  }

  return (
    <div className="grid gap-4" aria-label={TITLE[mode]}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button className="text-sm text-muted hover:text-accent" onClick={backTo?.go ?? closeCompanion}>← Back{backTo ? ` to ${backTo.label}` : ''}</button>
          <h1 className="font-display text-2xl text-accent">{TITLE[mode]}</h1>
          <p className="text-muted">{unit.customName}{unit.factionName ? ` · ${unit.factionName}` : ''}</p>
        </div>
        <button className="btn" onClick={() => openCompanion(mode === 'paint' ? 'build' : 'paint', unit.id, companion.timerId)}>
          Switch to {mode === 'paint' ? '🔨 Builder' : '🎨 Painter'}
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel grid content-start gap-2 p-4" aria-label="Timers">
          <h2 className="font-display text-lg">Timer</h2>
          {mine.length > 0 && <ul className="grid gap-2">{mine.map((t) => <TimerRow key={t.id} t={t} now={now} onPaused={() => setPaused(true)} />)}</ul>}
          {paused && !mine.some((t) => t.runningSince) && (
            <div className="grid gap-2 rounded border border-accent/50 p-2 text-sm" role="status" aria-label="Paused">
              <span>⏸ Paused and saved. Resume it any time from here, Home or the Companion tab.</span>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={closeCompanion}>Pick another unit</button>
                {backTo && <button className="btn" onClick={backTo.go}>← Back to {backTo.label}</button>}
                <button className="btn" onClick={() => setPaused(false)}>Stay here</button>
              </div>
            </div>
          )}
          {groups.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <StageSelect label="Companion timer stage" value={stage} onChange={setStage} />
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={pauseRest} onChange={(e) => setPauseRest(e.target.checked)} /> Pause other timers</label>
              <button className="btn btn-primary" onClick={() => void start()}>▶ Start timer</button>
            </div>
          ) : <p className="text-sm text-muted">Only wishlisted models: nothing to time yet.</p>}
          {others.length > 0 && (
            <>
              <h3 className="mt-2 text-sm text-muted">Other saved timers</h3>
              <ul className="grid gap-1 text-sm" aria-label="Other timers">
                {others.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span>{t.runningSince ? '▶' : '⏸'} {t.targets.map((x) => group(x.unitId, x.groupId)).join(', ')}</span>
                    <button className="btn px-2 py-0.5" onClick={() => void switchTo(t.id)}>Switch to this</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="panel grid content-start gap-2 p-4" aria-label="Models">
          <h2 className="font-display text-lg">Models</h2>
          <ul className="grid gap-2">
            {groups.map((g) => {
              const i = pipeline.stages.findIndex((s) => s.id === g.status)
              const next = pipeline.stages[i + 1]
              return (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span><b>{g.count} ×</b> {pipeline.stages[i]?.name ?? g.status}</span>
                  {next && <button className="btn" onClick={() => setMoving(g)}>Done → {next.name}…</button>}
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-muted">Moving the models also stops this unit's running timer and logs its time.</p>
        </section>
      </div>

      <section className="panel grid gap-2 p-4" aria-label={mode === 'paint' ? 'Scheme steps' : 'Build checklist'}>
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg">{mode === 'paint' ? `Scheme steps${scheme ? `: ${scheme.name}` : ''}` : 'What to build'}</h2>
          {items.length > 0 && (
            <span className="flex items-center gap-2 text-sm text-muted">
              {done} / {items.length} done
              {done > 0 && <button className="underline" onClick={() => void reset()}>Reset</button>}
            </span>
          )}
        </header>
        <Checklist unitId={unit.id} items={items} empty={mode === 'paint' ? 'No paint scheme chosen for this unit. Pick one on the unit page.' : 'No wargear or magnets set. Add a loadout or magnets on the unit page.'} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {mode === 'build' && (
          <>
            <section className="panel grid content-start gap-2 p-4" aria-label="Build links">
              <h2 className="font-display text-lg">Build links</h2>
              {unit.tutorials.length ? (
                <ul className="grid gap-1 text-sm">
                  {[...unit.tutorials].sort((a, b) => Number(b.kind === 'build') - Number(a.kind === 'build')).map((l, i) => (
                    <li key={i}><a className="text-accent underline" href={l.url} target="_blank" rel="noreferrer">{l.title || l.url}</a> <span className="text-muted">· {l.kind}</span></li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">No links yet. Add them on the unit page.</p>}
            </section>
            <section className="panel grid content-start gap-2 p-4" aria-label="Supplies used">
              <h2 className="font-display text-lg">Supplies</h2>
              {supplies.length ? (
                <ul className="grid gap-1 text-sm">
                  {supplies.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span>{s.name} <span className="text-muted">· {s.quantity} left</span></span>
                      <button className="btn px-2 py-0.5" disabled={s.quantity <= 0} onClick={() => void saveSupply({ ...s, quantity: s.quantity - 1, updatedAt: stamp() })}>Used one</button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">No supplies yet. Add them on the Supplies page.</p>}
            </section>
          </>
        )}
        <section className="panel grid content-start gap-2 p-4" aria-label="Photo and notes">
          <h2 className="font-display text-lg">Photo and notes</h2>
          <label className="btn w-fit cursor-pointer">
            📷 Add progress photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              aria-label="Progress photo"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])]
                if (files.length) void addPhotos(unit, files, { stage: groups[0]?.status }).then(() => setSaved('Photo added to the unit.'))
                e.target.value = ''
              }}
            />
          </label>
          <textarea className="input min-h-24" aria-label="Unit notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn w-fit" disabled={notes === unit.notes} onClick={() => void saveUnit({ ...unit, notes, updatedAt: stamp() }).then(() => setSaved('Notes saved.'))}>Save notes</button>
          {saved && <p className="text-sm text-muted" role="status">{saved}</p>}
        </section>
      </div>

      {moving && (
        <MoveDialog
          unit={unit}
          group={moving}
          onClose={() => setMoving(null)}
          onMoved={() => {
            for (const t of mine.filter((x) => x.runningSince)) void stopTimer(t.id)
          }}
        />
      )}
    </div>
  )
}

/** The Companion tab with nothing open: pick a unit and Painter or Builder, or continue from a timer. */
export function CompanionHub() {
  const { units, openCompanion, pipeline } = useStore()
  const [mode, setMode] = useState<CompanionMode>('paint')
  const [q, setQ] = useState('')
  const stage = (id: string) => pipeline.stages.find((s) => s.id === id)?.name ?? id
  const shown = units
    .filter((u) => u.lifecycle === 'active' && u.groups.some((g) => g.status !== WISHLISTED) && u.customName.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.nextUp) - Number(a.nextUp) || a.customName.localeCompare(b.customName))
  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-accent">Companion</h1>
        <div className="flex overflow-hidden rounded border border-line" role="group" aria-label="Companion mode">
          {(['paint', 'build'] as const).map((m) => (
            <button key={m} aria-pressed={mode === m} className={`px-3 py-1 ${mode === m ? 'bg-accent text-accent-fg' : 'hover:bg-panel-2'}`} onClick={() => setMode(m)}>{TITLE[m]}</button>
          ))}
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel grid content-start gap-2 p-4" aria-label="Pick a unit">
          <h2 className="font-display text-lg">Pick a unit</h2>
          <input className="input" placeholder="Search units…" aria-label="Search companion units" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="grid max-h-[60vh] gap-1 overflow-auto">
            {shown.map((u) => (
              <li key={u.id}>
                <button className="w-full rounded px-2 py-1 text-left hover:bg-panel-2" onClick={() => openCompanion(mode, u.id)}>
                  {u.nextUp ? '⏭ ' : ''}{u.customName}
                  <span className="text-sm text-muted"> · {u.groups.filter((g) => g.status !== WISHLISTED).map((g) => `${g.count}× ${stage(g.status)}`).join(', ')}</span>
                </button>
              </li>
            ))}
            {!shown.length && <li className="text-sm text-muted">No units found</li>}
          </ul>
        </section>
        <section className="panel grid content-start gap-2 p-4" aria-label="Saved timers">
          <h2 className="font-display text-lg">Timers</h2>
          <TimerPanel />
        </section>
      </div>
    </div>
  )
}
