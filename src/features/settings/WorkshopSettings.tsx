import { useState } from 'react'
import { useStore } from '../../app/store'
import { DEFAULT_CATEGORIES } from '../../domain/workshop/categories'
import { addCategory, type WorkshopCategories } from '../../domain/workshop/item'
import { useT } from '../../i18n'

/** Categories of tools and supplies; supply categories can be marked as liquids (they track a level). */
export function WorkshopSettings() {
  const t = useT()
  const { workshopCategories: cats, saveWorkshopCategories, tools, supplies } = useStore()
  return (
    <>
      <CategoryList title={t('settingsPanels.workshop.tools')} kind="tools" cats={cats} used={(c) => tools.filter((t) => t.category === c).length} onSave={saveWorkshopCategories} />
      <CategoryList title={t('settingsPanels.workshop.supplies')} kind="supplies" cats={cats} used={(c) => supplies.filter((t) => t.category === c).length} onSave={saveWorkshopCategories} />
      <p className="text-sm text-muted">{t('settingsPanels.workshop.liquidHelp')}</p>
      <button className="btn w-fit" onClick={() => confirm(t('settingsPanels.workshop.confirmReset')) && void saveWorkshopCategories(DEFAULT_CATEGORIES)}>{t('settingsPanels.workshop.reset')}</button>
    </>
  )
}

function CategoryList({ title, kind, cats, used, onSave }: { title: string; kind: 'tools' | 'supplies'; cats: WorkshopCategories; used: (c: string) => number; onSave: (c: WorkshopCategories) => Promise<void> }) {
  const t = useT()
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
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={cats.liquid.includes(c)} onChange={(e) => save(list, e.target.checked ? [...cats.liquid, c] : cats.liquid.filter((x) => x !== c))} /> {t('settingsPanels.workshop.liquid')}</label>
            )}
            <span className="w-16 text-right text-xs text-muted">{t('settingsPanels.workshop.items', { count: used(c) })}</span>
            <button className="btn px-2 py-0.5" aria-label={t('settingsPanels.workshop.up', { name: c })} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button className="btn px-2 py-0.5" aria-label={t('settingsPanels.workshop.down', { name: c })} disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button className="btn px-2 py-0.5" aria-label={t('settingsPanels.workshop.delete', { name: c })} disabled={used(c) > 0} title={used(c) ? t('settingsPanels.workshop.inUse') : undefined} onClick={() => save(list.filter((x) => x !== c), cats.liquid.filter((x) => x !== c))}>✕</button>
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
        <input className="input flex-1" aria-label={kind === 'tools' ? t('settingsPanels.workshop.newTool') : t('settingsPanels.workshop.newSupply')} placeholder={t('settingsPanels.workshop.newPlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary">{t('settingsPanels.workshop.add')}</button>
      </form>
      {err && <p className="text-sm text-danger" role="alert">{err}</p>}
    </section>
  )
}
