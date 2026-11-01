import { useState } from 'react'
import { useStore } from '../../app/store'
import type { ModelGroup, OwnedUnit } from '../../domain/collection/types'
import { Dialog } from '../../ui/Dialog'

const today = () => new Date().toISOString().slice(0, 10)

export function MoveDialog({ unit, group, onClose }: { unit: OwnedUnit; group: ModelGroup; onClose: () => void }) {
  const { pipeline, move } = useStore()
  const currentIdx = pipeline.stages.findIndex((s) => s.id === group.status)
  const next = pipeline.stages[currentIdx + 1] ?? pipeline.stages.find((s) => s.id !== group.status)!
  const [count, setCount] = useState(group.count)
  const [to, setTo] = useState(next.id)
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const from = pipeline.stages[currentIdx]?.name ?? group.status

  return (
    <Dialog title="Move models" onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const dialog = (e.target as HTMLElement).closest('dialog')
          try {
            // Keep the real time when the date is today, so history stays in order within a day.
            await move(unit, group.id, count, to, { date: date === today() ? new Date().toISOString() : date, note })
            dialog?.close()
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      >
        <p className="text-muted">From <b className="text-fg">{from}</b> ({group.count} models)</p>
        <label className="grid gap-1">
          <span className="text-sm text-muted">How many</span>
          <div className="flex items-center gap-2">
            <input className="input w-20" type="number" min={1} max={group.count} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            <input className="flex-1 accent-[var(--accent)]" type="range" min={1} max={group.count} value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="How many (slider)" />
          </div>
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-muted">To stage</span>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {pipeline.stages.filter((s) => s.id !== group.status).map((s) => (
              <option key={s.id} value={s.id}>{pipeline.stages.indexOf(s) < currentIdx ? '↩ ' : ''}{s.name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-muted">Date</span>
          <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-muted">Photo</span>
          <button type="button" className="btn w-fit" disabled title="Photos arrive in a later sprint">📷 Add photo (soon)</button>
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-muted">Note</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="text-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={(e) => (e.target as HTMLElement).closest('dialog')?.close()}>Cancel</button>
          <button type="submit" className="btn btn-primary">Move</button>
        </div>
      </form>
    </Dialog>
  )
}
