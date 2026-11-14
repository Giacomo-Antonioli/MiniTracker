import { useMemo, useState } from 'react'
import { useStore } from '../../app/store'
import { modelsAt } from '../../domain/collection/bulk'
import type { OwnedUnit } from '../../domain/collection/types'
import { useT } from '../../i18n'
import { Dialog } from '../../ui/Dialog'

/** Change several units at once: move their models from one stage to another, or add/remove a tag. Every unit starts ticked. */
export function BulkEditDialog({ units, onClose }: { units: OwnedUnit[]; onClose: () => void }) {
  const t = useT()
  const { pipeline, bulkMove, bulkTag } = useStore()
  const [picked, setPicked] = useState<string[]>(units.map((u) => u.id))
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const [tag, setTag] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const ticked = useMemo(() => units.filter((u) => picked.includes(u.id)), [units, picked])
  // Stages that hold models in the ticked units, so "From" only offers what can move.
  const present = pipeline.stages.filter((s) => ticked.some((u) => modelsAt(u, s.id) > 0))
  const fromId = present.some((s) => s.id === from) ? from : (present[0]?.id ?? '')
  const toId = to && to !== fromId ? to : (pipeline.stages.find((s) => s.id !== fromId)?.id ?? '')
  const models = ticked.reduce((n, u) => n + modelsAt(u, fromId), 0)

  async function run(f: () => Promise<string>) {
    setBusy(true)
    setMessage(null)
    try {
      setMessage({ ok: true, text: await f() })
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  const ids = ticked.map((u) => u.id)

  return (
    <Dialog title={t('bulk.title')} onClose={onClose} wide>
      <div className="grid gap-4">
        <p className="text-sm text-muted">{t('bulk.help')}</p>
        <section className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display">{t('bulk.units')}</h3>
            <span className="text-sm text-muted">{t('bulk.selected', { n: ticked.length, total: units.length })}</span>
            <button className="btn px-2 py-0.5 text-sm" onClick={() => setPicked(units.map((u) => u.id))}>{t('bulk.all')}</button>
            <button className="btn px-2 py-0.5 text-sm" onClick={() => setPicked([])}>{t('bulk.none')}</button>
          </div>
          <ul className="grid max-h-48 gap-0.5 overflow-y-auto rounded border border-line p-2">
            {units.map((u) => (
              <li key={u.id}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={picked.includes(u.id)} onChange={() => setPicked(picked.includes(u.id) ? picked.filter((x) => x !== u.id) : [...picked, u.id])} />
                  <span>{u.customName}</span>
                  <span className="text-xs text-muted">{u.groups.map((g) => `${g.count} × ${pipeline.stages.find((s) => s.id === g.status)?.name ?? g.status}`).join(', ')}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel grid gap-2 p-3">
          <h3 className="font-display">{t('bulk.moveTitle')}</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-0.5 text-xs text-muted">{t('bulk.from')}
              <select className="input" value={fromId} onChange={(e) => setFrom(e.target.value)}>
                {present.map((s) => <option key={s.id} value={s.id}>{s.name} ({t('bulk.models', { n: ticked.reduce((n, u) => n + modelsAt(u, s.id), 0) })})</option>)}
              </select>
            </label>
            <label className="grid gap-0.5 text-xs text-muted">{t('bulk.to')}
              <select className="input" value={toId} onChange={(e) => setTo(e.target.value)}>
                {pipeline.stages.filter((s) => s.id !== fromId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="grid flex-1 gap-0.5 text-xs text-muted">{t('bulk.note')}
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <button
              className="btn btn-primary"
              disabled={busy || models === 0}
              onClick={() => void run(async () => {
                const r = await bulkMove(ids, fromId, toId, note)
                return r.models ? t('bulk.moved', r) : t('bulk.nothingToMove')
              })}
            >{t('bulk.move', { models })}</button>
          </div>
        </section>

        <section className="panel grid gap-2 p-3">
          <h3 className="font-display">{t('bulk.tagTitle')}</h3>
          <div className="flex flex-wrap items-end gap-2">
            <input className="input" aria-label={t('bulk.tagTitle')} value={tag} placeholder={t('bulk.tagPlaceholder')} onChange={(e) => setTag(e.target.value)} />
            <button className="btn" disabled={busy || !tag.trim() || ids.length === 0} onClick={() => void run(async () => t('bulk.tagged', { n: await bulkTag(ids, tag, true) }))}>{t('bulk.addTag')}</button>
            <button className="btn" disabled={busy || !tag.trim() || ids.length === 0} onClick={() => void run(async () => t('bulk.untagged', { n: await bulkTag(ids, tag, false) }))}>{t('bulk.removeTag')}</button>
          </div>
        </section>

        {message && <p role="status" className={message.ok ? 'text-ok' : 'text-danger'}>{message.text}</p>}
        <div className="flex justify-end"><button className="btn" onClick={onClose}>{t('bulk.close')}</button></div>
      </div>
    </Dialog>
  )
}
