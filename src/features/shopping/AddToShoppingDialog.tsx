import { useState } from 'react'
import { useStore } from '../../app/store'
import type { NewShopItem } from '../../domain/shopping/types'
import { Dialog } from '../../ui/Dialog'

const KIND: Record<string, string> = { model: 'Models', paint: 'Paints', other: 'Other' }

/** Choose where items go: always the main list, plus any of your lists or a new one. */
export function AddToShoppingDialog({ items, onClose }: { items: NewShopItem[]; onClose: () => void }) {
  const { shopLists, addToShopping } = useStore()
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [fresh, setFresh] = useState('')
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  // With models and paints together (e.g. an army's buy list), each kind can be left out.
  const kinds = [...new Set(items.map((x) => x.kind))]
  const [off, setOff] = useState<Set<string>>(new Set())
  const chosen = items.filter((x) => !off.has(x.kind))

  return (
    <Dialog title="Add to shopping list" onClose={onClose}>
      {kinds.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4 text-sm">
          {kinds.map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={!off.has(k)} onChange={() => setOff((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n })} />
              {KIND[k]} ({items.filter((x) => x.kind === k).length})
            </label>
          ))}
        </div>
      )}
      <p className="text-sm">{chosen.length} item{chosen.length === 1 ? '' : 's'}{chosen.length ? ': ' : ''}{chosen.slice(0, 4).map((x) => x.name).join(', ')}{chosen.length > 4 ? '…' : ''}</p>
      <ul className="mt-3 text-sm">
        <li><label className="flex items-center gap-2 py-0.5"><input type="checkbox" checked disabled /> Main list (everything)</label></li>
        {shopLists.map((l) => (
          <li key={l.id}><label className="flex items-center gap-2 py-0.5"><input type="checkbox" checked={picked.has(l.id)} onChange={() => toggle(l.id)} /> {l.name}</label></li>
        ))}
      </ul>
      <label className="mt-2 block text-sm">New list <input className="input ml-2" value={fresh} onChange={(e) => setFresh(e.target.value)} placeholder="e.g. GW order" /></label>
      <div className="mt-3 flex justify-end">
        <button className="btn btn-primary" disabled={!chosen.length} onClick={async () => { await addToShopping(chosen, [...picked], fresh); onClose() }}>Add</button>
      </div>
    </Dialog>
  )
}

/** Button that opens the dialog; hidden when there is nothing to add. */
export function AddToShoppingButton({ items, label = 'Add to shopping list…' }: { items: NewShopItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  if (!items.length) return null
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>{label}</button>
      {open && <AddToShoppingDialog items={items} onClose={() => setOpen(false)} />}
    </>
  )
}
