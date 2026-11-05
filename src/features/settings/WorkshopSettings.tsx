import { useState } from 'react'
import { useStore } from '../../app/store'
import { DEFAULT_CATEGORIES } from '../../domain/workshop/categories'
import { addCategory, type WorkshopCategories } from '../../domain/workshop/item'

/** Categories of tools and supplies; supply categories can be marked as liquids (they track a level). */
export function WorkshopSettings() {
  const { workshopCategories: cats, saveWorkshopCategories, tools, supplies } = useStore()
  return (
    <>
      <CategoryList title="Tool categories" kind="tools" cats={cats} used={(c) => tools.filter((t) => t.category === c).length} onSave={saveWorkshopCategories} />
      <CategoryList title="Supply categories" kind="supplies" cats={cats} used={(c) => supplies.filter((t) => t.category === c).length} onSave={saveWorkshopCategories} />
      <p className="text-sm text-muted">Liquid supplies (💧) show a level, Full → Empty, instead of a condition. Edit the levels in Pipelines › Liquid level.</p>
      <button className="btn w-fit" onClick={() => confirm('Reset tool and supply categories to the defaults? Items keep their category.') && void saveWorkshopCategories(DEFAULT_CATEGORIES)}>Reset categories</button>
    </>
  )
}

function CategoryList({ title, kind, cats, used, onSave }: { title: string; kind: 'tools' | 'supplies'; cats: WorkshopCategories; used: (c: string) => number; onSave: (c: WorkshopCategories) => Promise<void> }) {
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const list = cats[kind]
  const save = (next: string[], liquid = cats.liquid) => void onSave({ ...cats, [kind]: next, liquid })
  const move = (i: number, d: number) => {
    const r = [...list]
    ;[r[i], r[i + d]] = [r[i + d], r[i]]
    save(r)
  }
  return (
    <section className="panel grid gap-2 p-4" aria-label={title}>
      <h3 className="font-display text-lg">{title}</h3>
      <ul className="grid gap-1 text-sm">
        {list.map((c, i) => (
          <li key={c} className="flex items-center gap-2">
            <span className="flex-1">{c}</span>
            {kind === 'supplies' && (
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={cats.liquid.includes(c)} onChange={(e) => save(list, e.target.checked ? [...cats.liquid, c] : cats.liquid.filter((x) => x !== c))} /> 💧 Liquid</label>
            )}
            <span className="w-16 text-right text-xs text-muted">{used(c)} items</span>
            <button className="btn px-2 py-0.5" aria-label={`Move ${c} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button className="btn px-2 py-0.5" aria-label={`Move ${c} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button className="btn px-2 py-0.5" aria-label={`Delete ${c}`} disabled={used(c) > 0} title={used(c) ? 'Items use this category' : undefined} onClick={() => save(list.filter((x) => x !== c), cats.liquid.filter((x) => x !== c))}>✕</button>
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => {
        e.preventDefault()
        try {
          save(addCategory(list, name))
          setName('')
          setErr('')
        } catch (x) {
          setErr((x as Error).message)
        }
      }}>
        <input className="input flex-1" aria-label={`New ${kind === 'tools' ? 'tool' : 'supply'} category`} placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary">Add</button>
      </form>
      {err && <p className="text-sm text-danger" role="alert">{err}</p>}
    </section>
  )
}
