import { useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { pathLabel } from '../../domain/storage/storage'
import {
  addTask, CONDITIONS, daysLeft, dueTasks, markDone, newTool, removeTask, SUGGESTED_TASKS, TOOL_CATEGORIES, toolShopItem,
  type Tool, type ToolCondition, type ToolStatus,
} from '../../domain/tools/tools'
import { PlaceSelect } from '../storage/Storage'

const dueText = (d: number) => (d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : d === 0 ? 'due today' : `in ${d} day${d === 1 ? '' : 's'}`)

/** Airbrush, clippers, lamp…: tools you own with repeating maintenance jobs, and a wishlist for Shopping. */
export function ToolsPage() {
  const { tools, saveTool } = useStore()
  const [tab, setTab] = useState<ToolStatus>('owned')
  const [name, setName] = useState('')
  const [category, setCategory] = useState(TOOL_CATEGORIES[0])
  const [error, setError] = useState('')
  const now = ctx().now
  const due = dueTasks(tools, now)
  const shown = tools.filter((t) => t.status === tab).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-accent">Tools</h1>
        <div className="flex gap-1" role="tablist" aria-label="Tool list">
          {([['owned', 'Owned'], ['wishlist', 'Wishlist']] as const).map(([id, l]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`btn ${tab === id ? 'btn-primary' : ''}`} onClick={() => setTab(id)}>
              {l} ({tools.filter((t) => t.status === id).length})
            </button>
          ))}
        </div>
      </header>

      {due.length > 0 && (
        <section className="panel grid gap-1 p-3" aria-label="Maintenance due">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-danger">⚠ Maintenance due</h2>
          <ul className="grid gap-1 text-sm">
            {due.map(({ tool, task, daysLeft: d }) => (
              <li key={task.id} className="flex flex-wrap items-center gap-2">
                <span>{tool.name}: {task.name}</span>
                <span className="text-xs text-danger">{task.lastDone ? dueText(d) : 'never done'}</span>
                <button className="btn px-2 py-0 text-xs" aria-label={`Done: ${tool.name} ${task.name}`} onClick={() => void saveTool(markDone(tool, task.id, ctx()))}>✓ Done</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form
        className="panel flex flex-wrap items-end gap-2 p-3"
        aria-label="New tool"
        onSubmit={(e) => {
          e.preventDefault()
          try {
            void saveTool(newTool({ name, category, status: tab }, ctx()))
            setName('')
            setError('')
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      >
        <label className="grid gap-0.5 text-xs text-muted">Name<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Harder & Steenbeck Infinity" /></label>
        <label className="grid gap-0.5 text-xs text-muted">Category<select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{TOOL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <button className="btn btn-primary">{tab === 'owned' ? '+ Add tool' : '+ Add to wishlist'}</button>
        {error && <span className="text-sm text-danger" role="alert">{error}</span>}
      </form>

      {shown.length === 0 ? (
        <p className="text-muted">
          {tab === 'owned' ? 'No tools yet. Add your airbrush, clippers, lamp… and set maintenance reminders like cleaning or replacing blades.' : 'Nothing on the wishlist. Add tools you want and send them to the shopping list.'}
        </p>
      ) : (
        <ul className="grid gap-3">{shown.map((t) => <ToolCard key={t.id} tool={t} now={now} />)}</ul>
      )}
    </div>
  )
}

function ToolCard({ tool: t, now }: { tool: Tool; now: string }) {
  const { saveTool, deleteTool, storage, shopItems, addToShopping } = useStore()
  const [open, setOpen] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [every, setEvery] = useState('7')
  const [err, setErr] = useState('')
  const save = (patch: Partial<Tool>) => void saveTool({ ...t, ...patch, updatedAt: ctx().now })
  const onList = shopItems.some((x) => !x.bought && x.refId === `tool:${t.id}`)
  const suggestions = (SUGGESTED_TASKS[t.category] ?? []).filter((s) => !t.tasks.some((x) => x.name.toLowerCase() === s.name.toLowerCase()))
  const add = (input: { name: string; everyDays: number }) => {
    try {
      void saveTool(addTask(t, input, ctx()))
      setTaskName('')
      setErr('')
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const buyLabel = t.status === 'wishlist' ? '🛒 Add to shopping' : '🛒 Buy a replacement'

  return (
    <li className={`panel grid gap-2 p-3 ${t.condition === 'broken' ? 'border-danger' : ''}`} aria-label={`Tool ${t.name}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button className="text-left font-semibold" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '▾' : '▸'} {t.name}</button>
        <span className="text-xs text-muted">{[t.brand, t.category, t.placeId && pathLabel(storage, t.placeId)].filter(Boolean).join(' · ')}</span>
        {t.status === 'owned' && t.condition !== 'good' && <span className={`text-xs ${t.condition === 'broken' ? 'text-danger' : 'text-muted'}`}>{t.condition === 'broken' ? '✕ Broken' : '◐ Worn'}</span>}
        <span className="ml-auto flex flex-wrap gap-1">
          {(t.status === 'wishlist' || t.condition !== 'good') && (
            onList ? <span className="text-xs text-muted">✓ On shopping list</span>
              : <button className="btn px-2 py-0.5 text-xs" onClick={() => void addToShopping([toolShopItem(t)], [])}>{buyLabel}</button>
          )}
          {t.status === 'wishlist' && <button className="btn px-2 py-0.5 text-xs" onClick={() => save({ status: 'owned', boughtAt: ctx().now.slice(0, 10) })}>✓ Got it</button>}
          <button className="text-muted hover:text-danger" aria-label={`Delete ${t.name}`} onClick={() => void deleteTool(t.id)}>✕</button>
        </span>
      </div>

      {t.status === 'owned' && t.tasks.length > 0 && (
        <ul className="grid gap-1 text-sm" aria-label={`Maintenance of ${t.name}`}>
          {t.tasks.map((task) => {
            const d = daysLeft(task, now)
            return (
              <li key={task.id} className="flex flex-wrap items-center gap-2">
                <span>{task.name}</span>
                <span className="text-xs text-muted">every {task.everyDays} days ·</span>
                <span className={`text-xs ${d <= 0 ? 'text-danger' : 'text-muted'}`}>{task.lastDone ? dueText(d) : 'never done'}</span>
                <button className="btn px-2 py-0 text-xs" aria-label={`Done: ${t.name} ${task.name}`} onClick={() => void saveTool(markDone(t, task.id, ctx()))}>✓ Done</button>
                {open && <button className="text-xs text-muted hover:text-danger" aria-label={`Remove task ${task.name}`} onClick={() => void saveTool(removeTask(t, task.id, ctx()))}>✕</button>}
              </li>
            )
          })}
        </ul>
      )}

      {open && (
        <div className="grid gap-2 border-t border-line pt-2 text-sm">
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-0.5 text-xs text-muted">Name<input className="input" value={t.name} onChange={(e) => save({ name: e.target.value })} /></label>
            <label className="grid gap-0.5 text-xs text-muted">Brand<input className="input w-32" value={t.brand} onChange={(e) => save({ brand: e.target.value })} /></label>
            <label className="grid gap-0.5 text-xs text-muted">Category<select className="input" value={t.category} onChange={(e) => save({ category: e.target.value })}>{[...new Set([...TOOL_CATEGORIES, t.category])].map((c) => <option key={c}>{c}</option>)}</select></label>
            {t.status === 'owned' && (
              <>
                <label className="grid gap-0.5 text-xs text-muted">Condition<select className="input" value={t.condition} onChange={(e) => save({ condition: e.target.value as ToolCondition })}>{CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                {storage.places.length > 0 && <label className="grid gap-0.5 text-xs text-muted">Kept in<PlaceSelect label="Kept in" empty="Not set" value={t.placeId} onChange={(id) => save({ placeId: id })} /></label>}
                <label className="grid gap-0.5 text-xs text-muted">Bought<input className="input" type="date" value={t.boughtAt ?? ''} onChange={(e) => save({ boughtAt: e.target.value || undefined })} /></label>
              </>
            )}
            <label className="grid gap-0.5 text-xs text-muted">Price<input className="input w-20" type="number" min={0} step="0.01" value={t.price ?? ''} onChange={(e) => save({ price: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} /></label>
          </div>
          <label className="grid gap-0.5 text-xs text-muted">Notes<textarea className="input" rows={2} value={t.notes} onChange={(e) => save({ notes: e.target.value })} placeholder="Needle size, spare parts, where you bought it…" /></label>

          {t.status === 'owned' && (
            <form className="flex flex-wrap items-end gap-2" aria-label={`New task for ${t.name}`} onSubmit={(e) => { e.preventDefault(); add({ name: taskName, everyDays: Number(every) }) }}>
              <label className="grid gap-0.5 text-xs text-muted">Maintenance job<input className="input" value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="e.g. Deep clean" /></label>
              <label className="grid gap-0.5 text-xs text-muted">Every (days)<input className="input w-20" type="number" min={1} value={every} onChange={(e) => setEvery(e.target.value)} /></label>
              <button className="btn">+ Add job</button>
              {suggestions.map((s) => <button type="button" key={s.name} className="btn px-2 py-0.5 text-xs" onClick={() => add(s)}>+ {s.name} ({s.everyDays} d)</button>)}
              {err && <span className="text-sm text-danger" role="alert">{err}</span>}
            </form>
          )}
        </div>
      )}
    </li>
  )
}
