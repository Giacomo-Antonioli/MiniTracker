import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../app/store'
import { factionLabel, searchDatasheets } from '../../domain/catalogue/search'
import type { Datasheet } from '../../domain/catalogue/types'
import { isGone } from '../../domain/collection/pipeline'
import { totalModels } from '../../domain/collection/ownedUnit'
import { useTx } from '../../i18n'
import { Dialog } from '../../ui/Dialog'

/** Search the whole catalogue (units and paints) and add to the shopping list without owning it (#107). */
export function CatalogueSearch({ listIds }: { listIds: string[] }) {
  const tx = useTx()
  const { catalogue, paints, paintStock, units, loadPaints, addFromCatalogue } = useStore()
  const [q, setQ] = useState('')
  const [ask, setAsk] = useState<Datasheet | null>(null)
  const [done, setDone] = useState('')
  useEffect(() => {
    if (!paints.length) void loadPaints()
  }, [paints.length, loadPaints])

  const term = q.trim().toLowerCase()
  const sheets = useMemo(() => (catalogue && term.length > 1 ? searchDatasheets(catalogue, term, { limit: 12 }) : []), [catalogue, term])
  const pots = useMemo(() => (term.length > 1 ? paints.filter((p) => `${p.brand} ${p.name}`.toLowerCase().includes(term)).slice(0, 12) : []), [paints, term])
  const mine = (d: Datasheet) => units.filter((u) => u.datasheetId === d.id && !isGone(u.lifecycle))

  const addUnit = async (d: Datasheet, backlog: 'new' | 'none' | { unitId: string }) => {
    setAsk(null)
    await addFromCatalogue({ kind: 'model', name: d.name, refId: d.id, qty: d.minModels, sources: ['Catalogue'] }, listIds, backlog)
    setDone(tx('Added {{name}}', { name: d.name }))
  }

  return (
    <div className="mt-3">
      <input className="input w-full" aria-label={tx('Search catalogue')} placeholder={tx('Search units and paints to add…')} value={q} onChange={(e) => { setQ(e.target.value); setDone('') }} />
      {done && <p className="mt-1 text-sm text-ok">{done}</p>}
      {(sheets.length > 0 || pots.length > 0) && (
        <ul className="mt-1 max-h-72 overflow-y-auto rounded border border-line text-sm" aria-label={tx('Catalogue results')}>
          {sheets.map((d) => (
            <li key={d.id} className="flex items-center gap-2 px-2 py-1">
              <span className="flex-1">{d.name} <span className="text-xs text-muted">{catalogue ? factionLabel(catalogue, d) : ''} · {d.minModels === d.maxModels ? tx('{{n}} models', { n: d.minModels }) : tx('{{min}}–{{max}} models', { min: d.minModels, max: d.maxModels })}</span></span>
              <button className="btn px-2 py-0.5" aria-label={tx('Add {{name}}', { name: d.name })} onClick={() => (mine(d).length ? setAsk(d) : addUnit(d, 'new'))}>+</button>
            </li>
          ))}
          {pots.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-2 py-1">
              <span className="inline-block h-4 w-4 shrink-0 rounded-sm border border-line" style={{ background: p.hex }} aria-hidden />
              <span className="flex-1">{p.brand} {p.name} {(paintStock.get(p.id)?.quantity ?? 0) > 0 && <span className="text-xs text-muted">{tx('owned')}</span>}</span>
              <button className="btn px-2 py-0.5" aria-label={tx('Add {{name}}', { name: `${p.brand} ${p.name}` })} onClick={async () => { await addFromCatalogue({ kind: 'paint', name: `${p.brand} ${p.name}`, refId: p.id, qty: 1, sources: ['Catalogue'] }, listIds); setDone(tx('Added {{name}}', { name: `${p.brand} ${p.name}` })) }}>+</button>
            </li>
          ))}
        </ul>
      )}
      {ask && (
        <Dialog title={tx('{{name}} is in your backlog', { name: ask.name })} onClose={() => setAsk(null)}>
          <p className="text-sm">{ask.minModels === 1 ? tx('Add 1 Wishlisted model to:') : tx('Add {{n}} Wishlisted models to:', { n: ask.minModels })}</p>
          <div className="mt-3 flex flex-col gap-2">
            {mine(ask).map((u) => (
              <button key={u.id} className="btn text-left" onClick={() => addUnit(ask, { unitId: u.id })}>{u.customName} ({tx('{{n}} models', { n: totalModels(u) })})</button>
            ))}
            <button className="btn text-left" onClick={() => addUnit(ask, 'new')}>{tx('A new backlog entry')}</button>
            <button className="btn text-left" onClick={() => addUnit(ask, 'none')}>{tx('Shopping list only, leave the backlog')}</button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
