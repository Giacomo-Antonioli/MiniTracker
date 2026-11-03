import { TECHNIQUE_DETAILS, type TechniqueDetail } from './techniqueDetails.ts'

/** Painting technique guides. Text written for MiniTracker; videos are YouTube searches so links never go stale. */

export interface Technique {
  id: string
  name: string
  /** Other words used for it in recipes (matched case-insensitively). */
  aliases: string[]
  what: string
  when: string
  brush: string
  thinning: string
  mistakes: string[]
  /** In-depth method, tips, sources and diagram (see techniqueDetails.ts). */
  detail?: TechniqueDetail
}

const BASE: Technique[] = [
  {
    id: 'prime', name: 'Priming', aliases: ['primer', 'undercoat', 'spray'],
    what: 'A thin, even coat of primer over the whole model so paint grips the plastic or resin.',
    when: 'Always first, on a clean, assembled (or sub-assembled) model. Black hides gaps and suits dark schemes; white or grey makes bright colours and Contrast paints pop.',
    brush: 'Spray can or airbrush; a large brush for touch-ups.',
    thinning: 'Spray primer is ready to use. Airbrush primer as it comes, or as the bottle says.',
    mistakes: ['Spraying too close or too long: details fill in and the coat looks grainy.', 'Priming when it is cold or humid: the finish turns chalky.', 'Skipping a wash with soapy water on resin models (release agent stops paint sticking).'],
  },
  {
    id: 'zenithal', name: 'Zenithal priming', aliases: ['zenithal highlight', 'zenith'],
    what: 'A dark primer all over, then a light colour sprayed from above, so the model has light and shadow before you start.',
    when: 'After priming, before Contrast paints, glazes or thin basecoats that let the undercoat show through.',
    brush: 'Airbrush or spray can held about 45° above the model.',
    thinning: 'As for priming.',
    mistakes: ['Spraying from every angle: the shadows disappear.', 'Using a heavy basecoat afterwards: it hides all the work.'],
  },
  {
    id: 'basecoat', name: 'Basecoat', aliases: ['base', 'base coat', 'basecoating'],
    what: 'The main flat colour of an area, laid down smooth and opaque.',
    when: 'First colour on every area after priming. Paint big areas first and small details last, so mistakes are easy to tidy.',
    brush: 'Medium brush (size 1–2), large for big panels.',
    thinning: 'Like milk: two thin coats beat one thick coat.',
    mistakes: ['One thick coat that hides detail and leaves brush marks.', 'Paint creeping into the ferrule: it ruins the point.'],
  },
  {
    id: 'contrast', name: 'Contrast / speed paints', aliases: ['speedpaint', 'speed paint', 'xpress', 'contrast paint'],
    what: 'A single paint that tints, shades and highlights in one coat, flowing into recesses and staying light on raised areas.',
    when: 'Over a white, grey or zenithal undercoat, for fast armies or as a base for further highlights.',
    brush: 'Medium or large brush with a good belly to carry plenty of paint.',
    thinning: 'Straight from the pot; use Contrast medium to make it lighter, not water.',
    mistakes: ['Going back over an area that is half dry: it leaves tide marks.', 'Letting it pool on flat panels.'],
  },
  {
    id: 'shade', name: 'Shading / washing', aliases: ['wash', 'shade', 'all over shade', 'oil wash'],
    what: 'A thin, dark paint that runs into recesses to add shadow and definition.',
    when: 'After the basecoat. Then tidy up raised areas with the basecoat or a layer before highlighting.',
    brush: 'Medium or large brush.',
    thinning: 'Shades are ready to use. Wipe excess from the brush so it does not pool.',
    mistakes: ['Pools and tide marks on flat areas: soak them up with a clean, damp brush.', 'Touching it while half dry.'],
  },
  {
    id: 'recess shade', name: 'Recess shading', aliases: ['recess wash', 'pin wash', 'panel line', 'line shade', 'lining'],
    what: 'Shade placed only in panel lines and recesses, leaving the rest clean.',
    when: 'On smooth armour and vehicles, after the basecoat, when you want crisp shadows without dirtying the colour.',
    brush: 'Small brush with a fine point.',
    thinning: 'Shade or thin dark paint; touch the tip to the line and let it flow.',
    mistakes: ['Too much paint: it spills out of the line. Use less and repeat.'],
  },
  {
    id: 'layer', name: 'Layering', aliases: ['layers'],
    what: 'Lighter colours painted over the base on the raised areas, leaving the previous colour showing in the recesses.',
    when: 'After shading. Each layer covers a smaller area than the one before.',
    brush: 'Small to medium brush with a good point.',
    thinning: 'Thin, a little more than for a basecoat.',
    mistakes: ['Covering the whole area again: the shading vanishes.', 'Big jumps in colour: add a mix of the two as an in-between step.'],
  },
  {
    id: 'highlight', name: 'Highlighting', aliases: ['chunky highlight', 'blended highlight', 'soft highlight'],
    what: 'Light colour on the parts that light would hit: tops, ridges and raised muscles.',
    when: 'After shading and layering, brightest last.',
    brush: 'Small brush; use the side of the bristles for broader highlights.',
    thinning: 'Thin; several thin coats for smooth transitions.',
    mistakes: ['Highlighting everything the same: think about where the light comes from (usually above).'],
  },
  {
    id: 'edge highlight', name: 'Edge highlighting', aliases: ['edge', 'dot highlight', 'fine highlight', 'spot highlight', 'line highlight'],
    what: 'A thin line of light colour along sharp edges, or dots on corners and tips.',
    when: 'Near the end, on armour plates, weapon casings and hard edges.',
    brush: 'Small detail brush, or the side of a small brush pulled along the edge.',
    thinning: 'Thin but not watery; too thin and it spreads, too thick and it is lumpy.',
    mistakes: ['Lines that are too wide.', 'Missing edges: turn the model and check every side.'],
  },
  {
    id: 'drybrush', name: 'Drybrushing', aliases: ['dry brush', 'dry-brush', 'overbrush'],
    what: 'A brush with almost no paint flicked over textured areas so only the raised details catch colour.',
    when: 'On fur, chainmail, rough stone, bases and texture. Great for speed.',
    brush: 'An old, stiff or dedicated drybrush; round makeup-style drybrushes work well.',
    thinning: 'No thinning: wipe the brush on a towel until almost nothing comes off.',
    mistakes: ['Too much paint on the brush: it leaves streaks.', 'Using it on smooth panels: it looks chalky.'],
  },
  {
    id: 'glaze', name: 'Glazing', aliases: ['glazes', 'filter', 'tint'],
    what: 'A very thin, transparent coat that tints an area or smooths the joins between layers.',
    when: 'Over layers and highlights to blend them, or to change the colour tone of an area.',
    brush: 'Medium brush, mostly dry.',
    thinning: 'Very thin: mostly water or medium, with a little paint.',
    mistakes: ['Too much paint: it becomes a layer and hides the work below.', 'Pooling: remove excess from the brush first.'],
  },
  {
    id: 'wetblend', name: 'Wet blending', aliases: ['wet blend', 'blend', 'blending', 'two-brush blend', 'feathering'],
    what: 'Mixing two colours on the model while both are still wet, for a smooth gradient.',
    when: 'On cloaks, large panels and skin, when you want smooth transitions.',
    brush: 'Medium brush; some painters use a second damp brush to soften the join.',
    thinning: 'Slightly thinner than a basecoat; add a retarder or drying medium to work longer.',
    mistakes: ['Working too slowly: the paint dries before it blends.', 'Too much water: the colours run into each other.'],
  },
  {
    id: 'stipple', name: 'Stippling', aliases: ['stippling', 'dab'],
    what: 'Dabbing paint on with the tip of the brush to build up a mottled texture.',
    when: 'For skin texture, rust, weathering and grainy surfaces.',
    brush: 'An old or stiff brush.',
    thinning: 'Little or no thinning.',
    mistakes: ['Dragging the brush instead of dabbing.'],
  },
  {
    id: 'sponge', name: 'Sponge chipping', aliases: ['chipping', 'sponging', 'chips', 'battle damage'],
    what: 'Dabbing paint with a bit of foam to make chipped paint and scratches.',
    when: 'On vehicles and armour, after the main colours and before washes or weathering.',
    brush: 'Blister-pack foam; a small brush to paint a few chips by hand.',
    thinning: 'Dab most paint off the sponge on a towel first.',
    mistakes: ['Too much paint or too many chips: less is more.', 'Chips in places that would not be hit.'],
  },
  {
    id: 'details', name: 'Details', aliases: ['detail', 'eyes', 'lenses', 'gems'],
    what: 'Small parts like eyes, lenses, gems, purity seals and pouches.',
    when: 'After the main areas, before varnish and base rim.',
    brush: 'Fine detail brush with a sharp point.',
    thinning: 'Thin, with the brush wiped to a point.',
    mistakes: ['A brush that has lost its point.', 'Painting details before the big areas around them.'],
  },
  {
    id: 'freehand', name: 'Freehand', aliases: ['free hand', 'decals', 'transfers'],
    what: 'Patterns, symbols and text painted by hand on flat areas such as banners and shoulder pads.',
    when: 'After the area is fully painted and highlighted.',
    brush: 'Fine detail brush.',
    thinning: 'Thin; sketch with a light colour first, then refine.',
    mistakes: ['Starting with the final colour: sketch first.', 'Not planning: practise on paper.'],
  },
  {
    id: 'weathering', name: 'Weathering', aliases: ['mud', 'rust', 'streaking', 'pigments', 'dirt'],
    what: 'Mud, rust, dust and streaks that make a model look used.',
    when: 'At the end, before or after varnish depending on the products (pigments go on after).',
    brush: 'Old brush, sponge or stippling brush.',
    thinning: 'Varies: washes for streaks, thick texture paints for mud.',
    mistakes: ['Weathering evenly everywhere: dirt gathers low down and in corners.'],
  },
  {
    id: 'basing', name: 'Basing', aliases: ['rim', 'base rim', 'texture', 'bases'],
    what: 'Texture, colour and tufts on the base, then a neat rim.',
    when: 'Last, so drips on the base do not matter. See the Bases guide for recipes.',
    brush: 'Old brush for texture, drybrush for highlights, medium brush for the rim.',
    thinning: 'Texture paints straight from the pot.',
    mistakes: ['Forgetting the rim: a clean rim makes the whole model look finished.'],
  },
  {
    id: 'varnish', name: 'Varnishing', aliases: ['varnish', 'matt varnish', 'gloss varnish', 'lacquer'],
    what: 'A clear coat that protects the paint from handling.',
    when: 'When everything is dry. Gloss on gems and wet effects after a matt coat.',
    brush: 'Spray can or airbrush; a brush for small gloss areas.',
    thinning: 'As the product says.',
    mistakes: ['Spraying in humid weather: the varnish frosts white.', 'Varnishing before paint is fully dry.'],
  },
]

export const TECHNIQUES_GUIDE: Technique[] = BASE.map((t) => ({ ...t, detail: TECHNIQUE_DETAILS[t.id] }))

const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()

/** The guide for a technique written in a recipe step, if there is one. */
export function techniqueFor(value: string): Technique | undefined {
  const v = norm(value)
  if (!v) return undefined
  return TECHNIQUES_GUIDE.find((t) => norm(t.id) === v || norm(t.name) === v || t.aliases.some((a) => norm(a) === v))
}

/** A YouTube search for tutorials on a technique. */
export const videoSearch = (t: Technique) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${t.name} miniature painting tutorial`)}`

export interface GuideSection { title: string; points: string[] }

/** Getting started: the order of work and the basics, in our own words. */
export const GETTING_STARTED: GuideSection[] = [
  { title: 'Before painting', points: [
    'Clip parts with sprue cutters, then scrape mould lines off with a hobby knife.',
    'Wash resin parts in warm soapy water so paint sticks.',
    'Leave parts that hide others (shields, cloaks, riders) off the model: paint them as sub-assemblies and glue them at the end.',
    'Glue the model to a cork or holder so you never touch the paint.',
  ] },
  { title: 'The order of work', points: [
    'Prime → basecoat → shade → layers and highlights → details → base → varnish.',
    'Inside to outside: paint what is hard to reach first (skin, under-suits), then the armour on top.',
    'Big areas before small ones; metals and messy techniques (drybrush) before neat areas.',
    'Finish the base and rim last, then varnish.',
  ] },
  { title: 'Thinning paint', points: [
    'Put paint on a palette (a wet palette keeps it fresh for hours), never paint straight from the pot.',
    'Add water a drop at a time; aim for milk for basecoats and thinner for layers and glazes.',
    'Two thin coats always look better than one thick coat.',
  ] },
  { title: 'Brushes', points: [
    'Three brushes are enough to start: a large for basecoats, a medium, and a small detail brush. Keep an old one for drybrushing.',
    'Keep paint off the metal ferrule; rinse often and reshape the point.',
    'Clean them with brush soap after each session and store them tip up.',
  ] },
  { title: 'Light and contrast', points: [
    'Light comes from above: tops get highlights, undersides stay dark.',
    'Strong contrast between colours reads better at arm’s length on the table.',
    'Check your model from a distance; tiny flaws disappear, missing highlights do not.',
  ] },
]
