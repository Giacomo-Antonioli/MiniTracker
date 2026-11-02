import { useEffect, useState, type ReactNode } from 'react'
import { ctx, useStore } from '../../app/store'
import { pointsFor } from '../../domain/catalogue/points'
import { totalModels } from '../../domain/collection/ownedUnit'
import { setFlags } from '../../domain/collection/pipeline'
import type { ModelGroup, OwnedUnit } from '../../domain/collection/types'
import { DatasheetInfo } from '../catalogue/DatasheetInfo'
import { PhotoGallery } from '../photos/PhotoGallery'
import { PhotoThumb } from '../photos/PhotoThumb'
import { PhotoViewer } from '../photos/PhotoViewer'
import { SchemeCardLink } from '../schemes/SchemeCardLink'
import { SchemePicker } from '../schemes/SchemePicker'
import { schemesForUnit } from '../../domain/schemes/match'
import { missingForSchemes } from '../../domain/paints/missing'
import { AddToShoppingButton } from '../shopping/AddToShoppingDialog'
import { unitTag } from '../../domain/photos/naming'
import { MoveDialog } from './MoveDialog'
import { QuickMove } from './QuickMove'

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })

interface Props {
  unit: OwnedUnit
  onEdit: () => void
  /** Panel: close it. Page: go back. */
  onClose: () => void
  /** 'panel' (side panel next to the backlog) or 'page' (full unit page). */
  variant?: 'panel' | 'page'
  onOpenPage?: () => void
  onOpenDatasheet?: (datasheetId: string) => void
  onOpenScheme?: (schemeId: string) => void
}

export function UnitPanel({ unit, onEdit, onClose, variant = 'panel', onOpenPage, onOpenDatasheet, onOpenScheme }: Props) {
  const page = variant === 'page'
  const { pipeline, events, loadEvents, saveUnit, deleteUnit, catalogue, photos: allPhotos, loadPhotos, schemes, library, loadLibrary, paints, loadPaints, paintStock } = useStore()
  const allSchemes = [...schemes, ...library]
  const scheme = unit.schemeId ? allSchemes.find((s) => s.id === unit.schemeId) : undefined
  const photos = allPhotos[unit.id] ?? []
  const [viewing, setViewing] = useState<string | null>(null)
  const datasheet = unit.datasheetId ? catalogue?.datasheets.find((d) => d.id === unit.datasheetId) : undefined
  const models = totalModels(unit)
  let points: number | undefined
  try {
    points = datasheet ? pointsFor(datasheet, models) : undefined
  } catch {
    points = undefined
  }
  const [moving, setMoving] = useState<ModelGroup | null>(null)
  const stageName = (id: string) => pipeline.stages.find((s) => s.id === id)?.name ?? id
  const history = [...(events[unit.id] ?? [])].reverse()

  useEffect(() => {
    void loadEvents(unit.id)
    void loadPhotos(unit.id)
  }, [unit.id, loadEvents, loadPhotos])

  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])

  useEffect(() => {
    if (scheme && !paints.length) void loadPaints()
  }, [scheme, paints.length, loadPaints])

  const toggle = (flag: 'favourite' | 'nextUp') => saveUnit(setFlags(unit, { [flag]: !unit[flag] }, ctx()))

  return (
    <Container
      className={page ? 'panel mx-auto flex w-full max-w-4xl flex-col' : 'panel flex h-full w-[420px] shrink-0 flex-col overflow-y-auto'}
      aria-label={page ? 'Unit page' : 'Unit details'}
    >
      <header className="border-b border-line p-4">
        {page && (
          <button className="mb-3 text-sm text-muted hover:text-accent" onClick={onClose}>
            ← Back to backlog
          </button>
        )}
        <div className="flex items-start justify-between gap-2">
          <h2 className={`font-display text-accent ${page ? 'text-3xl' : 'text-xl'}`}>{unit.customName}</h2>
          <div className="flex gap-1">
            <button className="btn" aria-pressed={unit.favourite} title="Favourite" onClick={() => toggle('favourite')}>{unit.favourite ? '★' : '☆'}</button>
            <button className="btn" aria-pressed={unit.nextUp} title="Next up" onClick={() => toggle('nextUp')}>{unit.nextUp ? '⏭' : '⏵'}</button>
            {!page && onOpenPage && (
              <button className="btn" title="Open the full unit page" onClick={onOpenPage}>⤢ Open page</button>
            )}
            {!page && <button className="btn" aria-label="Close details" onClick={onClose}>✕</button>}
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">
          {unit.factionName ?? 'No faction'} · {unit.lifecycle} ·{' '}
          <span title="Permanent unit tag, used in photo names and future QR/NFC tags" aria-label="Unit tag">🏷 {unitTag(unit.id)}</span>
        </p>
        {datasheet && (
          <p className="mt-1 text-sm" aria-label="Datasheet">
            📜{' '}
            {onOpenDatasheet ? (
              <button className="text-accent underline" onClick={() => onOpenDatasheet(datasheet.id)}>{datasheet.name}</button>
            ) : (
              datasheet.name
            )}
            {datasheet.role && <span className="text-muted"> · {datasheet.role}</span>}
            <span className="text-muted"> · {models} models</span>
            {points !== undefined ? (
              <b className="text-accent"> · {points || '?'} pts</b>
            ) : (
              <span className="text-danger"> · size {datasheet.minModels}–{datasheet.maxModels} allowed</span>
            )}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button className="btn" onClick={onEdit}>Edit</button>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm(`Delete "${unit.customName}" and its history?`)) void deleteUnit(unit.id).then(onClose)
            }}
          >
            Delete
          </button>
        </div>
      </header>

      <section className="border-b border-line p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Models</h3>
        <ul className="grid gap-2">
          {unit.groups.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2">
              <div>
                <b>{g.count} ×</b> {stageName(g.status)}
                {g.loadout.length > 0 && <span className="text-muted"> · {g.loadout.join(', ')}</span>}
                {g.magnetised.map((m) => (
                  <div key={m.slot} className="text-xs text-muted">🧲 {m.slot}: {m.optionIds.join(' | ')}</div>
                ))}
              </div>
              <div className="flex flex-col items-end gap-1">
                <QuickMove key={`${g.id}-${g.count}-${g.status}`} unit={unit} group={g} />
                <button className="text-xs text-muted underline" onClick={() => setMoving(g)}>Move with date, note or photo…</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-2 border-b border-line p-4" aria-label="Scheme">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Paint scheme</h3>
          <div className="w-56">
            <SchemePicker
              label="Choose scheme"
              chosenColours={false}
              value={unit.schemeId}
              paints={paints}
              groups={schemesForUnit(allSchemes, unit, datasheet)}
              onChange={(id) => void saveUnit({ ...unit, schemeId: id, updatedAt: new Date().toISOString() })}
            />
          </div>
        </div>
        {scheme ? (
          <>
            <SchemeCardLink scheme={scheme} large={page} onOpen={onOpenScheme && (() => onOpenScheme(scheme.id))} />
            <ol className="text-xs text-muted">
              {scheme.sections.map((sec) => (
                <li key={sec.id}>
                  <b>{sec.area}:</b> {sec.steps.map((st) => `${st.technique || 'step'} (${st.paints.map((p) => paints.find((x) => x.id === p.paintId)?.name ?? '?').join(' + ')})`).join(' → ')}
                </li>
              ))}
            </ol>
            <AddToShoppingButton
              label="Add missing paints to shopping list…"
              items={missingForSchemes([scheme], paints, paintStock).map((m) => ({ kind: 'paint' as const, name: m.paint ? `${m.paint.brand} ${m.paint.name}` : m.paintId, refId: m.paintId, qty: 1, sources: [`Scheme: ${scheme.name}`] }))}
            />
          </>
        ) : (
          <p className="text-sm text-muted">
            {unit.schemeId ? 'The linked scheme is no longer available.' : schemesForUnit(allSchemes, unit, datasheet).length ? 'No scheme yet: pick one above.' : 'No schemes for this unit yet.'}
          </p>
        )}
      </section>

      {datasheet && catalogue && (
        <details className="border-b border-line" open={page} aria-label="Datasheet details">
          <summary className="cursor-pointer p-4 text-xs font-semibold uppercase tracking-wider text-muted">Datasheet: stats, weapons, abilities, rules, wargear</summary>
          <DatasheetInfo catalogue={catalogue} d={datasheet} />
        </details>
      )}

      <PhotoGallery unit={unit} photos={photos} thumbSize={page ? 'h-40 w-40' : undefined} />

      <section className="border-b border-line p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">History</h3>
        {history.length === 0 && <p className="text-sm text-muted">No changes yet.</p>}
        <ol className="grid gap-3">
          {history.map((e) => (
            <li key={e.id} className="grid grid-cols-[90px_1fr] gap-2 text-sm">
              <span className="text-muted">{fmt(e.date)}</span>
              <div>
                {e.count} models {stageName(e.from)} {e.direction === 'forward' ? '→' : '↩'} {stageName(e.to)}
                {e.note && <p className="text-muted italic">“{e.note}”</p>}
                {(() => {
                  const ph = e.photoId && photos.find((p) => p.id === e.photoId)
                  return ph ? <div className="mt-1"><PhotoThumb photo={ph} size="h-14 w-14" onClick={() => setViewing(ph.id)} /></div> : null
                })()}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {unit.tutorials.length > 0 && (
        <section className="border-b border-line p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Tutorials</h3>
          <ul className="grid gap-1">
            {unit.tutorials.map((t, i) => (
              <li key={i}>
                <a className="text-accent underline" href={t.url} target="_blank" rel="noreferrer">{t.title || t.url}</a>
                <span className="text-xs text-muted"> · {t.kind}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(unit.notes || unit.tags.length > 0) && (
        <section className="p-4">
          {unit.notes && <p className="whitespace-pre-wrap text-sm">{unit.notes}</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            {unit.tags.map((t) => <span key={t} className="rounded bg-panel-2 px-2 py-0.5 text-xs">{t}</span>)}
          </div>
        </section>
      )}

      {viewing && <PhotoViewer photos={photos} startId={viewing} onClose={() => setViewing(null)} />}
      {moving && <MoveDialog unit={unit} group={moving} onClose={() => setMoving(null)} />}
    </Container>
  )
}

function Container({ className, children, ...rest }: { className: string; children: ReactNode; 'aria-label': string }) {
  return rest['aria-label'] === 'Unit page' ? (
    <article className={className} {...rest}>{children}</article>
  ) : (
    <aside className={className} {...rest}>{children}</aside>
  )
}
