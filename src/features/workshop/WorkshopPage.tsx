import { useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { pathLabel } from '../../domain/storage/storage'
import { SUPPLY_CATEGORIES } from '../../domain/supplies/supplies'
import { SUGGESTED_TASKS, TOOL_CATEGORIES, TOOL_SOURCE } from '../../domain/tools/tools'
import {
  addTask, CONDITIONS, daysLeft, dueTasks, isLow, markDone, newItem, refPrefix, removeTask, shopItem,
  type ItemCondition, type ItemStatus, type WorkshopItem, type WorkshopKind,
} from '../../domain/workshop/item'
import { PlaceSelect } from '../storage/Storage'

const dueText = (d: number) => (d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : d === 0 ? 'due today' : `in ${d} day${d === 1 ? '' : 's'}`)
const KIND = { tool: { one: 'tool', title: 'Tools', icon: '🔧', categories: TOOL_CATEGORIES }, supply: { one: 'supply', title: 'Supplies', icon: '🧴', categories: SUPPLY_CATEGORIES } } as const

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
export function workshopAlerts(s: { tools: WorkshopItem[]; supplies: WorkshopItem[] }, kind?: WorkshopKind) {
  const items = kind === 'tool' ? s.tools : kind === 'supply' ? s.supplies : [...s.tools, ...s.supplies]
  return items.filter(isLow).length + dueTasks(items, new Date().toISOString()).length
}

/** Tools and supplies: stock with alerts, condition, storage place, maintenance jobs and a wishlist. `kind` shows one list only. */
export function WorkshopPage({ kind }: { kind?: WorkshopKind }) {
  const { rows: all, save } = useWorkshop()
  const [tab, setTab] = useState<ItemStatus>('owned')
  const [newKind, setNewKind] = useState<WorkshopKind>(kind ?? 'tool')
  const addKind = kind ?? newKind
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>(KIND[addKind].categories[0])
  const [qty, setQty] = useState('1')
  const [lowAt, setLowAt] = useState('0')
  const [error, setError] = useState('')
  const now = ctx().now
  const rows = all.filter((r) => !kind || r.kind === kind)
  const due = dueTasks(rows.map((r) => r.item), now).map((d) => ({ ...d, kind: rows.find((r) => r.item === d.item)!.kind }))
  const low = rows.filter((r) => isLow(r.item)).length
  const shown = rows
    .filter((r) => r.item.status === tab)
    .sort((a, b) => Number(isLow(b.item)) - Number(isLow(a.item)) || a.item.category.localeCompare(b.item.category) || a.item.name.localeCompare(b.item.name))
  const title = kind ? KIND[kind].title : 'Workshop'
  const what = kind ? KIND[kind].one : 'item'

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-accent">{title}</h1>
        {low > 0 && <span className="text-sm text-danger" role="status">⚠ {low} running low</span>}
        <div className="flex gap-1" role="tablist" aria-label="List">
          {([['owned', 'Owned'], ['wishlist', 'Wishlist']] as const).map(([id, l]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`btn ${tab === id ? 'btn-primary' : ''}`} onClick={() => setTab(id)}>
              {l} ({rows.filter((r) => r.item.status === id).length})
            </button>
          ))}
        </div>
      </header>

      {due.length > 0 && (
        <section className="panel grid gap-1 p-3" aria-label="Maintenance due">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-danger">⚠ Maintenance due</h2>
          <ul className="grid gap-1 text-sm">
            {due.map(({ item, task, daysLeft: d, kind: k }) => (
              <li key={task.id} className="flex flex-wrap items-center gap-2">
                <span>{item.name}: {task.name}</span>
                <span className="text-xs text-danger">{task.lastDone ? dueText(d) : 'never done'}</span>
                <button className="btn px-2 py-0 text-xs" aria-label={`Done: ${item.name} ${task.name}`} onClick={() => save(k, markDone(item, task.id, ctx()))}>✓ Done</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form
        className="panel flex flex-wrap items-end gap-2 p-3"
        aria-label={`New ${what}`}
        onSubmit={(e) => {
          e.preventDefault()
          try {
            save(addKind, newItem({ name, category, status: tab, quantity: Math.max(0, Number(qty) || 0), lowAt: Math.max(0, Number(lowAt) || 0) }, ctx(), addKind === 'tool' ? 'A tool' : 'A supply'))
            setName('')
            setError('')
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      >
        {!kind && (
          <label className="grid gap-0.5 text-xs text-muted">Type
            <select className="input" value={newKind} onChange={(e) => { const k = e.target.value as WorkshopKind; setNewKind(k); setCategory(KIND[k].categories[0]); }}>
              <option value="tool">🔧 Tool</option>
              <option value="supply">🧴 Supply</option>
            </select>
          </label>
        )}
        <label className="grid gap-0.5 text-xs text-muted">Name<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={addKind === 'tool' ? 'e.g. Sprue cutters' : 'e.g. Plastic glue'} /></label>
        <label className="grid gap-0.5 text-xs text-muted">Category<select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{KIND[addKind].categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="grid gap-0.5 text-xs text-muted">{tab === 'owned' ? 'How many' : 'Want'}<input className="input w-20" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
        {tab === 'owned' && <label className="grid gap-0.5 text-xs text-muted">Alert at<input className="input w-20" type="number" min={0} value={lowAt} onChange={(e) => setLowAt(e.target.value)} /></label>}
        <button className="btn btn-primary">{tab === 'owned' ? '+ Add' : '+ Add to wishlist'}</button>
        {error && <span className="text-sm text-danger" role="alert">{error}</span>}
      </form>

      {shown.length === 0 ? (
        <p className="text-muted">
          {tab === 'wishlist' ? `Nothing on the wishlist. Add what you want and send it to the shopping list.`
            : kind === 'supply' ? 'No supplies yet. Add primer, glue, brushes… and get an alert (and a shopping list entry) when they run low.'
            : kind === 'tool' ? 'No tools yet. Add your airbrush, clippers, lamp… and set maintenance reminders like cleaning or replacing blades.'
            : 'Your workshop is empty. Add tools (airbrush, clippers…) and supplies (glue, primer…): stock alerts, maintenance reminders and a wishlist for both.'}
        </p>
      ) : (
        <ul className="grid gap-3">{shown.map((r) => <ItemCard key={`${r.kind}:${r.item.id}`} row={r} now={now} showKind={!kind} />)}</ul>
      )}
    </div>
  )
}

function ItemCard({ row: { kind, item: t }, now, showKind }: { row: Row; now: string; showKind: boolean }) {
  const { storage, shopItems, addToShopping } = useStore()
  const { save: saveAny, remove } = useWorkshop()
  const [open, setOpen] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [every, setEvery] = useState('7')
  const [err, setErr] = useState('')
  const save = (patch: Partial<WorkshopItem>) => saveAny(kind, { ...t, ...patch, updatedAt: ctx().now })
  const onList = shopItems.some((x) => !x.bought && x.refId === `${refPrefix(kind)}${t.id}`)
  const low = isLow(t)
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
  const buyLabel = !owned ? '🛒 Add to shopping' : t.condition !== 'good' ? '🛒 Buy a replacement' : '🛒 Restock'
  const wantsBuying = !owned || t.condition !== 'good' || low

  return (
    <li className={`panel grid gap-2 p-3 ${t.condition === 'broken' || low ? 'border-danger' : ''}`} aria-label={`${kind === 'tool' ? 'Tool' : 'Supply'} ${t.name}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button className="text-left font-semibold" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '▾' : '▸'} {showKind ? `${KIND[kind].icon} ` : ''}{t.name}</button>
        <span className="text-xs text-muted">{[t.brand, t.category, t.placeId && pathLabel(storage, t.placeId)].filter(Boolean).join(' · ')}</span>
        {owned && t.condition !== 'good' && <span className={`text-xs ${t.condition === 'broken' ? 'text-danger' : 'text-muted'}`}>{t.condition === 'broken' ? '✕ Broken' : '◐ Worn'}</span>}
        {low && <span className="text-xs text-danger">⚠ Low{onList ? ' · on shopping list' : ''}</span>}
        <span className="ml-auto flex flex-wrap items-center gap-1">
          {owned && (
            <span className="flex items-center gap-1">
              <button className="btn px-2 py-0" aria-label={`One less ${t.name}`} disabled={t.quantity <= 0} onClick={() => save({ quantity: t.quantity - 1 })}>−</button>
              <span className="w-8 text-center tabular-nums" aria-label={`${t.name} in stock`}>{t.quantity}</span>
              <button className="btn px-2 py-0" aria-label={`One more ${t.name}`} onClick={() => save({ quantity: t.quantity + 1 })}>+</button>
            </span>
          )}
          {wantsBuying && (onList ? (!low && <span className="text-xs text-muted">✓ On shopping list</span>)
            : <button className="btn px-2 py-0.5 text-xs" onClick={() => void addToShopping([shopItem(t, kind, kind === 'tool' ? TOOL_SOURCE : 'Supplies')], [])}>{buyLabel}</button>)}
          {!owned && <button className="btn px-2 py-0.5 text-xs" onClick={() => save({ status: 'owned', boughtAt: ctx().now.slice(0, 10), quantity: Math.max(1, t.quantity) })}>✓ Got it</button>}
          <button className="text-muted hover:text-danger" aria-label={`Delete ${t.name}`} onClick={() => remove(kind, t.id)}>✕</button>
        </span>
      </div>

      {owned && t.tasks.length > 0 && (
        <ul className="grid gap-1 text-sm" aria-label={`Maintenance of ${t.name}`}>
          {t.tasks.map((task) => {
            const d = daysLeft(task, now)
            return (
              <li key={task.id} className="flex flex-wrap items-center gap-2">
                <span>{task.name}</span>
                <span className="text-xs text-muted">every {task.everyDays} days ·</span>
                <span className={`text-xs ${d <= 0 ? 'text-danger' : 'text-muted'}`}>{task.lastDone ? dueText(d) : 'never done'}</span>
                <button className="btn px-2 py-0 text-xs" aria-label={`Done: ${t.name} ${task.name}`} onClick={() => saveAny(kind, markDone(t, task.id, ctx()))}>✓ Done</button>
                {open && <button className="text-xs text-muted hover:text-danger" aria-label={`Remove task ${task.name}`} onClick={() => saveAny(kind, removeTask(t, task.id, ctx()))}>✕</button>}
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
            <label className="grid gap-0.5 text-xs text-muted">Category<select className="input" value={t.category} onChange={(e) => save({ category: e.target.value })}>{[...new Set([...KIND[kind].categories, t.category])].map((c) => <option key={c}>{c}</option>)}</select></label>
            {owned && (
              <>
                <label className="grid gap-0.5 text-xs text-muted">Alert at<input className="input w-16" type="number" min={0} aria-label={`Alert level for ${t.name}`} value={t.lowAt} onChange={(e) => save({ lowAt: Math.max(0, Number(e.target.value) || 0) })} /></label>
                <label className="grid gap-0.5 text-xs text-muted">Condition<select className="input" value={t.condition} onChange={(e) => save({ condition: e.target.value as ItemCondition })}>{CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                {storage.places.length > 0 && <label className="grid gap-0.5 text-xs text-muted">Kept in<PlaceSelect label="Kept in" empty="Not set" value={t.placeId} onChange={(id) => save({ placeId: id })} /></label>}
                <label className="grid gap-0.5 text-xs text-muted">Bought<input className="input" type="date" value={t.boughtAt ?? ''} onChange={(e) => save({ boughtAt: e.target.value || undefined })} /></label>
              </>
            )}
            <label className="grid gap-0.5 text-xs text-muted">Price<input className="input w-20" type="number" min={0} step="0.01" value={t.price ?? ''} onChange={(e) => save({ price: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} /></label>
          </div>
          <label className="grid gap-0.5 text-xs text-muted">Notes<textarea className="input" rows={2} value={t.notes} onChange={(e) => save({ notes: e.target.value })} placeholder="Sizes, spare parts, where you bought it…" /></label>

          {owned && (
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
