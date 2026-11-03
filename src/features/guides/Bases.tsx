import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../app/store'
import { BASE_KINDS, filterBases, type BaseRecipe } from '../../domain/guides/bases'
import { techniqueFor, type Technique } from '../../domain/guides/techniques'
import { TechniquePanel } from './GuidesPage'

let cache: BaseRecipe[] | null = null
/** Bases are loaded on first use, like the scheme library. */
export function useBases(): BaseRecipe[] | null {
  const [bases, setBases] = useState(cache)
  useEffect(() => {
    if (cache) return
    void import('../../data/guides/bases.json').then((m) => setBases((cache = (m.default as { bases: BaseRecipe[] }).bases)))
  }, [])
  return bases
}

const KINDS = BASE_KINDS.map(([k]) => k)

/** Browse basing recipes; with onPick, each card gets a "Use this base" button. */
export function BasesBrowser({ onPick }: { onPick?: (b: BaseRecipe) => void }) {
  const bases = useBases()
  const { paints, loadPaints } = useStore()
  useEffect(() => {
    if (!paints.length) void loadPaints()
  }, [paints.length, loadPaints])
  const [kind, setKind] = useState('')
  const [text, setText] = useState('')
  const [technique, setTechnique] = useState<Technique | null>(null)
  // Our own recipes first, then the dedicated basing recipes, then bases taken from faction schemes.
  const shown = useMemo(
    () => (bases ? filterBases(bases, kind, text).sort((a, b) => Number(a.origin !== 'minitracker') - Number(b.origin !== 'minitracker') || Number(!!a.schemeId) - Number(!!b.schemeId) || a.name.localeCompare(b.name)) : []),
    [bases, kind, text],
  )
  if (!bases) return <p className="text-sm text-muted">Loading bases…</p>

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-56" aria-label="Search bases" placeholder="Search bases or factions…" value={text} onChange={(e) => setText(e.target.value)} />
        <div role="group" aria-label="Base type" className="flex flex-wrap gap-1">
          {['', ...KINDS].map((k) => (
            <button key={k || 'all'} aria-pressed={kind === k} className={`btn text-sm ${kind === k ? 'btn-primary' : ''}`} onClick={() => setKind(k)}>
              {k || 'All'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted">{shown.length} recipes. Texture paints go on first; finish with drybrushing and a neat rim.</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((b) => <BaseCard key={b.id} base={b} onTechnique={setTechnique} onPick={onPick} />)}
      </div>
      {technique && <TechniquePanel technique={technique} onClose={() => setTechnique(null)} />}
    </div>
  )
}

function BaseCard({ base: b, onTechnique, onPick }: { base: BaseRecipe; onTechnique: (t: Technique) => void; onPick?: (b: BaseRecipe) => void }) {
  const { paints } = useStore()
  const byId = useMemo(() => new Map(paints.map((p) => [p.id, p])), [paints])
  return (
    <article className="panel grid content-start gap-2 p-3 text-sm" aria-label={`Base ${b.name}`}>
      <header>
        <h3 className="font-semibold text-accent">{b.name}</h3>
        <p className="text-xs text-muted">
          {b.kinds.join(' · ') || 'other'}
          {b.factionName && ` · ${b.factionName}`}
          {b.origin === 'minitracker' ? ' · MiniTracker' : b.source ? <> · <a className="hover:text-accent hover:underline" href={b.source.url} target="_blank" rel="noreferrer">{b.schemeId ? 'from a scheme' : 'source'} ↗</a></> : null}
        </p>
      </header>
      <ol className="grid gap-1">
        {b.steps.map((st, i) => {
          const guide = techniqueFor(st.technique)
          return (
            <li key={st.id} className="flex flex-wrap items-center gap-1.5">
              <span className="w-5 text-right text-muted">{i + 1}.</span>
              {guide ? (
                <button className="text-muted underline decoration-dotted hover:text-accent" onClick={() => onTechnique(guide)}>{st.technique}</button>
              ) : st.technique ? (
                <span className="text-muted">{st.technique}</span>
              ) : null}
              {st.paints.map((sp) => {
                const p = byId.get(sp.paintId)
                return (
                  <span key={sp.paintId} className="flex items-center gap-1 rounded border border-line px-1.5">
                    <span className="h-3 w-3 rounded-sm border border-line" style={{ background: p?.hex ?? '#888' }} />
                    {p?.name ?? sp.paintId.split('/').pop()}
                    {sp.parts ? ` ×${sp.parts}` : ''}
                  </span>
                )
              })}
              {st.note && <span className="text-muted italic">{st.note}</span>}
            </li>
          )
        })}
      </ol>
      {onPick && <button className="btn btn-primary justify-self-start text-sm" onClick={() => onPick(b)}>Use this base</button>}
    </article>
  )
}

/** Pick a base recipe for a scheme. */
export function BasePickerDialog({ onPick, onClose }: { onPick: (b: BaseRecipe) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-label="Pick a base recipe">
      <div className="panel grid max-h-full w-[1000px] max-w-full gap-3 overflow-y-auto p-4">
        <header className="flex items-center justify-between">
          <h2 className="font-display text-xl text-accent">Pick a base recipe</h2>
          <button className="btn" aria-label="Close base picker" onClick={onClose}>✕</button>
        </header>
        <BasesBrowser onPick={onPick} />
      </div>
    </div>
  )
}
