import { useEffect, useMemo, useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { inventoryToCsv } from '../../domain/paints/csv'
import { adjustQuantity, filterPaints, paintStats, placeStocks, type PaintFilter } from '../../domain/paints/inventory'
import type { PaintDef } from '../../domain/paints/types'
import { CustomPaintDialog } from './CustomPaintDialog'
import { MissingPaintsDialog } from './MissingPaintsDialog'
import { AddToShoppingButton } from '../shopping/AddToShoppingDialog'
import { PaintPanel } from './PaintPanel'
import { HexMatchDialog } from './ColourMatches'
import { Dialog } from '../../ui/Dialog'
import { PlaceSelect } from '../storage/Storage'
import { useTx } from '../../i18n'

const PAGE = 240

const distinct = (paints: PaintDef[], key: 'brand' | 'type' | 'family') =>
  [...new Set(paints.map((p) => p[key]).filter((x): x is string => !!x))].sort()

export function PaintsPage() {
  const tx = useTx()
  const { paints, paintStock, pipelines, loadPaints, importPaintCsv, saveStock } = useStore()
  const [csvMessage, setCsvMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState<PaintFilter>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [matching, setMatching] = useState(false)
  const [buying, setBuying] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [moving, setMoving] = useState(false)

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

  if (!paints.length) return <p className="text-muted">{tx('Loading paints…')}</p>

  return (
    <div className="flex h-full gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-accent" data-tour="paints-title">{tx('Paints')}</h1>
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
              {tx('⬇ Export CSV')}
            </button>
            <label className="btn">
              {tx('⬆ Import CSV')}
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label={tx('Paint CSV file')}
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  try {
                    const r = await importPaintCsv(await f.text())
                    const skipped = r.skipped.length ? ` ${tx('Skipped {{n}}: {{list}}', { n: r.skipped.length, list: `${r.skipped.slice(0, 3).map((s) => tx('line {{line}} ({{reason}})', { line: s.line, reason: s.reason })).join(', ')}${r.skipped.length > 3 ? '…' : ''}` })}` : ''
                    setCsvMessage({ ok: true, text: `${tx('Imported {{n}} paints ({{m}} new custom).', { n: r.imported, m: r.created })}${skipped}` })
                  } catch (err) {
                    setCsvMessage({ ok: false, text: (err as Error).message })
                  }
                }}
              />
            </label>
            <button className="btn" aria-pressed={selecting} onClick={() => { setSelecting(!selecting); setPicked(new Set()) }}>{selecting ? tx('Done selecting') : tx('☑ Select')}</button>
            <button className="btn" onClick={() => setBuying(true)}>{tx('Paints to buy…')}</button>
            <button className="btn" onClick={() => setMatching(true)}>{tx('🎯 Match a colour')}</button>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>{tx('+ Custom paint')}</button>
          </div>
        </header>
        {csvMessage && <p role="status" className={csvMessage.ok ? 'text-ok' : 'text-danger'}>{csvMessage.text}</p>}

        <section className="panel flex flex-wrap gap-6 p-4 text-sm" aria-label={tx('Paint stats')} data-tour="paint-stats">
          <span><b className="text-lg text-accent">{stats.owned}</b> {tx('paints owned')}</span>
          <span><b className="text-lg">{stats.pots}</b> {tx('pots')}</span>
          <span><b className="text-lg">{stats.value.toFixed(2)}</b> {tx('total value')}</span>
          <button className="text-left" onClick={() => set({ stage: 'low' })}><b className="text-lg text-danger">{stats.low}</b> {tx('running low')}</button>
          <button className="text-left" onClick={() => set({ stage: 'wishlist' })}><b className="text-lg">{stats.wishlist}</b> {tx('on wishlist')}</button>
          <AddToShoppingButton label={tx('Wishlist to shopping list…')} items={paints.filter((p) => paintStock.get(p.id)?.stage === 'wishlist').map((p) => ({ kind: 'paint' as const, name: `${p.brand} ${p.name}`, refId: p.id, qty: 1, sources: [tx('Wishlist')] }))} />
          <span className="text-muted">{Object.entries(stats.byBrand).map(([b, n]) => `${b} ${n}`).join(' · ')}</span>
        </section>

        <section className="flex flex-wrap items-center gap-2" aria-label={tx('Paint filters')} data-tour="paint-filters">
          <input className="input w-56" data-tour="paint-search" placeholder={tx('🔍 Search name or brand')} value={filter.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
          <select className="input" aria-label={tx('Brand')} value={filter.brand ?? ''} onChange={(e) => set({ brand: e.target.value || undefined })}>
            <option value="">{tx('All brands')}</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
          </select>
          <select className="input" aria-label={tx('Type')} value={filter.type ?? ''} onChange={(e) => set({ type: e.target.value || undefined })}>
            <option value="">{tx('All types')}</option>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select className="input" aria-label={tx('Colour')} value={filter.family ?? ''} onChange={(e) => set({ family: e.target.value || undefined })}>
            <option value="">{tx('All colours')}</option>
            {families.map((f) => <option key={f}>{f}</option>)}
          </select>
          <select className="input" aria-label={tx('Stage')} value={filter.stage ?? ''} onChange={(e) => set({ stage: e.target.value || undefined })}>
            <option value="">{tx('Any stage')}</option>
            {pipelines.paint.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={!!filter.ownedOnly} onChange={(e) => set({ ownedOnly: e.target.checked })} /> {tx('Owned')}</label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={!!filter.favouritesOnly} onChange={(e) => set({ favouritesOnly: e.target.checked })} /> {tx('Favourites')}</label>
          <span className="ml-auto text-sm text-muted">{tx('{{n}} paints', { n: shown.length })}</span>
        </section>

        {selecting && (
          <section className="panel flex flex-wrap items-center gap-2 p-3 text-sm" aria-label={tx('Selection')}>
            <b>{tx('{{n}} selected', { n: picked.size })}</b>
            <button className="btn" onClick={() => setPicked(new Set(shown.map((p) => p.id)))}>{tx('Select all ({{n}})', { n: shown.length })}</button>
            <button className="btn" disabled={!picked.size} onClick={() => setPicked(new Set())}>{tx('Clear')}</button>
            <button className="btn btn-primary" disabled={!picked.size} onClick={() => setMoving(true)}>{tx('📦 Put in a box…')}</button>
          </section>
        )}

        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 overflow-y-auto pb-4" aria-label={tx('Paints')}>
          {shown.slice(0, limit).map((p) => {
            const s = paintStock.get(p.id)
            return (
              <li key={p.id} className="relative">
                <button
                  className={`panel flex w-full flex-col overflow-hidden text-left hover:border-accent ${p.id === selectedId || picked.has(p.id) ? 'border-accent' : ''}`}
                  onClick={() => selecting ? setPicked((x) => { const n = new Set(x); if (!n.delete(p.id)) n.add(p.id); return n }) : setSelectedId(p.id)}
                  aria-label={`${p.name} (${p.brand})`}
                  aria-pressed={selecting ? picked.has(p.id) : undefined}
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
                {selecting && <span className="pointer-events-none absolute left-1 top-1 rounded bg-panel px-1 text-sm" aria-hidden>{picked.has(p.id) ? '☑' : '☐'}</span>}
                {s && !selecting && (
                  <span className="absolute right-1 top-1 flex overflow-hidden rounded border border-line bg-panel text-sm">
                    <button className="px-2" aria-label={tx('One pot less: {{name}}', { name: p.name })} disabled={s.quantity < 1} onClick={() => void saveStock(adjustQuantity(s, -1, ctx()))}>−</button>
                    <button className="px-2" aria-label={tx('One pot more: {{name}}', { name: p.name })} onClick={() => void saveStock(adjustQuantity(s, 1, ctx()))}>+</button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        {shown.length > limit && (
          <button className="btn mx-auto" onClick={() => setLimit(limit + PAGE)}>{tx('Show more ({{n}} left)', { n: shown.length - limit })}</button>
        )}
        {shown.length === 0 && <p className="p-6 text-center text-muted">{tx('No paints match these filters.')}</p>}
      </div>

      {moving && <PutInBoxDialog ids={[...picked]} onClose={(done) => { setMoving(false); if (done) { setPicked(new Set()); setSelecting(false) } }} />}
      {selected && <PaintPanel paint={selected} onClose={() => setSelectedId(null)} onSelect={setSelectedId} />}
      {buying && <MissingPaintsDialog onClose={() => setBuying(false)} />}
      {matching && <HexMatchDialog onClose={() => setMatching(false)} onPick={(p) => { setSelectedId(p.id); setMatching(false) }} />}
      {adding && <CustomPaintDialog onClose={() => setAdding(false)} onCreated={(id) => setSelectedId(id)} />}
    </div>
  )
}

/** Choose a storage place for the picked paints; paints you do not own yet are skipped. */
function PutInBoxDialog({ ids, onClose }: { ids: string[]; onClose: (done: boolean) => void }) {
  const tx = useTx()
  const { paintStock, saveStock } = useStore()
  const [target, setTarget] = useState<string>()
  const owned = ids.filter((id) => paintStock.has(id))
  const skipped = ids.length - owned.length
  return (
    <Dialog title={tx('Put {{n}} paints in a box', { n: ids.length })} onClose={() => onClose(false)}>
      <div className="grid gap-3">
        <PlaceSelect label={tx('Box or place')} empty={tx('Choose a place…')} value={target} onChange={setTarget} />
        {skipped > 0 && <p className="text-sm text-muted" role="status">{tx('{{n}} not in your inventory yet will be skipped.', { n: skipped })}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={!target || !owned.length} onClick={async () => {
            for (const st of placeStocks(useStore.getState().paintStock, owned, target, ctx())) await saveStock(st)
            onClose(true)
          }}>{tx('Move {{n}}', { n: owned.length })}</button>
          <button className="btn" disabled={!owned.length} onClick={async () => {
            for (const st of placeStocks(useStore.getState().paintStock, owned, undefined, ctx())) await saveStock(st)
            onClose(true)
          }}>{tx('Take out of any box')}</button>
        </div>
      </div>
    </Dialog>
  )
}
