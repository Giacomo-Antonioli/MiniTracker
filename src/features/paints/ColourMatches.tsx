import { useMemo, useState } from 'react'
import { useStore } from '../../app/store'
import { closestPaints, matchLabel, owns, type PaintMatch } from '../../domain/paints/colour'
import type { PaintDef } from '../../domain/paints/types'

/** Closest owned paints and closest paints of a chosen brand to a hex colour. */
export function ColourMatches({ hex, exclude, onPick }: { hex: string; exclude?: string; onPick?: (p: PaintDef) => void }) {
  const { paints, paintStock } = useStore()
  const brands = useMemo(() => [...new Set(paints.map((p) => p.brand))].sort(), [paints])
  const [brand, setBrand] = useState('')
  const owned = closestPaints(hex, paints, { exclude, filter: (p) => owns(paintStock, p.id) })
  const inBrand = brand ? closestPaints(hex, paints, { exclude, filter: (p) => p.brand === brand }) : []

  return (
    <div className="grid gap-3">
      <MatchList title="Closest you own" matches={owned} empty={exclude && owns(paintStock, exclude) ? 'You own no other paints.' : 'You own no paints yet.'} onPick={onPick} />
      <label className="flex items-center gap-2">
        <span className="text-sm text-muted">Closest in</span>
        <select className="input flex-1" aria-label="Match brand" value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">choose a brand…</option>
          {brands.map((b) => <option key={b}>{b}</option>)}
        </select>
      </label>
      {brand && <MatchList title={`Closest in ${brand}`} matches={inBrand} empty="No paints." onPick={onPick} />}
    </div>
  )
}

function MatchList({ title, matches, empty, onPick }: { title: string; matches: PaintMatch[]; empty: string; onPick?: (p: PaintDef) => void }) {
  return (
    <div aria-label={title} role="list">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      {matches.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      {matches.map(({ paint, distance }) => (
        <button key={paint.id} role="listitem" className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-line" onClick={() => onPick?.(paint)}>
          <span className="h-4 w-4 shrink-0 rounded border border-line" style={{ background: paint.hex }} />
          <span className="flex-1 truncate">{paint.name} <span className="text-muted">· {paint.brand}</span></span>
          <span className="text-xs text-muted" title={`ΔE2000 ${distance.toFixed(1)}`}>{matchLabel(distance)}</span>
        </button>
      ))}
    </div>
  )
}

/** Pick or type a hex colour and see the closest paints. */
export function HexMatchDialog({ onPick, onClose }: { onPick: (p: PaintDef) => void; onClose: () => void }) {
  const [hex, setHex] = useState('#8a2be2')
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" role="dialog" aria-label="Match a colour">
      <div className="panel grid w-[420px] max-w-[calc(100vw-32px)] gap-3 p-4">
        <header className="flex items-center justify-between">
          <h2 className="font-display text-xl text-accent">Match a colour</h2>
          <button className="btn" aria-label="Close colour match" onClick={onClose}>✕</button>
        </header>
        <div className="flex items-center gap-2">
          <input type="color" aria-label="Colour" value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000'} onChange={(e) => setHex(e.target.value)} />
          <input className="input flex-1" aria-label="Hex" value={hex} onChange={(e) => setHex(e.target.value)} />
        </div>
        <ColourMatches hex={hex} onPick={onPick} />
      </div>
    </div>
  )
}
