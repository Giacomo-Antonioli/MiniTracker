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

/** How to paint terrain: what several published guides agree on, in our own words. */
export const TERRAIN_GUIDE: { title: string; points: string[] }[] = [
  { title: 'Prepare', points: [
    'Wash resin and 3D-printed pieces in warm soapy water; glue and fill gaps before priming.',
    'Plan the colours: muted, natural terrain makes a bright army stand out (and the other way round).',
    'Paint several pieces together, step by step, like a batch of infantry.',
  ] },
  { title: 'Prime and block in', points: [
    'Spray outside, 30–50 cm away, in short sweeping bursts; shake the can for a few minutes.',
    'Dark colour first, all over. Then a lighter colour from above with less coverage: a zenithal for terrain.',
    'Use big, cheap brushes for basecoats; spray or airbrush when you have a lot of terrain.',
  ] },
  { title: 'Drybrush and shade', points: [
    'Shade the whole piece so recesses and cracks go dark; it does not need to be neat.',
    'Drybrush with a large, cheap brush: a heavy coat first, then lighter colours with less paint each time.',
    'A wash between drybrush layers adds depth; a drop of retarder makes drybrushing less chalky.',
    'Open floors and walls first, then raised details in a second pass.',
  ] },
  { title: 'Details and weathering', points: [
    'Pick out only what the eye goes to: doors, skulls, metal parts, screens and lights.',
    'Dirt collects low, in corners and under ledges; rust starts at bolts and edges and runs down.',
    'Moss and grime grow at the bottom of walls and in damp, shaded places.',
    'Use your base colours on the ground of the terrain so armies and table match.',
  ] },
  { title: 'Finish', points: [
    'Varnish: terrain is handled more than models. A matt spray protects drybrushing.',
    'Glue tufts or flock on the ground last, like on bases.',
  ] },
]

export const TERRAIN_SOURCES = [
  { title: 'Warhammer Community: Stone scenery step by step', url: 'https://www.warhammer-community.com/en-gb/articles/IhR0bYqC/turn-simple-stone-scenery-into-works-of-art-with-this-step-by-step-painting-guide/' },
  { title: 'Printable Scenery: How to drybrush terrain', url: 'https://www.printablescenery.com/2021/05/20/how-to-drybrush-terrain/' },
  { title: 'Frontline Gaming: Quick and easy Gothic ruins', url: 'https://frontlinegaming.org/2018/06/01/hobby-tutorial-quick-and-easy-painting-of-the-gothic-ruins-itc-terrain-set/' },
  { title: 'Printable Scenery: 7 ways to improve your terrain painting', url: 'https://www.printablescenery.com/2026/04/17/7-ways-to-improve-your-terrain-painting/' },
]
