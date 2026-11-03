import { useState } from 'react'
import { BoxDialog } from '../barcodes/BoxScan'
import { ctx, useStore } from '../../app/store'
import type { OwnedUnit } from '../../domain/collection/types'
import {
  checkedOutTo, checkOut, descendants, fill, homedIn, kindOf, pathLabel, pickList, placeById, putBack, putBackList, removePlace, removeSite, saveKinds, savePlace,
  saveSite, setFlow, setHome, siteOf, sitePlaces, unitLog, whereIs, type KindDef, type Place, type Site, type Storage,
} from '../../domain/storage/storage'
import { Dialog } from '../../ui/Dialog'
import { CodeBadge, FindCode, LabelsDialog } from './Labels'

const icon = (k: string) => kindOf(useStore.getState().storage, k).icon

/** Places in tree order with their depth, for lists and selects. */
function tree(s: Storage, siteId?: string | null): { place: Place; depth: number }[] {
  const out: { place: Place; depth: number }[] = []
  const roots = siteId === undefined || !s.sites.length ? undefined : new Set(sitePlaces(s, siteId ?? undefined).map((p) => p.id))
  const walk = (parentId: string | undefined, depth: number) => {
    for (const p of s.places.filter((x) => x.parentId === parentId && (parentId || !roots || roots.has(x.id))).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
      out.push({ place: p, depth })
      walk(p.id, depth + 1)
    }
  }
  walk(undefined, 0)
  return out
}

function PlaceSelect({ value, onChange, label, exclude, empty = 'None', only }: { value?: string; onChange: (id?: string) => void; label: string; exclude?: Set<string>; empty?: string; only?: string[] }) {
  const { storage } = useStore()
  return (
    <select className="input" aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{empty}</option>
      {(storage.sites.length > 1 ? storage.sites : [undefined]).map((site) => {
        const rows = tree(storage, site?.id).filter(({ place }) => !exclude?.has(place.id) && (!only || only.includes(place.kind)))
        const opts = rows.map(({ place, depth }) => <option key={place.id} value={place.id}>{' '.repeat(depth * 2)}{icon(place.kind)} {place.name}</option>)
        return site ? <optgroup key={site.id} label={site.name}>{opts}</optgroup> : opts
      })}
    </select>
  )
}

function useSave() {
  const { storage, saveStorage } = useStore()
  const [err, setErr] = useState('')
  const run = (f: (s: Storage) => Storage) => {
    try {
      setErr('')
      void saveStorage(f(useStore.getState().storage ?? storage))
    } catch (x) {
      setErr((x as Error).message)
    }
  }
  return { run, err }
}

function PlaceForm({ start, siteId, onDone }: { start?: Place; siteId?: string; onDone: (id?: string) => void }) {
  const { storage } = useStore()
  const { run, err } = useSave()
  const [p, setP] = useState<Place>(start ?? { id: crypto.randomUUID(), name: '', kind: storage.kinds[0]?.id ?? 'box', siteId, location: '', note: '', createdAt: new Date().toISOString() })
  return (
    <form
      className="grid gap-2 rounded border border-line p-3"
      aria-label={start ? 'Edit place' : 'Add place'}
      onSubmit={(e) => {
        e.preventDefault()
        let ok = false
        run((s) => {
          const next = savePlace(s, p)
          ok = true
          return next
        })
        if (ok) onDone(p.id)
      }}
    >
      <div className="flex flex-wrap gap-2">
        <select className="input" aria-label="Kind" value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value })}>
          {storage.kinds.map((k) => <option key={k.id} value={k.id}>{k.icon} {k.name}</option>)}
        </select>
        <input className="input flex-1" aria-label="Name" placeholder="Name or number, e.g. Box 3, Bag 7" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
      </div>
      <div className="flex flex-wrap gap-2">
        <PlaceSelect label="Inside" empty="Not inside anything" value={p.parentId} exclude={start ? descendants(storage, start.id) : undefined} onChange={(v) => setP({ ...p, parentId: v })} />
        {!p.parentId && storage.sites.length > 0 && (
          <select className="input" aria-label="Storage" value={p.siteId ?? storage.sites[0].id} onChange={(e) => setP({ ...p, siteId: e.target.value })}>
            {storage.sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        )}
        <input className="input flex-1" aria-label="Location" placeholder="Where, e.g. study, shelf 2" value={p.location} onChange={(e) => setP({ ...p, location: e.target.value })} />
        <input className="input w-28" type="number" min={1} aria-label="Slots" placeholder="Slots" value={p.capacity ?? ''} onChange={(e) => setP({ ...p, capacity: e.target.value ? Number(e.target.value) : undefined })} />
      </div>
      <input className="input" aria-label="Place note" placeholder="Note (foam layout, magnets…)" value={p.note} onChange={(e) => setP({ ...p, note: e.target.value })} />
      <div className="flex gap-2">
        <button className="btn btn-primary">Save</button>
        <button type="button" className="btn" onClick={() => onDone()}>Cancel</button>
      </div>
      {err && <p className="text-sm text-danger" role="alert">{err}</p>}
    </form>
  )
}

function FillBar({ s, id }: { s: Storage; id: string }) {
  const f = fill(s, id)
  const now = checkedOutTo(s, id).length
  const extra = now ? ` · ${now} in now` : ''
  if (!f.capacity) return <span className="text-xs text-muted">{f.used} stored{extra}</span>
  return (
    <span className="flex items-center gap-2 text-xs text-muted">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-panel-2"><span className={`block h-full ${f.used >= f.capacity ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${Math.min(1, f.used / f.capacity) * 100}%` }} /></span>
      {f.used}/{f.capacity} slots{extra}
    </span>
  )
}

function PlaceDetail({ id, onOpenUnit, onEdit, onDeleted, onOpenPlace, full }: { id: string; onOpenUnit: (id: string) => void; onEdit: () => void; onDeleted: () => void; onOpenPlace?: (id: string) => void; full?: boolean }) {
  const { storage: s, units } = useStore()
  const { run } = useSave()
  const p = placeById(s, id)!
  const name = (u: string) => units.find((x) => x.id === u)?.customName ?? 'Deleted unit'
  const homed = homedIn(s, id)
  const here = checkedOutTo(s, id)
  const back = putBackList(s, id)
  const inside = s.places.filter((x) => x.parentId === id)
  return (
    <section className="panel grid content-start gap-3 p-4" aria-label={`Place ${p.name}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted">{pathLabel(s, p.parentId) || siteOf(s, id)?.name || 'Top level'}</p>
          <h2 className="font-display text-xl">{icon(p.kind)} {p.name}</h2>
          {p.location && <p className="text-sm text-muted">📍 {p.location}</p>}
          {p.note && <p className="text-sm text-muted">{p.note}</p>}
          <FillBar s={s} id={id} />
        </div>
        <div className="flex gap-2">
          {!full && onOpenPlace && <button className="btn" title="Open the full page of this place" onClick={() => onOpenPlace(id)}>⤢ Open page</button>}
          <button className="btn" onClick={onEdit}>Edit</button>
          <button className="btn" onClick={() => { if (confirm(`Remove "${p.name}"? What is inside moves up one level and its units lose this home.`)) { run((x) => removePlace(x, id, ctx())); onDeleted() } }}>Delete</button>
        </div>
      </header>
      {full && <CodeBadge id={id} kind="place" />}
      {inside.length > 0 && (
        <p className="flex flex-wrap gap-2 text-sm">Inside:{inside.map((x) => onOpenPlace ? <button key={x.id} className="text-accent underline" onClick={() => onOpenPlace(x.id)}>{icon(x.kind)} {x.name}</button> : <span key={x.id}>{icon(x.kind)} {x.name}</span>)}</p>
      )}
      <div>
        <h3 className="text-sm text-muted">Home of</h3>
        {homed.length ? (
          <ul className="grid gap-1 text-sm" aria-label="Units stored here">
            {homed.map(({ unitId, slot }) => {
              const w = whereIs(s, unitId)
              return (
                <li key={unitId} className="flex flex-wrap items-center gap-2">
                  <span className="w-14 text-muted">{slot !== undefined ? `slot ${slot}` : '—'}</span>
                  <button className="text-accent underline" onClick={() => onOpenUnit(unitId)}>{name(unitId)}</button>
                  {w.out && <span className="text-xs text-muted">out → {pathLabel(s, w.placeId)}</span>}
                </li>
              )
            })}
          </ul>
        ) : <p className="text-sm text-muted">Nothing stored here yet. Set a unit's home on its page.</p>}
      </div>
      {here.length > 0 && (
        <div className="grid gap-2">
          <h3 className="text-sm text-muted">In here now (checked out)</h3>
          <PickStops stops={back.stops} name={name} />
          {back.unstored.length > 0 && <p className="text-sm">No home yet: {back.unstored.map(name).join(', ')}</p>}
          <button className="btn w-fit" onClick={() => run((x) => putBack(x, here, ctx()))}>↩ Put everything back</button>
        </div>
      )}
      {full && (
        <div>
          <h3 className="text-sm text-muted">History</h3>
          {s.log.some((m) => m.placeId === id) ? (
            <ul className="text-xs text-muted" aria-label="Place history">
              {s.log.filter((m) => m.placeId === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map((m) => (
                <li key={m.id}>{m.date.slice(0, 10)} · {name(m.unitId)} {m.kind === 'home' ? 'stored here' : m.kind === 'out' ? 'checked out here' : 'put back here'}</li>
              ))}
            </ul>
          ) : <p className="text-xs text-muted">No moves yet.</p>}
        </div>
      )}
    </section>
  )
}

function PickStops({ stops, name }: { stops: ReturnType<typeof pickList>['stops']; name: (id: string) => string }) {
  return (
    <ol className="grid gap-2 text-sm" aria-label="Places to open">
      {stops.map((st, i) => (
        <li key={st.placeId}>
          <b>{i + 1}. {st.path}</b>
          <ul className="ml-5 list-disc">{st.items.map((x) => <li key={x.unitId}>{name(x.unitId)}{x.slot !== undefined ? <span className="text-muted"> · slot {x.slot}</span> : null}</li>)}</ul>
        </li>
      ))}
    </ol>
  )
}

function SiteForm({ start, onDone }: { start?: Site; onDone: (id?: string) => void }) {
  const { run, err } = useSave()
  const [x, setX] = useState<Site>(start ?? { id: crypto.randomUUID(), name: '', address: '', note: '' })
  return (
    <form
      className="grid gap-2 rounded border border-line p-3"
      aria-label={start ? 'Edit storage' : 'Add storage'}
      onSubmit={(e) => {
        e.preventDefault()
        let ok = false
        run((st) => {
          const next = saveSite(st, x)
          ok = true
          return next
        })
        if (ok) onDone(x.id)
      }}
    >
      <div className="flex flex-wrap gap-2">
        <input className="input flex-1" aria-label="Storage name" placeholder="Home, Club locker, Friend's house…" value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} />
        <input className="input flex-1" aria-label="Address" placeholder="Address (optional)" value={x.address} onChange={(e) => setX({ ...x, address: e.target.value })} />
      </div>
      <input className="input" aria-label="Storage note" placeholder="Note" value={x.note} onChange={(e) => setX({ ...x, note: e.target.value })} />
      <div className="flex gap-2">
        <button className="btn btn-primary">Save</button>
        <button type="button" className="btn" onClick={() => onDone()}>Cancel</button>
      </div>
      {err && <p className="text-sm text-danger" role="alert">{err}</p>}
    </form>
  )
}

/** Tab shown when coming back to the Storage page. */
let lastSite: string | undefined

/** Storage page: one tab per storage (home, club…), its tree of places and what is in each. */
export function StoragePage({ onOpenUnit, onOpenPlace }: { onOpenUnit: (id: string) => void; onOpenPlace: (id: string) => void }) {
  const { storage: s } = useStore()
  const { run } = useSave()
  const [siteId, setSite] = useState<string | undefined>(lastSite ?? s.sites[0]?.id)
  const setSiteId = (id: string | undefined) => {
    lastSite = id
    setSite(id)
  }
  const [sel, setSel] = useState<string>()
  const [form, setForm] = useState<'new' | 'edit' | 'site' | 'edit-site' | null>(null)
  const [labels, setLabels] = useState(false)
  const [box, setBox] = useState<string>()
  const site = s.sites.find((x) => x.id === siteId) ?? s.sites[0]
  const out = Object.keys(s.out).length
  const rows = tree(s, site?.id ?? null)
  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-accent">Storage</h1>
        <div className="flex flex-wrap items-start gap-2">
          <FindCode onFound={(t) => (t.kind === 'unit' ? onOpenUnit(t.id) : onOpenPlace(t.id))} onBarcode={setBox} />
          {box && <BoxDialog code={box} onOpenUnit={onOpenUnit} onClose={() => setBox(undefined)} />}
          <button className="btn" onClick={() => setLabels(true)}>🏷 Labels</button>
        </div>
      </header>
      <p className="-mt-2 text-sm text-muted">{s.places.length} places · {Object.keys(s.homes).length} units stored{out ? ` · ${out} checked out` : ''}</p>
      {labels && <LabelsDialog onClose={() => setLabels(false)} />}
      <div className="flex flex-wrap items-center gap-1 border-b border-line" role="tablist" aria-label="Storages">
        {s.sites.map((x) => (
          <button key={x.id} role="tab" aria-selected={site?.id === x.id} className={`rounded-t px-3 py-1.5 ${site?.id === x.id ? 'bg-panel-2 text-accent' : 'text-muted hover:text-fg'}`} onClick={() => { setSiteId(x.id); setSel(undefined); setForm(null) }}>
            🏠 {x.name}
          </button>
        ))}
        <button className="px-3 py-1.5 text-sm text-muted hover:text-accent" onClick={() => setForm('site')}>+ Add storage</button>
      </div>
      {form === 'site' && <SiteForm onDone={(id) => { setForm(null); if (id) setSiteId(id) }} />}
      {form === 'edit-site' && site && <SiteForm start={site} onDone={() => setForm(null)} />}
      {site && form !== 'edit-site' && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted">{[site.address, site.note].filter(Boolean).join(' · ') || 'Independent storage with its own places.'}</span>
          <span className="flex gap-2">
            <button className="btn" onClick={() => setForm('edit-site')}>Edit storage</button>
            <button className="btn" onClick={() => { if (confirm(`Remove storage "${site.name}"? Its places move to another storage.`)) { run((x) => removeSite(x, site.id)); setSiteId(undefined) } }}>Delete storage</button>
          </span>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_2fr]">
        <section className="panel grid content-start gap-2 p-4" aria-label="Places">
          <button className="btn btn-primary w-fit" onClick={() => setForm('new')}>+ Add place</button>
          {form === 'new' && <PlaceForm siteId={site?.id} onDone={(id) => { setForm(null); if (id) setSel(id) }} />}
          {rows.length === 0 && form !== 'new' && <p className="text-sm text-muted">Add your shelves, drawers, boxes, sprue bags and travel cases. Places can sit inside each other.</p>}
          <ul className="grid gap-0.5">
            {rows.map(({ place, depth }) => (
              <li key={place.id}>
                <button aria-current={sel === place.id ? 'true' : undefined} className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left ${sel === place.id ? 'bg-panel-2 text-accent' : 'hover:bg-panel-2'}`} style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }} onClick={() => { setSel(place.id); setForm(null) }} onDoubleClick={() => onOpenPlace(place.id)}>
                  <span>{icon(place.kind)} {place.name}</span>
                  <FillBar s={s} id={place.id} />
                </button>
              </li>
            ))}
          </ul>
        </section>
        {sel && placeById(s, sel) ? (
          form === 'edit' ? <PlaceForm start={placeById(s, sel)} onDone={() => setForm(null)} /> : <PlaceDetail id={sel} onOpenUnit={onOpenUnit} onOpenPlace={onOpenPlace} onEdit={() => setForm('edit')} onDeleted={() => setSel(undefined)} />
        ) : <p className="text-muted">Pick a place to see what is inside. Double-click to open its page.</p>}
      </div>
    </div>
  )
}

/** Full page of one place. */
export function PlacePage({ placeId, onBack, onOpenUnit, onOpenPlace }: { placeId: string; onBack: () => void; onOpenUnit: (id: string) => void; onOpenPlace: (id: string) => void }) {
  const { storage: s } = useStore()
  const [editing, setEditing] = useState(false)
  const p = placeById(s, placeId)
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-3">
      <button className="w-fit text-sm text-muted hover:text-accent" onClick={p?.parentId ? () => onOpenPlace(p.parentId!) : onBack}>← Back to {p?.parentId ? placeById(s, p.parentId)?.name : 'Storage'}</button>
      {!p ? <p className="text-muted">This place no longer exists.</p>
        : editing ? <PlaceForm start={p} onDone={() => setEditing(false)} />
        : <PlaceDetail id={placeId} full onOpenUnit={onOpenUnit} onOpenPlace={onOpenPlace} onEdit={() => setEditing(true)} onDeleted={onBack} />}
    </div>
  )
}

/** Settings: the list of place kinds (Shelf, Box, Drawer…). */
export function KindsEditor() {
  const { storage: s } = useStore()
  const { run, err } = useSave()
  const [rows, setRows] = useState<KindDef[]>(s.kinds)
  const used = (id: string) => s.places.filter((p) => p.kind === id).length
  const move = (i: number, d: number) => {
    const r = [...rows]
    ;[r[i], r[i + d]] = [r[i + d], r[i]]
    setRows(r)
  }
  return (
    <section className="panel grid gap-2 p-4" aria-label="Place kinds">
      <h3 className="font-display text-lg">Storage place kinds</h3>
      <p className="text-sm text-muted">Kinds of places in Storage. Kinds used by places can't be deleted.</p>
      <ul className="grid gap-1">
        {rows.map((k, i) => (
          <li key={k.id} className="flex items-center gap-2">
            <input className="input w-14 text-center" aria-label={`Icon of ${k.name}`} value={k.icon} onChange={(e) => setRows(rows.map((x) => (x.id === k.id ? { ...x, icon: e.target.value } : x)))} />
            <input className="input flex-1" aria-label={`Name of ${k.name}`} value={k.name} onChange={(e) => setRows(rows.map((x) => (x.id === k.id ? { ...x, name: e.target.value } : x)))} />
            <span className="w-16 text-xs text-muted">{used(k.id)} used</span>
            <button className="btn px-2 py-0.5" aria-label={`Move ${k.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button className="btn px-2 py-0.5" aria-label={`Move ${k.name} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button className="btn px-2 py-0.5" aria-label={`Delete ${k.name}`} disabled={used(k.id) > 0} onClick={() => setRows(rows.filter((x) => x.id !== k.id))}>✕</button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => setRows([...rows, { id: crypto.randomUUID().slice(0, 8), name: 'New kind', icon: '📦' }])}>+ Add kind</button>
        <button className="btn btn-primary" onClick={() => run((x) => saveKinds(x, rows))}>Save kinds</button>
      </div>
      {err && <p className="text-sm text-danger" role="alert">{err}</p>}
    </section>
  )
}

/** Unit page section: home (place + slot), where it is now, check out / put back, moves. */
export function UnitStorage({ unit }: { unit: OwnedUnit }) {
  const { storage: s, pipelines } = useStore()
  const { run, err } = useSave()
  const home = s.homes[unit.id]
  const w = whereIs(s, unit.id)
  const [target, setTarget] = useState<string>()
  const f = home ? fill(s, home.placeId) : undefined
  const slots = f?.capacity ? [...new Set([...(home?.slot ? [home.slot] : []), ...f.free])].sort((a, b) => a - b) : []
  const log = unitLog(s, unit.id).slice(0, 5)
  return (
    <section className="grid gap-2 border-b border-line p-4" aria-label="Storage">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Storage</h3>
      <CodeBadge id={unit.id} kind="unit" />
      {s.places.length === 0 ? <p className="text-sm text-muted">Add boxes and other places on the Storage page first.</p> : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-12 text-muted">Home</span>
            <PlaceSelect label="Home place" empty="No home" value={home?.placeId} onChange={(id) => run((x) => setHome(x, unit.id, id ? { placeId: id, slot: fill(x, id).free[0] } : undefined, ctx()))} />
            {home && f?.capacity ? (
              <select className="input" aria-label="Slot" value={home.slot ?? ''} onChange={(e) => run((x) => setHome(x, unit.id, { placeId: home.placeId, slot: e.target.value ? Number(e.target.value) : undefined }, ctx()))}>
                <option value="">No slot</option>
                {slots.map((n) => <option key={n} value={n}>slot {n}</option>)}
                {/* a bag can share a slot with other units of the same sprue */}
                {Array.from({ length: f.capacity }, (_, i) => i + 1).filter((n) => !slots.includes(n)).map((n) => <option key={n} value={n}>slot {n} (shared)</option>)}
              </select>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-12 text-muted">Status</span>
            <select className="input" aria-label="Storage status" value={s.flow[unit.id] ?? ''} onChange={(e) => run((x) => setFlow(x, [unit.id], e.target.value || undefined))}>
              <option value="">—</option>
              {pipelines.storage.stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </div>
          <p className="text-sm">
            {w.placeId ? <>Now: <b>{pathLabel(s, w.placeId, w.slot)}</b>{w.out ? <span className="text-muted"> (checked out)</span> : null}</> : <span className="text-muted">Not stored anywhere yet.</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <PlaceSelect label="Check out to" empty="Check out to…" value={target} exclude={home ? new Set([home.placeId]) : undefined} onChange={setTarget} />
            <button className="btn" disabled={!target} onClick={() => { run((x) => checkOut(x, [unit.id], target!, ctx())); setTarget(undefined) }}>Check out</button>
            {w.out && <button className="btn" onClick={() => run((x) => putBack(x, [unit.id], ctx()))}>↩ Put back{home ? '' : ' (no home)'}</button>}
          </div>
          {log.length > 0 && (
            <ul className="text-xs text-muted" aria-label="Storage moves">
              {log.map((m) => <li key={m.id}>{m.date.slice(0, 10)} · {m.kind === 'home' ? (m.placeId ? `home → ${pathLabel(s, m.placeId, m.slot)}` : 'home removed') : m.kind === 'out' ? `out → ${pathLabel(s, m.placeId)}` : 'put back'}</li>)}
            </ul>
          )}
          {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        </>
      )}
    </section>
  )
}

/** Army list: where to collect its units, and pack them into a case. */
export function PickListDialog({ unitIds, unlinked, title, onClose }: { unitIds: string[]; unlinked: number; title: string; onClose: () => void }) {
  const { storage: s, units } = useStore()
  const { run } = useSave()
  const cases = s.places.filter((p) => p.kind === 'case' || p.kind === 'tray')
  const [target, setTarget] = useState<string | undefined>(cases[0]?.id)
  const name = (u: string) => units.find((x) => x.id === u)?.customName ?? 'Deleted unit'
  const pick = pickList(s, unitIds, target)
  const toPack = pick.stops.flatMap((st) => st.items.map((x) => x.unitId))
  return (
    <Dialog title={`Pick list: ${title}`} onClose={onClose} wide>
      <div className="grid gap-3" id="pick-list">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Pack into
          <PlaceSelect label="Pack into" empty="(just collect)" value={target} onChange={setTarget} />
        </div>
        {pick.stops.length > 0 ? <PickStops stops={pick.stops} name={name} /> : <p className="text-sm text-muted">Nothing to collect.</p>}
        {pick.ready.length > 0 && <p className="text-sm">✅ Already in {placeById(s, target)?.name}: {pick.ready.map(name).join(', ')}</p>}
        {pick.unstored.length > 0 && <p className="text-sm">❓ Not stored anywhere: {pick.unstored.map(name).join(', ')}</p>}
        {unlinked > 0 && <p className="text-sm text-muted">{unlinked} list {unlinked === 1 ? 'entry is' : 'entries are'} not linked to a unit of your collection.</p>}
        <div className="flex flex-wrap gap-2">
          {target && toPack.length > 0 && <button className="btn btn-primary" onClick={() => run((x) => checkOut(x, toPack, target, ctx()))}>🧳 Pack {toPack.length} into {placeById(s, target)?.name}</button>}
          {target && pick.ready.length > 0 && <button className="btn" onClick={() => run((x) => putBack(x, pick.ready, ctx()))}>↩ Put back {pick.ready.length}</button>}
          <button className="btn" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>
    </Dialog>
  )
}
