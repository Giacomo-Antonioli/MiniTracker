import type { PaintScheme } from './types'

const paintSet = (s: PaintScheme) => new Set(s.sections.flatMap((x) => x.steps.flatMap((st) => st.paints.map((p) => p.paintId))))
const stepCount = (s: PaintScheme) => s.sections.reduce((n, x) => n + x.steps.length, 0)

/** Jaccard similarity of the paints two schemes use (0–1). */
export function paintSimilarity(a: PaintScheme, b: PaintScheme): number {
  const x = paintSet(a)
  const y = paintSet(b)
  if (!x.size && !y.size) return 1
  let both = 0
  for (const p of x) if (y.has(p)) both++
  return both / (x.size + y.size - both)
}

/** True when two schemes are the same recipe: same id, or same author with (almost) the same paints and step count. */
export function sameRecipe(a: PaintScheme, b: PaintScheme, threshold = 0.9): boolean {
  if (a.id === b.id) return true
  if (!a.source?.author || a.source.author !== b.source?.author) return false
  const [m, n] = [stepCount(a), stepCount(b)].sort((p, q) => p - q)
  return n > 0 && m / n >= 0.8 && paintSimilarity(a, b) >= threshold
}

/**
 * Drops near-identical recipes, keeping the first one seen (list sources from most to least specific,
 * e.g. Ultramarines before Space Marines). Returns the kept schemes and, for each dropped one, which it duplicates.
 */
export function dedupeSchemes(schemes: PaintScheme[]): { kept: PaintScheme[]; dropped: { id: string; name: string; duplicateOf: string }[] } {
  const kept: PaintScheme[] = []
  const dropped: { id: string; name: string; duplicateOf: string }[] = []
  for (const s of schemes) {
    const twin = kept.find((k) => sameRecipe(k, s))
    if (twin) dropped.push({ id: s.id, name: s.name, duplicateOf: twin.id })
    else kept.push(s)
  }
  return { kept, dropped }
}
