import { useMemo, useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { editCopies, type WorkshopItem, type WorkshopKind } from '../../domain/workshop/item'
import { useT } from '../../i18n'
import { Dialog } from '../../ui/Dialog'
import { PlaceSelect } from '../storage/Storage'

type Row = { kind: WorkshopKind; item: WorkshopItem }

/** Change several tools and supplies at once: move them to a storage place, set a category, or mark them as liquids. All start ticked. */
export function WorkshopBulkDialog({ rows, onClose }: { rows: Row[]; onClose: () => void }) {
  const t = useT()
  const { saveTool, saveSupply, workshopCategories: cats, storage } = useStore()
  const key = (r: Row) => `${r.kind}:${r.item.id}`
  const [picked, setPicked] = useState<string[]>(rows.map(key))
  const [place, setPlace] = useState<string | undefined>()
  const [category, setCategory] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const ticked = useMemo(() => rows.filter((r) => picked.includes(`${r.kind}:${r.item.id}`)), [rows, picked])
  const categories = [...new Set([...cats.tools, ...cats.supplies])]

  async function apply(change: (r: Row) => WorkshopItem | undefined) {
    setBusy(true)
    let n = 0
    for (const r of ticked) {
      const next = change(r)
      if (!next) continue
      await (r.kind === 'tool' ? saveTool(next) : saveSupply(next))
      n++
    }
    setBusy(false)
    setMessage(t('workshopCopies.bulkDone', { n }))
  }
  const stamp = (i: WorkshopItem) => ({ ...i, updatedAt: ctx().now })

  return (
    <Dialog title={t('workshopCopies.bulkTitle')} onClose={onClose} wide>
      <div className="grid gap-4">
        <p className="text-sm text-muted">{t('workshopCopies.bulkHelp')}</p>
        <section className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">{t('workshopCopies.bulkSelected', { n: ticked.length, total: rows.length })}</span>
            <button className="btn px-2 py-0.5 text-sm" onClick={() => setPicked(rows.map(key))}>{t('workshopCopies.bulkAll')}</button>
            <button className="btn px-2 py-0.5 text-sm" onClick={() => setPicked([])}>{t('workshopCopies.bulkNone')}</button>
          </div>
          <ul className="grid max-h-48 gap-0.5 overflow-y-auto rounded border border-line p-2">
            {rows.map((r) => (
              <li key={key(r)}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={picked.includes(key(r))} onChange={() => setPicked(picked.includes(key(r)) ? picked.filter((x) => x !== key(r)) : [...picked, key(r)])} />
                  <span>{r.item.name}</span>
                  <span className="text-xs text-muted">{r.item.category}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel grid gap-2 p-3">
          <h3 className="font-display">{t('workshopCopies.bulkMove')}</h3>
          {storage.places.length === 0 ? <p className="text-sm text-muted">{t('workshopCopies.bulkNoPlaces')}</p> : (
            <div className="flex flex-wrap items-end gap-2">
              <PlaceSelect label={t('workshopCopies.bulkMove')} value={place} onChange={setPlace} />
              <button className="btn btn-primary" disabled={busy || !place || ticked.length === 0} onClick={() => void apply((r) => stamp(editCopies(r.item, 'all', { placeId: place })))}>{t('workshopCopies.bulkMoveGo', { n: ticked.length })}</button>
            </div>
          )}
        </section>

        <section className="panel grid gap-2 p-3">
          <h3 className="font-display">{t('workshopCopies.bulkCategory')}</h3>
          <div className="flex flex-wrap items-end gap-2">
            <select className="input" aria-label={t('workshopCopies.bulkCategory')} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="" />
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button className="btn" disabled={busy || !category || ticked.length === 0} onClick={() => void apply((r) => stamp({ ...r.item, category }))}>{t('workshopCopies.bulkCategoryGo', { n: ticked.length })}</button>
          </div>
        </section>

        <section className="panel grid gap-2 p-3">
          <h3 className="font-display">{t('workshopCopies.bulkLiquid')}</h3>
          <div className="flex flex-wrap gap-2">
            <button className="btn" disabled={busy || ticked.length === 0} onClick={() => void apply((r) => stamp({ ...r.item, liquid: true }))}>{t('workshopCopies.bulkLiquidOn')}</button>
            <button className="btn" disabled={busy || ticked.length === 0} onClick={() => void apply((r) => stamp({ ...r.item, liquid: false }))}>{t('workshopCopies.bulkLiquidOff')}</button>
          </div>
        </section>

        {message && <p role="status" className="text-ok">{message}</p>}
        <div className="flex justify-end"><button className="btn" onClick={onClose}>{t('workshopCopies.bulkClose')}</button></div>
      </div>
    </Dialog>
  )
}
