import { printPage } from '../../app/platform'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../app/store'
import { colourStrip, paintIdsOf } from '../../domain/schemes/scheme'
import type { PaintScheme } from '../../domain/schemes/types'
import { usePhotoUrl } from '../photos/usePhotoUrl'
import { ORIGIN_LABEL } from './origin'
import { useTx } from '../../i18n'

/** Printable one-page recipe card. Rendered off-screen and printed (or saved as PDF from the print dialog). */
export function RecipeCard({ scheme, onDone }: { scheme: PaintScheme; onDone: () => void }) {
  const tx = useTx()
  const { paints, paintStock } = useStore()
  const cover = usePhotoUrl(scheme.coverPhotoId)
  const byId = new Map(paints.map((p) => [p.id, p]))

  useEffect(() => {
    const done = () => onDone()
    window.addEventListener('afterprint', done)
    // Give the cover image a moment to load before opening the print dialog.
    const t = setTimeout(() => void printPage(), scheme.coverPhotoId ? 400 : 50)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', done)
    }
  }, [onDone, scheme.coverPhotoId])

  return createPortal(
    <div className="print-only recipe-card" aria-label={tx('Recipe card')}>
      <div className="flex h-4 w-full">{colourStrip(scheme, paints).map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</div>
      <header className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{scheme.name}</h1>
          <p className="text-sm">
            {[scheme.factionName, ORIGIN_LABEL[scheme.origin], scheme.difficulty && tx('difficulty {{n}}/5', { n: scheme.difficulty }), scheme.minutesPerModel && tx('{{n}} min/model', { n: scheme.minutesPerModel })].filter(Boolean).join(' · ')}
          </p>
          {scheme.source && (
            <p className="text-xs">
              {tx('Source:')} {scheme.source.title ?? scheme.source.url}
              {scheme.source.author && ` ${tx('by {{name}}', { name: scheme.source.author })}`}
              {scheme.source.url && <> · {scheme.source.url}</>}
            </p>
          )}
        </div>
        {cover && <img src={cover} alt="" className="h-32 w-32 rounded object-cover" />}
      </header>
      <section className="mt-3">
        <h2 className="font-bold">{tx('Paints')}</h2>
        <ul className="columns-3 text-xs">
          {paintIdsOf(scheme).map((id) => {
            const p = byId.get(id)
            const owned = (paintStock.get(id)?.quantity ?? 0) > 0
            return (
              <li key={id} className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 border border-black" style={{ background: p?.hex ?? '#888' }} />
                {p ? `${p.name} (${p.brand})` : id} {owned ? '✓' : '☐'}
              </li>
            )
          })}
        </ul>
      </section>
      {scheme.sections.map((sec) => (
        <section key={sec.id} className="mt-3 break-inside-avoid">
          <h2 className="font-bold">{sec.area}</h2>
          <ol className="list-decimal pl-5 text-sm">
            {sec.steps.map((st) => (
              <li key={st.id}>
                <b>{st.technique || tx('Step')}</b>: {st.paints.map((p) => `${byId.get(p.paintId)?.name ?? p.paintId}${p.parts && st.paints.length > 1 ? ` ×${p.parts}` : ''}`).join(' + ')}
                {st.thinning && ` (${st.thinning})`}
                {st.tool && ` · ${st.tool}`}
                {st.note && ` · ${st.note}`}
                {st.links?.map((l) => <span key={l.url} className="block break-all text-xs">▶ {l.title ? `${l.title}: ` : ''}{l.url}</span>)}
              </li>
            ))}
          </ol>
        </section>
      ))}
      {scheme.tips && (
        <section className="mt-3">
          <h2 className="font-bold">{tx('Tips')}</h2>
          <p className="whitespace-pre-wrap text-sm">{scheme.tips}</p>
        </section>
      )}
      <footer className="mt-4 text-[0.625rem]">{tx('MiniTracker · ✓ = in your paint inventory')}</footer>
    </div>,
    document.body,
  )
}
