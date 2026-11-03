import { useState } from 'react'
import { ctx, useStore } from '../../app/store'
import type { OwnedUnit } from '../../domain/collection/types'
import {
  checkedOutTo, checkOut, descendants, fill, homedIn, pathLabel, pickList, PLACE_KINDS, placeById, putBack, putBackList, removePlace, savePlace,
  setHome, unitLog, whereIs, type Place, type PlaceKind, type Storage,
} from '../../domain/storage/storage'
import { Dialog } from '../../ui/Dialog'

const icon = (k: PlaceKind) => PLACE_KINDS.find((x) => x.id === k)?.icon ?? '📦'

/** Places in tree order with their depth, for lists and selects. */
function tree(s: Storage): { place: Place; depth: number }[] {
  const out: { place: Place; depth: number }[] = []
  const walk = (parentId: string | undefined, depth: number) => {
    for (const p of s.places.filter((x) => x.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
      out.push({ place: p, depth })
      walk(p.id, depth + 1)
    }
  }
  walk(undefined, 0)
  return out
}

function PlaceSelect({ value, onChange, label, exclude, empty = 'None', only }: { value?: string; onChange: (id?: string) => void; label: string; exclude?: Set<string>; empty?: string; only?: PlaceKind[] }) {
  const { storage } = useStore()
  return (
    <select className="input" aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{empty}</option>
      {tree(storage).filter(({ place }) => !exclude?.has(place.id) && (!only || only.includes(place.kind))).map(({ place, depth }) => (
        <option key={place.id} value={place.id}>{' '.repeat(depth * 2)}{icon(place.kind)} {place.name}</option>
      ))}
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

function PlaceForm({ start, onDone }: { start?: Place; onDone: (id?: string) => void }) {
  const { storage } = useStore()
  const { run, err } = useSave()
  const [p, setP] = useState<Place>(start ?? { id: crypto.randomUUID(), name: '', kind: 'box', location: '', note: '', createdAt: new Date().toISOString() })
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
        <select className="input" aria-label="Kind" value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value as PlaceKind })}>
          {PLACE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.icon} {k.name}</option>)}
        </select>
        <input className="input flex-1" aria-label="Name" placeholder="Name or number, e.g. Box 3, Bag 7" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
      </div>
      <div className="flex flex-wrap gap-2">
        <PlaceSelect label="Inside" empty="Not inside anything" value={p.parentId} exclude={start ? descendants(storage, start.id) : undefined} onChange={(v) => setP({ ...p, parentId: v })} />
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

function PlaceDetail({ id, onOpenUnit, onEdit, onDeleted }: { id: string; onOpenUnit: (id: string) => void; onEdit: () => void; onDeleted: () => void }) {
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
          <p className="text-xs text-muted">{pathLabel(s, p.parentId) || 'Top level'}</p>
          <h2 className="font-display text-xl">{icon(p.kind)} {p.name}</h2>
          {p.location && <p className="text-sm text-muted">📍 {p.location}</p>}
          {p.note && <p className="text-sm text-muted">{p.note}</p>}
          <FillBar s={s} id={id} />
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={onEdit}>Edit</button>
          <button className="btn" onClick={() => { if (confirm(`Remove "${p.name}"? What is inside moves up one level and its units lose this home.`)) { run((x) => removePlace(x, id, ctx())); onDeleted() } }}>Delete</button>
        </div>
      </header>
      {inside.length > 0 && <p className="text-sm">Inside: {inside.map((x) => `${icon(x.kind)} ${x.name}`).join(', ')}</p>}
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

/** Storage page: the tree of places and what is in each. */
export function StoragePage({ onOpenUnit }: { onOpenUnit: (id: string) => void }) {
  const { storage: s } = useStore()
  const [sel, setSel] = useState<string>()
  const [form, setForm] = useState<'new' | 'edit' | null>(null)
  const out = Object.keys(s.out).length
  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-accent">Storage</h1>
        <span className="text-sm text-muted">{s.places.length} places · {Object.keys(s.homes).length} units stored{out ? ` · ${out} checked out` : ''}</span>
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_2fr]">
        <section className="panel grid content-start gap-2 p-4" aria-label="Places">
          <button className="btn btn-primary w-fit" onClick={() => setForm('new')}>+ Add place</button>
          {form === 'new' && <PlaceForm onDone={(id) => { setForm(null); if (id) setSel(id) }} />}
          {s.places.length === 0 && form !== 'new' && <p className="text-sm text-muted">Add your shelves, boxes, sprue bags and travel cases. Places can sit inside each other.</p>}
          <ul className="grid gap-0.5">
            {tree(s).map(({ place, depth }) => (
              <li key={place.id}>
                <button aria-current={sel === place.id ? 'true' : undefined} className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left ${sel === place.id ? 'bg-panel-2 text-accent' : 'hover:bg-panel-2'}`} style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }} onClick={() => { setSel(place.id); setForm(null) }}>
                  <span>{icon(place.kind)} {place.name}</span>
                  <FillBar s={s} id={place.id} />
                </button>
              </li>
            ))}
          </ul>
        </section>
        {sel && placeById(s, sel) ? (
          form === 'edit' ? <PlaceForm start={placeById(s, sel)} onDone={() => setForm(null)} /> : <PlaceDetail id={sel} onOpenUnit={onOpenUnit} onEdit={() => setForm('edit')} onDeleted={() => setSel(undefined)} />
        ) : <p className="text-muted">Pick a place to see what is inside.</p>}
      </div>
    </div>
  )
}

/** Unit page section: home (place + slot), where it is now, check out / put back, moves. */
export function UnitStorage({ unit }: { unit: OwnedUnit }) {
  const { storage: s } = useStore()
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
