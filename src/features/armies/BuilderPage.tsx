import { useEffect, useMemo, useState } from 'react'
import { catalogueFor, ctx, useStore } from '../../app/store'
import { EDITIONS } from '../../data/catalogue/fetch'
import { keywordLegend, unitCards } from '../../domain/lists/cards'
import { ArmyPrintDialog, ArmySheet, type ArmyPrintOptions } from './ArmySheet'
import { ownedByDatasheet } from '../../domain/catalogue/owned'
import type { Catalogue, Datasheet } from '../../domain/catalogue/types'
import type { OwnedUnit } from '../../domain/collection/types'
import { removeEntry, updateEntry } from '../../domain/lists/list'
import { listOwnership } from '../../domain/lists/ownership'
import { listPoints } from '../../domain/lists/points'
import { buyList, buyListText, type BuyPaint } from '../../domain/lists/buy'
import { defaultPicks, effectiveLoadout, type LoadoutSource } from '../../domain/lists/loadout'
import { addFromCollection, collectionPlan } from '../../domain/lists/collection'
import { armySchemeChoices, paintPlan, resolveScheme, schemesToApply, unitSchemeChoices, type SchemeContext, type SchemeSource } from '../../domain/lists/schemes'
import { totalModels } from '../../domain/collection/ownedUnit'
import { isGone, setFlags } from '../../domain/collection/pipeline'
import { BuyListSheet } from './BuyListSheet'
import { listToJson, listToText } from '../../domain/lists/io'
import { evalLimit } from '../../domain/lists/conditions'
import { addUnit, ISSUE_HELP, battleSizes, canLead, checkList, enhancementAllowed, legalUnits, listCounter } from '../../domain/lists/rules'
import type { ArmyList, ListEntry, ListStatus, LoadoutRow } from '../../domain/lists/types'
import type { PaintDef } from '../../domain/paints/types'
import { AddToShoppingButton } from '../shopping/AddToShoppingDialog'

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
  const [printAsk, setPrintAsk] = useState(false)
  const [printOpts, setPrintOpts] = useState<ArmyPrintOptions | null>(null)
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
      {cat && list.factionId && <ArmySchemeSelect list={list} factionName={cat.factions.find((f) => f.id === list.factionId)?.name} onChange={(schemeId) => set({ schemeId })} />}
      {cat && list.entries.length > 0 && <button className="btn" title="Roster and datasheet cards, no paints. Choose “Save as PDF” in the print dialog." onClick={() => setPrintAsk(true)}>📄 Army PDF</button>}
      <ExportMenu list={list} cat={cat} />
      {printAsk && cat && (
        <div className="relative">
          <ArmyPrintDialog
            list={list}
            cat={cat}
            onSave={onSave}
            onCancel={() => setPrintAsk(false)}
            onPrint={(o) => {
              setPrintAsk(false)
              setPrintOpts(o)
            }}
          />
        </div>
      )}
      {printOpts && cat && <ArmySheet list={list} cat={cat} options={printOpts} onDone={() => setPrintOpts(null)} />}
      <button className="btn btn-danger ml-auto" onClick={onDelete}>Delete list</button>
    </header>
  )
}

function Builder({ list, cat, onSave }: { list: ArmyList; cat: Catalogue; onSave: (l: ArmyList) => void }) {
  const { units, pipeline, schemes: mine, library, loadLibrary, paintStock, schemeDefaults, paints, loadPaints } = useStore()
  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])
  // Your schemes plus the bundled library, as on the unit page.
  const schemes = useMemo(() => [...mine, ...library], [mine, library])
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
  useEffect(() => {
    if (!paints.length) void loadPaints()
  }, [paints.length, loadPaints])
  const plan = useMemo(() => collectionPlan(own, units, schemes, paintStock, schemeDefaults), [own, units, schemes, paintStock, schemeDefaults])
  const factionName = cat.factions.find((f) => f.id === list.factionId)?.name
  const schemeCtx = useMemo((): SchemeContext => ({ schemes, sheets, units, own, factionName, defaults: schemeDefaults }), [schemes, sheets, units, own, factionName, schemeDefaults])
  const pplan = useMemo(() => paintPlan(list, schemeCtx, paintStock), [list, schemeCtx, paintStock])
  const paintName = useMemo(() => new Map(paints.map((x) => [x.id, `${x.brand} ${x.name}`])), [paints])
  const paintById = useMemo(() => new Map(paints.map((x) => [x.id, x])), [paints])
  // Paints come from every unit's scheme, owned or not.
  const missingPaints = useMemo((): BuyPaint[] => pplan.missing.map((m) => ({ paintId: m.paintId, name: paintName.get(m.paintId) ?? m.paintId, schemes: m.schemes })), [pplan, paintName])
  const [openRows, setOpenRows] = useState<Set<string>>(new Set())
  const toggleRow = (id: string) => setOpenRows((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const linkedElsewhere = (entryId: string) => new Set(list.entries.filter((x) => x.id !== entryId && x.ownedUnitId).map((x) => x.ownedUnitId))
  const issues = useMemo(() => (cat.muster ? checkList(list, cat) : []), [list, cat])
  const flagged = new Set(issues.flatMap((i) => i.entryIds))
  const noWarlord = !list.entries.some((e) => e.warlord)
  const characters = list.entries.filter((e) => sheets.get(e.datasheetId)?.keywords.includes('Character')).length

  const edit = (id: string, patch: Partial<Omit<ListEntry, 'id'>>) => onSave(updateEntry(list, id, patch, ctx()))
  // One Warlord per army: choosing a unit moves the ★ there; clicking it again clears it.
  const setWarlord = (id: string) => onSave({ ...list, entries: list.entries.map((e) => ({ ...e, warlord: e.id === id ? !e.warlord : false })), updatedAt: ctx().now })
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
          {list.entries.length > 0 && noWarlord && (
            <p className="text-sm text-accent" role="status">{characters ? '★ Choose your Warlord: click the star of a highlighted Character.' : '★ Add a Character to choose your Warlord.'}</p>
          )}
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
                <button className="w-5 text-muted" aria-label={`Details: ${d?.name ?? 'unit'}`} aria-expanded={openRows.has(e.id)} onClick={() => toggleRow(e.id)}>
                  {openRows.has(e.id) ? '▾' : '▸'}
                </button>
                {(() => {
                  // Only Characters can be the Warlord; until one is chosen, the candidates are highlighted.
                  const can = !d || d.keywords.includes('Character')
                  const look = e.warlord ? 'text-accent' : !can ? 'cursor-not-allowed text-muted/20' : noWarlord ? 'rounded text-accent ring-1 ring-accent/70' : 'text-muted/50 hover:text-accent'
                  return (
                    <button
                      className={`w-6 ${look}`}
                      aria-label={`Warlord: ${d?.name ?? 'unit'}`}
                      aria-pressed={!!e.warlord}
                      disabled={!can && !e.warlord}
                      onClick={() => setWarlord(e.id)}
                      title={e.warlord ? 'Warlord (click to clear)' : can ? 'Make Warlord' : 'Only a Character can be the Warlord'}
                    >
                      ★
                    </button>
                  )
                })()}
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
                {openRows.has(e.id) && (
                  <div className="flex basis-full flex-wrap items-center gap-2 pl-11 text-xs" aria-label={`${d?.name ?? 'Unit'} details`}>
                    <label className="flex items-center gap-1">
                      Scheme
                      <UnitSchemeSelect list={list} entry={e} ctx={schemeCtx} onChange={(schemeId) => edit(e.id, { schemeId })} />
                    </label>
                    {d && (
                      <LoadoutEditor
                        d={d}
                        entry={e}
                        linked={o.from.map((f) => units.find((u) => u.id === f.unitId)).filter((u): u is NonNullable<typeof u> => !!u)}
                        onChange={(rows) => edit(e.id, rows ? { loadout: rows, models: Math.max(1, rows.reduce((n, r) => n + r.count, 0)) } : { loadout: undefined })}
                      />
                    )}
                  </div>
                )}
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
                  title={ISSUE_HELP[i.code]}
                  onClick={() => setHighlight(highlight === i.entryIds ? [] : i.entryIds)}
                >
                  ⚠ {i.message}
                </button>
              ))
            )}
        <CollectionPanel own={own} plan={plan} missingPaints={missingPaints} toApply={schemesToApply(list, schemeCtx)} />
        <BuyPanel list={list} cat={cat} linkedTo={(e) => (own.byEntry.get(e.id)?.from ?? []).map((f) => units.find((u) => u.id === f.unitId)).filter((u): u is NonNullable<typeof u> => !!u)} rows={buyList(list, sheets, own, points)} paints={missingPaints} schemeCtx={schemeCtx} paintById={paintById} onSave={onSave} subtitle={[cat.factions.find((f) => f.id === list.factionId)?.name, EDITIONS.find((x) => x.key === list.edition)?.label, battleSizes(cat).find((b) => b.id === list.battleSize)?.name].filter(Boolean).join(' · ')} />
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
                {d.keywords.includes('Character') && <span className="mr-1 text-accent/80" title="Character: can be your Warlord" aria-label="Can be Warlord">★</span>}
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

function BuyPanel({ list, rows: b, paints, subtitle, schemeCtx, paintById, onSave, cat, linkedTo }: { list: ArmyList; rows: ReturnType<typeof buyList>; paints: BuyPaint[]; subtitle: string; schemeCtx: SchemeContext; paintById: Map<string, PaintDef>; onSave: (l: ArmyList) => void; cat: Catalogue; linkedTo: (e: ListEntry) => OwnedUnit[] }) {
  const { paintStock } = useStore()
  const [withCards, setWithCards] = useState(true)
  const [withPaints, setWithPaints] = useState(true)
  const [withBuy, setWithBuy] = useState(true)
  const [copied, setCopied] = useState('')
  const [asking, setAsking] = useState(false)
  const [printing, setPrinting] = useState<ArmyList | null>(null)
  if (list.entries.length === 0) return null
  return (
    <section className="panel grid gap-2 p-3" aria-label="Buy list">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Buy list</h2>
        <span className="text-sm text-muted">
          {[b.missingModels ? `${b.missingModels} model${b.missingModels === 1 ? '' : 's'} to buy` : 'You own every model', paints.length ? `${paints.length} paint${paints.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')}
        </span>
        {(b.rows.length > 0 || paints.length > 0) && (
          <button
            className="btn ml-auto px-2 py-0.5 text-sm"
            onClick={() => {
              navigator.clipboard
                .writeText(buyListText(list.name, b, paints))
                .then(() => setCopied('Copied'))
                .catch(() => setCopied('Copy failed'))
            }}
          >
            📋 Copy as text
          </button>
        )}
        <button className="btn px-2 py-0.5 text-sm" title="Asks for colour schemes, then opens the print dialog: choose “Save as PDF”" onClick={() => setAsking(true)}>
          📄 PDF
        </button>
        <AddToShoppingButton
          items={[
            ...b.rows.map((r) => ({ kind: 'model' as const, name: r.name, refId: r.datasheetId, qty: r.missingModels, sources: [`List: ${list.name}`] })),
            ...paints.map((p) => ({ kind: 'paint' as const, name: p.name, refId: p.paintId, qty: 1, sources: p.schemes.map((x) => `Scheme: ${x}`) })),
          ]}
        />
        {printing && (
          <BuyListSheet
            list={printing}
            buy={b}
            plan={paintPlan(printing, schemeCtx, paintStock)}
            paintById={paintById}
            subtitle={subtitle}
            cards={withCards ? unitCards(printing, cat, linkedTo) : undefined}
            legend={withCards ? keywordLegend(unitCards(printing, cat, linkedTo), cat.rules ?? []) : undefined}
            paints={withPaints}
            buyRows={withBuy}
            onDone={() => setPrinting(null)}
          />
        )}
        {copied && <span className="text-xs text-muted" role="status">{copied}</span>}
      </div>
      {asking && (
        <PdfDialog
          list={list}
          c={schemeCtx}
          withCards={withCards}
          onCards={setWithCards}
          withPaints={withPaints}
          onPaints={setWithPaints}
          withBuy={withBuy}
          onBuy={setWithBuy}
          onCancel={() => setAsking(false)}
          onMake={(l) => {
            setAsking(false)
            onSave({ ...l, updatedAt: ctx().now })
            setPrinting(l)
          }}
        />
      )}
      {(b.rows.length > 0 || paints.length > 0) && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-accent">Show what to buy</summary>
          <div className="mt-1 grid gap-2">
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
            {paints.length > 0 && (
              <table className="text-sm" aria-label="Paints to buy">
                <thead className="text-left text-xs text-muted">
                  <tr><th className="font-normal">Paint</th><th className="text-right font-normal">For schemes</th></tr>
                </thead>
                <tbody>
                  {paints.map((x) => (
                    <tr key={x.name}>
                      <td>{x.name}</td>
                      <td className="text-right text-muted">{x.schemes.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </details>
      )}
    </section>
  )
}

/** What the collection still needs for this list: models to paint (with a "next up" shortcut) and missing paints. */
function CollectionPanel({ own, plan, missingPaints, toApply }: { own: ReturnType<typeof listOwnership>; plan: ReturnType<typeof collectionPlan>; missingPaints: BuyPaint[]; toApply: ReturnType<typeof schemesToApply> }) {
  const { saveUnit } = useStore()
  const apply = async () => {
    let changes = toApply.set
    if (toApply.change.length && confirm(`${toApply.change.length} of your models already have a different scheme. Change them too?\n\n${toApply.change.map((x) => x.unit.customName).join(', ')}`)) changes = [...changes, ...toApply.change]
    for (const { unit, schemeId } of changes) await saveUnit({ ...unit, schemeId, updatedAt: ctx().now })
  }
  if (!plan.toPaint.length && !missingPaints.length && !toApply.set.length && !toApply.change.length) return null
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
      {(toApply.set.length > 0 || toApply.change.length > 0) && (
        <button className="btn w-fit text-sm" onClick={() => void apply()}>
          🎨 Use these schemes on my models ({toApply.set.length + toApply.change.length})
        </button>
      )}
      {missingPaints.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-accent">Paints missing for the list's schemes ({missingPaints.length})</summary>
          <ul className="mt-1 grid gap-0.5">
            {missingPaints.map((m) => (
              <li key={m.name}>{m.name} <span className="text-xs text-muted">({m.schemes.join(', ')})</span></li>
            ))}
          </ul>
        </details>
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

const SOURCE: Record<SchemeSource, string> = { list: 'chosen', model: 'from my model', variant: 'army scheme for this unit type', army: 'army scheme', default: 'faction default', none: '' }

/** Scheme for one list unit: "Auto" shows what it gets without a choice. */
function UnitSchemeSelect({ list, entry, ctx: c, onChange }: { list: ArmyList; entry: ListEntry; ctx: SchemeContext; onChange: (schemeId: string | undefined) => void }) {
  const auto = resolveScheme(list, { ...entry, schemeId: undefined }, c)
  const d = c.sheets.get(entry.datasheetId)
  return (
    <select className="input py-0.5 text-xs" aria-label={`${d?.name ?? 'Unit'} scheme`} value={entry.schemeId ?? ''} onChange={(ev) => onChange(ev.target.value || undefined)}>
      <option value="">{auto.scheme ? `Auto: ${auto.scheme.name} (${SOURCE[auto.source]})` : 'Auto: no scheme'}</option>
      {unitSchemeChoices(c.schemes, d, c.factionName, entry.schemeId).map((g) => (
        <optgroup key={g.origin} label={g.origin}>
          {g.schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

function ArmySchemeSelect({ list, factionName, onChange, label = 'Army scheme' }: { list: ArmyList; factionName?: string; onChange: (schemeId: string | undefined) => void; label?: string }) {
  const { schemes: mine, library, schemeDefaults } = useStore()
  const schemes = [...mine, ...library]
  const def = factionName ? schemes.find((s) => s.id === schemeDefaults[factionName]) : undefined
  return (
    <select className="input" aria-label={label} value={list.schemeId ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{def ? `Army scheme: faction default (${def.name})` : 'Army scheme: none'}</option>
      {armySchemeChoices(schemes, factionName, list.schemeId).map((g) => (
        <optgroup key={g.origin} label={g.origin}>
          {g.schemes.map((s) => <option key={s.id} value={s.id}>🎨 {s.name}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

/** Asked before making the PDF: army scheme, and optionally a scheme per unit. Choices are saved to the list. */
function PdfDialog({ list, c, withCards, onCards, withPaints, onPaints, withBuy, onBuy, onCancel, onMake }: { list: ArmyList; c: SchemeContext; withCards: boolean; onCards: (v: boolean) => void; withPaints: boolean; onPaints: (v: boolean) => void; withBuy: boolean; onBuy: (v: boolean) => void; onCancel: () => void; onMake: (l: ArmyList) => void }) {
  const [draft, setDraft] = useState(list)
  const [perUnit, setPerUnit] = useState(list.entries.some((e) => e.schemeId))
  return (
    <div role="dialog" aria-label="Make PDF" className="panel grid gap-3 border-accent/60 p-3">
      <h3 className="font-semibold">Colour schemes for the PDF</h3>
      <ArmySchemeSelect list={draft} factionName={c.factionName} onChange={(schemeId) => setDraft({ ...draft, schemeId })} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={perUnit} onChange={(e) => setPerUnit(e.target.checked)} /> Choose a scheme per unit
      </label>
      {perUnit && (
        <div className="grid gap-1 text-sm">
          {draft.entries.map((e) => (
            <div key={e.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{c.sheets.get(e.datasheetId)?.name ?? 'Unknown unit'}</span>
              <UnitSchemeSelect list={draft} entry={e} ctx={c} onChange={(schemeId) => setDraft({ ...draft, entries: draft.entries.map((x) => (x.id === e.id ? { ...x, schemeId } : x)) })} />
            </div>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withBuy} onChange={(e) => onBuy(e.target.checked)} /> Include the models to buy
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withCards} onChange={(e) => onCards(e.target.checked)} /> Include datasheet cards
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withPaints} onChange={(e) => onPaints(e.target.checked)} /> Include paints for the schemes
      </label>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={() => onMake(perUnit ? draft : { ...draft, entries: draft.entries.map((x) => ({ ...x, schemeId: undefined })) })}>📄 Make PDF</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

const LOADOUT_SOURCE: Record<LoadoutSource, string> = { list: 'set in this list', models: 'from my models', default: 'default' }

/** Models by type with their wargear choices. Editing saves the loadout to the list and sets the model count. */
function LoadoutEditor({ d, entry, linked, onChange }: { d: Datasheet; entry: ListEntry; linked: OwnedUnit[]; onChange: (rows: LoadoutRow[] | undefined) => void }) {
  if (!d.models?.length) return null
  const { rows, source } = effectiveLoadout(entry, d, linked)
  const types = new Map(d.models.map((m) => [m.id, m]))
  const setRow = (i: number, patch: Partial<LoadoutRow>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  const used = (id: string) => rows.filter((r) => r.modelId === id).reduce((n, r) => n + r.count, 0)
  return (
    <div className="grid basis-full gap-1 rounded border border-line/60 p-2" aria-label={`${d.name} loadout`}>
      <div className="flex items-center gap-2 text-muted">
        <span>Loadout · {LOADOUT_SOURCE[source]}</span>
        {source !== 'list' && <span className="text-[10px]">(change anything to keep your own)</span>}
        {source === 'list' && <button className="ml-auto underline" onClick={() => onChange(undefined)}>Reset</button>}
      </div>
      {rows.map((r, i) => {
        const m = types.get(r.modelId)
        if (!m) return <div key={i} className="text-danger">Unknown model type</div>
        return (
          <div key={i} className="flex flex-wrap items-center gap-2" data-testid="loadout-row">
            <input
              className="input w-14 py-0.5"
              type="number"
              min={0}
              max={m.max}
              aria-label={`${m.name} count`}
              value={r.count}
              onChange={(ev) => setRow(i, { count: Math.max(0, Number(ev.target.value) || 0) })}
            />
            <span className="font-semibold">× {m.name}</span>
            {m.fixed.length > 0 && <span className="text-muted">{m.fixed.join(', ')}</span>}
            {m.choices.map((c) =>
              c.max === 1 ? (
                <select
                  key={c.id}
                  className="input py-0.5"
                  aria-label={`${m.name}: ${c.name}`}
                  value={r.picks.find((p) => c.options.some((o) => o.id === p)) ?? ''}
                  onChange={(ev) => setRow(i, { picks: [...r.picks.filter((p) => !c.options.some((o) => o.id === p)), ...(ev.target.value ? [ev.target.value] : [])] })}
                >
                  {c.min === 0 && <option value="">{c.name}: none</option>}
                  {c.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : (
                <span key={c.id} className="flex flex-wrap items-center gap-1">
                  {c.name}:
                  {c.options.map((o) => (
                    <label key={o.id} className="flex items-center gap-0.5">
                      <input
                        className="input w-11 py-0"
                        type="number"
                        min={0}
                        max={o.max}
                        aria-label={`${m.name}: ${o.name}`}
                        value={r.picks.filter((p) => p === o.id).length}
                        onChange={(ev) => setRow(i, { picks: [...r.picks.filter((p) => p !== o.id), ...Array(Math.max(0, Number(ev.target.value) || 0)).fill(o.id)] })}
                      />
                      {o.name}
                    </label>
                  ))}
                </span>
              ),
            )}
            <button className="text-muted hover:text-danger" aria-label={`Remove ${m.name} row`} onClick={() => onChange(rows.filter((_, k) => k !== i))}>✕</button>
          </div>
        )
      })}
      <select
        className="input w-fit py-0.5"
        aria-label={`Add models to ${d.name}`}
        value=""
        onChange={(ev) => {
          const m = types.get(ev.target.value)
          if (m) onChange([...rows, { modelId: m.id, count: 1, picks: defaultPicks(m) }])
        }}
      >
        <option value="">+ Add models</option>
        {d.models.map((m) => (
          <option key={m.id} value={m.id} disabled={used(m.id) >= m.max}>{m.name}</option>
        ))}
      </select>
    </div>
  )
}
