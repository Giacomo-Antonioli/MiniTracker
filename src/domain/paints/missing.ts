import { missingPaints } from '../schemes/scheme'
import type { PaintScheme } from '../schemes/types'
import type { PaintDef, PaintStock } from './types'

export interface MissingPaint {
  paintId: string
  paint?: PaintDef
  schemes: string[]
}

/** Paints the chosen schemes use that you have no pots of, sorted by brand and name, each with the schemes that use it. */
export function missingForSchemes(schemes: PaintScheme[], paints: PaintDef[], stocks: Map<string, PaintStock>): MissingPaint[] {
  const byId = new Map(paints.map((p) => [p.id, p]))
  const rows = new Map<string, MissingPaint>()
  for (const s of schemes)
    for (const id of missingPaints(s, stocks)) {
      const r = rows.get(id) ?? { paintId: id, paint: byId.get(id), schemes: [] }
      r.schemes.push(s.name)
      rows.set(id, r)
    }
  // Known paints by brand then name; unknown ones last.
  const key = (r: MissingPaint) => (r.paint ? [0, r.paint.brand, r.paint.name] : [1, '', r.paintId]) as [number, string, string]
  return [...rows.values()].sort((a, b) => {
    const [x, y] = [key(a), key(b)]
    return x[0] - y[0] || x[1].localeCompare(y[1]) || x[2].localeCompare(y[2])
  })
}
