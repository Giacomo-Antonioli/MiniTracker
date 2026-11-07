import { useState } from 'react'
import { useStore } from '../../app/store'
import { goalHistory, goalProgress, goalTitle, validateGoal, type Goal, type Period, } from '../../domain/goals/goals'
import { useTx, txr } from '../../i18n'
import { useAllEvents } from '../stats/StatsPage'
import { GoalBar as Bar } from './GoalBar'

const kinds = (): { kind: Goal['kind']; label: string }[] => [
  { kind: 'models', label: txr('Paint models per period') },
  { kind: 'units', label: txr('Finish chosen units') },
  { kind: 'pile', label: txr('Shrink the pile (paint more than you add)') },
  { kind: 'streak', label: txr('Paint every week (streak)') },
]

function blank(kind: Goal['kind']): Goal {
  const base = { id: crypto.randomUUID(), title: '', createdAt: new Date().toISOString() }
  if (kind === 'models') return { ...base, kind, count: 10, period: 'month' }
  if (kind === 'units') return { ...base, kind, unitIds: [] }
  if (kind === 'pile') return { ...base, kind, period: 'month' }
  return { ...base, kind, weeks: 4 }
}

/** Hobby goals (#90): progress now, and past periods for recurring goals. */
export function GoalsPage() {
  const tx = useTx()
  const { goals, units, pipeline, deleteGoal } = useStore()
  const events = useAllEvents()
  const [editing, setEditing] = useState<Goal | null>(null)
  const now = new Date().toISOString()

  return (
    <div className="grid max-w-4xl gap-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-accent" data-tour="goals-title">{tx('Goals')}</h1>
        {!editing && <button className="btn btn-primary" onClick={() => setEditing(blank('models'))}>{tx('+ Goal')}</button>}
      </header>
      {editing && <GoalForm goal={editing} onClose={() => setEditing(null)} />}
      {goals.length === 0 && !editing && <p className="text-muted">{tx('No goals yet. Try “Paint 10 models a month” or “Finish my Combat Patrol by Christmas”.')}</p>}
      <ul className="grid gap-3" aria-label={tx('Goals')}>
        {goals.map((g) => {
          const pr = goalProgress(g, units, events, pipeline, now)
          const past = goalHistory(g, units, events, pipeline, now)
          return (
            <li key={g.id} className="panel grid gap-2 p-4" aria-label={goalTitle(g)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg">{pr.done ? '✅ ' : ''}{goalTitle(g)}</h2>
                  <p className={`text-sm ${pr.overdue ? 'text-danger' : 'text-muted'}`}>{[pr.when, pr.overdue && tx('overdue')].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex gap-1">
                  <button className="btn px-2" aria-label={tx('Edit {{name}}', { name: goalTitle(g) })} onClick={() => setEditing(g)}>✎</button>
                  <button className="btn btn-danger px-2" aria-label={tx('Delete {{name}}', { name: goalTitle(g) })} onClick={() => confirm(tx('Delete goal “{{name}}”?', { name: goalTitle(g) })) && void deleteGoal(g.id)}>✕</button>
                </div>
              </div>
              <Bar p={pr} />
              {past.length > 0 && (
                <div className="flex flex-wrap gap-1.5 text-xs" aria-label={tx('Past periods')}>
                  {past.map((x) => (
                    <span key={x.when} className={`rounded border px-1.5 py-0.5 ${x.done ? 'border-ok text-ok' : 'border-line text-muted'}`} title={x.text}>
                      {x.done ? '✓' : '✗'} {x.when}
                    </span>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function GoalForm({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const tx = useTx()
  const { units, saveGoal } = useStore()
  const [g, setG] = useState<Goal>(goal)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const isNew = !useStore.getState().goals.some((x) => x.id === goal.id)
  const period = (v: Period) => setG({ ...g, period: v } as Goal)
  const shown = g.kind === 'units' ? units.filter((u) => g.unitIds.includes(u.id) || u.customName.toLowerCase().includes(filter.toLowerCase())) : []

  return (
    <form
      className="panel grid gap-3 border-accent/60 p-4"
      aria-label={tx('Goal')}
      onSubmit={(e) => {
        e.preventDefault()
        try {
          validateGoal(g)
          void saveGoal(g).then(onClose)
        } catch (err) {
          setError((err as Error).message)
        }
      }}
    >
      {isNew && (
        <label className="grid gap-1 text-sm">{tx('Kind')}
          <select className="input" value={g.kind} onChange={(e) => setG({ ...blank(e.target.value as Goal['kind']), id: g.id, title: g.title })}>
            {kinds().map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
          </select>
        </label>
      )}
      <label className="grid gap-1 text-sm">{tx('Title (optional)')}<input className="input" placeholder={goalTitle({ ...g, title: '' })} value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} /></label>
      {g.kind === 'models' && (
        <div className="flex flex-wrap gap-3">
          <label className="grid gap-1 text-sm">{tx('Models')}<input className="input w-24" type="number" min={1} value={g.count} onChange={(e) => setG({ ...g, count: Number(e.target.value) })} /></label>
          <PeriodSelect value={g.period} onChange={period} />
        </div>
      )}
      {g.kind === 'pile' && <PeriodSelect value={g.period} onChange={period} />}
      {g.kind === 'streak' && <label className="grid gap-1 text-sm">{tx('Weeks in a row')}<input className="input w-24" type="number" min={1} value={g.weeks} onChange={(e) => setG({ ...g, weeks: Number(e.target.value) })} /></label>}
      {g.kind === 'units' && (
        <>
          <label className="grid gap-1 text-sm">{tx('Due (optional)')}<input className="input w-44" type="date" value={g.due ?? ''} onChange={(e) => setG({ ...g, due: e.target.value || undefined })} /></label>
          <fieldset className="grid gap-1">
            <legend className="text-sm text-muted">{tx('Units ({{n}} chosen)', { n: g.unitIds.length })}</legend>
            <input className="input" placeholder={tx('Filter units')} aria-label={tx('Filter units')} value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="grid max-h-56 gap-0.5 overflow-y-auto">
              {shown.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={g.unitIds.includes(u.id)} onChange={() => setG({ ...g, unitIds: g.unitIds.includes(u.id) ? g.unitIds.filter((x) => x !== u.id) : [...g.unitIds, u.id] })} /> {u.customName}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {error && <p className="text-danger" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary">{tx('Save goal')}</button>
        <button type="button" className="btn" onClick={onClose}>{tx('Cancel')}</button>
      </div>
    </form>
  )
}

function PeriodSelect({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const tx = useTx()
  return (
    <label className="grid gap-1 text-sm">{tx('Every')}
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as Period)}>
        <option value="week">{tx('week')}</option>
        <option value="month">{tx('month')}</option>
        <option value="year">{tx('year')}</option>
      </select>
    </label>
  )
}
