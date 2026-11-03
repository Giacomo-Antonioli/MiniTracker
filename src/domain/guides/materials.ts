import type { BaseRecipe } from './bases'

/** Basing materials: what they are and how to use them. Written for MiniTracker; brand links go to the makers' own sites. */
export interface Material {
  id: string
  name: string
  what: string
  how: string[]
  tips: string[]
  mistakes: string[]
  /** Makers that sell it (links to their sites). */
  brands: { name: string; url: string }[]
  /** Supplies category when added to Supplies. */
  category: 'Basing' | 'Glue'
}

const GSW = { name: 'Green Stuff World', url: 'https://www.greenstuffworld.com/en/49-basing-materials' }
const GSW_TUFTS = { name: 'Green Stuff World', url: 'https://www.greenstuffworld.com/en/68-grass-tufts' }
const GSW_GRASS = { name: 'Green Stuff World', url: 'https://www.greenstuffworld.com/en/43-static-grass-flock' }
const AP = { name: 'The Army Painter', url: 'https://thearmypainter.com/shop/us/basing' }
const GG = { name: "Gamers Grass", url: 'https://www.gamersgrass.com/' }
const CIT = { name: 'Citadel', url: 'https://www.warhammer.com/' }
const VAL = { name: 'Vallejo', url: 'https://acrylicosvallejo.com/' }
const MN = { name: 'MiniNatur', url: 'https://www.mininatur.de/' }
const WS = { name: 'Woodland Scenics', url: 'https://woodlandscenics.woodlandscenics.com/' }
const AK = { name: 'AK Interactive', url: 'https://ak-interactive.com/' }

export const MATERIALS: Material[] = [
  {
    id: 'texture-paste', name: 'Texture paint / paste', category: 'Basing',
    what: 'Paint or acrylic paste with grit mixed in. One product gives ground, colour and texture in a single coat.',
    how: ['Stir well; it settles.', 'Spread a thick layer with an old brush or a spreader; push it up to the model\'s feet.', 'Let it dry fully (some crack on purpose as they dry).', 'Shade, then drybrush one or two lighter colours.'],
    tips: ['Thicker layers of crackle pastes give bigger cracks.', 'Mix in a little real sand for coarser ground.'],
    mistakes: ['Shading or drybrushing before it is fully dry: it smears.'],
    brands: [CIT, VAL, GSW, AK],
  },
  {
    id: 'sand-grit', name: 'Sand and fine grit', category: 'Basing',
    what: 'Real sand or fine gravel glued to the base: the classic, cheapest ground.',
    how: ['Paint a thin layer of PVA glue on the base.', 'Dip the base in a tub of sand and tap off the excess.', 'When dry, seal it with watered-down PVA so it does not shed.', 'Prime or basecoat, shade and drybrush.'],
    tips: ['Mix fine and coarse grit for a natural look.', 'Glue a few bigger stones first, then sand around them.'],
    mistakes: ['Skipping the sealing coat: grains fall off when you drybrush.'],
    brands: [AP, GSW],
  },
  {
    id: 'rocks', name: 'Rocks, cork and slate', category: 'Basing',
    what: 'Bigger pieces that make height and interest: cork board, slate chips, bark or resin rocks.',
    how: ['Break cork or slate into pieces smaller than the base.', 'Glue them with super glue (PVA for big, light cork).', 'Fill gaps with texture paint or sand.', 'Basecoat grey, shade with black or brown, drybrush lighter greys.'],
    tips: ['Tear cork rather than cutting it for natural edges.', 'Cover cork with texture gel so it drybrushes like stone.'],
    mistakes: ['Rocks that hide the model or make it fall over.'],
    brands: [GSW, AP],
  },
  {
    id: 'static-grass', name: 'Static grass', category: 'Basing',
    what: 'Short fibres that stand up when charged with static, like real grass.',
    how: ['Paint PVA where the grass should go.', 'Sprinkle the grass, or use a static applicator so the fibres stand up.', 'Tip off and blow away the loose fibres when the glue is dry.'],
    tips: ['Mix two colours or lengths for a natural meadow.', 'A little matt varnish removes the shine and locks the fibres.'],
    mistakes: ['Too much glue: fibres sink in and lie flat.'],
    brands: [GSW_GRASS, AP, MN, WS],
  },
  {
    id: 'tufts', name: 'Grass tufts', category: 'Basing',
    what: 'Ready-made clumps of grass on a sticky backing: the quickest vegetation.',
    how: ['Finish painting the base and the rim first.', 'Pull a tuft off the sheet with tweezers.', 'Press it on with a dot of PVA or super glue.'],
    tips: ['Two or three tufts per base is usually enough.', 'Put them where they would grow: against rocks and walls, not in the middle of a path.', 'Winter, burnt and jungle tufts set the scene for the whole army.'],
    mistakes: ['Gluing tufts before the rim: they hang over and get painted.'],
    brands: [GSW_TUFTS, AP, GG, MN],
  },
  {
    id: 'flowers', name: 'Flowers and shrubs', category: 'Basing',
    what: 'Tufts with tiny flowers, or small bushes, for colour on green bases.',
    how: ['Add after the grass and tufts.', 'Glue with PVA or super glue, using tweezers.'],
    tips: ['Pick a flower colour that contrasts with your army so the base does not compete with it.'],
    mistakes: ['Too many colours on one base.'],
    brands: [GSW_TUFTS, GG, MN],
  },
  {
    id: 'flock', name: 'Flock and leaf litter', category: 'Basing',
    what: 'Fine foam crumbs (flock) or tiny leaves scattered over the ground.',
    how: ['Paint watered-down PVA on small patches.', 'Sprinkle flock or leaves, press lightly, tip off the rest.'],
    tips: ['Leaves look great on woodland and autumn bases; keep them sparse.'],
    mistakes: ['Covering the whole base: it hides the texture work.'],
    brands: [WS, GSW, AP],
  },
  {
    id: 'pigments', name: 'Weathering pigments', category: 'Basing',
    what: 'Coloured powders for dust, mud and rust on bases and lower legs.',
    how: ['Pick up a little powder with a soft, dry brush.', 'Dab and brush it onto the base and up onto feet and legs.', 'Fix it with a drop of pigment fixer or thinner, or leave it dry for a softer look.'],
    tips: ['Use the same pigment on the base and the model\'s feet so it sits in the ground.', 'Apply after varnish: varnish over pigments makes them disappear.'],
    mistakes: ['Varnishing over dry pigments.'],
    brands: [GSW, AK, VAL],
  },
  {
    id: 'snow', name: 'Snow and ice effects', category: 'Basing',
    what: 'Texture paint, powder or gel that looks like snow, frost or ice.',
    how: ['Finish the base under it.', 'Stipple snow paste in patches, thicker against rocks and feet.', 'For frost, a light drybrush of white is enough.'],
    tips: ['Leave some ground showing: thin, uneven snow looks more real.', 'Add a gloss varnish to ice and puddles.'],
    mistakes: ['Pure white everywhere: it flattens the base.'],
    brands: [CIT, GSW, VAL],
  },
  {
    id: 'water', name: 'Water and resin effects', category: 'Basing',
    what: 'Clear gels or resins for puddles, swamps, lava pools and streams.',
    how: ['Paint the bottom of the puddle dark (it gives depth).', 'Pour or brush in thin layers; let each dry.', 'For ripples, stipple water gel on the top layer.'],
    tips: ['Tint the first layer with a tiny drop of ink.', 'Ardcoat or gloss varnish works for small puddles.'],
    mistakes: ['Pouring one thick layer: it shrinks, clouds or bubbles.'],
    brands: [VAL, CIT, GSW, WS],
  },
  {
    id: 'pva', name: 'PVA glue', category: 'Glue',
    what: 'White wood glue: slow, cheap and the standard for sand, flock and static grass.',
    how: ['Brush where needed; water it down for sealing and for flock.'],
    tips: ['Dries clear; keep an old brush just for glue.'],
    mistakes: ['Using it for heavy rocks: they fall off; use super glue.'],
    brands: [AP, CIT],
  },
  {
    id: 'super-glue', name: 'Super glue', category: 'Glue',
    what: 'Fast cyanoacrylate glue for rocks, tufts and anything heavy.',
    how: ['A tiny dot is enough; press for a few seconds.'],
    tips: ['Gel super glue gives you a few seconds to adjust.'],
    mistakes: ['Too much: it frosts white around the part.'],
    brands: [AP, CIT, GSW],
  },
]

// Matched on step notes; paint names only show texture paints and gloss (a paint called "Tallarn Sand" is not sand).
const USES: [string, RegExp, 'notes' | 'paints'][] = [
  ['texture-paste', /astrogranite|armageddon|stirland|agrellan|martian|mordant|valhallan/i, 'paints'],
  ['texture-paste', /texture/i, 'notes'],
  ['sand-grit', /\bsand\b|grit|gravel/i, 'notes'],
  ['rocks', /\brocks?\b|cork|slate|stones?/i, 'notes'],
  ['static-grass', /static grass/i, 'notes'],
  ['tufts', /tufts?/i, 'notes'],
  ['flowers', /flowers?|shrubs?/i, 'notes'],
  ['flock', /flock|leaves|leaf/i, 'notes'],
  ['pigments', /pigment|powder/i, 'notes'],
  ['snow', /snow|frost|\bice\b/i, 'notes'],
  ['snow', /valhallan-blizzard/i, 'paints'],
  ['water', /water effect|puddle|resin/i, 'notes'],
  ['pva', /\bpva\b/i, 'notes'],
  ['super-glue', /super ?glue/i, 'notes'],
]

/** Materials a base recipe uses, from its step notes and texture paints. */
export function materialsFor(base: BaseRecipe): Material[] {
  const notes = base.steps.map((s) => s.note).join(' ')
  const paints = base.steps.flatMap((s) => s.paints.map((p) => p.paintId)).join(' ')
  const ids = new Set(USES.filter(([, re, where]) => re.test(where === 'notes' ? notes : paints)).map(([id]) => id))
  return MATERIALS.filter((m) => ids.has(m.id))
}
