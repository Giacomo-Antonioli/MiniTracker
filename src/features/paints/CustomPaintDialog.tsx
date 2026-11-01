import { useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { createCustomPaint, newStock } from '../../domain/paints/inventory'
import { Dialog } from '../../ui/Dialog'

const TYPES = ['base', 'layer', 'shade', 'contrast', 'speedpaint', 'metallic', 'air', 'technical', 'dry', 'ink', 'primer', 'varnish']

export function CustomPaintDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { saveCustomPaint, saveStock, paints, pipelines } = useStore()
  const brands = [...new Set(paints.map((p) => p.brand))].sort()
  const [brand, setBrand] = useState('')
  const [name, setName] = useState('')
  const [hex, setHex] = useState('#7a8a99')
  const [type, setType] = useState('')
  const [own, setOwn] = useState(true)
  const [error, setError] = useState('')

  return (
    <Dialog title="Add custom paint" onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const dialog = (e.target as HTMLElement).closest('dialog')
          try {
            const c = ctx()
            const paint = createCustomPaint({ brand, name, hex, type: type || undefined }, c)
            await saveCustomPaint(paint)
            const stage = pipelines.paint.stages.some((s) => s.id === 'sealed') ? 'sealed' : pipelines.paint.stages[0].id
            if (own) await saveStock(newStock(paint.id, stage, c))
            onCreated(paint.id)
            dialog?.close()
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      >
        <label className="grid gap-1">
          <span className="text-sm text-muted">Brand *</span>
          <input className="input" list="paint-brands" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Green Stuff World" autoFocus />
          <datalist id="paint-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-muted">Name *</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="flex gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-muted">Colour</span>
            <span className="flex items-center gap-2">
              <input type="color" aria-label="Colour picker" value={hex} onChange={(e) => setHex(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent" />
              <input className="input w-28" aria-label="Hex colour" value={hex} onChange={(e) => setHex(e.target.value)} />
            </span>
          </label>
          <label className="grid flex-1 gap-1">
            <span className="text-sm text-muted">Type</span>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">—</option>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} /> I own it</label>
        {error && <p className="text-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={(e) => (e.target as HTMLElement).closest('dialog')?.close()}>Cancel</button>
          <button type="submit" className="btn btn-primary">Add paint</button>
        </div>
      </form>
    </Dialog>
  )
}
