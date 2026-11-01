import { useMemo, useState } from 'react'
import { catalogueFor, ctx, useStore } from '../../app/store'
import { EDITIONS } from '../../data/catalogue/fetch'
import { ownedByDatasheet } from '../../domain/catalogue/owned'
import type { Catalogue, Datasheet } from '../../domain/catalogue/types'
import { removeEntry, updateEntry } from '../../domain/lists/list'
import { listOwnership } from '../../domain/lists/ownership'
import { listPoints } from '../../domain/lists/points'
import { addUnit, battleSizes, checkList, legalUnits } from '../../domain/lists/rules'
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
  const points = useMemo(() => listPoints(list, new Map((cat?.datasheets ?? []).map((d) => [d.id, d]))).total, [list, cat])
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
      <button className="btn btn-danger ml-auto" onClick={onDelete}>Delete list</button>
    </header>
  )
}

function Builder({ list, cat, onSave }: { list: ArmyList; cat: Catalogue; onSave: (l: ArmyList) => void }) {
  const { units } = useStore()
  const [highlight, setHighlight] = useState<string[]>([])
  const sheets = useMemo(() => new Map(cat.datasheets.map((d) => [d.id, d])), [cat])
  const points = useMemo(() => listPoints(list, sheets), [list, sheets])
  const own = useMemo(() => listOwnership(list, units), [list, units])
  const issues = useMemo(() => (cat.muster ? checkList(list, cat) : []), [list, cat])
  const flagged = new Set(issues.flatMap((i) => i.entryIds))

  const edit = (id: string, patch: Partial<Omit<ListEntry, 'id'>>) => onSave(updateEntry(list, id, patch, ctx()))
  const setWarlord = (id: string) => onSave({ ...list, entries: list.entries.map((e) => ({ ...e, warlord: e.id === id ? !e.warlord : e.warlord })), updatedAt: ctx().now })
  const leadable = list.entries.filter((e) => !sheets.get(e.datasheetId)?.keywords.includes('Character'))

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[22rem_1fr]">
      <AddPanel list={list} cat={cat} onSave={onSave} />
      <div className="grid gap-3">
        <section className="panel grid gap-1 p-3" aria-label="List">
          {list.entries.length === 0 && <p className="text-muted">No units yet. Add them from the left.</p>}
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
                {isChar && leadable.length > 0 && (
                  <select className="input py-0.5 text-xs" aria-label={`${d?.name} leads`} value={e.attachedTo ?? ''} onChange={(ev) => edit(e.id, { attachedTo: ev.target.value || undefined })}>
                    <option value="">Leads: none</option>
                    {leadable.map((t) => (
                      <option key={t.id} value={t.id}>Leads: {sheets.get(t.datasheetId)?.name}</option>
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
          </section>
        )}
      </div>
    </div>
  )
}

function AddPanel({ list, cat, onSave }: { list: ArmyList; cat: Catalogue; onSave: (l: ArmyList) => void }) {
  const { units } = useStore()
  const [text, setText] = useState('')
  const [notOwned, setNotOwned] = useState(false)
  const [legends, setLegends] = useState(false)
  const [choose, setChoose] = useState<Datasheet | null>(null)
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

  const add = (d: Datasheet, factionId?: string) => {
    if (!list.factionId && !factionId && d.factionIds.length > 1) return setChoose(d)
    setChoose(null)
    onSave(addUnit(list, d, d.minModels, ctx(), factionId))
  }
  const factionName = (id: string) => cat.factions.find((f) => f.id === id)?.name ?? id
  const count = groups.reduce((n, [, ds]) => n + ds.length, 0)

  return (
    <section className="panel grid gap-2 p-3 lg:sticky lg:top-0 lg:max-h-[calc(100vh-6rem)] lg:overflow-auto" aria-label="Add units">
      <input className="input" placeholder="🔍 Search units" aria-label="Search units" value={text} onChange={(e) => setText(e.target.value)} />
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
          <button className="btn" onClick={() => setChoose(null)}>Cancel</button>
        </div>
      )}
      {count === 0 && (
        <p className="text-sm text-muted">
          {notOwned ? 'No units match.' : 'You own none of these units yet. Tick “Not owned” to see every unit.'}
        </p>
      )}
      {groups.map(([role, ds]) => (
        <div key={role} className="grid gap-0.5">
          <h3 className="text-xs uppercase tracking-wide text-muted">{role}</h3>
          {ds.slice(0, 200).map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {d.name}
                {owned.has(d.id) && <span className="ml-1 text-accent" title={`You own ${owned.get(d.id)!.models} models`}>✓</span>}
              </span>
              <span className="text-xs text-muted">{d.points[0]?.points ?? '—'}</span>
              <button className="btn px-2 py-0.5" aria-label={`Add ${d.name}`} onClick={() => add(d)}>+</button>
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}
