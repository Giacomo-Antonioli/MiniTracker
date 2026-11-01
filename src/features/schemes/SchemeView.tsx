import { useMemo, useState } from 'react'
import { ctx, useStore } from '../../app/store'
import { colourStrip, makeVariant, missingPaints } from '../../domain/schemes/scheme'
import type { PaintScheme } from '../../domain/schemes/types'
import { ColourStrip } from './ColourStrip'
import { RecipeCard } from './RecipeCard'
import { ORIGIN_LABEL, ORIGIN_STYLE } from './origin'

/** Read-only view of a library scheme, with ways to make it your own. */
export function SchemeView({ scheme, onOpen, onClose, onOpenUnit }: { scheme: PaintScheme; onOpen: (id: string) => void; onClose: () => void; onOpenUnit?: (id: string) => void }) {
  const { paints, paintStock, saveScheme, units } = useStore()
  const usedBy = units.filter((u) => u.schemeId === scheme.id)
  const byId = useMemo(() => new Map(paints.map((p) => [p.id, p])), [paints])
  const missing = missingPaints(scheme, paintStock)
  const [printing, setPrinting] = useState(false)

  async function copy(asVariant: boolean) {
    const v = makeVariant(scheme, ctx())
    const mine = asVariant
      ? v
      : { ...v, name: scheme.name, origin: scheme.origin, source: scheme.source, stage: scheme.stage, description: scheme.description }
    await saveScheme(mine)
    onOpen(mine.id)
  }

  return (
    <section className="panel flex min-w-0 flex-1 flex-col overflow-y-auto" aria-label="Library scheme">
      <div className="p-4 pb-0">
        <ColourStrip colours={colourStrip(scheme, paints)} height="h-6" />
      </div>
      <header className="flex items-start justify-between gap-2 border-b border-line p-4">
        <div className="grid gap-1">
          <h2 className="font-display text-xl text-accent">{scheme.name}</h2>
          <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="rounded border border-line px-1.5 text-xs">Library</span>
            <span className={`rounded border px-1.5 text-xs ${ORIGIN_STYLE[scheme.origin]}`}>{ORIGIN_LABEL[scheme.origin]}</span>
            {scheme.factionName}
            {scheme.tags.length > 0 && ` · ${scheme.tags.join(', ')}`}
          </span>
          <span className="text-sm text-muted">{scheme.appliesTo?.length ? `For: ${scheme.appliesTo.join(', ')}` : 'For the whole army'}</span>
          {usedBy.length > 0 && (
            <span className="text-sm text-ok">
              used by{' '}
              {usedBy.map((u, i) => (
                <span key={u.id}>
                  {i > 0 && ', '}
                  {onOpenUnit ? <button className="underline" onClick={() => onOpenUnit(u.id)}>{u.customName}</button> : u.customName}
                </span>
              ))}
            </span>
          )}
          {scheme.source && (
            <p className="text-sm">
              Source:{' '}
              {scheme.source.url ? (
                <a className="text-accent underline" href={scheme.source.url} target="_blank" rel="noreferrer">{scheme.source.title ?? scheme.source.url} ↗</a>
              ) : (
                scheme.source.title
              )}
              {scheme.source.author && <span className="text-muted"> by {scheme.source.author}</span>}
            </p>
          )}
        </div>
        <button className="btn" aria-label="Close scheme" onClick={onClose}>✕</button>
      </header>
      <div className="flex flex-wrap gap-2 border-b border-line p-4">
        <button className="btn btn-primary" onClick={() => void copy(false)}>+ Save a copy</button>
        <button className="btn" onClick={() => void copy(true)}>⑂ Make my variant</button>
        <button className="btn" onClick={() => setPrinting(true)}>🖨 Recipe card</button>
      </div>
      {missing.length > 0 && (
        <p className="border-b border-line p-4 text-sm">
          <b className="text-danger">Missing paints ({missing.length}):</b> {missing.map((id) => byId.get(id)?.name ?? id).join(', ')}
        </p>
      )}
      <div className="grid gap-4 p-4">
        <p className="text-sm text-muted">{scheme.description}</p>
        {scheme.tips && <p className="text-sm"><b>Note:</b> {scheme.tips}</p>}
        {scheme.sections.map((sec) => (
          <section key={sec.id} aria-label={`Area ${sec.area}`}>
            <h3 className="mb-1 font-semibold">{sec.area}</h3>
            <ol className="grid gap-1 text-sm">
              {sec.steps.map((st, i) => (
                <li key={st.id} className="flex flex-wrap items-center gap-2">
                  <span className="w-6 text-right text-muted">{i + 1}.</span>
                  <span className="w-28 text-muted">{st.technique || 'step'}</span>
                  {st.paints.map((sp, j) => {
                    const p = byId.get(sp.paintId)
                    const owned = (paintStock.get(sp.paintId)?.quantity ?? 0) > 0
                    return (
                      <span key={j} className={`flex items-center gap-1 rounded border px-1.5 ${owned ? 'border-line' : 'border-danger/60'}`}>
                        <span className="inline-block h-3 w-3 rounded-sm border border-line" style={{ background: p?.hex ?? '#888' }} />
                        {p?.name ?? sp.paintId}
                        {sp.parts && <span className="text-xs text-muted">×{sp.parts}</span>}
                      </span>
                    )
                  })}
                  {st.thinning && <span className="text-xs text-muted">({st.thinning})</span>}
                  {st.note && <span className="text-xs italic text-muted">{st.note}</span>}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      {printing && <RecipeCard scheme={scheme} onDone={() => setPrinting(false)} />}
    </section>
  )
}
