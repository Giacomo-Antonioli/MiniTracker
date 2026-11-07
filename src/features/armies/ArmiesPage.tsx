import { useMemo, useState } from 'react'
import { catalogueFor, ctx, useStore } from '../../app/store'
import { EDITIONS } from '../../data/catalogue/fetch'
import { gameOfEdition } from '../../domain/catalogue/unitGame'
import { addFromCollection } from '../../domain/lists/collection'
import { createList } from '../../domain/lists/list'
import { battleSizes } from '../../domain/lists/rules'
import type { EditionKey } from '../../domain/lists/types'
import { ImportForm } from './ImportForm'
import { summarise } from './summary'

type Filter = 'all' | 'complete' | 'incomplete' | 'issues'

export function ArmiesPage({ onOpenList, onOpenSettings }: { onOpenList: (id: string) => void; onOpenSettings: () => void }) {
  const { lists: allLists, catalogues, units, gameFilter } = useStore()
  const lists = useMemo(() => (gameFilter === 'all' ? allLists : allLists.filter((l) => gameOfEdition(l.edition) === gameFilter)), [allLists, gameFilter])
  const [filter, setFilter] = useState<Filter>('all')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)

  const rows = useMemo(
    () => lists.map((l) => ({ l, s: summarise(l, catalogueFor(catalogues, l.edition), units) })),
    [lists, catalogues, units],
  )
  const shown = rows.filter(({ s }) =>
    filter === 'complete' ? s.complete : filter === 'incomplete' ? !s.complete : filter === 'issues' ? !!s.issues?.length : true,
  )

  if (!catalogues.length) {
    return (
      <div className="grid max-w-xl gap-3">
        <h1 className="font-display text-2xl text-accent" data-tour="armies-title">Armies</h1>
        <p className="text-muted">Install a unit catalogue first: lists are built from it.</p>
        <button className="btn btn-primary w-fit" onClick={onOpenSettings}>Go to Settings → Catalogue data</button>
      </div>
    )
  }

  return (
    <div className="grid max-w-4xl gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-accent" data-tour="armies-title">Armies</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setImporting(true)}>⬆ Import</button>
          <button className="btn btn-primary" data-tour="new-list" onClick={() => setCreating(true)}>+ New list</button>
        </div>
      </header>

      {creating && <NewListForm onCancel={() => setCreating(false)} onCreated={onOpenList} />}
      {importing && <ImportForm onCancel={() => setImporting(false)} onOpen={onOpenList} />}

      {lists.length > 0 && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter lists">
          {(
            [
              ['all', 'All'],
              ['complete', 'Complete'],
              ['incomplete', 'Incomplete'],
              ['issues', 'Rule issues'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={`btn ${filter === id ? 'btn-primary' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {lists.length === 0 && !creating && !importing && <p className="text-muted">No army lists yet. Start one with “+ New list”.</p>}

      <ul className="grid gap-2" aria-label="Army lists">
        {shown.map(({ l, s }) => (
          <li key={l.id}>
            <button className="panel grid w-full gap-1 p-3 text-left hover:border-accent/60" onClick={() => onOpenList(l.id)}>
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{l.name}</span>
                <span className={`text-sm ${s.points > l.pointsLimit ? 'text-danger' : 'text-muted'}`}>{s.points} / {l.pointsLimit} pts</span>
              </span>
              <span className="text-sm text-muted">
                {[s.factionName ?? 'No faction yet', EDITIONS.find((e) => e.key === l.edition)?.label, s.battleSizeName].filter(Boolean).join(' · ')}
              </span>
              <span className="flex flex-wrap gap-3 text-sm">
                <span>{l.entries.length === 0 ? '— Empty' : s.complete ? '✅ Complete' : `🟡 Missing ${s.missingModels} model${s.missingModels === 1 ? '' : 's'}`}</span>
                <span>{s.issues === undefined ? '· Rules not checked' : s.issues.length ? `⚠ ${s.issues.length} rule issue${s.issues.length === 1 ? '' : 's'}` : '✔ Rules OK'}</span>
                <span className="text-muted">{l.status}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {lists.length > 0 && shown.length === 0 && <p className="text-muted">No lists match this filter.</p>}
    </div>
  )
}

function NewListForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const { catalogues, catalogue: active, saveList, units } = useStore()
  const [fromCollection, setFromCollection] = useState(false)
  const installed = EDITIONS.filter((e) => catalogueFor(catalogues, e.key))
  const activeKey = installed.find((e) => catalogueFor(catalogues, e.key) === active)?.key
  const [edition, setEdition] = useState<EditionKey | undefined>(activeKey ?? installed[0]?.key)
  const cat = edition ? catalogueFor(catalogues, edition) : undefined
  const sizes = cat ? battleSizes(cat) : []
  const [name, setName] = useState('')
  const [size, setSize] = useState(sizes.find((b) => b.name === 'Strike Force')?.id ?? sizes[0]?.id ?? '')
  const [factionId, setFactionId] = useState('')

  if (!installed.length) return <p className="text-muted">Catalogues installed from local files can't be used for lists yet: download an edition in Settings.</p>

  const create = async () => {
    const b = sizes.find((x) => x.id === size)!
    let l = createList({ name: name.trim(), edition: edition!, battleSize: b.id, pointsLimit: b.pointsLimit, ...(factionId ? { factionId } : {}) }, ctx())
    if (fromCollection && cat) l = addFromCollection(l, cat, units, ctx())
    await saveList(l)
    onCreated(l.id)
  }

  return (
    <form
      className="panel grid gap-3 p-3 sm:grid-cols-2"
      aria-label="New list"
      data-tour="new-list-form"
      onSubmit={(e) => {
        e.preventDefault()
        void create()
      }}
    >
      <label className="grid gap-1 text-sm">
        Name
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tau 1000" data-tour="list-name" autoFocus />
      </label>
      <label className="grid gap-1 text-sm">
        Edition
        <select
          className="input"
          value={edition}
          onChange={(e) => {
            const k = e.target.value as EditionKey
            setEdition(k)
            const s = battleSizes(catalogueFor(catalogues, k)!)
            setSize(s.find((b) => b.name === 'Strike Force')?.id ?? s[0].id)
            setFactionId('')
          }}
        >
          {installed.map((e) => (
            <option key={e.key} value={e.key}>{e.label}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Battle size
        <select className="input" value={size} onChange={(e) => setSize(e.target.value)}>
          {sizes.map((b) => (
            <option key={b.id} value={b.id}>{b.name} ({b.pointsLimit} pts)</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Faction
        <select className="input" value={factionId} onChange={(e) => setFactionId(e.target.value)}>
          <option value="">Set by the first unit</option>
          {cat?.factions.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={fromCollection} disabled={!factionId} onChange={(e) => setFromCollection(e.target.checked)} />
        Start with all the units I own
      </label>
      <p className="-mt-2 text-xs text-muted sm:col-span-2">
        {factionId ? 'Every unit of this army you own is added, linked to your collection.' : 'Pick the army above to use this.'}
      </p>
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn btn-primary" type="submit" disabled={!name.trim()}>Create</button>
        <button className="btn" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
