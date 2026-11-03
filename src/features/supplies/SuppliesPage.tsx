import { useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { isLow, newSupply, SUPPLY_CATEGORIES } from '../../domain/supplies/supplies'

/** Primer, glue, brushes…: stock with an alert level. Going low adds the item to the shopping list (#92). */
export function SuppliesPage() {
  const { supplies, saveSupply, deleteSupply, shopItems } = useStore()
  const [name, setName] = useState('')
  const [category, setCategory] = useState(SUPPLY_CATEGORIES[0])
  const [qty, setQty] = useState('1')
  const [lowAt, setLowAt] = useState('0')
  const [error, setError] = useState('')
  const onList = (id: string) => shopItems.some((x) => !x.bought && x.refId === `supply:${id}`)
  const sorted = [...supplies].sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  const low = supplies.filter(isLow).length
  const change = (id: string, patch: Partial<{ quantity: number; lowAt: number }>) => {
    const s = supplies.find((x) => x.id === id)!
    void saveSupply({ ...s, ...patch, updatedAt: ctx().now })
  }

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-accent">Supplies</h1>
        {low > 0 && <span className="text-sm text-danger" role="status">⚠ {low} running low</span>}
      </header>

      <form
        className="panel flex flex-wrap items-end gap-2 p-3"
        aria-label="New supply"
        onSubmit={(e) => {
          e.preventDefault()
          try {
            void saveSupply(newSupply({ name, category, quantity: Math.max(0, Number(qty) || 0), lowAt: Math.max(0, Number(lowAt) || 0) }, ctx()))
            setName('')
            setError('')
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      >
        <label className="grid gap-0.5 text-xs text-muted">Name<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chaos Black spray" /></label>
        <label className="grid gap-0.5 text-xs text-muted">Category<select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{SUPPLY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="grid gap-0.5 text-xs text-muted">In stock<input className="input w-20" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
        <label className="grid gap-0.5 text-xs text-muted">Alert at<input className="input w-20" type="number" min={0} value={lowAt} onChange={(e) => setLowAt(e.target.value)} /></label>
        <button className="btn btn-primary">+ Add</button>
        {error && <span className="text-sm text-danger" role="alert">{error}</span>}
      </form>

      {supplies.length === 0 ? (
        <p className="text-muted">No supplies yet. Add primer, glue, brushes… and get an alert (and a shopping list entry) when they run low.</p>
      ) : (
        <table className="panel w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted">
            <tr><th className="p-2">Supply</th><th>Category</th><th>In stock</th><th>Alert at</th><th /></tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id} className={`border-t border-line ${isLow(s) ? 'bg-danger/10' : ''}`}>
                <td className="p-2">
                  {s.name}
                  {isLow(s) && <span className="ml-2 text-xs text-danger">⚠ Low{onList(s.id) ? ' · on shopping list' : ''}</span>}
                </td>
                <td>{s.category}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <button className="btn px-2 py-0" aria-label={`One less ${s.name}`} disabled={s.quantity <= 0} onClick={() => change(s.id, { quantity: s.quantity - 1 })}>−</button>
                    <span className="w-8 text-center tabular-nums">{s.quantity}</span>
                    <button className="btn px-2 py-0" aria-label={`One more ${s.name}`} onClick={() => change(s.id, { quantity: s.quantity + 1 })}>+</button>
                  </div>
                </td>
                <td><input className="input w-16 py-0.5" type="number" min={0} aria-label={`Alert level for ${s.name}`} value={s.lowAt} onChange={(e) => change(s.id, { lowAt: Math.max(0, Number(e.target.value) || 0) })} /></td>
                <td className="pr-2 text-right"><button className="text-muted hover:text-danger" aria-label={`Delete ${s.name}`} onClick={() => void deleteSupply(s.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
