import { useEffect, useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { setFlags } from '../../domain/collection/pipeline'
import type { ModelGroup, OwnedUnit } from '../../domain/collection/types'
import { MoveDialog } from './MoveDialog'

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })

export function UnitPanel({ unit, onEdit, onClose }: { unit: OwnedUnit; onEdit: () => void; onClose: () => void }) {
  const { pipeline, events, loadEvents, saveUnit, deleteUnit } = useStore()
  const [moving, setMoving] = useState<ModelGroup | null>(null)
  const stageName = (id: string) => pipeline.stages.find((s) => s.id === id)?.name ?? id
  const history = [...(events[unit.id] ?? [])].reverse()

  useEffect(() => {
    void loadEvents(unit.id)
  }, [unit.id, loadEvents])

  const toggle = (flag: 'favourite' | 'nextUp') => saveUnit(setFlags(unit, { [flag]: !unit[flag] }, ctx()))

  return (
    <aside className="panel flex h-full w-[420px] shrink-0 flex-col overflow-y-auto" aria-label="Unit details">
      <header className="border-b border-line p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-xl text-accent">{unit.customName}</h2>
          <div className="flex gap-1">
            <button className="btn" aria-pressed={unit.favourite} title="Favourite" onClick={() => toggle('favourite')}>{unit.favourite ? '★' : '☆'}</button>
            <button className="btn" aria-pressed={unit.nextUp} title="Next up" onClick={() => toggle('nextUp')}>{unit.nextUp ? '⏭' : '⏵'}</button>
            <button className="btn" aria-label="Close details" onClick={onClose}>✕</button>
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">
          {unit.factionName ?? 'No faction'} · {unit.lifecycle}
        </p>
        <div className="mt-3 flex gap-2">
          <button className="btn" onClick={onEdit}>Edit</button>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm(`Delete "${unit.customName}" and its history?`)) void deleteUnit(unit.id).then(onClose)
            }}
          >
            Delete
          </button>
        </div>
      </header>

      <section className="border-b border-line p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Models</h3>
        <ul className="grid gap-2">
          {unit.groups.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2">
              <div>
                <b>{g.count} ×</b> {stageName(g.status)}
                {g.loadout.length > 0 && <span className="text-muted"> · {g.loadout.join(', ')}</span>}
                {g.magnetised.map((m) => (
                  <div key={m.slot} className="text-xs text-muted">🧲 {m.slot}: {m.optionIds.join(' | ')}</div>
                ))}
              </div>
              <button className="btn" onClick={() => setMoving(g)}>Move…</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-b border-line p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">History</h3>
        {history.length === 0 && <p className="text-sm text-muted">No changes yet.</p>}
        <ol className="grid gap-3">
          {history.map((e) => (
            <li key={e.id} className="grid grid-cols-[90px_1fr] gap-2 text-sm">
              <span className="text-muted">{fmt(e.date)}</span>
              <div>
                {e.count} models {stageName(e.from)} {e.direction === 'forward' ? '→' : '↩'} {stageName(e.to)}
                {e.note && <p className="text-muted italic">“{e.note}”</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {unit.tutorials.length > 0 && (
        <section className="border-b border-line p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Tutorials</h3>
          <ul className="grid gap-1">
            {unit.tutorials.map((t, i) => (
              <li key={i}>
                <a className="text-accent underline" href={t.url} target="_blank" rel="noreferrer">{t.title || t.url}</a>
                <span className="text-xs text-muted"> · {t.kind}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(unit.notes || unit.tags.length > 0) && (
        <section className="p-4">
          {unit.notes && <p className="whitespace-pre-wrap text-sm">{unit.notes}</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            {unit.tags.map((t) => <span key={t} className="rounded bg-panel-2 px-2 py-0.5 text-xs">{t}</span>)}
          </div>
        </section>
      )}

      {moving && <MoveDialog unit={unit} group={moving} onClose={() => setMoving(null)} />}
    </aside>
  )
}
