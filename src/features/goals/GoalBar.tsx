import type { Progress } from '../../domain/goals/goals'

/** Progress bar with the progress text under it. */
export function GoalBar({ p }: { p: Progress }) {
  const pct = p.target > 0 ? Math.min(100, (p.current / p.target) * 100) : p.done ? 100 : 0
  return (
    <div className="grid gap-1">
      <div className="h-2.5 overflow-hidden rounded bg-panel-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full ${p.done ? 'bg-ok' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm tabular-nums">{p.text}</span>
    </div>
  )
}
