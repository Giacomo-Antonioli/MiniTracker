import { Fragment, useEffect, useMemo, useState } from 'react'
import { useStore } from '../../app/store'
import { groupUnits, sortGroups, type GroupSort } from '../../domain/collection/groups'
import { unitProgress } from '../../domain/collection/backlog'
import { WISHLISTED } from '../../domain/collection/pipeline'
import { colourStrip } from '../../domain/schemes/scheme'
import type { OwnedUnit, Pipeline } from '../../domain/collection/types'
import { ProgressBar } from '../../ui/Dialog'
import { ColourStrip } from '../schemes/ColourStrip'
import { lifecycleName } from './lifecycle'
import { txr, useTx } from '../../i18n'

const COLUMNS = ['faction', 'models', 'stages', 'painted', 'schemes', 'flags', 'updated'] as const
type Column = (typeof COLUMNS)[number]
const TITLE: Record<Column, () => string> = { faction: () => txr('Faction'), models: () => txr('Models'), stages: () => txr('Stages'), painted: () => txr('Painted'), schemes: () => txr('Schemes'), flags: () => txr('Flags'), updated: () => txr('Updated') }
const SORT: Partial<Record<Column | 'unit', GroupSort>> = { unit: 'name', faction: 'faction', models: 'models', painted: 'painted', updated: 'updated' }

const ago = (iso: string) => {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  return d < 1 ? txr('today') : d < 30 ? txr('{{n}} d', { n: d }) : d < 365 ? txr('{{n}} mo', { n: Math.floor(d / 30) }) : txr('{{n}} y', { n: Math.floor(d / 365) })
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

/** A distinct colour per stage, in pipeline order; Wishlisted is hatched. */
const PALETTE = ['#9aa5b1', '#b07d4f', '#8e6bbf', '#4f86c6', '#d9a441', '#3fa37a', '#c75f8a', '#5bb8c4', '#e07b39', '#7a9c3a']
export function stageColour(p: Pipeline, id: string): string {
  if (id === WISHLISTED) return 'repeating-linear-gradient(45deg, transparent 0 3px, var(--color-muted, #888) 3px 4px)'
  const i = p.stages.filter((s) => s.id !== WISHLISTED).findIndex((s) => s.id === id)
  return PALETTE[Math.max(0, i) % PALETTE.length]
}

/** Bar of every stage's share, with each stage in its own colour. `legend` lists them with counts and percentages. */
export function StageBar({ stages, pipeline, legend = false, wide = false }: { stages: { id: string; name: string; count: number }[]; pipeline: Pipeline; legend?: boolean; wide?: boolean }) {
  const tx = useTx()
  const total = stages.reduce((n, s) => n + s.count, 0)
  const pct = (n: number) => Math.round((100 * n) / Math.max(1, total))
  const text = stages.map((s) => `${s.name} ${s.count}`).join(' · ')
  const hover = stages.map((s) => `${s.name}: ${s.count} (${pct(s.count)}%)`).join('\n')
  return (
    <div className={legend ? 'grid gap-2' : 'flex items-center gap-2'} title={hover} aria-label={tx('Stages: {{list}}', { list: text })}>
      <div className={`flex overflow-hidden rounded border border-line ${wide ? 'h-4 w-full' : 'h-3 w-28 shrink-0'}`}>
        {stages.map((s) => <div key={s.id} style={{ width: `${(100 * s.count) / Math.max(1, total)}%`, background: stageColour(pipeline, s.id) }} />)}
      </div>
      {legend ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {stages.map((s) => (
            <li key={s.id} className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-line" style={{ background: stageColour(pipeline, s.id) }} />{s.name} <b>{s.count}</b> <span className="text-muted">{pct(s.count)}%</span></li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** Backlog as summary rows per datasheet + faction, each expanding into its entries. */
export function BacklogTable({ units, selectedId, onRowClick }: { units: OwnedUnit[]; selectedId: string | null; onRowClick: (id: string, clicks: number) => void }) {
  const tx = useTx()
  const { pipeline, catalogue, schemes, library, paints, loadPaints, loadLibrary } = useStore()
  // Scheme strips need the paint colours (and the bundled schemes) loaded.
  const hasSchemes = units.some((u) => u.schemeId)
  useEffect(() => {
    if (!hasSchemes) return
    if (!paints.length) void loadPaints()
    void loadLibrary()
  }, [hasSchemes, paints.length, loadPaints, loadLibrary])
  const [sort, setSort] = useState<{ by: GroupSort; desc: boolean }>(() => read('backlog.sort', { by: 'name', desc: false }))
  const [hidden, setHidden] = useState<Column[]>(() => read('backlog.hidden', []))
  const [open, setOpen] = useState<string[]>(() => read('backlog.open', []))
  const [picking, setPicking] = useState(false)
  const [openUnits, setOpenUnits] = useState<string[]>([])
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
    <span className="whitespace-nowrap">{u.favourite ? <span title={tx('Favourite')} className="text-accent">★ </span> : null}{u.nextUp ? <span title={tx('Next up')}>⏭ </span> : null}<span className="text-xs text-muted">{extra.join(' · ')}</span></span>
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
    const extra = [u.lifecycle !== 'active' ? lifecycleName(u.lifecycle) : '', u.groups.some((g) => g.magnetised.length) ? '🧲' : '', ...u.tags.map((t) => `#${t}`)].filter(Boolean)
    return (
      <tr
        key={u.id}
        onClick={(e) => onRowClick(u.id, e.detail)}
        title={tx('Double-click to open the unit page')}
        className={`cursor-pointer select-none border-b border-line/50 hover:bg-panel-2 ${u.id === selectedId ? 'bg-panel-2' : ''} ${child ? 'text-sm' : ''}`}
      >
        <td className="p-2">
          <span className={child ? 'pl-6 text-muted' : ''}>{child ? '└ ' : ''}</span>
          {u.groups.length > 1 ? <button
            className="mr-1 inline-block w-4 text-muted"
            aria-label={openUnits.includes(u.id) ? tx('Hide models of {{name}}', { name: u.customName }) : tx('Show models of {{name}}', { name: u.customName })}
            aria-expanded={openUnits.includes(u.id)}
            onClick={(e) => { e.stopPropagation(); setOpenUnits(openUnits.includes(u.id) ? openUnits.filter((x) => x !== u.id) : [...openUnits, u.id]) }}
          >{openUnits.includes(u.id) ? '▾' : '▸'}</button> : <span className="mr-1 inline-block w-4" />}
          {u.customName}
          {u.lifecycle !== 'active' && <span className="text-muted"> ({lifecycleName(u.lifecycle)})</span>}
        </td>
        {show.map((c) => (
          <td key={c} className="p-2">
            {c === 'faction' ? <span className="text-muted">{u.factionName ?? '—'}</span>
              : c === 'models' ? <>{owned}{wish ? <span className="text-muted"> {tx('(+{{n}} wishlisted)', { n: wish })}</span> : null}</>
              : c === 'stages' ? <StageBar stages={stages} pipeline={pipeline} />
              : c === 'painted' ? <div className="flex items-center gap-2"><ProgressBar ratio={p.ratio} /><span className="w-12 text-right text-xs">{p.done}/{p.total}{p.total > 0 && p.done === p.total ? ' ✓' : ''}</span></div>
              : c === 'schemes' ? <span className="flex gap-1">{strips(u.schemeId ? [u.schemeId] : [])}</span>
              : c === 'flags' ? flags(u, extra)
              : <span className="text-muted">{ago(u.updatedAt)}</span>}
          </td>
        ))}
        <td className="whitespace-nowrap p-2 text-right" aria-label={tx('Companion')}>
          <span className="opacity-60 hover:opacity-100">
            <button title={tx('Painter companion')} aria-label={tx('Paint {{name}}', { name: u.customName })} onClick={(e) => { e.stopPropagation(); useStore.getState().openCompanion('paint', u.id) }}>🎨</button>
            <button title={tx('Builder companion')} aria-label={tx('Build {{name}}', { name: u.customName })} onClick={(e) => { e.stopPropagation(); useStore.getState().openCompanion('build', u.id) }}>🔨</button>
          </span>
        </td>
      </tr>
    )
  }
  const groupRows = (u: OwnedUnit, child: boolean) =>
    u.groups.length > 1 && openUnits.includes(u.id)
      ? u.groups.map((g) => {
          const scheme = u.schemeId ? schemeById.get(u.schemeId) : undefined
          return (
            <tr key={g.id} className="border-b border-line/30 text-xs" aria-label={`${g.count} × ${pipeline.stages.find((s) => s.id === g.status)?.name ?? g.status}`}>
              <td className={`p-1 ${child ? 'pl-16' : 'pl-10'}`}>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-line align-middle" style={{ background: stageColour(pipeline, g.status) }} />
                <b>{g.count} ×</b> {pipeline.stages.find((s) => s.id === g.status)?.name ?? g.status}
              </td>
              <td className="p-1 text-muted" colSpan={show.length + 1}>
                {[g.loadout.length ? g.loadout.join(', ') : '', ...g.magnetised.map((m) => `🧲 ${m.slot}: ${m.optionIds.join(' | ')}`), scheme ? tx('Scheme: {{name}}', { name: scheme.name }) : ''].filter(Boolean).join(' · ') || '—'}
              </td>
            </tr>
          )
        })
      : []
  const entry = (u: OwnedUnit, child: boolean) => [entryRow(u, child), ...groupRows(u, child)]

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line p-2 text-sm">
        {multi.length > 0 && <button className="btn px-2 py-0.5" onClick={() => setOpenKeys(allOpen ? [] : multi.map((g) => g.key))}>{allOpen ? tx('Collapse all') : tx('Expand all')}</button>}
        <span className="flex-1" />
        <div className="relative">
          <button className="btn px-2 py-0.5" aria-expanded={picking} onClick={() => setPicking(!picking)}>{tx('Columns')}</button>
          {picking && (
            <div className="panel absolute right-0 z-10 mt-1 flex flex-col p-2" role="group" aria-label={tx('Columns')}>
              {COLUMNS.map((c) => <label key={c} className="flex items-center gap-2 whitespace-nowrap"><input type="checkbox" checked={!hidden.includes(c)} onChange={() => toggleColumn(c)} /> {TITLE[c]()}</label>)}
            </div>
          )}
        </div>
      </div>
      <table className="w-full text-left text-sm" data-tour="backlog-units">
        <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
          <tr>{head('unit', tx('Unit'))}{show.map((c) => head(c, TITLE[c]()))}<th className="p-2"><span className="sr-only">{tx('Companion')}</span></th></tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            if (g.units.length === 1) return <Fragment key={g.key}>{entry(g.units[0], false)}</Fragment>
            const isOpen = open.includes(g.key)
            return (
              <Fragment key={g.key}>
                <tr className="cursor-pointer select-none border-b border-line/50 bg-panel-2/40 hover:bg-panel-2" onClick={() => toggleOpen(g.key)} aria-expanded={isOpen}>
                  <td className="p-2 font-semibold"><span className="mr-1 inline-block w-3">{isOpen ? '▾' : '▸'}</span>{g.name} <span className="text-muted">×{g.units.length}</span></td>
                  {show.map((c) => (
                    <td key={c} className="p-2">
                      {c === 'faction' ? <span className="text-muted">{g.factionName ?? '—'}</span>
                        : c === 'models' ? <>{g.models}{g.wishlisted ? <span className="text-muted"> {tx('(+{{n}} wishlisted)', { n: g.wishlisted })}</span> : null}</>
                        : c === 'stages' ? <StageBar stages={g.stages} pipeline={pipeline} />
                        : c === 'painted' ? <div className="flex items-center gap-2"><ProgressBar ratio={g.painted.ratio} /><span className="w-12 text-right text-xs">{g.painted.done}/{g.painted.total}</span></div>
                        : c === 'schemes' ? <span className="flex gap-1">{g.schemeIds.length === 1 && g.units.every((u) => u.schemeId === g.schemeIds[0]) ? strips(g.schemeIds) : null}</span>
                        : c === 'flags' ? flags(g)
                        : <span className="text-muted">{ago(g.updatedAt)}</span>}
                    </td>
                  ))}
                  <td />
                </tr>
                {isOpen && g.units.map((u) => <Fragment key={u.id}>{entry(u, true)}</Fragment>)}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

/** Phone version of the backlog: one card per entry, sorted by name; tap to open. */
export function BacklogCards({ units, selectedId, onRowClick }: { units: OwnedUnit[]; selectedId: string | null; onRowClick: (id: string, clicks: number) => void }) {
  const tx = useTx()
  const { pipeline } = useStore()
  const sorted = [...units].sort((a, b) => a.customName.localeCompare(b.customName))
  return (
    <ul className="grid gap-2" aria-label={tx('Units')} data-tour="backlog-units">
      {sorted.map((u) => {
        const p = unitProgress(u, pipeline)
        const owned = u.groups.filter((g) => g.status !== WISHLISTED).reduce((n, g) => n + g.count, 0)
        const stages = pipeline.stages.map((s) => ({ id: s.id, name: s.name, count: u.groups.filter((g) => g.status === s.id).reduce((n, g) => n + g.count, 0) })).filter((s) => s.count)
        return (
          <li key={u.id}>
            <button className={`panel grid w-full gap-1 p-3 text-left ${u.id === selectedId ? 'border-accent' : ''}`} onClick={() => onRowClick(u.id, 1)} aria-label={u.customName}>
              <span className="flex items-baseline gap-2">
                <span className="flex-1 font-semibold">{u.favourite ? <span className="text-accent">★ </span> : null}{u.nextUp ? '⏭ ' : null}{u.customName}</span>
                <span className="text-xs text-muted">{tx('{{n}} models · {{pct}}%', { n: owned, pct: Math.round(p.ratio * 100) })}</span>
              </span>
              {u.factionName && <span className="text-xs text-muted">{u.factionName}</span>}
              {stages.length > 0 && <StageBar stages={stages} pipeline={pipeline} />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
