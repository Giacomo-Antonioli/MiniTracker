/** Groups of paint ids that a published conversion chart lists as close substitutes for each other. */
export type EquivalentGroups = string[][]

/** The other paints in every group that holds this paint (no duplicates, never the paint itself). */
export function equivalentsOf(id: string, groups: EquivalentGroups): string[] {
  const out = new Set<string>()
  for (const g of groups) if (g.includes(id)) for (const o of g) if (o !== id) out.add(o)
  return [...out]
}
