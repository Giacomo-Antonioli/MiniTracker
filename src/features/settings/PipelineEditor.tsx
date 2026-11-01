import { useState } from 'react'
import { addStage, removeUnusedStage, renameStage, reorderStages } from '../../domain/collection/pipeline'
import type { Pipeline } from '../../domain/collection/types'

interface Props {
  title: string
  description: string
  pipeline: Pipeline
  defaults: Pipeline
  /** How many items are in a stage (deleting is blocked while > 0). */
  usedBy: (stageId: string) => number
  usedLabel: string
  onSave: (p: Pipeline) => Promise<void>
}

/** Rename, reorder, add, delete and reset the stages of any pipeline. */
export function PipelineEditor({ title, description, pipeline, defaults, usedBy, usedLabel, onSave }: Props) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const ids = pipeline.stages.map((s) => s.id)

  async function apply(change: () => Pipeline) {
    try {
      setError('')
      await onSave(change())
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const swap = (i: number, j: number) => {
    const next = [...ids]
    ;[next[i], next[j]] = [next[j], next[i]]
    return reorderStages(pipeline, next)
  }

  return (
    <section className="panel grid gap-3 p-4" aria-label={title}>
      <div>
        <h3 className="font-display text-lg">{title}</h3>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <ol className="divide-y divide-line rounded border border-line">
        {pipeline.stages.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 p-2">
            <span className="w-6 text-right text-muted">{i + 1}.</span>
            <input
              className="input flex-1"
              defaultValue={s.name}
              aria-label={`Name of stage ${i + 1}`}
              onBlur={(e) => e.target.value !== s.name && apply(() => renameStage(pipeline, s.id, e.target.value))}
            />
            <span className="w-24 text-xs text-muted">{usedBy(s.id)} {usedLabel}</span>
            <button className="btn" aria-label="Move up" disabled={i === 0} onClick={() => apply(() => swap(i, i - 1))}>↑</button>
            <button className="btn" aria-label="Move down" disabled={i === ids.length - 1} onClick={() => apply(() => swap(i, i + 1))}>↓</button>
            <button className="btn btn-danger" aria-label="Delete stage" onClick={() => apply(() => removeUnusedStage(pipeline, s.id, usedBy(s.id)))}>✕</button>
          </li>
        ))}
      </ol>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const name = newName.trim()
          if (!name) return
          const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          const id = ids.includes(base) ? `${base}-${Date.now()}` : base
          void apply(() => addStage(pipeline, { id, name })).then(() => setNewName(''))
        }}
      >
        <input className="input flex-1" placeholder="New stage name" aria-label={`New stage for ${title}`} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn btn-primary" type="submit">Add stage</button>
        <button
          type="button"
          className="btn"
          onClick={() =>
            confirm(`Reset "${title}" to the default stages?`) &&
            apply(() => {
              const missing = pipeline.stages.filter((s) => usedBy(s.id) > 0 && !defaults.stages.some((d) => d.id === s.id))
              if (missing.length) throw new Error(`Some items are in stages the default doesn't have: ${missing.map((s) => s.name).join(', ')}`)
              return defaults
            })
          }
        >
          Reset
        </button>
      </form>
      {error && <p className="text-danger" role="alert">{error}</p>}
    </section>
  )
}
