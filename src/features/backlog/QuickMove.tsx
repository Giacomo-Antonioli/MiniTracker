import { useState } from 'react'
import { useStore } from '../../app/store'
import type { ModelGroup, OwnedUnit } from '../../domain/collection/types'

/** Move some or all models of a group, to the next stage by default (any stage can be chosen). */
export function QuickMove({ unit, group }: { unit: OwnedUnit; group: ModelGroup }) {
  const { pipeline, move } = useStore()
  const stages = pipeline.stages.filter((s) => s.id !== group.status)
  const at = pipeline.stages.findIndex((s) => s.id === group.status)
  const next = pipeline.stages[at + 1]?.id ?? stages[0]?.id
  const [to, setTo] = useState(next)
  const [n, setN] = useState('1')
  const count = Math.min(group.count, Math.max(1, Math.round(Number(n)) || 1))
  if (!stages.length) return null
  const go = (count: number) => void move(unit, group.id, count, to, {})
  const name = pipeline.stages[at]?.name ?? group.status

  return (
    <div className="flex items-center gap-1 text-sm">
      <input className="input w-14" type="number" min={1} max={group.count} value={n} aria-label={`How many ${name} to move`} onChange={(e) => setN(e.target.value)} />
      <span>→</span>
      <select className="input" value={to} aria-label={`Move ${name} to`} onChange={(e) => setTo(e.target.value)}>
        {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <button className="btn" onClick={() => go(count)}>Move</button>
      <button className="btn" onClick={() => go(group.count)} title={`Move all ${group.count}`}>All</button>
    </div>
  )
}
