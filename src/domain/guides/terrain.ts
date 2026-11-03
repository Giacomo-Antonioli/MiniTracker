/** Terrain recipes reuse the base recipe shape; `kinds` are surfaces. */
export const TERRAIN_KINDS: [string, RegExp][] = [
  ['stone', /\b(stone|sandstone|concrete|statue|rock|ruins?|brick)\b/i],
  ['walls', /\bwalls?\b/i],
  ['floor', /\b(floor|flooring|ground|deck)\b/i],
  ['metal', /\b(metal|metallic|steel|bronze|brass|copper|silver|iron|gold)\b/i],
  ['rust', /\b(rust|oxide|verdigris|corrosion)\b/i],
  ['pipes', /\b(pipes?|cables?|wires?|tubes?)\b/i],
  ['wood', /\b(wood|wooden|planks?|timber)\b/i],
  ['glow', /\b(glow|plasma|osl|light|crystals?|energy)\b/i],
  ['ice', /\b(ice|frost|frozen)\b/i],
]

export function terrainKinds(text: string): string[] {
  return TERRAIN_KINDS.filter(([, re]) => re.test(text)).map(([k]) => k)
}
