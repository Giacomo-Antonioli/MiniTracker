import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../app/store'
import { inventoryToCsv } from '../../domain/paints/csv'
import { filterPaints, paintStats, type PaintFilter } from '../../domain/paints/inventory'
import type { PaintDef } from '../../domain/paints/types'
import { CustomPaintDialog } from './CustomPaintDialog'
import { MissingPaintsDialog } from './MissingPaintsDialog'
import { AddToShoppingButton } from '../shopping/AddToShoppingDialog'
import { PaintPanel } from './PaintPanel'

const PAGE = 240

const distinct = (paints: PaintDef[], key: 'brand' | 'type' | 'family') =>
  [...new Set(paints.map((p) => p[key]).filter((x): x is string => !!x))].sort()

export function PaintsPage() {
  const { paints, paintStock, pipelines, loadPaints, importPaintCsv } = useStore()
  const [csvMessage, setCsvMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState<PaintFilter>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [buying, setBuying] = useState(false)
  const [limit, setLimit] = useState(PAGE)

  useEffect(() => {
    if (!paints.length) void loadPaints()
  }, [paints.length, loadPaints])

  const set = (patch: Partial<PaintFilter>) => {
    setFilter({ ...filter, ...patch })
    setLimit(PAGE)
  }
  const brands = useMemo(() => distinct(paints, 'brand'), [paints])
  const types = useMemo(() => distinct(paints, 'type'), [paints])
  const families = useMemo(() => distinct(paints, 'family'), [paints])
  const shown = useMemo(() => filterPaints(paints, paintStock, filter), [paints, paintStock, filter])
  const stats = paintStats(paints, paintStock, 'low')
  const stageName = (id: string) => pipelines.paint.stages.find((s) => s.id === id)?.name ?? id
  const selected = paints.find((p) => p.id === selectedId)

  if (!paints.length) return <p className="text-muted">Loading paints…</p>

  return (
    <div className="flex h-full gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-accent">Paints</h1>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn"
              disabled={paintStock.size === 0}
              onClick={() => {
                const url = URL.createObjectURL(new Blob([inventoryToCsv(paints, paintStock)], { type: 'text/csv' }))
                const a = document.createElement('a')
                a.href = url
                a.download = `minitracker-paints-${new Date().toISOString().slice(0, 10)}.csv`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              ⬇ Export CSV
            </button>
            <label className="btn">
              ⬆ Import CSV
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label="Paint CSV file"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  try {
                    const r = await importPaintCsv(await f.text())
                    const skipped = r.skipped.length ? ` Skipped ${r.skipped.length}: ${r.skipped.slice(0, 3).map((s) => `line ${s.line} (${s.reason})`).join(', ')}${r.skipped.length > 3 ? '…' : ''}` : ''
                    setCsvMessage({ ok: true, text: `Imported ${r.imported} paints (${r.created} new custom).${skipped}` })
                  } catch (err) {
                    setCsvMessage({ ok: false, text: (err as Error).message })
                  }
                }}
              />
            </label>
            <button className="btn" onClick={() => setBuying(true)}>Paints to buy…</button>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Custom paint</button>
          </div>
        </header>
        {csvMessage && <p role="status" className={csvMessage.ok ? 'text-ok' : 'text-danger'}>{csvMessage.text}</p>}

        <section className="panel flex flex-wrap gap-6 p-4 text-sm" aria-label="Paint stats">
          <span><b className="text-lg text-accent">{stats.owned}</b> paints owned</span>
          <span><b className="text-lg">{stats.pots}</b> pots</span>
          <span><b className="text-lg">{stats.value.toFixed(2)}</b> total value</span>
          <button className="text-left" onClick={() => set({ stage: 'low' })}><b className="text-lg text-danger">{stats.low}</b> running low</button>
          <button className="text-left" onClick={() => set({ stage: 'wishlist' })}><b className="text-lg">{stats.wishlist}</b> on wishlist</button>
          <AddToShoppingButton label="Wishlist to shopping list…" items={paints.filter((p) => paintStock.get(p.id)?.stage === 'wishlist').map((p) => ({ kind: 'paint' as const, name: `${p.brand} ${p.name}`, refId: p.id, qty: 1, sources: ['Wishlist'] }))} />
          <span className="text-muted">{Object.entries(stats.byBrand).map(([b, n]) => `${b} ${n}`).join(' · ')}</span>
        </section>

        <section className="flex flex-wrap items-center gap-2" aria-label="Paint filters">
          <input className="input w-56" placeholder="🔍 Search name or brand" value={filter.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
          <select className="input" aria-label="Brand" value={filter.brand ?? ''} onChange={(e) => set({ brand: e.target.value || undefined })}>
            <option value="">All brands</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
          </select>
          <select className="input" aria-label="Type" value={filter.type ?? ''} onChange={(e) => set({ type: e.target.value || undefined })}>
            <option value="">All types</option>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select className="input" aria-label="Colour" value={filter.family ?? ''} onChange={(e) => set({ family: e.target.value || undefined })}>
            <option value="">All colours</option>
            {families.map((f) => <option key={f}>{f}</option>)}
          </select>
          <select className="input" aria-label="Stage" value={filter.stage ?? ''} onChange={(e) => set({ stage: e.target.value || undefined })}>
            <option value="">Any stage</option>
            {pipelines.paint.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={!!filter.ownedOnly} onChange={(e) => set({ ownedOnly: e.target.checked })} /> Owned</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={!!filter.favouritesOnly} onChange={(e) => set({ favouritesOnly: e.target.checked })} /> Favourites</label>
          <span className="ml-auto text-sm text-muted">{shown.length} paints</span>
        </section>

        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 overflow-y-auto pb-4" aria-label="Paints">
          {shown.slice(0, limit).map((p) => {
            const s = paintStock.get(p.id)
            return (
              <li key={p.id}>
                <button
                  className={`panel flex w-full flex-col overflow-hidden text-left hover:border-accent ${p.id === selectedId ? 'border-accent' : ''}`}
                  onClick={() => setSelectedId(p.id)}
                  aria-label={`${p.name} (${p.brand})`}
                >
                  <span className="h-12 w-full border-b border-line" style={{ background: p.hex }} />
                  <span className="p-2">
                    <span className="block truncate text-sm">{p.name}</span>
                    <span className="block truncate text-xs text-muted">{p.brand}{p.type ? ` · ${p.type}` : ''}</span>
                    {s && (
                      <span className="mt-1 flex items-center justify-between text-xs">
                        <span className={s.stage === 'low' ? 'text-danger' : 'text-accent'}>{stageName(s.stage)}</span>
                        <span>{s.favourite ? '★ ' : ''}{s.quantity > 0 ? `×${s.quantity}` : ''}</span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {shown.length > limit && (
          <button className="btn mx-auto" onClick={() => setLimit(limit + PAGE)}>Show more ({shown.length - limit} left)</button>
        )}
        {shown.length === 0 && <p className="p-6 text-center text-muted">No paints match these filters.</p>}
      </div>

      {selected && <PaintPanel paint={selected} onClose={() => setSelectedId(null)} />}
      {buying && <MissingPaintsDialog onClose={() => setBuying(false)} />}
      {adding && <CustomPaintDialog onClose={() => setAdding(false)} onCreated={(id) => setSelectedId(id)} />}
    </div>
  )
}
