import { useEffect, useMemo, useRef, useState } from 'react'
import { ScanBoxButton } from '../barcodes/BoxScan'
import { useStore } from '../../app/store'
import { factionsOf, filterUnits, stageTotals, type BacklogFilter } from '../../domain/collection/backlog'
import { isGone, progress, WISHLISTED } from '../../domain/collection/pipeline'
import type { OwnedUnit } from '../../domain/collection/types'
import { CatalogueBanner } from './CatalogueBanner'
import { UnitFormDialog } from './UnitFormDialog'
import { UnitPanel } from './UnitPanel'
import { BacklogTable, StageBar } from './BacklogTable'
import { BacklogBoard } from './BacklogBoard'
import { MassMoveDialog } from '../storage/MassMove'

/** How long a single click waits for a possible second click. */
const DOUBLE_CLICK_MS = 250

export function BacklogPage({ onOpenUnit, onOpenDatasheet, onOpenScheme }: { onOpenUnit?: (id: string) => void; onOpenDatasheet?: (id: string) => void; onOpenScheme?: (id: string) => void }) {
  const { units, pipeline, backlogFilter: filter, setBacklogFilter: setFilter } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<OwnedUnit | 'new' | null>(null)
  const [storing, setStoring] = useState(false)
  const hasPlaces = useStore((s) => s.storage.places.length > 0)
  // Table or board; remembered per browser (storage can be blocked, so it is only a convenience).
  const [view, setView] = useState<'table' | 'board'>(() => {
    try {
      return localStorage.getItem('backlogView') === 'board' ? 'board' : 'table'
    } catch {
      return 'table'
    }
  })
  const chooseView = (v: 'table' | 'board') => {
    setView(v)
    try {
      localStorage.setItem('backlogView', v)
    } catch {
      /* not saved */
    }
  }

  const shown = useMemo(() => filterUnits(units, filter), [units, filter])
  const factions = useMemo(() => factionsOf(units), [units])
  const total = progress(units, pipeline, 'painted')
  const live = units.filter((u) => !isGone(u.lifecycle))
  const stats = stageTotals(units, pipeline).map((s) => ({ id: s.stage.id, name: s.stage.name, count: s.count }))
  const wished = stats.find((s) => s.id === WISHLISTED)?.count ?? 0
  const owned = stats.reduce((n, s) => n + s.count, 0) - wished
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
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl text-accent">Backlog</h1>
            <div role="tablist" aria-label="Backlog view" className="flex gap-1">
              {(['table', 'board'] as const).map((v) => (
                <button key={v} role="tab" aria-selected={view === v} className={`btn text-sm ${view === v ? 'btn-primary' : ''}`} onClick={() => chooseView(v)}>
                  {v === 'table' ? '☰ Table' : '▦ Board'}
                </button>
              ))}
            </div>
          </div>
          <ScanBoxButton onOpenUnit={onOpenUnit} />
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Add unit</button>
        </header>

        <CatalogueBanner />

        <section className="panel grid gap-3 p-4" aria-label="Summary">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Units', live.length],
              ['Models owned', owned],
              ['Wishlisted', wished],
              ['Painted', `${Math.round(total.ratio * 100)}%`],
            ].map(([k, v]) => (
              <div key={k} className="rounded border border-line p-2"><div className="text-xs uppercase tracking-wider text-muted">{k}</div><div className="font-display text-xl text-accent">{v}</div></div>
            ))}
          </div>
          {stats.length ? <StageBar stages={stats} pipeline={pipeline} legend wide /> : <p className="text-sm text-muted">No models yet</p>}
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
          {hasPlaces && shown.length > 0 && <button className="btn ml-auto text-sm" onClick={() => setStoring(true)}>📦 Store shown units… ({shown.length})</button>}
        </section>
        {storing && <MassMoveDialog title="Store the shown units" unitIds={shown.filter((u) => u.lifecycle === 'active' || u.lifecycle === 'on-hold').map((u) => u.id)} onClose={() => setStoring(false)} />}

        {view === 'board' ? (
          <BacklogBoard units={shown} selectedId={selectedId} onCardClick={onRowClick} />
        ) : (
        <div className="panel overflow-auto">
          <BacklogTable units={shown} selectedId={selectedId} onRowClick={onRowClick} />
          {shown.length === 0 && (
            <p className="p-6 text-center text-muted">
              {units.length === 0 ? 'Your backlog is empty. Add your first unit!' : 'No units match these filters.'}
            </p>
          )}
        </div>
        )}
      </div>

      {selected && (
        <UnitPanel
          unit={selected}
          onEdit={() => setEditing(selected)}
          onClose={() => setSelectedId(null)}
          onOpenPage={onOpenUnit && (() => onOpenUnit(selected.id))}
          onOpenDatasheet={onOpenDatasheet}
          onOpenScheme={onOpenScheme}
        />
      )}
      {editing && <UnitFormDialog unit={editing === 'new' ? undefined : editing} factions={factions} onClose={() => setEditing(null)} />}
    </div>
  )
}
