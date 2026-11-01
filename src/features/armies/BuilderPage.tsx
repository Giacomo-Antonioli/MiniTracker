import { useEffect, useMemo, useState } from 'react'
import { catalogueFor, ctx, useStore } from '../../app/store'
import { EDITIONS } from '../../data/catalogue/fetch'
import { ownedByDatasheet } from '../../domain/catalogue/owned'
import type { Catalogue, Datasheet } from '../../domain/catalogue/types'
import { removeEntry, updateEntry } from '../../domain/lists/list'
import { listOwnership } from '../../domain/lists/ownership'
import { listPoints } from '../../domain/lists/points'
import { buyList, buyListText } from '../../domain/lists/buy'
import { addFromCollection, collectionPlan } from '../../domain/lists/collection'
import { totalModels } from '../../domain/collection/ownedUnit'
import { isGone, setFlags } from '../../domain/collection/pipeline'
import { BuyListSheet } from './BuyListSheet'
import { listToJson, listToText } from '../../domain/lists/io'
import { evalLimit } from '../../domain/lists/conditions'
import { addUnit, battleSizes, canLead, checkList, enhancementAllowed, legalUnits, listCounter } from '../../domain/lists/rules'
import type { ArmyList, ListEntry, ListStatus } from '../../domain/lists/types'

const ROLE_ORDER = ['Epic Hero', 'Character', 'Battleline']
const roleRank = (r: string) => (ROLE_ORDER.includes(r) ? ROLE_ORDER.indexOf(r) : ROLE_ORDER.length)
const roleOf = (d: Datasheet) => (d.keywords.includes('Epic Hero') ? 'Epic Hero' : (d.role ?? 'Other'))

export function BuilderPage({ listId, onBack, onOpenSettings }: { listId: string; onBack: () => void; onOpenSettings: () => void }) {
  const { lists, catalogues, saveList, deleteList, downloadCatalogue, catalogueJob } = useStore()
  const list = lists.find((l) => l.id === listId)
  if (!list) {
    return (
      <div className="grid gap-3">
        <p className="text-muted">This list no longer exists.</p>
        <button className="btn w-fit" onClick={onBack}>← Armies</button>
      </div>
    )
  }
  const cat = catalogueFor(catalogues, list.edition)
  const edition = EDITIONS.find((e) => e.key === list.edition)!
  const save = (l: ArmyList) => void saveList(l)

  return (
    <div className="grid gap-3">
      <Header list={list} cat={cat} onBack={onBack} onSave={save} onDelete={() => {
        if (!confirm(`Delete “${list.name}”?`)) return
        void deleteList(list.id)
        onBack()
      }} />
      {!cat ? (
        <section className="panel grid gap-2 p-3" aria-label="Catalogue missing">
          <p>The {edition.label} catalogue is not installed. Install it to edit this list.</p>
          <button className="btn btn-primary w-fit" onClick={onOpenSettings}>Go to Settings → Catalogue data</button>
        </section>
      ) : (
        <>
          {!cat.muster && (
            <section className="panel flex flex-wrap items-center gap-3 border-accent/60 p-3" aria-label="Rule checks unavailable">
              <p className="min-w-0 flex-1 text-sm">Your {edition.label} catalogue was downloaded before rule checks existed. Download it again to check this list.</p>
              <button className="btn btn-primary" disabled={catalogueJob.phase !== 'idle'} onClick={() => void downloadCatalogue(cat.source.repo)}>
                {catalogueJob.phase === 'idle' ? '⬇ Download again' : 'Downloading…'}
              </button>
            </section>
          )}
          <Builder list={list} cat={cat} onSave={save} />
        </>
      )}
    </div>
  )
}

function Header({ list, cat, onBack, onSave, onDelete }: { list: ArmyList; cat?: Catalogue; onBack: () => void; onSave: (l: ArmyList) => void; onDelete: () => void }) {
  const sizes = cat ? battleSizes(cat) : []
  const points = useMemo(
    () => listPoints(list, new Map((cat?.datasheets ?? []).map((d) => [d.id, d])), new Map((cat?.enhancements ?? []).map((x) => [x.id, x]))).total,
    [list, cat],
  )
  const set = (patch: Partial<ArmyList>) => onSave({ ...list, ...patch, updatedAt: new Date().toISOString() })
  const factionLocked = list.entries.length > 0
  const [name, setName] = useState(list.name)

  return (
    <header className="flex flex-wrap items-center gap-2">
      <button className="btn" onClick={onBack}>← Armies</button>
      <input
        className="input w-48 font-semibold"
        aria-label="List name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => (name.trim() ? name !== list.name && set({ name: name.trim() }) : setName(list.name))}
      />
      <select
        className="input"
        aria-label="Faction"
        value={list.factionId ?? ''}
        disabled={!cat || factionLocked}
        title={factionLocked ? 'Remove all units to change faction' : undefined}
        onChange={(e) => {
          if (e.target.value) return set({ factionId: e.target.value })
          const { factionId: _, ...rest } = list
          onSave({ ...rest, updatedAt: new Date().toISOString() })
        }}
      >
        <option value="">Faction: set by the first unit</option>
        {cat?.factions.map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
      <span className="text-sm text-muted">{EDITIONS.find((e) => e.key === list.edition)?.label}</span>
      <select
        className="input"
        aria-label="Battle size"
        value={list.battleSize}
        disabled={!cat}
        onChange={(e) => {
          const b = sizes.find((x) => x.id === e.target.value)!
          set({ battleSize: b.id, pointsLimit: b.pointsLimit })
        }}
      >
        {!sizes.some((b) => b.id === list.battleSize) && <option value={list.battleSize}>Unknown battle size</option>}
        {sizes.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-sm">
        <span className={points > list.pointsLimit ? 'text-danger' : ''}>{points}</span> /
        <input
          className="input w-20"
          type="number"
          min={0}
          step={50}
          aria-label="Points limit"
          value={list.pointsLimit}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (Number.isInteger(v) && v >= 0) set({ pointsLimit: v })
          }}
        />
        pts
      </label>
      <select className="input" aria-label="Status" value={list.status} onChange={(e) => set({ status: e.target.value as ListStatus })}>
        <option value="planned">Planned</option>
        <option value="playable">Playable</option>
      </select>
      <ExportMenu list={list} cat={cat} />
      <button className="btn btn-danger ml-auto" onClick={onDelete}>Delete list</button>
    </header>
  )
}

function Builder({ list, cat, onSave }: { list: ArmyList; cat: Catalogue; onSave: (l: ArmyList) => void }) {
  const { units, pipeline } = useStore()
  const [highlight, setHighlight] = useState<string[]>([])
  const [choose, setChoose] = useState<Datasheet | null>(null)
  const [dropping, setDropping] = useState(false)
  const [panelWidth, setPanelWidth] = usePanelWidth()
  const add = (d: Datasheet, factionId?: string) => {
    if (!list.factionId && !factionId && d.factionIds.length > 1) return setChoose(d)
    setChoose(null)
    onSave(addUnit(list, d, d.minModels, ctx(), factionId))
  }
  const sheets = useMemo(() => new Map(cat.datasheets.map((d) => [d.id, d])), [cat])
  const enhancements = useMemo(() => new Map((cat.enhancements ?? []).map((x) => [x.id, x])), [cat])
  const points = useMemo(() => listPoints(list, sheets, enhancements), [list, sheets, enhancements])
  const offered = (cat.enhancements ?? []).filter((x) => list.detachmentIds?.includes(x.detachmentId))
  const own = useMemo(() => listOwnership(list, units, pipeline), [list, units, pipeline])
  const linkedElsewhere = (entryId: string) => new Set(list.entries.filter((x) => x.id !== entryId && x.ownedUnitId).map((x) => x.ownedUnitId))
  const issues = useMemo(() => (cat.muster ? checkList(list, cat) : []), [list, cat])
  const flagged = new Set(issues.flatMap((i) => i.entryIds))

  const edit = (id: string, patch: Partial<Omit<ListEntry, 'id'>>) => onSave(updateEntry(list, id, patch, ctx()))
  const setWarlord = (id: string) => onSave({ ...list, entries: list.entries.map((e) => ({ ...e, warlord: e.id === id ? !e.warlord : e.warlord })), updatedAt: ctx().now })
  const leadable = list.entries.filter((e) => !sheets.get(e.datasheetId)?.keywords.includes('Character'))
  // With leader data (catalogue format 6) a Leader is offered only the units it can lead; older catalogues offer all.
  const hasLeaderData = cat.datasheets.some((d) => d.leads)
  const targetsFor = (e: ListEntry) => {
    const d = sheets.get(e.datasheetId)
    return leadable.filter((t) => {
      const td = sheets.get(t.datasheetId)
      return t.id === e.attachedTo || !hasLeaderData || (d && td && canLead(d, td))
    })
  }

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[var(--add-w)_auto_minmax(0,1fr)] lg:gap-0" style={{ '--add-w': `${panelWidth}px` } as React.CSSProperties}>
      <AddPanel list={list} cat={cat} onAdd={add} choose={choose} onCancelChoose={() => setChoose(null)} onSave={onSave} />
      <ResizeHandle width={panelWidth} onChange={setPanelWidth} />
      {/* The whole column takes drops, down to the bottom of the screen, not just the list box. */}
      <div
        className="grid min-h-[calc(100vh-8rem)] content-start gap-3"
        data-testid="drop-zone"
        onDragOver={(ev) => {
          if (!ev.dataTransfer.types.includes(DRAG_TYPE)) return
          ev.preventDefault()
          setDropping(true)
        }}
        onDragLeave={(ev) => {
          if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) setDropping(false)
        }}
        onDrop={(ev) => {
          setDropping(false)
          const d = sheets.get(ev.dataTransfer.getData(DRAG_TYPE))
          if (!d) return
          ev.preventDefault()
          add(d)
        }}
      >
        {cat.detachments && <DetachmentBar list={list} cat={cat} onSave={onSave} />}
        <section className={`panel grid gap-1 p-3 ${dropping ? 'border-accent' : ''}`} aria-label="List">
          {list.entries.length === 0 && <p className="text-muted">No units yet. Add them from the left: +, double-click, or drag them here.</p>}
          {list.entries.map((e) => {
            const d = sheets.get(e.datasheetId)
            const o = own.byEntry.get(e.id)!
            const pts = points.byEntry.get(e.id)
            const isChar = d?.keywords.includes('Character')
            return (
              <div
                key={e.id}
                data-testid="entry"
                className={`flex flex-wrap items-center gap-2 rounded px-2 py-1 ${highlight.includes(e.id) ? 'bg-accent/20' : flagged.has(e.id) ? 'bg-danger/10' : ''}`}
              >
                <button className={`w-6 ${e.warlord ? 'text-accent' : 'text-muted/50'}`} aria-label={`Warlord: ${d?.name ?? 'unit'}`} aria-pressed={!!e.warlord} onClick={() => setWarlord(e.id)} title="Warlord">
                  ★
                </button>
                <span className="min-w-0 flex-1 truncate">{d?.name ?? 'Unknown unit'}</span>
                {isChar && !d?.keywords.includes('Epic Hero') && cat.detachments && (offered.length > 0 || e.enhancementId) && (
                  <select
                    className="input py-0.5 text-xs"
                    aria-label={`${d?.name} enhancement`}
                    value={e.enhancementId ?? ''}
                    onChange={(ev) => edit(e.id, { enhancementId: ev.target.value || undefined })}
                  >
                    <option value="">Enhancement: none</option>
                    {e.enhancementId && !offered.some((x) => x.id === e.enhancementId) && (
                      <option value={e.enhancementId}>{enhancements.get(e.enhancementId)?.name ?? 'Unknown enhancement'} (detachment not chosen)</option>
                    )}
                    {offered
                      .filter((x) => x.id === e.enhancementId || enhancementAllowed(list, cat, e, x))
                      .map((x) => (
                        <option key={x.id} value={x.id}>{x.name} (+{x.points})</option>
                      ))}
                  </select>
                )}
                {isChar && (d && hasLeaderData ? !!d.leads : true) && targetsFor(e).length > 0 && (
                  <select className="input py-0.5 text-xs" aria-label={`${d?.name} leads`} value={e.attachedTo ?? ''} onChange={(ev) => edit(e.id, { attachedTo: ev.target.value || undefined })}>
                    <option value="">Leads: none</option>
                    {targetsFor(e).map((t) => (
                      <option key={t.id} value={t.id}>Leads: {sheets.get(t.datasheetId)?.name}</option>
                    ))}
                  </select>
                )}
                {units.some((u) => u.datasheetId === e.datasheetId && !isGone(u.lifecycle)) && (
                  <select
                    className="input py-0.5 text-xs"
                    aria-label={`${d?.name ?? 'Unit'} from my collection`}
                    value={e.ownedUnitId ?? ''}
                    onChange={(ev) => edit(e.id, { ownedUnitId: ev.target.value || undefined })}
                  >
                    <option value="">My models: auto</option>
                    {units
                      .filter((u) => u.datasheetId === e.datasheetId && !isGone(u.lifecycle) && !linkedElsewhere(e.id).has(u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>{u.customName} ({totalModels(u)})</option>
                      ))}
                  </select>
                )}
                {d && d.maxModels > d.minModels ? (
                  <select className="input py-0.5" aria-label={`${d.name} models`} value={e.models} onChange={(ev) => edit(e.id, { models: Number(ev.target.value) })}>
                    {Array.from({ length: d.maxModels - d.minModels + 1 }, (_, i) => d.minModels + i).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                ) : (
                  <span className="w-8 text-center text-sm text-muted">{e.models}</span>
                )}
                <span className={`w-16 text-sm ${o.state === 'missing' ? 'text-muted' : ''}`} title={`${o.have} of ${o.need} models owned`}>
                  {o.state === 'owned' ? '✅' : o.state === 'partial' ? `🟡 ${o.have}/${o.need}` : `✖ 0/${o.need}`}
                </span>
                <span className="w-14 text-xs text-muted" title={`${o.painted} of ${o.have} owned models painted`}>{o.have > 0 ? `🎨 ${o.painted}/${o.have}` : ''}</span>
                <span className="w-12 text-right text-sm">{pts ?? '—'}</span>
                <button className="btn px-2 py-0.5" aria-label={`Remove ${d?.name ?? 'unit'}`} onClick={() => onSave(removeEntry(list, e.id, ctx()))}>✕</button>
              </div>
            )
          })}
        </section>
        {cat.muster && (
          <section className="panel grid gap-1 p-3" aria-label="Issues">
            {issues.length === 0 ? (
              <p className="text-sm">✔ No rule issues</p>
            ) : (
              issues.map((i, k) => (
                <button
                  key={k}
                  className="text-left text-sm hover:text-accent"
                  onClick={() => setHighlight(highlight === i.entryIds ? [] : i.entryIds)}
                >
                  ⚠ {i.message}
                </button>
              ))
            )}
        <CollectionPanel own={own} />
        <BuyPanel list={list} rows={buyList(list, sheets, own, points)} subtitle={[cat.factions.find((f) => f.id === list.factionId)?.name, EDITIONS.find((x) => x.key === list.edition)?.label, battleSizes(cat).find((b) => b.id === list.battleSize)?.name].filter(Boolean).join(' · ')} />
          </section>
        )}
      </div>
    </div>
  )
}

const WIDTH_KEY = 'builderPanelWidth'
const MIN_W = 240
const MAX_W = 640
const clampW = (w: number) => Math.min(MAX_W, Math.max(MIN_W, Math.round(w)))

/** Width of the add panel, remembered on this device. */
function usePanelWidth(): [number, (w: number) => void] {
  const [w, setW] = useState(() => {
    try {
      const v = Number(localStorage.getItem(WIDTH_KEY))
      return v ? clampW(v) : 352
    } catch {
      return 352
    }
  })
  const set = (v: number) => {
    const c = clampW(v)
    setW(c)
    try {
      localStorage.setItem(WIDTH_KEY, String(c))
    } catch {
      /* not remembered */
    }
  }
  return [w, set]
}

/** Drag (or use arrow keys) to change the add panel's width. Wide screens only; on narrow ones the columns stack. */
function ResizeHandle({ width, onChange }: { width: number; onChange: (w: number) => void }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize unit panel"
      aria-valuenow={width}
      aria-valuemin={MIN_W}
      aria-valuemax={MAX_W}
      tabIndex={0}
      className="group mx-1 hidden w-2 cursor-col-resize self-stretch rounded focus:outline-none lg:flex lg:justify-center"
      onPointerDown={(ev) => {
        ev.preventDefault()
        const startX = ev.clientX
        const startW = width
        const move = (e: PointerEvent) => onChange(startW + e.clientX - startX)
        const up = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
      onKeyDown={(ev) => {
        if (ev.key === 'ArrowLeft') onChange(width - 16)
        if (ev.key === 'ArrowRight') onChange(width + 16)
      }}
    >
      <span className="w-0.5 rounded bg-muted/30 group-hover:bg-accent group-focus:bg-accent" />
    </div>
  )
}

/** Data type used when dragging a unit from the add panel onto the list. */
const DRAG_TYPE = 'application/x-minitracker-datasheet'

function AddPanel({ list, cat, onAdd, choose, onCancelChoose, onSave }: { list: ArmyList; cat: Catalogue; onAdd: (d: Datasheet, factionId?: string) => void; choose: Datasheet | null; onCancelChoose: () => void; onSave: (l: ArmyList) => void }) {
  const { units } = useStore()
  const [text, setText] = useState('')
  const [notOwned, setNotOwned] = useState(false)
  const [legends, setLegends] = useState(false)
  const owned = useMemo(() => ownedByDatasheet(units), [units])

  const groups = useMemo(() => {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean)
    const pool = list.factionId ? legalUnits(cat, list.factionId, { legends }) : cat.datasheets.filter((d) => legends || !d.legends)
    const map = new Map<string, Datasheet[]>()
    for (const d of pool) {
      if (!notOwned && !owned.has(d.id)) continue
      if (!words.every((w) => d.name.toLowerCase().includes(w))) continue
      const r = roleOf(d)
      map.set(r, [...(map.get(r) ?? []), d])
    }
    return [...map].sort(([a], [b]) => roleRank(a) - roleRank(b) || a.localeCompare(b))
  }, [cat, list.factionId, legends, notOwned, owned, text])

  const add = onAdd
  const factionName = (id: string) => cat.factions.find((f) => f.id === id)?.name ?? id
  const count = groups.reduce((n, [, ds]) => n + ds.length, 0)

  return (
    <section className="panel grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 p-3 lg:sticky lg:top-0 lg:max-h-[calc(100vh-6rem)] lg:overflow-auto" aria-label="Add units">
      <input className="input" placeholder="🔍 Search units" aria-label="Search units" value={text} onChange={(e) => setText(e.target.value)} />
      {list.factionId && (
        <button
          className="btn text-sm"
          title="Adds every unit you own of this faction that isn't in the list yet"
          onClick={() => onSave(addFromCollection(list, cat, units, ctx(), { legends }))}
        >
          ⤵ Add all my units
        </button>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={notOwned} onChange={(e) => setNotOwned(e.target.checked)} /> Not owned
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={legends} onChange={(e) => setLegends(e.target.checked)} /> Legends
        </label>
      </div>
      {choose && (
        <div className="grid gap-1 rounded border border-accent/60 p-2 text-sm" role="dialog" aria-label="Choose faction">
          <p>{choose.name} is in several factions. Build this list as:</p>
          {choose.factionIds.map((f) => (
            <button key={f} className="btn" onClick={() => add(choose, f)}>{factionName(f)}</button>
          ))}
          <button className="btn" onClick={onCancelChoose}>Cancel</button>
        </div>
      )}
      {count === 0 && (
        <p className="text-sm text-muted">
          {notOwned ? 'No units match.' : 'You own none of these units yet. Tick “Not owned” to see every unit.'}
        </p>
      )}
      {groups.map(([role, ds]) => (
        <div key={role} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-0.5">
          <h3 className="text-xs uppercase tracking-wide text-muted">{role}</h3>
          {ds.slice(0, 200).map((d) => (
            <div
              key={d.id}
              data-testid="unit-option"
              className="flex cursor-grab select-none items-center gap-2 rounded px-1 text-sm hover:bg-panel-2"
              title="Double-click or drag onto the list to add"
              draggable
              onDragStart={(ev) => {
                ev.dataTransfer.setData(DRAG_TYPE, d.id)
                ev.dataTransfer.effectAllowed = 'copy'
              }}
              onDoubleClick={() => add(d)}
            >
              <span className="min-w-0 flex-1 truncate">
                {d.name}
                {owned.has(d.id) && <span className="ml-1 text-accent" title={`You own ${owned.get(d.id)!.models} models`}>✓</span>}
              </span>
              <span className="shrink-0 text-xs text-muted">{d.points[0]?.points ?? '—'}</span>
              <button className="btn shrink-0 px-2 py-0.5" aria-label={`Add ${d.name}`} onClick={() => add(d)}>+</button>
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}

function DetachmentBar({ list, cat, onSave }: { list: ArmyList; cat: Catalogue; onSave: (l: ArmyList) => void }) {
  const chosen = list.detachmentIds ?? []
  const all = new Map((cat.detachments ?? []).map((d) => [d.id, d]))
  const available = (cat.detachments ?? []).filter((d) => list.factionId && d.factionIds.includes(list.factionId) && !chosen.includes(d.id))
  const used = chosen.reduce((n, id) => n + (all.get(id)?.detachmentPoints ?? 0), 0)
  const budget = cat.muster?.detachmentPoints ? evalLimit(cat.muster.detachmentPoints, listCounter(list, cat)) : undefined
  const set = (ids: string[]) => onSave({ ...list, detachmentIds: ids, updatedAt: ctx().now })

  return (
    <section className="panel flex flex-wrap items-center gap-2 p-3" aria-label="Detachments">
      <span className="text-sm text-muted">Detachments</span>
      {chosen.map((id) => {
        const d = all.get(id)
        return (
          <span key={id} className="flex items-center gap-1 rounded border border-accent/50 px-2 py-0.5 text-sm">
            {d?.name ?? 'Unknown detachment'}
            {!!d?.detachmentPoints && <span className="text-xs text-muted">{d.detachmentPoints} DP</span>}
            <button aria-label={`Remove ${d?.name ?? 'detachment'}`} className="ml-1 text-muted hover:text-danger" onClick={() => set(chosen.filter((x) => x !== id))}>✕</button>
          </span>
        )
      })}
      {list.factionId ? (
        available.length > 0 && (
          <select className="input py-0.5 text-sm" aria-label="Add detachment" value="" onChange={(e) => e.target.value && set([...chosen, e.target.value])}>
            <option value="">+ Add detachment</option>
            {available.map((d) => (
              <option key={d.id} value={d.id}>{d.name}{d.detachmentPoints ? ` (${d.detachmentPoints} DP)` : ''}</option>
            ))}
          </select>
        )
      ) : (
        <span className="text-sm text-muted">Choose a faction or add a unit first</span>
      )}
      {budget !== undefined && budget >= 0 && (
        <span className={`ml-auto text-sm ${used > budget ? 'text-danger' : 'text-muted'}`}>{used} / {budget} detachment points</span>
      )}
    </section>
  )
}

function BuyPanel({ list, rows: b, subtitle }: { list: ArmyList; rows: ReturnType<typeof buyList>; subtitle: string }) {
  const [copied, setCopied] = useState('')
  const [printing, setPrinting] = useState(false)
  if (list.entries.length === 0) return null
  return (
    <section className="panel grid gap-2 p-3" aria-label="Buy list">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Buy list</h2>
        <span className="text-sm text-muted">{b.missingModels ? `${b.missingModels} model${b.missingModels === 1 ? '' : 's'} to buy` : 'You own everything in this list'}</span>
        {b.rows.length > 0 && (
          <button
            className="btn ml-auto px-2 py-0.5 text-sm"
            onClick={() => {
              navigator.clipboard
                .writeText(buyListText(list.name, b))
                .then(() => setCopied('Copied'))
                .catch(() => setCopied('Copy failed'))
            }}
          >
            📋 Copy as text
          </button>
        )}
        {b.rows.length > 0 && (
          <button className="btn px-2 py-0.5 text-sm" title="Opens the print dialog: choose “Save as PDF”" onClick={() => setPrinting(true)}>
            📄 PDF
          </button>
        )}
        {printing && <BuyListSheet list={list} buy={b} subtitle={subtitle} onDone={() => setPrinting(false)} />}
        {copied && <span className="text-xs text-muted" role="status">{copied}</span>}
      </div>
      {b.rows.length > 0 && (
        <table className="text-sm">
          <thead className="text-left text-xs text-muted">
            <tr><th className="font-normal">Unit</th><th className="text-right font-normal">Models</th><th className="text-right font-normal">Points in list</th></tr>
          </thead>
          <tbody>
            {b.rows.map((r) => (
              <tr key={r.datasheetId}>
                <td>{r.name}{r.units > 1 ? <span className="text-muted"> ×{r.units}</span> : null}</td>
                <td className="text-right">{r.missingModels}</td>
                <td className="text-right">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

/** What the collection still needs for this list: models to paint (with a "next up" shortcut) and missing paints. */
function CollectionPanel({ own }: { own: ReturnType<typeof listOwnership> }) {
  const { units, schemes, paintStock, schemeDefaults, paints, loadPaints, saveUnit } = useStore()
  useEffect(() => {
    if (!paints.length) void loadPaints()
  }, [paints.length, loadPaints])
  const plan = useMemo(() => collectionPlan(own, units, schemes, paintStock, schemeDefaults), [own, units, schemes, paintStock, schemeDefaults])
  const paintName = new Map(paints.map((p) => [p.id, `${p.brand} ${p.name}`]))
  if (!plan.toPaint.length && !plan.missingPaints.length) return null
  return (
    <section className="panel grid gap-2 p-3" aria-label="From my collection">
      <h2 className="font-semibold">From my collection</h2>
      {plan.toPaint.length > 0 && (
        <div className="grid gap-1 text-sm">
          <p className="text-muted">{own.unpaintedModels} model{own.unpaintedModels === 1 ? '' : 's'} not painted yet</p>
          {plan.toPaint.map(({ unit, models }) => (
            <div key={unit.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{unit.customName}</span>
              <span className="text-muted">{models} to paint</span>
              <button
                className={`btn px-2 py-0.5 text-xs ${unit.nextUp ? 'btn-primary' : ''}`}
                aria-pressed={unit.nextUp}
                aria-label={`Next up: ${unit.customName}`}
                onClick={() => void saveUnit(setFlags(unit, { nextUp: !unit.nextUp }, ctx()))}
              >
                ⏭ Next up
              </button>
            </div>
          ))}
        </div>
      )}
      {plan.missingPaints.length > 0 && (
        <div className="grid gap-1 text-sm">
          <p className="text-muted">Paints missing for their schemes</p>
          <ul className="grid gap-0.5">
            {plan.missingPaints.map((m) => (
              <li key={m.paintId}>{paintName.get(m.paintId) ?? m.paintId} <span className="text-xs text-muted">({m.schemes.join(', ')})</span></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Export as text (copy or .txt) or as a MiniTracker .json file. */
function ExportMenu({ list, cat }: { list: ArmyList; cat?: Catalogue }) {
  const [msg, setMsg] = useState('')
  const label = EDITIONS.find((e) => e.key === list.edition)?.label ?? list.edition
  const file = list.name.replace(/[^\w\- ]+/g, '').trim() || 'list'
  return (
    <details className="relative">
      <summary className="btn list-none">⬇ Export</summary>
      <div className="panel absolute right-0 z-10 mt-1 grid w-48 gap-1 p-2">
        <button
          className="btn text-left text-sm"
          onClick={() =>
            navigator.clipboard
              .writeText(listToText(list, cat, label))
              .then(() => setMsg('Copied'))
              .catch(() => setMsg('Copy failed'))
          }
        >
          📋 Copy list as text
        </button>
        <button className="btn text-left text-sm" onClick={() => download(`${file}.txt`, listToText(list, cat, label), 'text/plain')}>📄 Text file (.txt)</button>
        <button className="btn text-left text-sm" onClick={() => download(`${file}.json`, listToJson(list), 'application/json')}>🗂 MiniTracker file (.json)</button>
        {msg && <span className="text-xs text-muted" role="status">{msg}</span>}
      </div>
    </details>
  )
}
