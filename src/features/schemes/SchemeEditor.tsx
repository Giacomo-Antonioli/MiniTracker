import { shareUrl } from '../../domain/schemes/share'
import type { StepLink } from '../../domain/schemes/types'
import { useMemo, useState } from 'react'
import type { Technique } from '../../domain/guides/techniques'
import { BeforeYouStart } from '../guides/BeforeYouStart'
import { BasePickerDialog } from '../guides/Bases'
import { areaStage } from '../../domain/guides/prepare'
import { TechniquePanel } from '../guides/GuidesPage'
import { ctx, useStore } from '../../app/store'
import { MissingPaints } from './MissingPaints'
import {
  AREAS, TECHNIQUES, addSection, addStep, colourStrip, duplicateStep, makeVariant, missingPaints, moveSection, moveStep,
  removeSection, removeStep, schemeFile, updateSection, updateStep, validateScheme, variantDiff,
} from '../../domain/schemes/scheme'
import type { PaintScheme, SchemeOrigin, SchemeStep } from '../../domain/schemes/types'
import { Combobox } from '../../ui/Combobox'
import { PhotoThumb } from '../photos/PhotoThumb'
import { PhotoViewer } from '../photos/PhotoViewer'
import { usePhotoUrl } from '../photos/usePhotoUrl'
import { ColourStrip } from './ColourStrip'
import { RecipeCard } from './RecipeCard'
import { SchemePhotos } from './SchemePhotos'
import { ORIGIN_LABEL, ORIGIN_STYLE } from './origin'
import { appUrl } from '../../app/platform'
import { useTx, txr } from '../../i18n'

export function SchemeEditor({ scheme, onOpen, onClose, onOpenUnit }: { scheme: PaintScheme; onOpen: (id: string) => void; onClose: () => void; onOpenUnit?: (id: string) => void }) {
  const tx = useTx()
  const { paints, paintStock, schemes, units, pipelines, schemeDefaults, saveScheme, deleteScheme, setDefaultScheme } = useStore()
  const [draft, setDraft] = useState(scheme)
  const [error, setError] = useState('')
  const [printing, setPrinting] = useState(false)
  const [linkNote, setLinkNote] = useState('')
  const [technique, setTechnique] = useState<Technique | null>(null)
  const [pickingBase, setPickingBase] = useState<string | null>(null)
  const coverUrl = usePhotoUrl(draft.coverPhotoId)
  const dirty = JSON.stringify(draft) !== JSON.stringify(scheme)
  const byId = useMemo(() => new Map(paints.map((p) => [p.id, p])), [paints])
  const { library } = useStore()
  const base = draft.basedOn ? [...schemes, ...library].find((s) => s.id === draft.basedOn) : undefined
  const missing = missingPaints(draft, paintStock)
  const usedBy = units.filter((u) => u.schemeId === scheme.id)
  const c = () => ctx()
  const patch = (p: Partial<PaintScheme>) => setDraft({ ...draft, ...p })
  const paintName = (id: string) => (byId.get(id) ? `${byId.get(id)!.name} (${byId.get(id)!.brand})` : id)

  async function save() {
    try {
      validateScheme(draft)
      setError('')
      const saved = { ...dropEmptyLinks(draft), updatedAt: new Date().toISOString() }
      await saveScheme(saved)
      setDraft(saved)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function variant() {
    if (dirty && !confirm(tx('Discard unsaved changes and make a variant of the saved scheme?'))) return
    const v = makeVariant(scheme, c())
    await saveScheme(v)
    onOpen(v.id)
  }

  async function shareLink() {
    const url = await shareUrl(appUrl(), schemeFile([scheme], paints, new Date().toISOString()))
    try {
      await navigator.clipboard.writeText(url)
      setLinkNote(tx('Link copied. Anyone opening it can import this scheme (photos are not included).'))
    } catch {
      setLinkNote(url)
    }
  }

  function share() {
    const url = URL.createObjectURL(new Blob([schemeFile([scheme], paints, new Date().toISOString())], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `scheme-${scheme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="panel flex min-w-0 flex-1 flex-col overflow-y-auto" aria-label={tx('Scheme editor')}>
      <div className="flex gap-3 p-4 pb-0">
        {coverUrl && <img src={coverUrl} alt={tx('Cover')} className="h-20 w-20 shrink-0 rounded object-cover" />}
        <div className="flex-1 self-end">
          <ColourStrip colours={colourStrip(draft, paints)} height="h-6" />
        </div>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line p-4">
        <div className="grid min-w-0 flex-1 gap-1">
          <input className="input font-display text-xl text-accent" aria-label={tx('Scheme name')} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
          <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className={`rounded border px-1.5 text-xs ${ORIGIN_STYLE[draft.origin]}`}>{ORIGIN_LABEL[draft.origin]}</span>
            {base && (
              <button className="underline" onClick={() => onOpen(base.id)}>{tx('↳ variant of {{name}}', { name: base.name })}</button>
            )}
            {usedBy.length > 0 && (
              <span className="text-ok">
                {tx('used by')}{' '}
                {usedBy.map((u, i) => (
                  <span key={u.id}>
                    {i > 0 && ', '}
                    {onOpenUnit ? (
                      <button className="underline" onClick={() => onOpenUnit(u.id)}>{u.customName}</button>
                    ) : (
                      u.customName
                    )}
                  </span>
                ))}
              </span>
            )}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={!dirty} onClick={() => void save()}>{dirty ? tx('Save') : tx('Saved')}</button>
          {dirty && <button className="btn" onClick={() => setDraft(scheme)}>{tx('Undo')}</button>}
          <button className="btn" aria-label={tx('Close scheme')} onClick={() => (!dirty || confirm(tx('Discard unsaved changes?'))) && onClose()}>✕</button>
        </div>
      </header>
      {error && <p className="px-4 pt-2 text-danger" role="alert">{error}</p>}

      <div className="flex flex-wrap gap-2 border-b border-line p-4">
        <button className="btn" onClick={() => void variant()}>{tx('⑂ Make my variant')}</button>
        {scheme.factionName && (
          schemeDefaults[scheme.factionName] === scheme.id ? (
            <button className="btn" onClick={() => void setDefaultScheme(scheme.factionName!, undefined)}>{tx('⭐ Default for {{name}} (remove)', { name: scheme.factionName })}</button>
          ) : (
            <button className="btn" onClick={() => void setDefaultScheme(scheme.factionName!, scheme.id)}>{tx('☆ Make default for {{name}}', { name: scheme.factionName })}</button>
          )
        )}
        <button className="btn" onClick={share}>{tx('⬇ Share file')}</button>
        <button className="btn" onClick={() => void shareLink()}>{tx('🔗 Share link')}</button>
        <button className="btn" onClick={() => setPrinting(true)}>{tx('🖨 Recipe card')}</button>
        <button
          className="btn btn-danger ml-auto"
          onClick={() => confirm(`${tx('Delete "{{name}}"?', { name: scheme.name })}${usedBy.length ? ` ${tx('{{n}} unit(s) will be unlinked.', { n: usedBy.length })}` : ''}`) && void deleteScheme(scheme.id).then(onClose)}
        >
          {tx('Delete')}
        </button>
      </div>
      {linkNote && <p className="break-all border-b border-line px-4 py-2 text-sm" role="status">{linkNote}</p>}

      <div className="grid gap-3 border-b border-line p-4 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm text-muted">{tx('Faction / army')}</span>
          <input className="input" value={draft.factionName ?? ''} onChange={(e) => patch({ factionName: e.target.value || undefined })} placeholder={tx('e.g. Ultramarines')} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-muted">{tx('Status')}</span>
          <select className="input" value={draft.stage} onChange={(e) => patch({ stage: e.target.value })}>
            {pipelines.scheme.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-muted">{tx('Origin')}</span>
          <select className="input" value={draft.origin} onChange={(e) => patch({ origin: e.target.value as SchemeOrigin })}>
            <option value="official">{tx('Official (studio colours)')}</option>
            <option value="community">{tx('Community (found online)')}</option>
            <option value="personal">{tx('Mine')}</option>
          </select>
        </label>
        <div className="flex gap-3">
          <label className="grid flex-1 gap-1">
            <span className="text-sm text-muted">{tx('Difficulty')}</span>
            <select className="input" value={draft.difficulty ?? ''} onChange={(e) => patch({ difficulty: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{'●'.repeat(d)}{'○'.repeat(5 - d)}</option>)}
            </select>
          </label>
          <label className="grid flex-1 gap-1">
            <span className="text-sm text-muted">{tx('Minutes / model')}</span>
            <input className="input" type="number" min={0} value={draft.minutesPerModel ?? ''} onChange={(e) => patch({ minutesPerModel: e.target.value ? Number(e.target.value) : undefined })} />
          </label>
        </div>
        {draft.origin !== 'personal' && (
          <fieldset className="grid gap-2 md:col-span-2">
            <legend className="text-sm text-muted">{tx('Source')} {draft.origin === 'community' && tx('(link or author required)')}</legend>
            <div className="flex flex-wrap gap-2">
              <input className="input flex-1" placeholder={tx('Title')} aria-label={tx('Source title')} value={draft.source?.title ?? ''} onChange={(e) => patch({ source: { ...draft.source, title: e.target.value || undefined } })} />
              <input className="input flex-1" placeholder={tx('Author')} aria-label={tx('Source author')} value={draft.source?.author ?? ''} onChange={(e) => patch({ source: { ...draft.source, author: e.target.value || undefined } })} />
            </div>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="https://…" aria-label={tx('Source link')} value={draft.source?.url ?? ''} onChange={(e) => patch({ source: { ...draft.source, url: e.target.value || undefined } })} />
              {draft.source?.url && <a className="btn" href={draft.source.url} target="_blank" rel="noreferrer">{tx('Open ↗')}</a>}
            </div>
          </fieldset>
        )}
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm text-muted">{tx('Description')}</span>
          <textarea className="input min-h-14" value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm text-muted">{tx('Tips and common mistakes')}</span>
          <textarea className="input min-h-14" value={draft.tips} onChange={(e) => patch({ tips: e.target.value })} />
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm text-muted">{tx('Applies to unit types (comma separated; empty = whole army)')}</span>
          <input
            className="input"
            aria-label={tx('Applies to')}
            placeholder={tx('e.g. Kroot, Vespid, Stealth')}
            value={(draft.appliesTo ?? []).join(', ')}
            onChange={(e) => {
              const list = e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
              patch({ appliesTo: list.length ? list : undefined })
            }}
          />
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm text-muted">{tx('Tags (comma separated)')}</span>
          <input className="input" value={draft.tags.join(', ')} onChange={(e) => patch({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
        </label>
      </div>

      <SchemePhotos scheme={scheme} cover={draft.coverPhotoId} onCover={(id) => patch({ coverPhotoId: id })} />

      {(missing.length > 0 || base) && (
        <div className="grid gap-2 border-b border-line p-4 text-sm">
          {missing.length > 0 && (
            <p>
              <MissingPaints ids={missing} name={paintName} />
            </p>
          )}
          {base && (() => {
            const d = variantDiff(draft, base)
            return (
              <p className="text-muted">
                {tx('Compared with')} <b>{base.name}</b>: {d.added.length ? tx('added {{list}}', { list: d.added.map(paintName).join(', ') }) : tx('no paints added')}
                {'; '}
                {d.removed.length ? tx('dropped {{list}}', { list: d.removed.map(paintName).join(', ') }) : tx('none dropped')}.
              </p>
            )
          })()}
        </div>
      )}

      <div className="grid gap-4 p-4">
        <datalist id="scheme-techniques">{TECHNIQUES.map((t) => <option key={t} value={t} />)}</datalist>
        <datalist id="scheme-areas">{AREAS.map((t) => <option key={t} value={t} />)}</datalist>
        <BeforeYouStart scheme={draft} paintName={(id) => byId.get(id)?.name ?? id} onTechnique={setTechnique} />
        {draft.sections.map((sec, si) => (
          <section key={sec.id} id={`area-${sec.id}`} className="rounded border border-line" aria-label={tx('Area {{name}}', { name: sec.area })}>
            <div className="flex items-center gap-2 border-b border-line bg-panel-2 p-2">
              <input className="input flex-1 font-semibold" list="scheme-areas" aria-label={tx('Area name')} value={sec.area} onChange={(e) => setDraft(updateSection(draft, sec.id, e.target.value, c()))} />
              <button className="btn" aria-label={tx('Move area up')} disabled={si === 0} onClick={() => setDraft(moveSection(draft, sec.id, -1, c()))}>↑</button>
              <button className="btn" aria-label={tx('Move area down')} disabled={si === draft.sections.length - 1} onClick={() => setDraft(moveSection(draft, sec.id, 1, c()))}>↓</button>
              <button className="btn btn-danger" aria-label={tx('Remove area')} onClick={() => setDraft(removeSection(draft, sec.id, c()))}>✕</button>
            </div>
            <ol className="divide-y divide-line">
              {sec.steps.map((st, i) => (
                <StepRow
                  scheme={scheme}
                  key={st.id}
                  n={i + 1}
                  step={st}
                  first={i === 0}
                  last={i === sec.steps.length - 1}
                  onChange={(p) => setDraft(updateStep(draft, st.id, p, c()))}
                  onMove={(d) => setDraft(moveStep(draft, st.id, d, c()))}
                  onDuplicate={() => setDraft(duplicateStep(draft, st.id, c()))}
                  onRemove={() => setDraft(removeStep(draft, st.id, c()))}
                />
              ))}
            </ol>
            <div className="p-2">
              <button className="btn text-sm" onClick={() => setDraft(addStep(draft, sec.id, {}, c()))}>{tx('+ Step')}</button>
              {areaStage(sec.area) === 9 && sec.steps.length === 0 && (
                <button className="btn ml-2 text-sm" onClick={() => setPickingBase(sec.id)}>{tx('🪨 Use a base recipe')}</button>
              )}
            </div>
          </section>
        ))}
        <div className="flex flex-wrap gap-2">
          <button className="btn w-fit" onClick={() => setDraft(addSection(draft, draft.sections.length ? '' : 'Armour', c()))}>{tx('+ Area')}</button>
          {!draft.sections.some((x) => areaStage(x.area) === 9) && <button className="btn w-fit" onClick={() => setPickingBase('new')}>{tx('🪨 Add a base')}</button>}
        </div>
        {pickingBase && (
          <BasePickerDialog
            onClose={() => setPickingBase(null)}
            onPick={(b) => {
              let next = draft
              let sectionId = pickingBase
              if (sectionId === 'new') {
                next = addSection(next, 'Base', c())
                sectionId = next.sections[next.sections.length - 1].id
              }
              for (const st of b.steps) next = addStep(next, sectionId, { technique: st.technique, paints: st.paints, note: st.note }, c())
              setDraft(next)
              setPickingBase(null)
            }}
          />
        )}
      </div>
      {printing && <RecipeCard scheme={draft} onDone={() => setPrinting(false)} />}
      {technique && <TechniquePanel technique={technique} onClose={() => setTechnique(null)} />}
    </section>
  )
}

function StepRow(props: {
  scheme: PaintScheme
  n: number
  step: SchemeStep
  first: boolean
  last: boolean
  onChange: (p: Partial<SchemeStep>) => void
  onMove: (d: number) => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const tx = useTx()
  const { paints, paintStock, photos: allPhotos, addSchemePhotos } = useStore()
  const { step } = props
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<string | null>(null)
  const stepPhotos = (allPhotos[props.scheme.id] ?? []).filter((p) => p.owner.kind === 'scheme' && p.owner.stepId === step.id)
  const byId = useMemo(() => new Map(paints.map((p) => [p.id, p])), [paints])
  const options = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return []
    return paints
      .filter((p) => words.every((w) => `${p.name} ${p.brand}`.toLowerCase().includes(w)))
      .map((p) => ({ p, owned: (paintStock.get(p.id)?.quantity ?? 0) > 0 }))
      .sort((a, b) => Number(b.owned) - Number(a.owned))
      .slice(0, 30)
      .map(({ p, owned }) => ({ value: p.id, label: p.name, hint: `${p.brand}${owned ? ` · ${txr('owned')}` : ''}` }))
  }, [paints, paintStock, search])

  return (
    <li className="grid gap-2 p-2" aria-label={tx('Step {{n}}', { n: props.n })}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-6 text-right text-muted">{props.n}.</span>
        <input className="input w-40" list="scheme-techniques" placeholder={tx('technique')} aria-label={tx('Technique')} value={step.technique} onChange={(e) => props.onChange({ technique: e.target.value })} />
        <input className="input w-36" placeholder={tx('thinning')} aria-label={tx('Thinning')} value={step.thinning ?? ''} onChange={(e) => props.onChange({ thinning: e.target.value || undefined })} />
        <input className="input w-36" placeholder={tx('brush / tool')} aria-label={tx('Tool')} value={step.tool ?? ''} onChange={(e) => props.onChange({ tool: e.target.value || undefined })} />
        <span className="ml-auto flex gap-1">
          <button className="btn" aria-label={tx('Move step up')} disabled={props.first} onClick={() => props.onMove(-1)}>↑</button>
          <button className="btn" aria-label={tx('Move step down')} disabled={props.last} onClick={() => props.onMove(1)}>↓</button>
          <label className="btn" title={tx('Photo of this step')}>
            📷
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label={tx('Photo for step {{n}}', { n: props.n })}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void addSchemePhotos(props.scheme, [f], step.id)
              }}
            />
          </label>
          <button className="btn" aria-label={tx('Duplicate step')} onClick={props.onDuplicate}>⧉</button>
          <button className="btn btn-danger" aria-label={tx('Remove step')} onClick={props.onRemove}>✕</button>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-8">
        {step.paints.map((sp, i) => {
          const p = byId.get(sp.paintId)
          const owned = (paintStock.get(sp.paintId)?.quantity ?? 0) > 0
          return (
            <span key={`${sp.paintId}-${i}`} className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-sm ${owned ? 'border-line' : 'border-danger/60'}`} title={owned ? tx('Owned') : tx('Not owned')}>
              <span className="inline-block h-3 w-3 rounded-sm border border-line" style={{ background: p?.hex ?? '#888' }} />
              {p?.name ?? sp.paintId}
              {step.paints.length > 1 && (
                <input
                  className="input w-12 px-1 py-0 text-xs"
                  type="number"
                  min={1}
                  aria-label={tx('Parts of {{name}}', { name: p?.name ?? sp.paintId })}
                  value={sp.parts ?? 1}
                  onChange={(e) => props.onChange({ paints: step.paints.map((x, j) => (j === i ? { ...x, parts: Number(e.target.value) || 1 } : x)) })}
                />
              )}
              <button className="text-muted hover:text-danger" aria-label={tx('Remove {{name}}', { name: p?.name ?? sp.paintId })} onClick={() => props.onChange({ paints: step.paints.filter((_, j) => j !== i) })}>×</button>
            </span>
          )
        })}
        <div className="w-64">
          <Combobox
            label={step.paints.length ? tx('Add paint to mix') : tx('Paint')}
            text={search}
            onTextChange={setSearch}
            options={options}
            onSelect={(o) => {
              props.onChange({ paints: [...step.paints, { paintId: o.value }] })
              setSearch('')
            }}
            placeholder={tx('search paints…')}
          />
        </div>
        {step.paints.length > 1 && <span className="text-xs text-muted">{tx('mix {{ratio}}', { ratio: step.paints.map((x) => x.parts ?? 1).join(':') })}</span>}
      </div>
      <input className="input ml-8" placeholder={tx('note')} aria-label={tx('Step note')} value={step.note} onChange={(e) => props.onChange({ note: e.target.value })} />
      <StepLinks links={step.links ?? []} onChange={(links) => props.onChange({ links: links.length ? links : undefined })} />
      {stepPhotos.length > 0 && (
        <div className="ml-8 flex gap-2">
          {stepPhotos.map((p) => <PhotoThumb key={p.id} photo={p} size="h-14 w-14" onClick={() => setViewing(p.id)} />)}
        </div>
      )}
      {viewing && <PhotoViewer photos={stepPhotos} startId={viewing} onClose={() => setViewing(null)} />}
    </li>
  )
}

/** Video/tutorial links of one step. */
function StepLinks({ links, onChange }: { links: StepLink[]; onChange: (l: StepLink[]) => void }) {
  const tx = useTx()
  const patch = (i: number, p: Partial<StepLink>) => onChange(links.map((l, j) => (j === i ? { ...l, ...p } : l)))
  return (
    <div className="ml-8 grid gap-1" aria-label={tx('Step links')}>
      {links.map((l, i) => (
        <div key={i} className="flex gap-1">
          <input className="input flex-1" placeholder={tx('https://… video or tutorial')} aria-label={tx('Link URL')} value={l.url} onChange={(e) => patch(i, { url: e.target.value })} />
          <input className="input w-36" placeholder={tx('title')} aria-label={tx('Link title')} value={l.title ?? ''} onChange={(e) => patch(i, { title: e.target.value || undefined })} />
          <button className="btn btn-danger" aria-label={tx('Remove link')} onClick={() => onChange(links.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="w-fit text-xs text-muted underline" onClick={() => onChange([...links, { url: '' }])}>{tx('+ video / tutorial link')}</button>
    </div>
  )
}

/** Blank link rows typed and left empty are not saved. */
function dropEmptyLinks(s: PaintScheme): PaintScheme {
  return {
    ...s,
    sections: s.sections.map((sec) => ({
      ...sec,
      steps: sec.steps.map((st) => {
        const links = st.links?.map((l) => ({ ...l, url: l.url.trim() })).filter((l) => l.url)
        return { ...st, links: links?.length ? links : undefined }
      }),
    })),
  }
}
