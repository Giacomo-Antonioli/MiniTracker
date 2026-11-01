import { useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { createUnit } from '../../domain/collection/ownedUnit'
import type { Lifecycle, Link, OwnedUnit } from '../../domain/collection/types'
import { Dialog } from '../../ui/Dialog'

interface GroupDraft {
  id?: string
  count: number
  status: string
  loadout: string
  magnetised: OwnedUnit['groups'][number]['magnetised']
}

const LIFECYCLES: Lifecycle[] = ['active', 'on-hold', 'sold', 'traded', 'gifted', 'lost']

/** Add a new unit, or edit an existing one when `unit` is given. */
export function UnitFormDialog({ unit, factions, onClose }: { unit?: OwnedUnit; factions: string[]; onClose: () => void }) {
  const { pipeline, saveUnit } = useStore()
  const [name, setName] = useState(unit?.customName ?? '')
  const [faction, setFaction] = useState(unit?.factionName ?? '')
  const [groups, setGroups] = useState<GroupDraft[]>(
    unit?.groups.map((g) => ({ ...g, loadout: g.loadout.join(', ') })) ?? [
      { count: 1, status: pipeline.stages[0].id, loadout: '', magnetised: [] },
    ],
  )
  const [tutorials, setTutorials] = useState<Link[]>(unit?.tutorials ?? [])
  const [notes, setNotes] = useState(unit?.notes ?? '')
  const [tags, setTags] = useState((unit?.tags ?? []).join(', '))
  const [favourite, setFavourite] = useState(unit?.favourite ?? false)
  const [nextUp, setNextUp] = useState(unit?.nextUp ?? false)
  const [lifecycle, setLifecycle] = useState<Lifecycle>(unit?.lifecycle ?? 'active')
  const [error, setError] = useState('')

  const patchGroup = (i: number, patch: Partial<GroupDraft>) => setGroups(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)))
  const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

  async function save(close: () => void) {
    try {
      const c = ctx()
      const fields = {
        customName: name,
        factionName: faction.trim() || undefined,
        tutorials: tutorials.filter((t) => t.url.trim()),
        notes,
        tags: split(tags),
        favourite,
        nextUp,
        lifecycle,
      }
      // createUnit validates name and counts; for edits we keep the original id and dates.
      const fresh = createUnit({ ...fields, groups: groups.map((g) => ({ count: g.count, status: g.status, loadout: split(g.loadout) })) }, c)
      const merged: OwnedUnit = unit
        ? {
            ...unit,
            ...fresh,
            id: unit.id,
            createdAt: unit.createdAt,
            groups: fresh.groups.map((g, i) => ({ ...g, id: groups[i].id ?? g.id, magnetised: groups[i].magnetised })),
          }
        : fresh
      await saveUnit(merged)
      close()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Dialog title={unit ? 'Edit unit' : 'Add unit'} onClose={onClose} wide>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.target as HTMLFormElement
          void save(() => form.closest('dialog')?.close())
        }}
      >
        <label className="grid gap-1">
          <span className="text-sm text-muted">Name *</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-muted">Faction</span>
          <input className="input" list="factions" value={faction} onChange={(e) => setFaction(e.target.value)} placeholder="e.g. Ultramarines" />
          <datalist id="factions">{factions.map((f) => <option key={f} value={f} />)}</datalist>
        </label>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm text-muted">Model groups</legend>
          {groups.map((g, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input className="input w-20" type="number" min={1} value={g.count} aria-label="Models" onChange={(e) => patchGroup(i, { count: Number(e.target.value) })} />
              <span className="text-muted">models in</span>
              <select className="input" value={g.status} aria-label="Stage" onChange={(e) => patchGroup(i, { status: e.target.value })}>
                {pipeline.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input className="input flex-1" placeholder="loadout, comma separated" value={g.loadout} aria-label="Loadout" onChange={(e) => patchGroup(i, { loadout: e.target.value })} />
              {g.magnetised.length > 0 && <span title="Magnetised">🧲</span>}
              <button type="button" className="btn btn-danger" aria-label="Remove group" disabled={groups.length === 1} onClick={() => setGroups(groups.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" className="btn w-fit" onClick={() => setGroups([...groups, { count: 1, status: pipeline.stages[0].id, loadout: '', magnetised: [] }])}>
            + Add group
          </button>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm text-muted">Tutorials and guides</legend>
          {tutorials.map((t, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input className="input w-40" placeholder="title" value={t.title} onChange={(e) => setTutorials(tutorials.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <input className="input flex-1" placeholder="https://…" value={t.url} onChange={(e) => setTutorials(tutorials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <select className="input" value={t.kind} onChange={(e) => setTutorials(tutorials.map((x, j) => (j === i ? { ...x, kind: e.target.value as Link['kind'] } : x)))}>
                <option value="build">build</option>
                <option value="paint">paint</option>
                <option value="lore">lore</option>
                <option value="other">other</option>
              </select>
              <button type="button" className="btn btn-danger" aria-label="Remove link" onClick={() => setTutorials(tutorials.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" className="btn w-fit" onClick={() => setTutorials([...tutorials, { title: '', url: '', kind: 'paint' }])}>+ Add link</button>
        </fieldset>

        <label className="grid gap-1">
          <span className="text-sm text-muted">Notes</span>
          <textarea className="input min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-muted">Tags (comma separated)</span>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="crusade, display" />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2"><input type="checkbox" checked={favourite} onChange={(e) => setFavourite(e.target.checked)} /> Favourite</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={nextUp} onChange={(e) => setNextUp(e.target.checked)} /> Next up</label>
          <label className="flex items-center gap-2">
            State
            <select className="input" value={lifecycle} onChange={(e) => setLifecycle(e.target.value as Lifecycle)}>
              {LIFECYCLES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </div>
        {error && <p className="text-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={(e) => (e.target as HTMLElement).closest('dialog')?.close()}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save</button>
        </div>
      </form>
    </Dialog>
  )
}
