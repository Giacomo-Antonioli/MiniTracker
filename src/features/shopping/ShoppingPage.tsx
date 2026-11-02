import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../app/store'
import { itemsOn, MAIN, shoppingText, totals } from '../../domain/shopping/shopping'
import type { ShopItem } from '../../domain/shopping/types'
import { Dialog } from '../../ui/Dialog'
import { CatalogueSearch } from './CatalogueSearch'

const KIND = { model: 'Model', paint: 'Paint', other: 'Other' }
const money = (n: number) => n.toFixed(2)
const num = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Number(v.replace(',', '.'))) || 0)

/** Shopping lists (#87): the main list has everything; your own lists hold some of it. */
export function ShoppingPage() {
  const { shopItems, shopLists, addToShopping, saveShopItem, deleteShopItem, setBought, createShopList, renameShopList, deleteShopList } = useStore()
  const [listId, setListId] = useState(MAIN)
  const [askPaint, setAskPaint] = useState<ShopItem | null>(null)
  const [printing, setPrinting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [draft, setDraft] = useState('')
  const list = shopLists.find((l) => l.id === listId)
  const title = list?.name ?? 'Shopping list'
  const items = itemsOn(shopItems, list ? listId : MAIN)
  const t = totals(items)
  const edit = (x: ShopItem, patch: Partial<ShopItem>) => saveShopItem({ ...x, ...patch, updatedAt: new Date().toISOString() })
  const tick = (x: ShopItem) => (!x.bought && x.kind === 'paint' && x.refId ? setAskPaint(x) : setBought(x.id, !x.bought))

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <nav aria-label="Shopping lists" className="flex flex-col gap-1 md:w-48">
        {[{ id: MAIN, name: 'Main list' }, ...shopLists].map((l) => (
          <button key={l.id} className={`rounded px-3 py-1.5 text-left ${l.id === (list ? listId : MAIN) ? 'bg-panel-2 text-accent' : 'hover:bg-panel-2'}`} onClick={() => setListId(l.id)}>
            {l.name} <span className="text-muted">({itemsOn(shopItems, l.id).filter((x) => !x.bought).length})</span>
          </button>
        ))}
        <button className="btn mt-2" onClick={async () => { const n = prompt('Name of the new list'); if (n?.trim()) setListId((await createShopList(n)).id) }}>+ New list</button>
      </nav>

      <section className="flex-1" aria-label={title}>
        <header className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold">{title}</h1>
          {list && (
            <>
              <button className="btn" onClick={() => { const n = prompt('Rename list', list.name); if (n) void renameShopList(list.id, n) }}>Rename</button>
              <button className="btn" onClick={() => { if (confirm(`Delete "${list.name}"? Its items stay on the main list.`)) { void deleteShopList(list.id); setListId(MAIN) } }}>Delete list</button>
            </>
          )}
          <span className="flex-1" />
          <button className="btn" disabled={!t.toBuy} onClick={async () => { await navigator.clipboard.writeText(shoppingText(title, items)); setCopied(true) }}>{copied ? 'Copied ✓' : 'Copy text'}</button>
          <button className="btn" disabled={!t.toBuy} onClick={() => setPrinting(true)}>Print / save PDF</button>
        </header>
        <p className="mt-1 text-sm text-muted" role="status">
          {t.toBuy} to buy · total {money(t.price)}{t.unpriced ? ` (+${t.unpriced} without price)` : ''}{t.bought ? ` · ${t.bought} bought` : ''}
        </p>

        <CatalogueSearch listIds={list ? [list.id] : []} />

        <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!draft.trim()) return; await addToShopping([{ kind: 'other', name: draft, qty: 1 }], list ? [list.id] : []); setDraft('') }}>
          <input className="input flex-1" aria-label="New item" placeholder="Add anything: brushes, basing sand…" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button className="btn btn-primary">Add</button>
        </form>

        {items.length === 0 ? (
          <p className="mt-6 text-muted">Nothing here yet. Add items above, or from an army's buy list, "Paints to buy" or your paint wishlist.</p>
        ) : (
          <table className="mt-3 w-full text-sm" aria-label="Items">
            <thead className="text-left text-xs text-muted">
              <tr><th className="w-8" /><th className="font-normal">Item</th><th className="font-normal">Qty</th><th className="font-normal">Shop</th><th className="font-normal">Price</th><th className="font-normal">Lists</th><th /></tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id} className={`border-t border-line ${x.bought ? 'text-muted line-through' : ''}`}>
                  <td><input type="checkbox" aria-label={`Bought ${x.name}`} checked={x.bought} onChange={() => tick(x)} /></td>
                  <td>{x.name} <span className="text-xs text-muted no-underline">{KIND[x.kind]}{x.sources.length ? ` · ${x.sources.join(', ')}` : ''}</span></td>
                  <td><input className="input w-14" type="number" min={1} aria-label={`Quantity of ${x.name}`} key={x.qty} defaultValue={x.qty} onBlur={(e) => edit(x, { qty: Math.max(1, Math.round(Number(e.target.value)) || 1) })} /></td>
                  <td><input className="input w-28" aria-label={`Shop for ${x.name}`} value={x.shop ?? ''} onChange={(e) => edit(x, { shop: e.target.value || undefined })} /></td>
                  <td><input className="input w-20" inputMode="decimal" aria-label={`Price of ${x.name}`} defaultValue={x.price ?? ''} onBlur={(e) => edit(x, { price: num(e.target.value) })} /></td>
                  <td>
                    {shopLists.map((l) => (
                      <label key={l.id} className="mr-2 whitespace-nowrap text-xs">
                        <input type="checkbox" checked={x.listIds.includes(l.id)} onChange={() => edit(x, { listIds: x.listIds.includes(l.id) ? x.listIds.filter((i) => i !== l.id) : [...x.listIds, l.id] })} /> {l.name}
                      </label>
                    ))}
                  </td>
                  <td><button className="btn" aria-label={`Remove ${x.name}`} onClick={() => deleteShopItem(x.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {askPaint && (
        <Dialog title={`Bought ${askPaint.name}`} onClose={() => setAskPaint(null)}>
          <p className="text-sm">Update your paint inventory:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn" onClick={() => { void setBought(askPaint.id, true, 'ordered'); setAskPaint(null) }}>Ordered</button>
            <button className="btn btn-primary" onClick={() => { void setBought(askPaint.id, true, 'owned'); setAskPaint(null) }}>In hand</button>
            <button className="btn" onClick={() => { void setBought(askPaint.id, true); setAskPaint(null) }}>Just tick it</button>
          </div>
        </Dialog>
      )}
      {printing && <ShoppingSheet title={title} items={items.filter((x) => !x.bought)} onDone={() => setPrinting(false)} />}
    </div>
  )
}

function ShoppingSheet({ title, items, onDone }: { title: string; items: ShopItem[]; onDone: () => void }) {
  const [date] = useState(() => new Date().toLocaleDateString())
  useEffect(() => {
    const done = () => onDone()
    window.addEventListener('afterprint', done)
    const t = setTimeout(() => window.print(), 50)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', done)
    }
  }, [onDone])
  const t = totals(items)
  return createPortal(
    <div className="print-only" aria-label="Shopping sheet">
      <h1 className="text-2xl font-bold">{title}</h1>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead><tr className="border-b border-black text-left"><th className="w-8" /><th>Item</th><th className="text-right">Qty</th><th>Shop</th><th className="text-right">Price</th></tr></thead>
        <tbody>
          {items.map((x) => (
            <tr key={x.id} className="border-b border-black/30"><td className="py-1">☐</td><td>{x.name}</td><td className="text-right">{x.qty}</td><td>{x.shop ?? ''}</td><td className="text-right">{x.price !== undefined ? money(x.price) : ''}</td></tr>
          ))}
        </tbody>
        <tfoot><tr className="font-bold"><td /><td>Total</td><td /><td /><td className="text-right">{money(t.price)}</td></tr></tfoot>
      </table>
      <p className="mt-6 text-xs">MiniTracker · {date}</p>
    </div>,
    document.body,
  )
}
