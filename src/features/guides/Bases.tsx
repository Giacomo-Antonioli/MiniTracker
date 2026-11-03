import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../app/store'
import { BASE_KINDS, BASES_GUIDE, BASES_SOURCES, filterBases, type BaseRecipe } from '../../domain/guides/bases'
import { TERRAIN_KINDS } from '../../domain/guides/terrain'
import { techniqueFor, type Technique } from '../../domain/guides/techniques'
import { HowTo, TechniquePanel } from './GuidesPage'
import { materialsFor, type Material } from '../../domain/guides/materials'
import { MaterialPanel, MaterialsList } from './Materials'

type RecipeSet = 'bases' | 'terrain'
const cache: Partial<Record<RecipeSet, BaseRecipe[]>> = {}
const LOAD: Record<RecipeSet, () => Promise<BaseRecipe[]>> = {
  bases: () => import('../../data/guides/bases.json').then((m) => (m.default as { bases: BaseRecipe[] }).bases),
  terrain: () => import('../../data/guides/terrain.json').then((m) => (m.default as { terrain: BaseRecipe[] }).terrain),
}
/** Base or terrain recipes, loaded on first use like the scheme library. */
export function useBases(set: RecipeSet = 'bases'): BaseRecipe[] | null {
  const [list, setList] = useState(cache[set] ?? null)
  useEffect(() => {
    if (cache[set]) return
    void LOAD[set]().then((l) => setList((cache[set] = l)))
  }, [set])
  return list
}

const KINDS: Record<RecipeSet, string[]> = { bases: BASE_KINDS.map(([k]) => k), terrain: TERRAIN_KINDS.map(([k]) => k) }

/** Browse basing recipes; with onPick, each card gets a "Use this base" button. */
export function BasesBrowser({ onPick, set = 'bases' }: { onPick?: (b: BaseRecipe) => void; set?: RecipeSet }) {
  const bases = useBases(set)
  const { paints, loadPaints } = useStore()
  useEffect(() => {
    if (!paints.length) void loadPaints()
  }, [paints.length, loadPaints])
  const [kind, setKind] = useState('')
  const [text, setText] = useState('')
  const [technique, setTechnique] = useState<Technique | null>(null)
  const [material, setMaterial] = useState<Material | null>(null)
  // Our own recipes first, then the dedicated basing recipes, then bases taken from faction schemes.
  const shown = useMemo(
    () => (bases ? filterBases(bases, kind, text).sort((a, b) => Number(a.origin !== 'minitracker') - Number(b.origin !== 'minitracker') || Number(!!a.schemeId) - Number(!!b.schemeId) || a.name.localeCompare(b.name)) : []),
    [bases, kind, text],
  )
  if (!bases) return <p className="text-sm text-muted">Loading bases…</p>

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-56" aria-label={set === 'bases' ? 'Search bases' : 'Search terrain'} placeholder={set === 'bases' ? 'Search bases or factions…' : 'Search terrain…'} value={text} onChange={(e) => setText(e.target.value)} />
        <div role="group" aria-label={set === 'bases' ? 'Base type' : 'Surface'} className="flex flex-wrap gap-1">
          {['', ...KINDS[set]].map((k) => (
            <button key={k || 'all'} aria-pressed={kind === k} className={`btn text-sm ${kind === k ? 'btn-primary' : ''}`} onClick={() => setKind(k)}>
              {k || 'All'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted">
        {shown.length} recipes.{' '}
        {set === 'bases' ? 'Texture paints go on first; finish with drybrushing and a neat rim.' : 'Spray or drybrush big areas, sponge on damage, and keep terrain colours different from your army so models stand out.'}
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((b) => <BaseCard key={b.id} base={b} label={set === 'bases' ? 'Base' : 'Terrain'} onTechnique={setTechnique} onMaterial={setMaterial} onPick={onPick} />)}
      </div>
      {technique && <TechniquePanel technique={technique} onClose={() => setTechnique(null)} />}
      {material && <MaterialPanel material={material} onClose={() => setMaterial(null)} />}
    </div>
  )
}

function BaseCard({ base: b, label, onTechnique, onMaterial, onPick }: { base: BaseRecipe; label: string; onTechnique: (t: Technique) => void; onMaterial: (m: Material) => void; onPick?: (b: BaseRecipe) => void }) {
  const { paints } = useStore()
  const byId = useMemo(() => new Map(paints.map((p) => [p.id, p])), [paints])
  return (
    <article className="panel grid content-start gap-2 p-3 text-sm" aria-label={`${label} ${b.name}`}>
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
                    {p?.name ?? sp.paintId.split('/').pop()!.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    {sp.parts ? ` ×${sp.parts}` : ''}
                  </span>
                )
              })}
              {st.note && <span className="text-muted italic">{st.note}</span>}
            </li>
          )
        })}
      </ol>
      {materialsFor(b).length > 0 && (
        <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
          Materials:
          {materialsFor(b).map((m) => (
            <button key={m.id} className="rounded border border-line px-1.5 hover:border-accent hover:text-accent" onClick={() => onMaterial(m)}>{m.name}</button>
          ))}
        </p>
      )}
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

/** Guides › Bases: recipes or materials. */
export function BasesTab() {
  const [view, setView] = useState<'recipes' | 'materials'>('recipes')
  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label="Bases view" className="flex gap-1">
        <button role="tab" aria-selected={view === 'recipes'} className={`btn text-sm ${view === 'recipes' ? 'btn-primary' : ''}`} onClick={() => setView('recipes')}>Recipes</button>
        <button role="tab" aria-selected={view === 'materials'} className={`btn text-sm ${view === 'materials' ? 'btn-primary' : ''}`} onClick={() => setView('materials')}>Materials</button>
      </div>
      {view === 'recipes' ? (
        <>
          <HowTo title="How to base miniatures" sections={BASES_GUIDE} sources={BASES_SOURCES} diagrams={['order', 'drybrush', 'tufts']} />
          <BasesBrowser />
        </>
      ) : (
        <MaterialsList />
      )}
    </div>
  )
}
