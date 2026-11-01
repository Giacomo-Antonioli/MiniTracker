import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../app/store'
import { factionsOf, filterUnits, stageTotals, unitProgress, type BacklogFilter } from '../../domain/collection/backlog'
import { progress } from '../../domain/collection/pipeline'
import type { OwnedUnit } from '../../domain/collection/types'
import { ProgressBar } from '../../ui/Dialog'
import { CatalogueBanner } from './CatalogueBanner'
import { UnitFormDialog } from './UnitFormDialog'
import { UnitPanel } from './UnitPanel'

/** How long a single click waits for a possible second click. */
const DOUBLE_CLICK_MS = 250

const ago = (iso: string) => {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  return d < 1 ? 'today' : d < 30 ? `${d} d` : d < 365 ? `${Math.floor(d / 30)} mo` : `${Math.floor(d / 365)} y`
}

export function BacklogPage({ onOpenUnit, onOpenDatasheet }: { onOpenUnit?: (id: string) => void; onOpenDatasheet?: (id: string) => void }) {
  const { units, pipeline, backlogFilter: filter, setBacklogFilter: setFilter } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<OwnedUnit | 'new' | null>(null)

  const shown = useMemo(() => filterUnits(units, filter), [units, filter])
  const factions = useMemo(() => factionsOf(units), [units])
  const total = progress(units, pipeline, 'painted')
  const selected = units.find((u) => u.id === selectedId)
  const set = (patch: Partial<BacklogFilter>) => setFilter({ ...filter, ...patch })
  // Single click opens the side panel, double-click opens the unit page. Opening the panel reflows the
  // list (filters wrap, rows move), so it waits briefly: a second click in that time is a double-click,
  // and nothing has moved under the cursor yet.
  const pending = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(pending.current), [])
  const onRowClick = (id: string, clicks: number) => {
    window.clearTimeout(pending.current)
    if (clicks >= 2 && onOpenUnit) return onOpenUnit(id)
    pending.current = window.setTimeout(() => setSelectedId(id), onOpenUnit ? DOUBLE_CLICK_MS : 0)
  }

  return (
    <div className="flex h-full gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-accent">Backlog</h1>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Add unit</button>
        </header>

        <CatalogueBanner />

        <section className="panel grid gap-2 p-4" aria-label="Summary">
          <div className="flex items-baseline justify-between">
            <span>Painted <b>{total.done}</b> / {total.total} models</span>
            <span className="font-display text-xl text-accent">{Math.round(total.ratio * 100)}%</span>
          </div>
          <ProgressBar ratio={total.ratio} />
          <p className="text-sm text-muted">
            {stageTotals(units, pipeline).map((s) => `${s.stage.name} ${s.count}`).join(' · ') || 'No models yet'}
          </p>
        </section>

        <section className="flex flex-wrap items-center gap-2" aria-label="Filters">
          <input className="input w-56" placeholder="🔍 Search name, faction, tag" value={filter.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
          <select className="input" aria-label="Faction" value={filter.faction ?? ''} onChange={(e) => set({ faction: e.target.value || undefined })}>
            <option value="">All factions</option>
            {factions.map((f) => <option key={f}>{f}</option>)}
          </select>
          <select className="input" aria-label="Stage" value={filter.stage ?? ''} onChange={(e) => set({ stage: e.target.value || undefined })}>
            <option value="">All stages</option>
            {pipeline.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input" aria-label="State" value={filter.lifecycle ?? 'current'} onChange={(e) => set({ lifecycle: e.target.value as BacklogFilter['lifecycle'] })}>
            <option value="current">Active + on hold</option>
            <option value="all">All states</option>
            {['active', 'on-hold', 'sold', 'traded', 'gifted', 'lost'].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={!!filter.nextUpOnly} onChange={(e) => set({ nextUpOnly: e.target.checked })} /> Next up</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={!!filter.favouritesOnly} onChange={(e) => set({ favouritesOnly: e.target.checked })} /> Favourites</label>
        </section>

        <div className="panel overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="w-8 p-2" aria-label="Favourite" />
                <th className="p-2">Unit</th>
                <th className="p-2">Faction</th>
                <th className="w-48 p-2">Painted</th>
                <th className="p-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => {
                const p = unitProgress(u, pipeline)
                return (
                  <tr
                    key={u.id}
                    onClick={(e) => onRowClick(u.id, e.detail)}
                    title="Double-click to open the unit page"
                    className={`cursor-pointer select-none border-b border-line/50 hover:bg-panel-2 ${u.id === selectedId ? 'bg-panel-2' : ''}`}
                  >
                    <td className="p-2 text-accent">{u.favourite ? '★' : ''}</td>
                    <td className="p-2">
                      {u.customName} {u.nextUp && <span title="Next up">⏭</span>}
                      {u.lifecycle !== 'active' && <span className="text-muted"> ({u.lifecycle})</span>}
                    </td>
                    <td className="p-2 text-muted">{u.factionName ?? '—'}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <ProgressBar ratio={p.ratio} />
                        <span className="w-12 text-right text-xs">{p.done}/{p.total}{p.total > 0 && p.done === p.total ? ' ✓' : ''}</span>
                      </div>
                    </td>
                    <td className="p-2 text-muted">{ago(u.updatedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {shown.length === 0 && (
            <p className="p-6 text-center text-muted">
              {units.length === 0 ? 'Your backlog is empty. Add your first unit!' : 'No units match these filters.'}
            </p>
          )}
        </div>
      </div>

      {selected && (
        <UnitPanel
          unit={selected}
          onEdit={() => setEditing(selected)}
          onClose={() => setSelectedId(null)}
          onOpenPage={onOpenUnit && (() => onOpenUnit(selected.id))}
          onOpenDatasheet={onOpenDatasheet}
        />
      )}
      {editing && <UnitFormDialog unit={editing === 'new' ? undefined : editing} factions={factions} onClose={() => setEditing(null)} />}
    </div>
  )
}
