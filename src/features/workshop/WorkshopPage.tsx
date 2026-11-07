import { useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { pathLabel } from '../../domain/storage/storage'
import { SUGGESTED_TASKS, TOOL_SOURCE } from '../../domain/tools/tools'
import type { Pipeline } from '../../domain/collection/types'
import {
  addTask, CONDITIONS, daysLeft, dueTasks, isLiquid, isLow, levelIsLow, markDone, newItem, refPrefix, removeTask, shopItem,
  type ItemCondition, type ItemStatus, type WorkshopCategories, type WorkshopItem, type WorkshopKind,
} from '../../domain/workshop/item'
import { useTx, txr } from '../../i18n'
import { PlaceSelect } from '../storage/Storage'

const dueText = (d: number) =>
  d < 0 ? (d === -1 ? txr('1 day overdue') : txr('{{n}} days overdue', { n: -d })) : d === 0 ? txr('due today') : d === 1 ? txr('in 1 day') : txr('in {{n}} days', { n: d })
const ICON = { tool: '🔧', supply: '🧴' } as const
const conditionName = (id: string) => (id === 'good' ? txr('Good') : id === 'worn' ? txr('Worn') : id === 'broken' ? txr('Broken') : id)
const catsOf = (c: WorkshopCategories, k: WorkshopKind) => (k === 'tool' ? c.tools : c.supplies)

type Row = { kind: WorkshopKind; item: WorkshopItem }

/** Saves and deletes for either list. */
function useWorkshop() {
  const { tools, supplies, saveTool, saveSupply, deleteTool, deleteSupply } = useStore()
  const rows: Row[] = [...tools.map((item) => ({ kind: 'tool' as const, item })), ...supplies.map((item) => ({ kind: 'supply' as const, item }))]
  return {
    rows,
    save: (kind: WorkshopKind, item: WorkshopItem) => void (kind === 'tool' ? saveTool(item) : saveSupply(item)),
    remove: (kind: WorkshopKind, id: string) => void (kind === 'tool' ? deleteTool(id) : deleteSupply(id)),
  }
}

/** Counts for the nav: low stock and due maintenance, over both lists or one. */
export function workshopAlerts(s: { tools: WorkshopItem[]; supplies: WorkshopItem[]; pipelines: { level: Pipeline } }, kind?: WorkshopKind) {
  const items = kind === 'tool' ? s.tools : kind === 'supply' ? s.supplies : [...s.tools, ...s.supplies]
  return items.filter((x) => isLow(x, s.pipelines.level)).length + dueTasks(items, new Date().toISOString()).length
}

/** Tools and supplies: stock with alerts, condition, storage place, maintenance jobs and a wishlist. `kind` shows one list only. */
export function WorkshopPage({ kind }: { kind?: WorkshopKind }) {
  const tx = useTx()
  const { rows: all, save } = useWorkshop()
  const { workshopCategories: cats, pipelines } = useStore()
  const levels = pipelines.level
  const [tab, setTab] = useState<ItemStatus>('owned')
  const [newKind, setNewKind] = useState<WorkshopKind>(kind ?? 'tool')
  const addKind = kind ?? newKind
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>(catsOf(cats, addKind)[0] ?? 'Other')
  const [qty, setQty] = useState('1')
  const [lowAt, setLowAt] = useState('0')
  const [error, setError] = useState('')
  const now = ctx().now
  const rows = all.filter((r) => !kind || r.kind === kind)
  const due = dueTasks(rows.map((r) => r.item), now).map((d) => ({ ...d, kind: rows.find((r) => r.item === d.item)!.kind }))
  const low = rows.filter((r) => isLow(r.item, levels)).length
  const shown = rows
    .filter((r) => r.item.status === tab)
    .sort((a, b) => Number(isLow(b.item, levels)) - Number(isLow(a.item, levels)) || a.item.category.localeCompare(b.item.category) || a.item.name.localeCompare(b.item.name))
  const title = kind === 'tool' ? tx('Tools') : kind === 'supply' ? tx('Supplies') : tx('Workshop')
  const newLabel = kind === 'tool' ? tx('New tool') : kind === 'supply' ? tx('New supply') : tx('New item')

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-accent" data-tour="workshop-title">{title}</h1>
        {low > 0 && <span className="text-sm text-danger" role="status">{tx('⚠ {{n}} running low', { n: low })}</span>}
        <div className="flex gap-1" role="tablist" aria-label={tx('List')} data-tour="workshop-tabs">
          {([['owned', tx('Owned')], ['wishlist', tx('Wishlist')]] as const).map(([id, l]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`btn ${tab === id ? 'btn-primary' : ''}`} onClick={() => setTab(id)}>
              {l} ({rows.filter((r) => r.item.status === id).length})
            </button>
          ))}
        </div>
      </header>

      {due.length > 0 && (
        <section className="panel grid gap-1 p-3" aria-label={tx('Maintenance due')}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-danger">{tx('⚠ Maintenance due')}</h2>
          <ul className="grid gap-1 text-sm">
            {due.map(({ item, task, daysLeft: d, kind: k }) => (
              <li key={task.id} className="flex flex-wrap items-center gap-2">
                <span>{item.name}: {task.name}</span>
                <span className="text-xs text-danger">{task.lastDone ? dueText(d) : tx('never done')}</span>
                <button className="btn px-2 py-0 text-xs" aria-label={tx('Done: {{item}} {{task}}', { item: item.name, task: task.name })} onClick={() => save(k, markDone(item, task.id, ctx()))}>{tx('✓ Done')}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form
        className="panel flex flex-wrap items-end gap-2 p-3"
        aria-label={newLabel}
        onSubmit={(e) => {
          e.preventDefault()
          try {
            save(addKind, newItem({ name, category, status: tab, quantity: Math.max(0, Number(qty) || 0), lowAt: Math.max(0, Number(lowAt) || 0) }, ctx(), addKind === 'tool' ? tx('A tool') : tx('A supply')))
            setName('')
            setError('')
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      >
        {!kind && (
          <label className="grid gap-0.5 text-xs text-muted">{tx('Type')}
            <select className="input" value={newKind} onChange={(e) => { const k = e.target.value as WorkshopKind; setNewKind(k); setCategory(catsOf(cats, k)[0] ?? 'Other'); }}>
              <option value="tool">{tx('🔧 Tool')}</option>
              <option value="supply">{tx('🧴 Supply')}</option>
            </select>
          </label>
        )}
        <label className="grid gap-0.5 text-xs text-muted" data-tour="workshop-name">{tx('Name')}<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={addKind === 'tool' ? tx('e.g. Sprue cutters') : tx('e.g. Plastic glue')} /></label>
        <label className="grid gap-0.5 text-xs text-muted">{tx('Category')}<select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{catsOf(cats, addKind).map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="grid gap-0.5 text-xs text-muted">{tab === 'owned' ? tx('How many') : tx('Want')}<input className="input w-20" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
        {tab === 'owned' && <label className="grid gap-0.5 text-xs text-muted">{tx('Alert at')}<input className="input w-20" type="number" min={0} value={lowAt} onChange={(e) => setLowAt(e.target.value)} /></label>}
        <button className="btn btn-primary" data-tour="workshop-add">{tab === 'owned' ? tx('+ Add') : tx('+ Add to wishlist')}</button>
        {error && <span className="text-sm text-danger" role="alert">{error}</span>}
      </form>

      {shown.length === 0 ? (
        <p className="text-muted">
          {tab === 'wishlist' ? tx('Nothing on the wishlist. Add what you want and send it to the shopping list.')
            : kind === 'supply' ? tx('No supplies yet. Add primer, glue, brushes… and get an alert (and a shopping list entry) when they run low.')
            : kind === 'tool' ? tx('No tools yet. Add your airbrush, clippers, lamp… and set maintenance reminders like cleaning or replacing blades.')
            : tx('Your workshop is empty. Add tools (airbrush, clippers…) and supplies (glue, primer…): stock alerts, maintenance reminders and a wishlist for both.')}
        </p>
      ) : (
        <ul className="grid gap-3">{shown.map((r) => <ItemCard key={`${r.kind}:${r.item.id}`} row={r} now={now} showKind={!kind} />)}</ul>
      )}
    </div>
  )
}

function ItemCard({ row: { kind, item: t }, now, showKind }: { row: Row; now: string; showKind: boolean }) {
  const tx = useTx()
  const { storage, shopItems, addToShopping, workshopCategories: cats, pipelines } = useStore()
  const levels = pipelines.level
  const liquid = isLiquid(t, kind, cats)
  const { save: saveAny, remove } = useWorkshop()
  const [open, setOpen] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [every, setEvery] = useState('7')
  const [err, setErr] = useState('')
  const save = (patch: Partial<WorkshopItem>) => saveAny(kind, { ...t, ...patch, updatedAt: ctx().now })
  const onList = shopItems.some((x) => !x.bought && x.refId === `${refPrefix(kind)}${t.id}`)
  const low = isLow(t, levels)
  const levelName = levels.stages.find((s) => s.id === (t.level ?? levels.stages[0]?.id))?.name
  const owned = t.status === 'owned'
  const suggestions = (SUGGESTED_TASKS[t.category] ?? []).filter((s) => !t.tasks.some((x) => x.name.toLowerCase() === s.name.toLowerCase()))
  const add = (input: { name: string; everyDays: number }) => {
    try {
      saveAny(kind, addTask(t, input, ctx()))
      setTaskName('')
      setErr('')
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const worn = !liquid && t.condition !== 'good'
  const buyLabel = !owned ? tx('🛒 Add to shopping') : worn ? tx('🛒 Buy a replacement') : tx('🛒 Restock')
  const wantsBuying = !owned || worn || low

  return (
    <li className={`panel grid gap-2 p-3 ${t.condition === 'broken' || low ? 'border-danger' : ''}`} aria-label={tx(kind === 'tool' ? 'Tool {{name}}' : 'Supply {{name}}', { name: t.name })}>
      <div className="flex flex-wrap items-center gap-2">
        <button className="text-left font-semibold" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '▾' : '▸'} {showKind ? `${ICON[kind]} ` : ''}{t.name}</button>
        <span className="text-xs text-muted">{[t.brand, t.category, t.placeId && pathLabel(storage, t.placeId)].filter(Boolean).join(' · ')}</span>
        {owned && liquid && (
          <select className={`input py-0 text-xs ${levelIsLow(t.level, levels) ? 'text-danger' : ''}`} aria-label={tx('Level of {{name}}', { name: t.name })} value={t.level ?? levels.stages[0]?.id} onChange={(e) => save({ level: e.target.value })}>
            {levels.stages.map((s) => <option key={s.id} value={s.id}>💧 {s.name}</option>)}
          </select>
        )}
        {owned && worn && <span className={`text-xs ${t.condition === 'broken' ? 'text-danger' : 'text-muted'}`}>{t.condition === 'broken' ? tx('✕ Broken') : tx('◐ Worn')}</span>}
        {low && <span className="text-xs text-danger">{onList ? tx('⚠ Low · on shopping list') : tx('⚠ Low')}</span>}
        <span className="ml-auto flex flex-wrap items-center gap-1">
          {owned && (
            <span className="flex items-center gap-1">
              <button className="btn px-2 py-0" aria-label={tx('One less {{name}}', { name: t.name })} disabled={t.quantity <= 0} onClick={() => save({ quantity: t.quantity - 1 })}>−</button>
              <span className="w-8 text-center tabular-nums" aria-label={tx('{{name}} in stock', { name: t.name })}>{t.quantity}</span>
              <button className="btn px-2 py-0" aria-label={tx('One more {{name}}', { name: t.name })} onClick={() => save({ quantity: t.quantity + 1 })}>+</button>
            </span>
          )}
          {wantsBuying && (onList ? (!low && <span className="text-xs text-muted">{tx('✓ On shopping list')}</span>)
            : <button className="btn px-2 py-0.5 text-xs" onClick={() => void addToShopping([shopItem(t, kind, kind === 'tool' ? TOOL_SOURCE : 'Supplies')], [])}>{buyLabel}</button>)}
          {!owned && <button className="btn px-2 py-0.5 text-xs" onClick={() => save({ status: 'owned', boughtAt: ctx().now.slice(0, 10), quantity: Math.max(1, t.quantity) })}>{tx('✓ Got it')}</button>}
          <button className="text-muted hover:text-danger" aria-label={tx('Delete {{name}}', { name: t.name })} onClick={() => remove(kind, t.id)}>✕</button>
        </span>
      </div>

      {owned && t.tasks.length > 0 && (
        <ul className="grid gap-1 text-sm" aria-label={tx('Maintenance of {{name}}', { name: t.name })}>
          {t.tasks.map((task) => {
            const d = daysLeft(task, now)
            return (
              <li key={task.id} className="flex flex-wrap items-center gap-2">
                <span>{task.name}</span>
                <span className="text-xs text-muted">{tx('every {{n}} days', { n: task.everyDays })} ·</span>
                <span className={`text-xs ${d <= 0 ? 'text-danger' : 'text-muted'}`}>{task.lastDone ? dueText(d) : tx('never done')}</span>
                <button className="btn px-2 py-0 text-xs" aria-label={tx('Done: {{item}} {{task}}', { item: t.name, task: task.name })} onClick={() => saveAny(kind, markDone(t, task.id, ctx()))}>{tx('✓ Done')}</button>
                {open && <button className="text-xs text-muted hover:text-danger" aria-label={tx('Remove task {{name}}', { name: task.name })} onClick={() => saveAny(kind, removeTask(t, task.id, ctx()))}>✕</button>}
              </li>
            )
          })}
        </ul>
      )}

      {open && (
        <div className="grid gap-2 border-t border-line pt-2 text-sm">
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-0.5 text-xs text-muted">{tx('Name')}<input className="input" value={t.name} onChange={(e) => save({ name: e.target.value })} /></label>
            <label className="grid gap-0.5 text-xs text-muted">{tx('Brand')}<input className="input w-32" value={t.brand} onChange={(e) => save({ brand: e.target.value })} /></label>
            <label className="grid gap-0.5 text-xs text-muted">{tx('Category')}<select className="input" value={t.category} onChange={(e) => save({ category: e.target.value })}>{[...new Set([...catsOf(cats, kind), t.category])].map((c) => <option key={c}>{c}</option>)}</select></label>
            {owned && (
              <>
                <label className="grid gap-0.5 text-xs text-muted">{tx('Alert at')}<input className="input w-16" type="number" min={0} aria-label={tx('Alert level for {{name}}', { name: t.name })} value={t.lowAt} onChange={(e) => save({ lowAt: Math.max(0, Number(e.target.value) || 0) })} /></label>
                {liquid ? <span className="grid gap-0.5 text-xs text-muted">{tx('Level')}<span className="py-1 text-sm text-fg">{levelName}</span></span> : <label className="grid gap-0.5 text-xs text-muted">{tx('Condition')}<select className="input" value={t.condition} onChange={(e) => save({ condition: e.target.value as ItemCondition })}>{CONDITIONS.map((c) => <option key={c.id} value={c.id}>{conditionName(c.id)}</option>)}</select></label>}
                {storage.places.length > 0 && <label className="grid gap-0.5 text-xs text-muted">{tx('Kept in')}<PlaceSelect label={tx('Kept in')} empty={tx('Not set')} value={t.placeId} onChange={(id) => save({ placeId: id })} /></label>}
                <label className="grid gap-0.5 text-xs text-muted">{tx('Bought')}<input className="input" type="date" value={t.boughtAt ?? ''} onChange={(e) => save({ boughtAt: e.target.value || undefined })} /></label>
              </>
            )}
            <label className="grid gap-0.5 text-xs text-muted">{tx('Price')}<input className="input w-20" type="number" min={0} step="0.01" value={t.price ?? ''} onChange={(e) => save({ price: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} /></label>
          </div>
          <label className="grid gap-0.5 text-xs text-muted">{tx('Notes')}<textarea className="input" rows={2} value={t.notes} onChange={(e) => save({ notes: e.target.value })} placeholder={tx('Sizes, spare parts, where you bought it…')} /></label>

          {owned && (
            <form className="flex flex-wrap items-end gap-2" aria-label={tx('New task for {{name}}', { name: t.name })} onSubmit={(e) => { e.preventDefault(); add({ name: taskName, everyDays: Number(every) }) }}>
              <label className="grid gap-0.5 text-xs text-muted">{tx('Maintenance job')}<input className="input" value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder={tx('e.g. Deep clean')} /></label>
              <label className="grid gap-0.5 text-xs text-muted">{tx('Every (days)')}<input className="input w-20" type="number" min={1} value={every} onChange={(e) => setEvery(e.target.value)} /></label>
              <button className="btn">{tx('+ Add job')}</button>
              {suggestions.map((s) => <button type="button" key={s.name} className="btn px-2 py-0.5 text-xs" onClick={() => add(s)}>+ {s.name} ({tx('{{n}} d', { n: s.everyDays })})</button>)}
              {err && <span className="text-sm text-danger" role="alert">{err}</span>}
            </form>
          )}
        </div>
      )}
    </li>
  )
}
