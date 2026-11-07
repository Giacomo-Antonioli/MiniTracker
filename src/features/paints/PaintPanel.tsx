import { useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { adjustQuantity, newStock, updateStock } from '../../domain/paints/inventory'
import type { PaintDef, PaintStock } from '../../domain/paints/types'
import { useTx } from '../../i18n'
import { ColourMatches } from './ColourMatches'

export function PaintPanel({ paint, onClose, onSelect }: { paint: PaintDef; onClose: () => void; onSelect?: (id: string) => void }) {
  const tx = useTx()
  const { paintStock, pipelines, saveStock, removeStock, deleteCustomPaint } = useStore()
  const stock = paintStock.get(paint.id)
  const [error, setError] = useState('')
  const stages = pipelines.paint.stages
  const has = (id: string) => stages.some((s) => s.id === id)

  async function patch(p: Partial<Omit<PaintStock, 'paintId' | 'updatedAt'>>) {
    if (!stock) return
    try {
      setError('')
      await saveStock(updateStock(stock, p, ctx()))
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const num = (v: string) => (v === '' ? undefined : Number(v))
  const text = (v: string) => (v.trim() === '' ? undefined : v)

  return (
    <aside className="panel flex h-full w-[400px] shrink-0 flex-col overflow-y-auto" aria-label={tx('Paint details')} data-tour="paint-details">
      <div className="h-24 border-b border-line" style={{ background: paint.hex }} />
      <header className="border-b border-line p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-xl text-accent">{paint.name}</h2>
            <p className="text-sm text-muted">
              {paint.brand}
              {paint.type && ` · ${paint.type}`}
              {paint.range && ` · ${paint.range}`}{paint.family && ` · ${paint.family}`} · <code>{paint.hex}</code>
              {paint.custom && ` · ${tx('custom')}`}
            </p>
          </div>
          <button className="btn" aria-label={tx('Close paint')} onClick={onClose}>✕</button>
        </div>
      </header>

      {!stock ? (
        <section className="grid gap-2 p-4">
          <p className="text-sm text-muted">{tx('Not in your inventory.')}</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => void saveStock(newStock(paint.id, has('sealed') ? 'sealed' : stages[0].id, ctx()))}>
              {tx('I own it')}
            </button>
            {has('wishlist') && (
              <button className="btn" onClick={() => void saveStock(newStock(paint.id, 'wishlist', ctx()))}>{tx('Add to wishlist')}</button>
            )}
          </div>
        </section>
      ) : (
        <section className="grid gap-3 p-4" aria-label={tx('Inventory')}>
          <div className="flex items-center gap-2">
            <span className="w-24 text-sm text-muted">{tx('Pots')}</span>
            <button className="btn" aria-label={tx('One pot less')} onClick={() => void saveStock(adjustQuantity(stock, -1, ctx()))}>−</button>
            <b className="w-8 text-center text-lg" aria-label={tx('Pots owned')}>{stock.quantity}</b>
            <button className="btn" aria-label={tx('One pot more')} onClick={() => void saveStock(adjustQuantity(stock, 1, ctx()))}>+</button>
            <button className="btn ml-auto" aria-pressed={stock.favourite} onClick={() => void patch({ favourite: !stock.favourite })}>
              {stock.favourite ? '★' : '☆'}
            </button>
          </div>
          <label className="flex items-center gap-2">
            <span className="w-24 text-sm text-muted">{tx('Stage')}</span>
            <select className="input flex-1" value={stock.stage} onChange={(e) => void patch({ stage: e.target.value })}>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {has('low') && stock.stage !== 'low' && <button className="btn" onClick={() => void patch({ stage: 'low' })}>{tx('Mark running low')}</button>}
            {has('empty') && stock.stage !== 'empty' && <button className="btn" onClick={() => void patch({ stage: 'empty', quantity: 0 })}>{tx('Mark empty')}</button>}
          </div>
          <Field label={tx('Purchased')} type="date" value={stock.purchaseDate ?? ''} onSave={(v) => patch({ purchaseDate: text(v) })} />
          <Field label={tx('Price / pot')} type="number" value={stock.price?.toString() ?? ''} onSave={(v) => patch({ price: num(v) })} />
          <Field label={tx('Shop')} value={stock.shop ?? ''} onSave={(v) => patch({ shop: text(v) })} />
          <Field label={tx('Location')} placeholder={tx('case, drawer, rack slot')} value={stock.location ?? ''} onSave={(v) => patch({ location: text(v) })} />
          <Field label={tx('Barcode')} value={stock.barcode ?? ''} onSave={(v) => patch({ barcode: text(v) })} />
          <label className="flex items-center gap-2">
            <span className="w-24 text-sm text-muted">{tx('Rating')}</span>
            <select className="input" value={stock.rating ?? ''} onChange={(e) => void patch({ rating: num(e.target.value) })}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{'★'.repeat(r)}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-muted">{tx('Notes')}</span>
            <textarea className="input min-h-16" defaultValue={stock.notes} key={`${paint.id}-notes`} onBlur={(e) => e.target.value !== stock.notes && void patch({ notes: e.target.value })} />
          </label>
          {error && <p className="text-danger" role="alert">{error}</p>}
          <button className="btn btn-danger w-fit" onClick={() => confirm(tx('Remove {{name}} from your inventory?', { name: paint.name })) && void removeStock(paint.id)}>
            {tx('Remove from inventory')}
          </button>
        </section>
      )}

      <section className="border-t border-line p-4" aria-label={tx('Colour match')}>
        <ColourMatches key={paint.id} hex={paint.hex} exclude={paint.id} onPick={(p) => onSelect?.(p.id)} />
      </section>

      {paint.custom && !paint.id.startsWith('lib/') && (
        <section className="mt-auto border-t border-line p-4">
          <button className="btn btn-danger" onClick={() => confirm(tx('Delete custom paint {{name}}?', { name: paint.name })) && void deleteCustomPaint(paint.id).then(onClose)}>
            {tx('Delete custom paint')}
          </button>
        </section>
      )}
    </aside>
  )
}

/** Text/number/date input that saves on blur. */
function Field({ label, value, onSave, type = 'text', placeholder }: { label: string; value: string; onSave: (v: string) => unknown; type?: string; placeholder?: string }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-24 text-sm text-muted">{label}</span>
      <input
        key={value}
        className="input flex-1"
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        min={type === 'number' ? 0 : undefined}
        placeholder={placeholder}
        defaultValue={value}
        onBlur={(e) => e.target.value !== value && void onSave(e.target.value)}
      />
    </label>
  )
}
