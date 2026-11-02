import { useState } from 'react'
import { useStore } from '../../app/store'
import type { NewShopItem } from '../../domain/shopping/types'
import { Dialog } from '../../ui/Dialog'

/** Choose where items go: always the main list, plus any of your lists or a new one. */
export function AddToShoppingDialog({ items, onClose }: { items: NewShopItem[]; onClose: () => void }) {
  const { shopLists, addToShopping } = useStore()
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [fresh, setFresh] = useState('')
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <Dialog title="Add to shopping list" onClose={onClose}>
      <p className="text-sm">{items.length} item{items.length === 1 ? '' : 's'}: {items.slice(0, 4).map((x) => x.name).join(', ')}{items.length > 4 ? '…' : ''}</p>
      <ul className="mt-3 text-sm">
        <li><label className="flex items-center gap-2 py-0.5"><input type="checkbox" checked disabled /> Main list (everything)</label></li>
        {shopLists.map((l) => (
          <li key={l.id}><label className="flex items-center gap-2 py-0.5"><input type="checkbox" checked={picked.has(l.id)} onChange={() => toggle(l.id)} /> {l.name}</label></li>
        ))}
      </ul>
      <label className="mt-2 block text-sm">New list <input className="input ml-2" value={fresh} onChange={(e) => setFresh(e.target.value)} placeholder="e.g. GW order" /></label>
      <div className="mt-3 flex justify-end">
        <button className="btn btn-primary" onClick={async () => { await addToShopping(items, [...picked], fresh); onClose() }}>Add</button>
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
