import { useState } from 'react'
import { useStore } from '../../app/store'
import { addStage, removeStage, renameStage, reorderStages, DEFAULT_PIPELINE } from '../../domain/collection/pipeline'
import type { Pipeline } from '../../domain/collection/types'

export function PipelinePage() {
  const { pipeline, units, savePipeline } = useStore()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  async function apply(change: () => Pipeline) {
    try {
      setError('')
      await savePipeline(change())
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const ids = pipeline.stages.map((s) => s.id)
  const swap = (i: number, j: number) => {
    const next = [...ids]
    ;[next[i], next[j]] = [next[j], next[i]]
    return reorderStages(pipeline, next)
  }
  const inUse = (id: string) => units.reduce((n, u) => n + u.groups.filter((g) => g.status === id).reduce((a, g) => a + g.count, 0), 0)

  return (
    <div className="grid max-w-2xl gap-4">
      <h1 className="font-display text-2xl text-accent">Painting pipeline</h1>
      <p className="text-muted">One list of stages for all your armies. Stages with models in them can't be deleted.</p>
      <ol className="panel divide-y divide-line">
        {pipeline.stages.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 p-2">
            <span className="w-6 text-right text-muted">{i + 1}.</span>
            <input
              className="input flex-1"
              defaultValue={s.name}
              aria-label={`Name of stage ${i + 1}`}
              onBlur={(e) => e.target.value !== s.name && apply(() => renameStage(pipeline, s.id, e.target.value))}
            />
            <span className="w-20 text-xs text-muted">{inUse(s.id)} models</span>
            <button className="btn" aria-label="Move up" disabled={i === 0} onClick={() => apply(() => swap(i, i - 1))}>↑</button>
            <button className="btn" aria-label="Move down" disabled={i === ids.length - 1} onClick={() => apply(() => swap(i, i + 1))}>↓</button>
            <button className="btn btn-danger" aria-label="Delete stage" onClick={() => apply(() => removeStage(pipeline, s.id, units))}>✕</button>
          </li>
        ))}
      </ol>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const name = newName.trim()
          if (!name) return
          const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + (ids.includes(name.toLowerCase()) ? `-${Date.now()}` : '')
          void apply(() => addStage(pipeline, { id, name })).then(() => setNewName(''))
        }}
      >
        <input className="input flex-1" placeholder="New stage name, e.g. Washed" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn btn-primary" type="submit">Add stage</button>
      </form>
      <button className="btn w-fit" onClick={() => confirm('Reset to the default stages?') && apply(() => {
        const missing = units.some((u) => u.groups.some((g) => !DEFAULT_PIPELINE.stages.some((s) => s.id === g.status)))
        if (missing) throw new Error('Some models are in stages that the default pipeline does not have')
        return DEFAULT_PIPELINE
      })}>
        Reset to default
      </button>
      {error && <p className="text-danger" role="alert">{error}</p>}
    </div>
  )
}
