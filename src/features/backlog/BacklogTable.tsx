import { Fragment, useMemo, useState } from 'react'
import { useStore } from '../../app/store'
import { groupUnits, sortGroups, type GroupSort, type UnitGroup } from '../../domain/collection/groups'
import { unitProgress } from '../../domain/collection/backlog'
import { WISHLISTED } from '../../domain/collection/pipeline'
import { colourStrip } from '../../domain/schemes/scheme'
import type { OwnedUnit, Pipeline } from '../../domain/collection/types'
import { ProgressBar } from '../../ui/Dialog'
import { ColourStrip } from '../schemes/ColourStrip'

const COLUMNS = ['faction', 'models', 'stages', 'painted', 'schemes', 'flags', 'updated'] as const
type Column = (typeof COLUMNS)[number]
const TITLE: Record<Column, string> = { faction: 'Faction', models: 'Models', stages: 'Stages', painted: 'Painted', schemes: 'Schemes', flags: 'Flags', updated: 'Updated' }
const SORT: Partial<Record<Column | 'unit', GroupSort>> = { unit: 'name', faction: 'faction', models: 'models', painted: 'painted', updated: 'updated' }

const ago = (iso: string) => {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  return d < 1 ? 'today' : d < 30 ? `${d} d` : d < 365 ? `${Math.floor(d / 30)} mo` : `${Math.floor(d / 365)} y`
}
const read = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : d
  } catch {
    return d
  }
}
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* private mode: not remembered */
  }
}

/** Shades from light (early stages) to the accent (last stage). */
const shade = (p: Pipeline, id: string) => {
  if (id === WISHLISTED) return 'transparent'
  const i = p.stages.findIndex((s) => s.id === id)
  return `color-mix(in srgb, var(--color-accent) ${Math.round(15 + (85 * i) / Math.max(1, p.stages.length - 1))}%, transparent)`
}

function StageBar({ stages, pipeline }: { stages: UnitGroup['stages']; pipeline: Pipeline }) {
  const total = stages.reduce((n, s) => n + s.count, 0)
  const text = stages.map((s) => `${s.name} ${s.count}`).join(' · ')
  return (
    <div className="flex items-center gap-2" title={text} aria-label={`Stages: ${text}`}>
      <div className="flex h-3 w-28 overflow-hidden rounded border border-line">
        {stages.map((s) => <div key={s.id} style={{ width: `${(100 * s.count) / Math.max(1, total)}%`, background: shade(pipeline, s.id) }} className={s.id === WISHLISTED ? 'border-r border-dashed border-line' : ''} />)}
      </div>
      <span className="whitespace-nowrap text-xs text-muted">{stages.map((s) => `${s.name} ${Math.round((100 * s.count) / Math.max(1, total))}%`).join(' · ')}</span>
    </div>
  )
}

/** Backlog as summary rows per datasheet + faction, each expanding into its entries. */
export function BacklogTable({ units, selectedId, onRowClick }: { units: OwnedUnit[]; selectedId: string | null; onRowClick: (id: string, clicks: number) => void }) {
  const { pipeline, catalogue, schemes, library, paints } = useStore()
  const [sort, setSort] = useState<{ by: GroupSort; desc: boolean }>(() => read('backlog.sort', { by: 'name', desc: false }))
  const [hidden, setHidden] = useState<Column[]>(() => read('backlog.hidden', []))
  const [open, setOpen] = useState<string[]>(() => read('backlog.open', []))
  const [picking, setPicking] = useState(false)
  const show = COLUMNS.filter((c) => !hidden.includes(c))
  const names = useMemo(() => new Map(catalogue?.datasheets.map((d) => [d.id, d.name]) ?? []), [catalogue])
  const groups = useMemo(() => sortGroups(groupUnits(units, pipeline, (id) => names.get(id)), sort.by, sort.desc), [units, pipeline, names, sort])
  const schemeById = useMemo(() => new Map([...schemes, ...library].map((s) => [s.id, s])), [schemes, library])
  const multi = groups.filter((g) => g.units.length > 1)
  const allOpen = multi.length > 0 && multi.every((g) => open.includes(g.key))

  const setOpenKeys = (keys: string[]) => {
    setOpen(keys)
    write('backlog.open', keys)
  }
  const toggleOpen = (k: string) => setOpenKeys(open.includes(k) ? open.filter((x) => x !== k) : [...open, k])
  const sortBy = (by: GroupSort) => {
    const s = { by, desc: sort.by === by ? !sort.desc : false }
    setSort(s)
    write('backlog.sort', s)
  }
  const toggleColumn = (c: Column) => {
    const h = hidden.includes(c) ? hidden.filter((x) => x !== c) : [...hidden, c]
    setHidden(h)
    write('backlog.hidden', h)
  }
  const strips = (ids: string[]) =>
    ids.map((id) => schemeById.get(id)).filter((s) => !!s).map((s) => (
      <span key={s.id} className="inline-flex w-16 flex-col" title={s.name}><ColourStrip colours={colourStrip(s, paints)} height="h-2" /></span>
    ))
  const flags = (u: { favourite?: boolean; nextUp?: boolean }, extra: string[] = []) => (
    <span className="whitespace-nowrap">{u.favourite ? <span title="Favourite" className="text-accent">★ </span> : null}{u.nextUp ? <span title="Next up">⏭ </span> : null}<span className="text-xs text-muted">{extra.join(' · ')}</span></span>
  )
  const head = (key: Column | 'unit', title: string) => {
    const by = SORT[key]
    return (
      <th key={key} className="p-2" aria-sort={by && sort.by === by ? (sort.desc ? 'descending' : 'ascending') : undefined}>
        {by ? <button className="uppercase" onClick={() => sortBy(by)}>{title}{sort.by === by ? (sort.desc ? ' ▼' : ' ▲') : ''}</button> : title}
      </th>
    )
  }

  const entryRow = (u: OwnedUnit, child: boolean) => {
    const p = unitProgress(u, pipeline)
    const owned = u.groups.filter((g) => g.status !== WISHLISTED).reduce((n, g) => n + g.count, 0)
    const wish = u.groups.filter((g) => g.status === WISHLISTED).reduce((n, g) => n + g.count, 0)
    const stages = pipeline.stages.map((s) => ({ id: s.id, name: s.name, count: u.groups.filter((g) => g.status === s.id).reduce((n, g) => n + g.count, 0) })).filter((s) => s.count)
    const extra = [u.lifecycle !== 'active' ? u.lifecycle : '', u.groups.some((g) => g.magnetised.length) ? '🧲' : '', ...u.tags.map((t) => `#${t}`)].filter(Boolean)
    return (
      <tr
        key={u.id}
        onClick={(e) => onRowClick(u.id, e.detail)}
        title="Double-click to open the unit page"
        className={`cursor-pointer select-none border-b border-line/50 hover:bg-panel-2 ${u.id === selectedId ? 'bg-panel-2' : ''} ${child ? 'text-sm' : ''}`}
      >
        <td className="p-2">
          <span className={child ? 'pl-6 text-muted' : ''}>{child ? '└ ' : ''}</span>
          {u.customName}
          {u.lifecycle !== 'active' && <span className="text-muted"> ({u.lifecycle})</span>}
        </td>
        {show.map((c) => (
          <td key={c} className="p-2">
            {c === 'faction' ? <span className="text-muted">{u.factionName ?? '—'}</span>
              : c === 'models' ? <>{owned}{wish ? <span className="text-muted"> (+{wish} wishlisted)</span> : null}</>
              : c === 'stages' ? <StageBar stages={stages} pipeline={pipeline} />
              : c === 'painted' ? <div className="flex items-center gap-2"><ProgressBar ratio={p.ratio} /><span className="w-12 text-right text-xs">{p.done}/{p.total}{p.total > 0 && p.done === p.total ? ' ✓' : ''}</span></div>
              : c === 'schemes' ? <span className="flex gap-1">{strips(u.schemeId ? [u.schemeId] : [])}</span>
              : c === 'flags' ? flags(u, extra)
              : <span className="text-muted">{ago(u.updatedAt)}</span>}
          </td>
        ))}
      </tr>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line p-2 text-sm">
        {multi.length > 0 && <button className="btn px-2 py-0.5" onClick={() => setOpenKeys(allOpen ? [] : multi.map((g) => g.key))}>{allOpen ? 'Collapse all' : 'Expand all'}</button>}
        <span className="flex-1" />
        <div className="relative">
          <button className="btn px-2 py-0.5" aria-expanded={picking} onClick={() => setPicking(!picking)}>Columns</button>
          {picking && (
            <div className="panel absolute right-0 z-10 mt-1 flex flex-col p-2" role="group" aria-label="Columns">
              {COLUMNS.map((c) => <label key={c} className="flex items-center gap-2 whitespace-nowrap"><input type="checkbox" checked={!hidden.includes(c)} onChange={() => toggleColumn(c)} /> {TITLE[c]}</label>)}
            </div>
          )}
        </div>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
          <tr>{head('unit', 'Unit')}{show.map((c) => head(c, TITLE[c]))}</tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            if (g.units.length === 1) return entryRow(g.units[0], false)
            const isOpen = open.includes(g.key)
            return (
              <Fragment key={g.key}>
                <tr className="cursor-pointer select-none border-b border-line/50 bg-panel-2/40 hover:bg-panel-2" onClick={() => toggleOpen(g.key)} aria-expanded={isOpen}>
                  <td className="p-2 font-semibold"><span className="mr-1 inline-block w-3">{isOpen ? '▾' : '▸'}</span>{g.name} <span className="text-muted">×{g.units.length}</span></td>
                  {show.map((c) => (
                    <td key={c} className="p-2">
                      {c === 'faction' ? <span className="text-muted">{g.factionName ?? '—'}</span>
                        : c === 'models' ? <>{g.models}{g.wishlisted ? <span className="text-muted"> (+{g.wishlisted} wishlisted)</span> : null}</>
                        : c === 'stages' ? <StageBar stages={g.stages} pipeline={pipeline} />
                        : c === 'painted' ? <div className="flex items-center gap-2"><ProgressBar ratio={g.painted.ratio} /><span className="w-12 text-right text-xs">{g.painted.done}/{g.painted.total}</span></div>
                        : c === 'schemes' ? <span className="flex gap-1">{strips(g.schemeIds)}</span>
                        : c === 'flags' ? flags(g)
                        : <span className="text-muted">{ago(g.updatedAt)}</span>}
                    </td>
                  ))}
                </tr>
                {isOpen && g.units.map((u) => entryRow(u, true))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
