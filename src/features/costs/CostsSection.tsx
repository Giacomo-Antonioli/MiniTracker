import { useState } from 'react'
import { useStore } from '../../app/store'
import { costSummary, money, validatePurchase, type Purchase } from '../../domain/costs/costs'

/** Spending and collection value (#94), with the purchases that cover several units. */
export function CostsSection() {
  const { units, purchases, paintStock, pipeline, currency, deletePurchase } = useStore()
  const [editing, setEditing] = useState<Purchase | null>(null)
  const s = costSummary(units, purchases, paintStock.values(), pipeline)
  const m = (n: number) => money(n, currency)
  const name = (id: string) => units.find((u) => u.id === id)?.customName ?? 'removed unit'
  const sorted = [...purchases].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  return (
    <section className="panel grid gap-3 p-4" aria-label="Costs">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Costs</h2>
        <button className="btn" onClick={() => setEditing({ id: crypto.randomUUID(), name: '', price: 0, date: new Date().toISOString().slice(0, 10), unitIds: [] })}>+ Purchase</button>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        <Cell label="Total spent" value={m(s.spent)} />
        <Cell label="Models" value={m(s.models)} />
        <Cell label="Paints" value={m(s.paints)} />
        <Cell label="Value painted" value={m(s.painted)} />
        <Cell label="Value unpainted" value={m(s.unpainted)} />
      </dl>
      {s.unpriced > 0 && <p className="text-xs text-muted">{s.unpriced} unit{s.unpriced === 1 ? ' has' : 's have'} no price yet: set it on the unit or add a purchase.</p>}
      {sorted.length > 0 && (
        <table className="w-full text-sm" aria-label="Purchases">
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="py-1 text-muted">{p.date ?? '—'}</td>
                <td>{p.name}{p.shop ? <span className="text-muted"> · {p.shop}</span> : null}</td>
                <td className="text-muted">{p.unitIds.map(name).join(', ') || 'no units'}</td>
                <td className="text-right tabular-nums">{m(p.price)}</td>
                <td className="w-16 text-right">
                  <button className="px-1 text-muted" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}>✎</button>
                  <button className="px-1 text-muted hover:text-danger" aria-label={`Delete ${p.name}`} onClick={() => { if (confirm(`Delete purchase ${p.name}?`)) void deletePurchase(p.id) }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && <PurchaseForm purchase={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line p-2">
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="font-display text-lg">{value}</dd>
    </div>
  )
}

function PurchaseForm({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const { units, savePurchase, currency } = useStore()
  const [p, setP] = useState(purchase)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const shown = units.filter((u) => p.unitIds.includes(u.id) || u.customName.toLowerCase().includes(filter.toLowerCase())).sort((a, b) => a.customName.localeCompare(b.customName))
  const toggle = (id: string) => setP({ ...p, unitIds: p.unitIds.includes(id) ? p.unitIds.filter((x) => x !== id) : [...p.unitIds, id] })

  return (
    <form
      className="grid gap-2 rounded border border-accent/60 p-3"
      aria-label="Purchase"
      onSubmit={(e) => {
        e.preventDefault()
        try {
          const clean = { ...p, name: p.name.trim(), shop: p.shop?.trim() || undefined, date: p.date || undefined }
          validatePurchase(clean)
          void savePurchase(clean).then(onClose)
        } catch (err) {
          setError((err as Error).message)
        }
      }}
    >
      <div className="flex flex-wrap gap-2">
        <label className="grid flex-1 gap-1 text-sm">Name<input className="input" placeholder="e.g. Combat Patrol box" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
        <label className="grid w-28 gap-1 text-sm">Price ({currency})<input className="input" type="number" min={0} step="0.01" value={p.price} onChange={(e) => setP({ ...p, price: Number(e.target.value) })} /></label>
        <label className="grid gap-1 text-sm">Date<input className="input" type="date" value={p.date ?? ''} onChange={(e) => setP({ ...p, date: e.target.value })} /></label>
        <label className="grid w-36 gap-1 text-sm">Shop<input className="input" value={p.shop ?? ''} onChange={(e) => setP({ ...p, shop: e.target.value })} /></label>
      </div>
      <fieldset className="grid gap-1">
        <legend className="text-sm text-muted">Units in this purchase (price shared by model count)</legend>
        <input className="input" placeholder="Filter units" aria-label="Filter units" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="grid max-h-48 gap-0.5 overflow-y-auto">
          {shown.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={p.unitIds.includes(u.id)} onChange={() => toggle(u.id)} /> {u.customName}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="text-danger" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary">Save purchase</button>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}
