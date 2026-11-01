import { useEffect, useMemo, useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { colourStrip, createScheme, missingPaints } from '../../domain/schemes/scheme'
import type { PaintScheme, SchemeOrigin } from '../../domain/schemes/types'
import { usePhotoUrl } from '../photos/usePhotoUrl'
import { ColourStrip } from './ColourStrip'
import { ORIGIN_LABEL, ORIGIN_STYLE } from './origin'
import { SchemeEditor } from './SchemeEditor'
import { SchemeView } from './SchemeView'
import { AddFromLinkDialog } from './AddFromLinkDialog'
import type { RecipePayload } from './recipeImport'

const ORDER: SchemeOrigin[] = ['official', 'community', 'personal']

export function SchemesPage({ openId, payload, onPayloadUsed, onOpenUnit }: { openId?: string; payload?: RecipePayload; onPayloadUsed?: () => void; onOpenUnit?: (id: string) => void }) {
  const { schemes: mine, library, loadLibrary, paints, paintStock, units, pipelines, schemeDefaults, loadPaints, saveScheme, importSchemes } = useStore()
  const [showLibrary, setShowLibrary] = useState(true)
  const schemes = useMemo(() => (showLibrary ? [...mine, ...library] : mine), [mine, library, showLibrary])
  const [text, setText] = useState('')
  const [faction, setFaction] = useState('')
  const [origin, setOrigin] = useState<'' | SchemeOrigin>('')
  const [stage, setStage] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(openId ?? null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!paints.length) void loadPaints()
    void loadLibrary()
  }, [paints.length, loadPaints, loadLibrary])

  const factions = useMemo(() => [...new Set(schemes.map((s) => s.factionName).filter((f): f is string => !!f))].sort(), [schemes])
  const shown = useMemo(() => {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean)
    return schemes
      .filter((s) => (!faction || s.factionName === faction) && (!origin || s.origin === origin) && (!stage || s.stage === stage))
      .filter((s) => words.every((w) => `${s.name} ${s.factionName ?? ''} ${s.tags.join(' ')}`.toLowerCase().includes(w)))
      .sort((a, b) => ORDER.indexOf(a.origin) - ORDER.indexOf(b.origin) || a.name.localeCompare(b.name))
  }, [schemes, text, faction, origin, stage])
  const selected = [...mine, ...library].find((s) => s.id === selectedId)
  const usedBy = (id: string) => units.filter((u) => u.schemeId === id).length

  async function create() {
    const s = createScheme({ name: 'New scheme', stage: pipelines.scheme.stages[0].id, factionName: faction || undefined }, ctx())
    await saveScheme(s)
    setSelectedId(s.id)
  }

  return (
    <div className="flex h-full gap-4">
      <div className={`flex min-w-0 flex-col gap-4 ${selected ? 'w-[380px] shrink-0' : 'flex-1'}`}>
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl text-accent">Schemes</h1>
          <div className="flex gap-2">
            <label className="btn">
              ⬆ Import
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                aria-label="Scheme file"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  try {
                    const added = await importSchemes(await f.text())
                    setMessage({ ok: true, text: `Imported ${added.length} scheme${added.length === 1 ? '' : 's'}.` })
                    if (added[0]) setSelectedId(added[0].id)
                  } catch (err) {
                    setMessage({ ok: false, text: (err as Error).message })
                  }
                }}
              />
            </label>
            <button className="btn" onClick={() => setAdding(true)}>🔗 Add from link</button>
            <button className="btn btn-primary" onClick={() => void create()}>+ New scheme</button>
          </div>
        </header>
        {message && <p role="status" className={message.ok ? 'text-ok' : 'text-danger'}>{message.text}</p>}

        <section className="flex flex-wrap items-center gap-2" aria-label="Scheme filters">
          <input className="input w-48" placeholder="🔍 Search" value={text} onChange={(e) => setText(e.target.value)} />
          <select className="input" aria-label="Faction" value={faction} onChange={(e) => setFaction(e.target.value)}>
            <option value="">All factions</option>
            {factions.map((f) => <option key={f}>{f}</option>)}
          </select>
          <select className="input" aria-label="Origin" value={origin} onChange={(e) => setOrigin(e.target.value as '' | SchemeOrigin)}>
            <option value="">Any origin</option>
            {ORDER.map((o) => <option key={o} value={o}>{ORIGIN_LABEL[o]}</option>)}
          </select>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={showLibrary} onChange={(e) => setShowLibrary(e.target.checked)} /> Library ({library.length})
          </label>
          <select className="input" aria-label="Status" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">Any status</option>
            {pipelines.scheme.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </section>

        <ul className={`grid gap-2 overflow-y-auto pb-4 ${selected ? '' : 'grid-cols-[repeat(auto-fill,minmax(260px,1fr))]'}`} aria-label="Schemes">
          {shown.map((s) => (
            <SchemeCard
              key={s.id}
              s={s}
              strip={colourStrip(s, paints)}
              missing={missingPaints(s, paintStock).length}
              used={usedBy(s.id)}
              isDefault={!!s.factionName && schemeDefaults[s.factionName] === s.id}
              stageName={pipelines.scheme.stages.find((x) => x.id === s.stage)?.name ?? s.stage}
              base={s.basedOn ? [...mine, ...library].find((x) => x.id === s.basedOn)?.name : undefined}
              active={s.id === selectedId}
              onOpen={() => setSelectedId(s.id)}
            />
          ))}
        </ul>
        {schemes.length === 0 && <p className="text-center text-muted">No schemes yet. Create one, browse the library, or import a scheme file from a friend.</p>}
        {schemes.length > 0 && shown.length === 0 && <p className="text-center text-muted">No schemes match these filters.</p>}
      </div>

      {(adding || payload) && (
        <AddFromLinkDialog
          payload={payload}
          onClose={() => {
            setAdding(false)
            onPayloadUsed?.()
          }}
          onCreated={setSelectedId}
        />
      )}
      {selected &&
        (selected.id.startsWith('lib/') ? (
          <SchemeView key={selected.id} scheme={selected} onOpen={setSelectedId} onClose={() => setSelectedId(null)} onOpenUnit={onOpenUnit} />
        ) : (
          <SchemeEditor key={selected.id} scheme={selected} onOpen={setSelectedId} onClose={() => setSelectedId(null)} onOpenUnit={onOpenUnit} />
        ))}
    </div>
  )
}

function SchemeCard(props: {
  s: PaintScheme
  strip: string[]
  missing: number
  used: number
  isDefault: boolean
  stageName: string
  base?: string
  active: boolean
  onOpen: () => void
}) {
  const { s } = props
  const cover = usePhotoUrl(s.coverPhotoId)
  return (
    <li>
      <button className={`panel grid w-full gap-2 p-3 text-left hover:border-accent ${props.active ? 'border-accent' : ''}`} onClick={props.onOpen} aria-label={`Scheme ${s.name}`}>
        {cover && <img src={cover} alt="" className="h-28 w-full rounded object-cover" />}
        <ColourStrip colours={props.strip} />
        <span className="flex items-start justify-between gap-2">
          <span className="font-semibold">{s.name}{props.isDefault && <span title="Default for this faction"> ⭐</span>}</span>
          <span className="flex shrink-0 gap-1">
            {s.id.startsWith('lib/') && <span className="rounded border border-line px-1.5 text-xs text-muted">Library</span>}
            <span className={`rounded border px-1.5 text-xs ${ORIGIN_STYLE[s.origin]}`}>{ORIGIN_LABEL[s.origin]}</span>
          </span>
        </span>
        <span className="text-xs text-muted">
          {[s.factionName, props.stageName, s.difficulty && `${'●'.repeat(s.difficulty)}${'○'.repeat(5 - s.difficulty)}`, s.minutesPerModel && `${s.minutesPerModel} min/model`]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {props.base && <span className="text-xs text-muted">↳ variant of {props.base}</span>}
        {s.source?.author && <span className="text-xs text-muted">by {s.source.author}</span>}
        <span className="flex gap-3 text-xs">
          {props.used > 0 && <span className="text-ok">{props.used} unit{props.used > 1 ? 's' : ''}</span>}
          {props.missing > 0 && <span className="text-danger">{props.missing} paint{props.missing > 1 ? 's' : ''} missing</span>}
        </span>
      </button>
    </li>
  )
}
