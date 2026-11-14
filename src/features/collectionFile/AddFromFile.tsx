import { useState } from 'react'
import { useStore } from '../../app/store'
import { selectEntries, type CollectionFile, type DuplicateFlags } from '../../domain/collection/collectionFile'
import { useT } from '../../i18n'
import { Dialog } from '../../ui/Dialog'

interface Review {
  file: CollectionFile
  duplicates: DuplicateFlags
  /** Which entries are ticked, in the file's order. */
  keep: DuplicateFlags
}

type Section = keyof DuplicateFlags

/**
 * "Add from a file": pick a collection file, look over what it holds (every entry ticked, those already in the
 * tracker flagged), untick what you don't want, then add. Ticked entries already there join the existing ones.
 */
export function AddFromFile({ compact }: { compact?: boolean }) {
  const t = useT()
  const { previewCollection, importCollection } = useStore()
  const [review, setReview] = useState<Review | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function pick(file: File) {
    setMessage(null)
    try {
      const { file: parsed, duplicates } = previewCollection(await file.text())
      const keep: DuplicateFlags = { units: duplicates.units.map(() => true), tools: duplicates.tools.map(() => true), supplies: duplicates.supplies.map(() => true) }
      setReview({ file: parsed, duplicates, keep })
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    }
  }

  function toggle(section: Section, i: number) {
    setReview((r) => r && { ...r, keep: { ...r.keep, [section]: r.keep[section].map((v, j) => (j === i ? !v : v)) } })
  }

  async function add() {
    if (!review) return
    setBusy(true)
    try {
      const r = await importCollection(selectEntries(review.file, review.keep), 'add')
      setMessage({ ok: true, text: t('settingsPanels.backup.added', { units: r.units, tools: r.tools, supplies: r.supplies, merged: r.duplicates }) })
      setReview(null)
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const ticked = review ? [...review.keep.units, ...review.keep.tools, ...review.keep.supplies].filter(Boolean).length : 0

  const list = (section: Section, title: string, names: string[]) =>
    review && names.length > 0 && (
      <section className="grid gap-1">
        <h3 className="font-display">{title} ({review.keep[section].filter(Boolean).length}/{names.length})</h3>
        <ul className="grid gap-0.5">
          {names.map((n, i) => (
            <li key={`${n}-${i}`}>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={review.keep[section][i]} onChange={() => toggle(section, i)} />
                <span>{n}</span>
                {review.duplicates[section][i] && <span className="text-xs text-muted">{t('settingsPanels.backup.dupBadge')}</span>}
              </label>
            </li>
          ))}
        </ul>
      </section>
    )

  return (
    <div className="grid gap-2">
      <label className={`btn w-fit ${compact ? 'text-sm' : ''} ${busy ? 'pointer-events-none opacity-50' : ''}`} title={t('settingsPanels.backup.addHelp')}>
        {compact ? t('settingsPanels.backup.addShort') : t('settingsPanels.backup.addChoose')}
        <input
          type="file"
          accept=".json,application/json"
          aria-label={t('settingsPanels.backup.addFile')}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void pick(f)
          }}
        />
      </label>
      {message && <p role="status" className={message.ok ? 'text-ok' : 'text-danger'}>{message.text}</p>}
      {review && (
        <Dialog title={t('settingsPanels.backup.reviewTitle')} onClose={() => setReview(null)} wide>
          <div className="grid gap-3">
            <p className="text-sm text-muted">{t('settingsPanels.backup.reviewHelp')}</p>
            {list('units', t('settingsPanels.backup.sectionUnits'), review.file.units.map((u) => `${u.name}${u.count && u.count > 1 ? ` ×${u.count}` : ''}${u.status ? ` · ${u.status}` : ''}`))}
            {list('tools', t('settingsPanels.backup.sectionTools'), review.file.tools.map((x) => x.name))}
            {list('supplies', t('settingsPanels.backup.sectionSupplies'), review.file.supplies.map((x) => x.name))}
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn" onClick={() => setReview(null)}>{t('settingsPanels.backup.dupCancel')}</button>
              <button className="btn btn-primary" disabled={busy || ticked === 0} onClick={() => void add()}>{t('settingsPanels.backup.reviewConfirm', { n: ticked })}</button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
