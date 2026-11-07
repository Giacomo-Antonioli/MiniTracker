import { useEffect, useMemo, useState } from 'react'
import { firstOwnedStage } from '../../domain/collection/pipeline'
import { ctx, useStore } from '../../app/store'
import { pointsFor } from '../../domain/catalogue/points'
import { factionLabel, searchDatasheets } from '../../domain/catalogue/search'
import type { Datasheet } from '../../domain/catalogue/types'
import { cleanMagnetSlots, createUnit } from '../../domain/collection/ownedUnit'
import { MagnetEditor, fromMagnetDrafts, toMagnetDrafts, type MagnetDraft } from './MagnetEditor'
import type { Lifecycle, Link, OwnedUnit } from '../../domain/collection/types'
import { schemesForUnit } from '../../domain/schemes/match'
import { SchemePicker } from '../schemes/SchemePicker'
import { Combobox, type ComboOption } from '../../ui/Combobox'
import { Dialog } from '../../ui/Dialog'
import { InfoTip } from '../../ui/InfoTip'
import { lifecycleName } from './lifecycle'
import { txr, useTx } from '../../i18n'

interface GroupDraft {
  id?: string
  count: number
  status: string
  loadout: string
  magnets: MagnetDraft[]
  showMagnets?: boolean
}

const LEGENDS_INFO = () =>
  txr('Legends are older units that Games Workshop no longer updates for current matched play. You can still use them in casual and narrative games, but they are usually not allowed in tournaments. They are hidden from the list unless you tick this box.')

const LIFECYCLES: Lifecycle[] = ['active', 'on-hold', 'sold', 'traded', 'gifted', 'lost']

/** Add a new unit, or edit an existing one when `unit` is given. */
export function UnitFormDialog({
  unit,
  factions,
  onClose,
  preset,
}: {
  unit?: OwnedUnit
  factions: string[]
  onClose: () => void
  /** Start a new unit from a catalogue datasheet (e.g. "Add to collection"). */
  preset?: { datasheet: Datasheet; factionId?: string }
}) {
  const tx = useTx()
  const { pipeline, saveUnit, catalogue, schemes: mySchemes, library, schemeDefaults, paints, loadPaints } = useStore()
  const schemes = [...mySchemes, ...library]
  const presetFaction = preset && catalogue ? (preset.factionId && preset.datasheet.factionIds.includes(preset.factionId) ? preset.factionId : preset.datasheet.factionIds[0]) : undefined
  const [name, setName] = useState(unit?.customName ?? preset?.datasheet.name ?? '')
  const [faction, setFaction] = useState(unit?.factionName ?? (presetFaction ? catalogue!.factions.find((f) => f.id === presetFaction)?.name ?? '' : ''))
  const [factionId, setFactionId] = useState(unit?.factionId ?? presetFaction)
  const [datasheetId, setDatasheetId] = useState(unit?.datasheetId ?? preset?.datasheet.id)
  const [showLegends, setShowLegends] = useState(false)
  const [groups, setGroups] = useState<GroupDraft[]>(
    unit?.groups.map((g) => ({ id: g.id, count: g.count, status: g.status, loadout: g.loadout.join(', '), magnets: toMagnetDrafts(g.magnetised) })) ?? [
      { count: preset?.datasheet.minModels ?? 1, status: firstOwnedStage(pipeline), loadout: '', magnets: [] },
    ],
  )
  const [tutorials, setTutorials] = useState<Link[]>(unit?.tutorials ?? [])
  const [notes, setNotes] = useState(unit?.notes ?? '')
  const [tags, setTags] = useState((unit?.tags ?? []).join(', '))
  const [favourite, setFavourite] = useState(unit?.favourite ?? false)
  const [nextUp, setNextUp] = useState(unit?.nextUp ?? false)
  const [lifecycle, setLifecycle] = useState<Lifecycle>(unit?.lifecycle ?? 'active')
  const [schemeId, setSchemeId] = useState<string | undefined>(unit?.schemeId)
  const [schemeTouched, setSchemeTouched] = useState(!!unit)
  const [error, setError] = useState('')
  // New units get their faction's default scheme until you pick one yourself.
  const effectiveScheme = schemeTouched ? schemeId : (schemeDefaults[faction.trim()] ?? schemeId)
  const chosen = effectiveScheme ? schemes.find((s) => s.id === effectiveScheme) : undefined
  useEffect(() => {
    if (chosen && !paints.length) void loadPaints()
  }, [chosen, paints.length, loadPaints])

  const datasheet = catalogue?.datasheets.find((d) => d.id === datasheetId)
  const totalModels = groups.reduce((n, g) => n + (Number(g.count) || 0), 0)
  const points = datasheet ? safePoints(datasheet, totalModels) : undefined

  const factionOptions = useMemo((): ComboOption[] => {
    const q = faction.trim().toLowerCase()
    const fromCatalogue = (catalogue?.factions ?? []).map((f) => ({ value: f.id, label: f.name, group: tx('Catalogue') }))
    const known = new Set(fromCatalogue.map((f) => f.label))
    const used = factions.filter((f) => !known.has(f)).map((f) => ({ value: `custom:${f}`, label: f, group: tx('Your factions') }))
    return [...fromCatalogue, ...used].filter((o) => o.label.toLowerCase().includes(q))
  }, [catalogue, factions, faction])

  const unitOptions = useMemo((): ComboOption[] => {
    if (!catalogue) return []
    const query = datasheet && name === datasheet.name ? '' : name
    return searchDatasheets(catalogue, query, { factionId, includeLegends: showLegends, limit: 40 }).map((d) => ({
      value: d.id,
      label: d.legends ? `${d.name} (Legends)` : d.name,
      hint: [d.role, d.minModels === d.maxModels ? `${d.minModels}` : `${d.minModels}–${d.maxModels}`, d.points[0].points ? `${d.points[0].points} pts` : 'pts ?']
        .filter(Boolean)
        .join(' · '),
      group: factionId ? undefined : factionLabel(catalogue, d),
    }))
  }, [catalogue, name, factionId, showLegends, datasheet])

  function pickDatasheet(d: Datasheet) {
    setDatasheetId(d.id)
    setName(d.name)
    if (!factionId || !d.factionIds.includes(factionId)) {
      const fid = d.factionIds[0]
      setFactionId(fid)
      setFaction(factionLabel(catalogue!, d, fid))
    }
    // A fresh single group gets the unit's minimum size.
    if (!unit && groups.length === 1 && groups[0].count === 1) setGroups([{ ...groups[0], count: d.minModels }])
  }

  const patchGroup = (i: number, patch: Partial<GroupDraft>) => setGroups(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)))
  const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

  async function save(close: () => void) {
    try {
      const c = ctx()
      const fields = {
        customName: name,
        factionName: faction.trim() || undefined,
        factionId: faction.trim() ? factionId : undefined,
        datasheetId,
        schemeId: effectiveScheme,
        tutorials: tutorials.filter((t) => t.url.trim()),
        notes,
        tags: split(tags),
        favourite,
        nextUp,
        lifecycle,
      }
      const magnets = groups.map((g) => cleanMagnetSlots(fromMagnetDrafts(g.magnets)))
      // createUnit validates name and counts; for edits we keep the original id and dates.
      const fresh = createUnit({ ...fields, groups: groups.map((g) => ({ count: g.count, status: g.status, loadout: split(g.loadout) })) }, c)
      const merged: OwnedUnit = unit
        ? {
            ...unit,
            ...fresh,
            id: unit.id,
            createdAt: unit.createdAt,
            groups: fresh.groups.map((g, i) => ({ ...g, id: groups[i].id ?? g.id, magnetised: magnets[i] })),
          }
        : { ...fresh, groups: fresh.groups.map((g, i) => ({ ...g, magnetised: magnets[i] })) }
      await saveUnit(merged)
      close()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Dialog title={unit ? tx('Edit unit') : tx('Add unit')} onClose={onClose} wide>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.target as HTMLFormElement
          void save(() => form.closest('dialog')?.close())
        }}
      >
        <Combobox
          label={tx('Faction')}
          tour="unit-faction"
          text={faction}
          onTextChange={(t) => {
            setFaction(t)
            setFactionId(catalogue?.factions.find((f) => f.name.toLowerCase() === t.trim().toLowerCase())?.id)
          }}
          options={factionOptions}
          onSelect={(o) => {
            setFaction(o.label)
            setFactionId(o.value.startsWith('custom:') ? undefined : o.value)
          }}
          placeholder={catalogue ? tx('Type to search, e.g. Ultramarines') : tx('e.g. Ultramarines')}
        />
        <Combobox
          label={tx('Name *')}
          tour="unit-name"
          text={name}
          onTextChange={setName}
          options={unitOptions}
          onSelect={(o) => pickDatasheet(catalogue!.datasheets.find((d) => d.id === o.value)!)}
          placeholder={catalogue ? tx('Type to search the catalogue, or enter any name') : tx('e.g. Intercessor Squad')}
          autoFocus
          footer={
            !catalogue
              ? tx('Tip: download the catalogue in Settings → Catalogue to pick units from a list.')
              : unitOptions.length === 0 && name.trim()
                ? tx('No catalogue match. You can keep a custom name (conversions, other games).')
                : undefined
          }
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {catalogue && (
            <span className="flex items-center gap-1.5">
              <label className="flex items-center gap-1 text-muted">
                <input type="checkbox" checked={showLegends} onChange={(e) => setShowLegends(e.target.checked)} /> {tx('Show Legends')}
              </label>
              <InfoTip label={tx('What are Legends?')} text={LEGENDS_INFO()} />
            </span>
          )}
          {datasheet ? (
            <span className="flex items-center gap-2" data-testid="datasheet-link">
              <span className="text-ok">{tx('✓ Linked to datasheet “{{name}}”', { name: datasheet.name })}</span>
              <span className="text-muted">{points === undefined ? tx('{{min}}–{{max}} models', { min: datasheet.minModels, max: datasheet.maxModels }) : tx('{{n}} models = {{pts}} pts', { n: totalModels, pts: points || '?' })}</span>
              <button type="button" className="text-muted underline" onClick={() => setDatasheetId(undefined)}>{tx('unlink')}</button>
            </span>
          ) : (
            unit?.datasheetId && <span className="text-muted">{tx('Datasheet not found in the installed catalogue.')}</span>
          )}
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm text-muted">{tx('Model groups')}</legend>
          {groups.map((g, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input className="input w-20" type="number" min={1} value={g.count} aria-label={tx('Models')} data-tour="unit-models" onChange={(e) => patchGroup(i, { count: Number(e.target.value) })} />
              <span className="text-muted">{tx('models in')}</span>
              <select className="input" value={g.status} aria-label={tx('Stage')} data-tour="unit-stage" onChange={(e) => patchGroup(i, { status: e.target.value })}>
                {pipeline.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input className="input flex-1" list={datasheet ? 'wargear-options' : undefined} placeholder={tx('loadout, comma separated')} value={g.loadout} aria-label={tx('Loadout')} onChange={(e) => patchGroup(i, { loadout: e.target.value })} />
              <button type="button" className="btn" aria-expanded={!!g.showMagnets} aria-label={tx('Magnets')} title={tx('Magnet slots')} onClick={() => patchGroup(i, { showMagnets: !g.showMagnets })}>
                🧲{g.magnets.length > 0 && ` ${g.magnets.length}`}
              </button>
              <button type="button" className="btn btn-danger" aria-label={tx('Remove group')} disabled={groups.length === 1} onClick={() => setGroups(groups.filter((_, j) => j !== i))}>✕</button>
              {g.showMagnets && (
                <div className="basis-full">
                  <MagnetEditor slots={g.magnets} wargear={datasheet?.wargear ?? []} onChange={(m) => patchGroup(i, { magnets: m })} />
                </div>
              )}
            </div>
          ))}
          {datasheet && <datalist id="wargear-options">{datasheet.wargear.map((w) => <option key={w} value={w} />)}</datalist>}
          <button type="button" className="btn w-fit" onClick={() => setGroups([...groups, { count: 1, status: firstOwnedStage(pipeline), loadout: '', magnets: [] }])}>
            {tx('+ Add group')}
          </button>
        </fieldset>

        <div className="grid gap-1">
          <span className="text-sm text-muted">{tx('Paint scheme')}</span>
          <SchemePicker
            label={tx('Paint scheme')}
            value={effectiveScheme}
            paints={paints}
            isDefault={(x) => schemeDefaults[x.factionName ?? ''] === x.id}
            groups={schemesForUnit(
              schemes,
              { ...(unit ?? createUnit({ customName: name.trim() || 'unit', groups: [] }, { now: '', newId: () => '' })), customName: name, factionName: faction.trim() || undefined, schemeId: effectiveScheme },
              datasheet,
            )}
            onChange={(id) => {
              setSchemeTouched(true)
              setSchemeId(id)
            }}
          />
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm text-muted">{tx('Tutorials and guides')}</legend>
          {tutorials.map((t, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input className="input w-40" placeholder={tx('title')} value={t.title} onChange={(e) => setTutorials(tutorials.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <input className="input flex-1" placeholder="https://…" value={t.url} onChange={(e) => setTutorials(tutorials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <select className="input" value={t.kind} onChange={(e) => setTutorials(tutorials.map((x, j) => (j === i ? { ...x, kind: e.target.value as Link['kind'] } : x)))}>
                <option value="build">{tx('build')}</option>
                <option value="paint">{tx('paint')}</option>
                <option value="lore">{tx('lore')}</option>
                <option value="other">{tx('other')}</option>
              </select>
              <button type="button" className="btn btn-danger" aria-label={tx('Remove link')} onClick={() => setTutorials(tutorials.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" className="btn w-fit" onClick={() => setTutorials([...tutorials, { title: '', url: '', kind: 'paint' }])}>{tx('+ Add link')}</button>
        </fieldset>

        <label className="grid gap-1">
          <span className="text-sm text-muted">{tx('Notes')}</span>
          <textarea className="input min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-muted">{tx('Tags (comma separated)')}</span>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={tx('crusade, display')} />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2"><input type="checkbox" checked={favourite} onChange={(e) => setFavourite(e.target.checked)} /> {tx('Favourite')}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={nextUp} onChange={(e) => setNextUp(e.target.checked)} /> {tx('Next up')}</label>
          <label className="flex items-center gap-2">
            {tx('State')}
            <select className="input" value={lifecycle} onChange={(e) => setLifecycle(e.target.value as Lifecycle)}>
              {LIFECYCLES.map((l) => <option key={l} value={l}>{lifecycleName(l)}</option>)}
            </select>
          </label>
        </div>
        {error && <p className="text-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={(e) => (e.target as HTMLElement).closest('dialog')?.close()}>{tx('Cancel')}</button>
          <button type="submit" className="btn btn-primary" data-tour="unit-save">{tx('Save')}</button>
        </div>
      </form>
    </Dialog>
  )
}

function safePoints(d: Datasheet, models: number): number | undefined {
  try {
    return pointsFor(d, models)
  } catch {
    return undefined
  }
}
