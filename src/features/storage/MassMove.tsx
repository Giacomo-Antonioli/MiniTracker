import { useCallback, useRef, useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { codeFromText, findCode } from '../../domain/storage/codes'
import { checkOut, descendants, kindOf, moveHomes, movePlace, pathLabel, placeById, planMove, type Storage } from '../../domain/storage/storage'
import type { WorkshopItem, WorkshopKind } from '../../domain/workshop/item'
import { Dialog } from '../../ui/Dialog'
import { ScanDialog } from './Labels'
import { PlaceSelect } from './Storage'

export type MoveMode = 'home' | 'out'
type ItemRef = { kind: WorkshopKind; id: string }
const key = (r: ItemRef) => `${r.kind}:${r.id}`

/** Tools and supplies whose storage place is `placeId`. */
export function itemsIn(s: { tools: WorkshopItem[]; supplies: WorkshopItem[] }, placeId: string): (ItemRef & { name: string })[] {
  return [
    ...s.tools.filter((t) => t.placeId === placeId).map((t) => ({ kind: 'tool' as const, id: t.id, name: t.name })),
    ...s.supplies.filter((t) => t.placeId === placeId).map((t) => ({ kind: 'supply' as const, id: t.id, name: t.name })),
  ]
}

/** Sets the storage place of these tools and supplies. */
async function moveItems(refs: ItemRef[], placeId: string) {
  const st = useStore.getState()
  for (const r of refs) {
    const list = r.kind === 'tool' ? st.tools : st.supplies
    const item = list.find((x) => x.id === r.id)
    if (!item) continue
    const next = { ...item, placeId, updatedAt: ctx().now }
    await (r.kind === 'tool' ? st.saveTool(next) : st.saveSupply(next))
  }
}

function ModePicker({ mode, setMode }: { mode: MoveMode; setMode: (m: MoveMode) => void }) {
  return (
    <div className="flex flex-wrap gap-3 text-sm" role="radiogroup" aria-label="How to move">
      <label className="flex items-center gap-1"><input type="radio" checked={mode === 'home'} onChange={() => setMode('home')} /> Move for good (new home)</label>
      <label className="flex items-center gap-1"><input type="radio" checked={mode === 'out'} onChange={() => setMode('out')} /> Take for now (check out)</label>
    </div>
  )
}

/** Pick units (and tools and supplies), a destination, and move them all at once. */
export function MassMoveDialog({ title, unitIds, items = [], fromPlaceId, onClose }: { title: string; unitIds: string[]; items?: (ItemRef & { name: string })[]; fromPlaceId?: string; onClose: () => void }) {
  const { storage: s, units, saveStorage } = useStore()
  const [picked, setPicked] = useState<string[]>(unitIds)
  const [pickedItems, setPickedItems] = useState<string[]>(items.map(key))
  const [target, setTarget] = useState<string>()
  const [mode, setMode] = useState<MoveMode>('home')
  const [err, setErr] = useState('')
  const name = (id: string) => units.find((u) => u.id === id)?.customName ?? 'Deleted unit'
  const toggle = (list: string[], set: (x: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const plan = target && mode === 'home' ? planMove(s, picked.filter((u) => s.homes[u]?.placeId !== target), target) : undefined
  const count = picked.length + pickedItems.length

  const go = async () => {
    if (!target) return
    if (plan?.noSlot.length && !confirm(`${placeById(s, target)!.name} is full: ${plan.noSlot.length} unit(s) will be stored there without a slot. Move anyway?`)) return
    try {
      const next = mode === 'home' ? moveHomes(s, picked, target, ctx()) : checkOut(s, picked, target, ctx())
      await saveStorage(next)
      await moveItems(items.filter((r) => pickedItems.includes(key(r))), target)
      onClose()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <Dialog title={title} onClose={onClose} wide>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Move to</span>
          <PlaceSelect label="Move to" empty="Choose a place…" value={target} exclude={fromPlaceId ? new Set([fromPlaceId]) : undefined} onChange={setTarget} />
        </div>
        {picked.length > 0 && <ModePicker mode={mode} setMode={setMode} />}
        <div className="flex gap-2 text-xs">
          <button className="underline" onClick={() => { setPicked(unitIds); setPickedItems(items.map(key)) }}>All</button>
          <button className="underline" onClick={() => { setPicked([]); setPickedItems([]) }}>None</button>
        </div>
        <fieldset className="grid max-h-72 content-start gap-1 overflow-auto text-sm">
          <legend className="text-xs text-muted">What to move ({count})</legend>
          {unitIds.map((u) => {
            const slot = plan?.slots[u]
            return (
              <label key={u} className="flex items-center gap-2">
                <input type="checkbox" checked={picked.includes(u)} onChange={() => toggle(picked, setPicked, u)} />
                {name(u)}
                <span className="text-xs text-muted">
                  {s.homes[u] ? `from ${pathLabel(s, s.homes[u].placeId, s.homes[u].slot)}` : 'no home yet'}
                  {plan && picked.includes(u) && s.homes[u]?.placeId !== target && (slot !== undefined ? ` → slot ${slot}` : plan.noSlot.includes(u) ? ' → no free slot' : '')}
                </span>
              </label>
            )
          })}
          {items.map((r) => (
            <label key={key(r)} className="flex items-center gap-2">
              <input type="checkbox" checked={pickedItems.includes(key(r))} onChange={() => toggle(pickedItems, setPickedItems, key(r))} />
              {r.kind === 'tool' ? '🔧' : '🧴'} {r.name}
            </label>
          ))}
        </fieldset>
        {plan && plan.noSlot.length > 0 && <p className="text-sm text-danger" role="status">⚠ Not enough free slots: {plan.noSlot.length} will have no slot.</p>}
        <button className="btn btn-primary w-fit" disabled={!target || !count} onClick={() => void go()}>
          📦 Move {count} {target ? `to ${placeById(s, target)?.name}` : ''}
        </button>
        {err && <p className="text-sm text-danger" role="alert">{err}</p>}
      </div>
    </Dialog>
  )
}

/** Moves a place (and everything inside it) into another place or to the top of a storage. */
export function MovePlaceDialog({ placeId, onClose }: { placeId: string; onClose: () => void }) {
  const { storage: s, saveStorage } = useStore()
  const p = placeById(s, placeId)!
  const [parentId, setParentId] = useState<string | undefined>(p.parentId)
  const [siteId, setSiteId] = useState<string | undefined>(p.siteId ?? s.sites[0]?.id)
  const [err, setErr] = useState('')
  const inside = descendants(s, placeId).size - 1
  return (
    <Dialog title={`Move ${p.name}`} onClose={onClose}>
      <div className="grid gap-3 text-sm">
        <p className="text-muted">Everything inside {p.name}{inside ? ` (${inside} place${inside > 1 ? 's' : ''} and their contents)` : ''} moves with it; homes and slots stay the same.</p>
        <label className="flex flex-wrap items-center gap-2">Put it in
          <PlaceSelect label="Put it in" empty="Nothing (top level)" value={parentId} exclude={descendants(s, placeId)} onChange={setParentId} />
        </label>
        {!parentId && s.sites.length > 0 && (
          <label className="flex flex-wrap items-center gap-2">Storage
            <select className="input" aria-label="Storage" value={siteId} onChange={(e) => setSiteId(e.target.value)}>{s.sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </label>
        )}
        <button className="btn btn-primary w-fit" onClick={() => {
          try {
            void saveStorage(movePlace(s, placeId, { parentId, siteId }))
            onClose()
          } catch (e) {
            setErr((e as Error).message)
          }
        }}>Move</button>
        {err && <p className="text-danger" role="alert">{err}</p>}
      </div>
    </Dialog>
  )
}

/** Scan stickers one after another; each unit (or box) scanned moves into `placeId`. */
export function ScanMoveDialog({ placeId, onClose }: { placeId: string; onClose: () => void }) {
  const { units } = useStore()
  const [mode, setMode] = useState<MoveMode>('home')
  const [done, setDone] = useState<{ code: string; text: string; ok: boolean }[]>([])
  const [round, setRound] = useState(0)
  const [open, setOpen] = useState(true)
  const target = placeById(useStore.getState().storage, placeId)
  const last = useRef({ code: '', at: 0 })
  const onText = useCallback((raw: string) => {
    const st = useStore.getState()
    const code = codeFromText(raw) ?? raw.trim().toUpperCase()
    // the same sticker still in front of the camera: ignore it for a moment
    if (code === last.current.code && Date.now() - last.current.at < 3000) return setRound((r) => r + 1)
    last.current = { code, at: Date.now() }
    const t = findCode(st.storage, code)
    let text = `${code}: no unit or place with this code`
    let ok = false
    try {
      if (t?.kind === 'unit') {
        const s: Storage = mode === 'home' ? moveHomes(st.storage, [t.id], placeId, ctx()) : checkOut(st.storage, [t.id], placeId, ctx())
        void st.saveStorage(s)
        const slot = s.homes[t.id]?.placeId === placeId ? s.homes[t.id].slot : undefined
        text = `${units.find((u) => u.id === t.id)?.customName ?? code}${mode === 'home' && slot !== undefined ? ` → slot ${slot}` : ''}`
        ok = true
      } else if (t?.kind === 'place') {
        void st.saveStorage(movePlace(st.storage, t.id, { parentId: placeId }))
        const p = placeById(st.storage, t.id)!
        text = `${kindOf(st.storage, p.kind).icon} ${p.name} (and what is inside)`
        ok = true
      }
    } catch (e) {
      text = `${code}: ${(e as Error).message}`
    }
    setDone((d) => [{ code, text, ok }, ...d])
    // restart the scanner for the next sticker
    setRound((r) => r + 1)
  }, [mode, placeId, units])

  return (
    <Dialog title={`Scan into ${target?.name ?? ''}`} onClose={onClose}>
      <div className="grid gap-2 text-sm">
        <ModePicker mode={mode} setMode={setMode} />
        <p className="text-xs text-muted">Scan or type each sticker; every unit or box you scan moves into {target?.name}. Close when you are done.</p>
        {open ? <ScanDialog key={round} title="Next sticker" onText={onText} onClose={() => setOpen(false)} /> : <button className="btn w-fit" onClick={() => setOpen(true)}>📷 Scan more</button>}
        <ul className="grid gap-0.5" aria-label="Moved">
          {done.map((d, i) => <li key={`${d.code}-${done.length - i}`} className={d.ok ? '' : 'text-danger'}>{d.ok ? '✓' : '✕'} {d.text}</li>)}
        </ul>
        {done.some((d) => d.ok) && <p className="text-xs text-muted">{done.filter((d) => d.ok).length} moved.</p>}
      </div>
    </Dialog>
  )
}
