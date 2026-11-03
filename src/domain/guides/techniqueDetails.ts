/**
 * In-depth "how to" for each technique. Each one merges what three or more published guides agree on,
 * rewritten in our own words; the guides are linked as sources. Diagrams are drawn by MiniTracker.
 */

export type DiagramId = 'light' | 'consistency' | 'wash' | 'layers' | 'edge' | 'drybrush' | 'glaze' | 'blend' | 'order' | 'spray' | 'varnish' | 'contrast' | 'stipple' | 'chips' | 'lens' | 'freehand' | 'weathering' | 'terrain-steps' | 'grime' | 'army-contrast'

export interface TechniqueDetail {
  /** Step-by-step method. */
  how: string[]
  /** Extra advice from experienced painters. */
  tips: string[]
  sources: { title: string; url: string }[]
  diagram?: DiagramId
}

export const TECHNIQUE_DETAILS: Record<string, TechniqueDetail> = {
  prime: {
    how: [
      'Wash resin and 3D prints in warm soapy water and let them dry; glue the model to a holder.',
      'Shake the can for at least a minute (two is better). If the can is cold, stand it in warm water for a few minutes.',
      'Test on a spare part first: the finish should be smooth and matt, not grainy or shiny.',
      'Hold the can about 25–30 cm away and spray in short passes that start and finish off the model.',
      'Turn the model and cover it from every side, including underneath, in two or three light coats.',
      'Let it dry fully (at least an hour, ideally overnight) before painting.',
    ],
    tips: [
      'Best conditions: 15–25 °C and 40–60 % humidity. Heat makes primer dry in the air and turn powdery; humidity makes it tacky or rough.',
      'Keep the model and the can at the same temperature as the air you spray in: a cold can in warm, damp air causes condensation.',
      'Grainy finish? You were too far away or it was too hot. Pooling or lost detail? Too close or too much at once.',
      'A brush-on primer is a good fix for spots the spray missed.',
    ],
    sources: [
      { title: 'The Army Painter: Prime your miniature in 6 easy steps', url: 'https://thearmypainter.com/blogs/explore/using-colour-primers' },
      { title: 'Golden Goblin Games: Priming your miniatures', url: 'https://goldengoblingames.com/painting-guide-priming' },
      { title: 'Spikey Bits: Hobby basics, priming 101', url: 'https://spikeybits.com/hobby-basics-priming-101/' },
    ],
    diagram: 'spray',
  },
  zenithal: {
    how: [
      'Prime the whole model black (or a very dark colour) and let it dry.',
      'Optional: spray grey from about 45° above, all around, to make a mid-tone.',
      'Spray white (or a light grey) from directly above in short bursts, so only the top-facing surfaces catch it.',
      'Check under a lamp: tops should be bright, sides mid-tone, undersides still dark.',
      'Paint over it with thin or translucent paints (Contrast, glazes, airbrush colours) so the light and shadow show through.',
    ],
    tips: [
      'No airbrush? Rattle cans work, they are just harder to aim. You can also fake it with a heavy white drybrush over black.',
      'The zenithal is a map of where light falls: use it to decide where to put highlights later, even if you cover it.',
      'Use a matt primer for every layer; gloss or satin makes the next paints slide off.',
    ],
    sources: [
      { title: 'The Army Painter: How to paint with a zenithal prime', url: 'https://thearmypainter.com/blogs/explore/zenithal-priming' },
      { title: 'Age of Miniatures: Zenithal highlight techniques', url: 'https://ageofminiatures.com/zenithal-highlight-techniques-for-miniatures/' },
      { title: 'Board Game Quest: Zenithal priming', url: 'https://boardgamequest.com/how-to-quickly-paint-board-game-miniatures-part-2-zenithal-priming' },
    ],
    diagram: 'light',
  },
  basecoat: {
    how: [
      'Put a little paint on a (wet) palette and add water a drop at a time until it flows like milk or thin cream.',
      'Load only the front half of the bristles, then touch off the excess on the palette.',
      'Paint the first coat; it can look patchy. Let it dry completely.',
      'Paint a second thin coat for an even, opaque colour. Very light colours (yellow, white) may need a third.',
      'Work from inside to outside and from big areas to small ones, tidying mistakes as you go.',
    ],
    tips: [
      'Test the consistency by drawing a line on the palette: it should flow smoothly without beading or running.',
      'Different brands need different amounts of water: Citadel bases often take 1:1, others less. Test each pot.',
      'Too much water makes paint lose colour and creep into places you did not want; too little leaves brush marks and fills detail.',
      'A wet palette keeps paint at the same consistency for the whole session.',
    ],
    sources: [
      { title: 'The Army Painter: How to paint a miniature', url: 'https://thearmypainter.com/blogs/explore/how-to-paint-a-miniature' },
      { title: 'Age of Miniatures: How to thin paints for miniatures', url: 'https://ageofminiatures.com/how-to-thin-paints-miniatures/' },
      { title: 'Wheels & Wings Hobbies: How to thin acrylic paint', url: 'https://wheelswingshobbies.com/blog/how-to-thin-acrylic-paint-for-miniatures-and-scale-models/' },
    ],
    diagram: 'consistency',
  },
  contrast: {
    how: [
      'Prime white, light grey, bone (e.g. Wraithbone / Grey Seer) or zenithal; over black the paint almost disappears.',
      'Shake the pot well. Load a medium brush generously.',
      'Flood one area at a time in a single coat, pulling the paint down so it collects in recesses.',
      'If a puddle forms, rinse and dry the brush and touch it to the puddle to soak it up.',
      'Leave it alone once it starts to settle; it looks blotchy while wet and evens out as it dries.',
      'Add highlights afterwards with normal paints if you want more contrast.',
    ],
    tips: [
      'Mix with Contrast Medium (up to 50/50) for lighter, smoother results and fewer pools on flat panels.',
      'Paint neighbouring areas only when the first is dry, or the colours bleed into each other.',
      'Thinned with medium, Contrast paints make excellent glazes.',
      '"Slapchop" / sketch-and-glaze: zenithal or drybrush first, then Contrast over it for fast, bright results.',
    ],
    sources: [
      { title: 'Access Models: Citadel Contrast paints, beginner\'s guide', url: 'https://accessmodels.co.uk/blogs/hobby-guide/citadel-contrast-paints-the-complete-beginners-guide' },
      { title: 'Golden Goblin Games: Using the Citadel Contrast method', url: 'https://goldengoblingames.com/painting-guide-using-the-citadel-contrast-method' },
      { title: 'Wargamer: Contrast paint', url: 'https://www.wargamer.com/warhammer-40k/contrast-paint' },
    ],
    diagram: 'contrast',
  },
  shade: {
    how: [
      'Make sure the basecoat is completely dry.',
      'Load the brush, then wipe a little off on the pot rim so it is not dripping.',
      'Apply over the area, guiding the shade into recesses and around raised details.',
      'Turn the model under a lamp and look for puddles on flat areas.',
      'Soak up puddles straight away with a clean, damp (not wet) brush.',
      'Let it dry fully before touching it again, then tidy raised areas with the basecoat or a layer.',
    ],
    tips: [
      'Tide marks form when shade dries in a puddle on a flat area. Do not brush over shade that has started to dry.',
      'Work in small sections on large models.',
      'A drop of Lahmian/matt medium or flow improver makes shades spread more evenly.',
      'To fix stains, repaint the basecoat over the area and feather the edges, or cover them with highlights.',
    ],
    sources: [
      { title: 'The Army Painter: Fix my mini, my wash pooled everywhere', url: 'https://thearmypainter.com/blogs/explore/how-to-fix-wash-pooling-on-miniatures' },
      { title: 'Age of Miniatures: How to use washes', url: 'https://ageofminiatures.com/how-to-use-washes-miniatures/' },
      { title: 'Spikey Bits: How to shade wash a miniature', url: 'https://spikeybits.com/how-to-shade-wash-a-miniature-army-painter-tutorial/' },
    ],
    diagram: 'wash',
  },
  'recess shade': {
    how: [
      'Use a small brush with a sharp point.',
      'Load a little shade (or thinned dark paint) and touch the tip to the start of a panel line.',
      'Hold it there and let capillary action pull the liquid along the line; do not drag the brush.',
      'Where it stops, touch it again further along.',
      'Clean any overspill at once with a damp brush, before it dries.',
    ],
    tips: [
      'A gloss varnish under the recess shade helps it flow and makes cleanup easy; matt varnish after.',
      'Do not line every recess on small models: it can look busy. Pick the main panel lines.',
      'Choose a shade that suits the colour (brown on yellow, dark blue on blue), not always black.',
    ],
    sources: [
      { title: 'Spikey Bits: Panel lining for power armour', url: 'https://spikeybits.com/panel-lining-for-power-armor-goobertown-hobbies/' },
      { title: 'Hobbyist Haven: Panel line washing full guide', url: 'https://hobbyisthaven.com/blogs/blog/panel-line-washing-for-gunpla-and-scale-models-full-guide' },
      { title: 'Scale Model Shop: Panel lining for clean results', url: 'https://www.scalemodelshop.co.uk/gunpla-panel-lining-guide-clean-results/' },
    ],
    diagram: 'wash',
  },
  layer: {
    how: [
      'Start from a dry, shaded basecoat.',
      'Mix the first, slightly lighter colour, a bit thinner than the basecoat.',
      'Paint it over the raised parts of the area, leaving the recesses and lower parts in the darker colour.',
      'Let it dry, then add the next lighter colour on a smaller area, closer to where the light hits.',
      'Repeat: each layer covers less than the one before. Two or three layers are usually enough.',
    ],
    tips: [
      'If the step between two colours looks harsh, mix them 1:1 and paint that as an in-between layer.',
      'Several thin coats give smoother results than one opaque coat.',
      'Layering is the base of most other techniques; once you can do it, edge highlights and glazes come easily.',
    ],
    sources: [
      { title: 'Creative Twilight: Layering', url: 'https://creativetwilight.com/layering/' },
      { title: 'The Army Painter: How to paint a miniature', url: 'https://thearmypainter.com/blogs/explore/how-to-paint-a-miniature' },
      { title: 'Brotherwise Games: Stormlight painting guide (PDF)', url: 'https://www.brotherwisegames.com/s/Stormlight-Painting-Guide-05-15-23.pdf' },
    ],
    diagram: 'layers',
  },
  highlight: {
    how: [
      'Decide where the light comes from (usually from above, a little in front) and keep it the same for the whole model.',
      'Hold the model under a lamp to see which surfaces catch the light.',
      'Paint a lighter colour on those surfaces: tops of heads and shoulders, upper muscles, folds of cloth.',
      'Add a brighter, smaller highlight on the very highest points.',
      'Leave the lower and back-facing surfaces darker.',
    ],
    tips: [
      'Surfaces closer to the light get brighter; build that up in two or three steps.',
      'Hard edges facing the light catch a brighter highlight than broad surfaces.',
      'The back of the model can be boring with one light; some painters add a weaker second light behind.',
      'Photograph the model under a lamp before painting to see where light and shadow fall.',
    ],
    sources: [
      { title: 'The Army Painter: Next level highlighting', url: 'https://thearmypainter.com/blogs/explore/next-level-highlighting' },
      { title: 'Creative Twilight: Shading and highlighting', url: 'https://creativetwilight.com/shading-highlighting' },
      { title: 'The Army Painter: Highlighting like a pro', url: 'https://thearmypainter.com/blogs/explore/learn-how-to-highlight-miniatures' },
    ],
    diagram: 'light',
  },
  'edge highlight': {
    how: [
      'Thin the paint slightly; load the brush lightly and wipe off the excess.',
      'Hold the brush almost flat to the edge (about 75° to the surface) and touch the side of the bristles to it.',
      'Drag gently along the edge; light pressure gives a thin line.',
      'On tight spots or corners, use the very tip instead, or add a dot.',
      'Turn the model and check every edge that faces the light.',
    ],
    tips: [
      'Brace your hands together or on the table for a steady line.',
      'A larger brush with a good point holds more paint and gives cleaner lines than a tiny one.',
      'Only highlight edges that face the light; highlighting every edge looks like an outline.',
      'Too wide? Tidy with the base colour while it is still easy.',
    ],
    sources: [
      { title: 'Creative Twilight: Edge highlighting', url: 'https://creativetwilight.com/edge-highlighting/' },
      { title: 'Spikey Bits: Edge highlighting for beginners', url: 'https://spikeybits.com/edge-highlighting-miniatures-for-beginners/' },
      { title: 'Loot Studios: Highlighting techniques you need to know', url: 'https://blog.lootstudios.com/paint/highlighting-painting-techniques-you-need-to-know/' },
    ],
    diagram: 'edge',
  },
  drybrush: {
    how: [
      'Use an old, stiff or dedicated drybrush (never your good brush).',
      'Dip only the tip in paint, then wipe the brush on a paper towel until almost nothing comes off.',
      'Test on your finger or the back of your hand: you should see faint colour, no streaks.',
      'Flick the brush lightly across the texture, at an angle, so only the raised edges catch paint.',
      'Build it up in several light passes; finish with a lighter colour on a smaller area.',
    ],
    tips: [
      'Streaks or pools mean the brush still has too much paint; a bone-dry brush leaves a chalky look.',
      'Best on texture: fur, chainmail, rocks, sand, scales. On smooth panels it looks dusty.',
      'Drybrush before washes and fine details, so stray paint does not ruin finished areas.',
      'Makeup brushes and dedicated round drybrushes work very well and last.',
    ],
    sources: [
      { title: 'Green Stuff World: How to dry brush, complete guide', url: 'https://www.greenstuffworld.com/en/module-blog?id=134' },
      { title: 'The Army Painter: What is drybrushing?', url: 'https://thearmypainter.com/blogs/explore/what-is-drybrushing-miniature-painting' },
      { title: 'Loot Studios: How to drybrush', url: 'https://blog.lootstudios.com/paint/how-to-drybrush/' },
    ],
    diagram: 'drybrush',
  },
  glaze: {
    how: [
      'Mix about 1 part paint to 3 parts glaze/matt medium (or water); adjust until it is clearly see-through.',
      'Test on a scrap or the palette: one coat should only tint, not cover.',
      'Load the brush, then wipe most of it off on a tissue.',
      'Apply a thin coat over the area you want to tint or smooth, never letting it pool.',
      'Let it dry completely, then repeat 2–5 times to build up the effect.',
    ],
    tips: [
      'There is no single ratio: strong pigments and inks need much more medium than weak ones.',
      'Medium keeps the paint together better than water alone; water-only glazes can dry blotchy.',
      'Glazes do not stick well to gloss; work on a matt surface.',
      'Use glazes to unify a model: a single glaze of one colour over several areas ties them together.',
    ],
    sources: [
      { title: 'Red Grass Creative: How to glaze miniatures', url: 'https://www.redgrasscreative.com/how-to-glaze-miniatures/' },
      { title: 'Loot Studios: How to glaze your paintings', url: 'https://blog.lootstudios.com/paint/how-to-glaze-your-painting/' },
      { title: 'Wheels & Wings Hobbies: Three glaze myths', url: 'https://wheelswingshobbies.com/blog/three-glaze-myths-beginners-get-told-and-whats-actually-true/' },
    ],
    diagram: 'glaze',
  },
  wetblend: {
    how: [
      'Pick two colours that are close (e.g. dark and light blue) for your first try.',
      'Add a drop of drying retarder to both on the palette.',
      'Paint the dark colour on its part of the area and the light colour next to it, touching.',
      'While both are wet, work the join back and forth with a clean, damp second brush.',
      'Stop as soon as the transition looks smooth; overworking turns it into one muddy colour.',
    ],
    tips: [
      'Work in small sections: acrylics dry fast.',
      'Keep the paint a little thicker than for layering; very thin paint dries faster.',
      'Keep the blending brush damp with retarder rather than water.',
      'If it dries before you are done, finish the transition with a couple of glazes.',
    ],
    sources: [
      { title: 'Loot Studios: Wet blending', url: 'https://blog.lootstudios.com/paint/painting-technique-wet-blending/' },
      { title: 'Spikey Bits: Wet blending made easy', url: 'https://spikeybits.com/wet-blending-your-miniatures-made-easy/' },
      { title: 'Spikey Bits: Lazy wet blending for bases', url: 'https://spikeybits.com/lazy-wet-blending-method-for-miniatures-bases/' },
    ],
    diagram: 'blend',
  },
  stipple: {
    how: [
      'Basecoat the area first.',
      'Use an old or stiff brush (or a bit of sponge); thin the paint just enough to flow.',
      'Wipe most of the paint off, then dab the tip straight down onto the surface: no strokes.',
      'Start with dots spread out, then make them denser towards the highlights.',
      'Repeat with a lighter colour on a smaller area.',
    ],
    tips: [
      'Great for worn leather, rough skin, freckles, rust, frozen ground and grass.',
      'Faster than glazing for building up texture.',
      'Cheap kitchen sponges work as well as art-store ones, if they are clean.',
    ],
    sources: [
      { title: 'Loot Studios: Stippling, realistic textures', url: 'https://blog.lootstudios.com/paint/exploring-painting-technique-stippling/' },
      { title: 'UrArtStudio: Stippling technique', url: 'https://urartstudio.com/painting-tips/stippling-technique/' },
      { title: 'Creative Twilight: Painting leather', url: 'https://creativetwilight.com/painting-leather-miniatures/' },
    ],
    diagram: 'stipple',
  },
  sponge: {
    how: [
      'Finish the armour colours first.',
      'Tear a small piece of blister-pack foam and hold it in tweezers.',
      'Dip it in a dark brown or metal colour and dab most of it off on a paper towel.',
      'Dab lightly where damage would happen: edges, corners, knees, hatches, around the feet.',
      'For depth, paint a thin lighter line under each big chip (the lit edge of the scratch).',
    ],
    tips: [
      'Less is more: start sparse and add.',
      'Different sponges give different chip sizes; small bits for infantry, bigger for vehicles.',
      'Chipping brushes are an easier alternative if the sponge feels random.',
    ],
    sources: [
      { title: 'Spikey Bits: Paint chipping tutorial', url: 'https://spikeybits.com/weathering-your-models-paint-chipping-tutorial/' },
      { title: 'Camospecs: How to weathering', url: 'https://camospecs.com/articles/how-to/how-to-weathering/' },
      { title: 'The Army Painter: Chipping brushes and weathering', url: 'https://thearmypainter.com/blogs/explore/miniature-chipping-brushes-weathering' },
    ],
    diagram: 'chips',
  },
  details: {
    how: [
      'Leave details until the big areas are finished.',
      'Use a fine brush with a sharp point; thin the paint so it flows but does not run.',
      'Lenses and gems: dark colour all over, then a lighter colour in the lower half, then a white dot in the upper corner.',
      'Eyes on small models: a dark line, then a tiny dot of light colour; do not use pure white.',
      'Finish lenses and gems with a little gloss varnish.',
    ],
    tips: [
      'Put the light dot on the opposite side to where the light falls on the rest of the lens: it reads as a reflection.',
      'If you varnish with matt, do it before the gloss on lenses.',
      'An even smaller brush can help for eyes, but the point matters more than the size.',
    ],
    sources: [
      { title: 'Spikey Bits: Beginner\'s guide to painting lenses', url: 'https://spikeybits.com/fast-easy-beginners-guide-to-painting-lenses/' },
      { title: 'Spikey Bits: Gemstones and lenses', url: 'https://spikeybits.com/gemstones-lenses-learn-to-paint-tutorial/' },
      { title: 'Tale of Painters: How to paint eyes more easily', url: 'https://taleofpainters.com/2021/01/tutorial-how-to-paint-eyes-more-easily-on-your-miniatures/' },
    ],
    diagram: 'lens',
  },
  freehand: {
    how: [
      'Practise the design on paper at the real size first.',
      'Paint the area\'s colour and let it dry.',
      'Sketch the shape with a thin, light colour (or a grey that is close to the base).',
      'Fill it in with the final colour, thin enough to flow (about 2:1 paint to water).',
      'Tidy the edges with the base colour, then add shading and highlights to the design.',
    ],
    tips: [
      'Use raised edges of the shoulder pad to steady the brush.',
      'Break big designs into simple shapes: circles, triangles, lines.',
      'Mistakes are easy to cover with the base colour: freehand is many small corrections.',
    ],
    sources: [
      { title: 'Goonhammer: How to paint everything, freehand', url: 'https://goonhammer.com/how-to-paint-everything-freehand' },
      { title: 'Creative Twilight: Freehand', url: 'https://creativetwilight.com/freehand/' },
      { title: 'Spikey Bits: Black Templars freehand guide', url: 'https://spikeybits.com/nothing-is-impossible-black-templars-freehand-guide/' },
    ],
    diagram: 'freehand',
  },
  weathering: {
    how: [
      'Finish painting the model.',
      'Chips and scratches first (see Sponge chipping).',
      'Streaks: paint a thin line of rust or grime under bolts and edges, then drag it down with a damp brush.',
      'Mud: stipple a mud texture paint on feet, legs and tracks, heaviest lowest down.',
      'Dust and pigments: apply dry pigments with a soft brush at the very end, after varnish.',
    ],
    tips: [
      'Dirt collects low and in corners; rust starts at edges and joints.',
      'Use the base\'s colour for mud and dust so the model sits in its ground.',
      'Look at photos of real vehicles or boots for where wear goes.',
    ],
    sources: [
      { title: 'The Army Painter: Weathering techniques', url: 'https://thearmypainter.com/blogs/explore/learn-how-to-use-weathering-techniques' },
      { title: 'Dakka Dakka: Modelling FAQ, weathering', url: 'https://www.dakkadakka.com/wiki/en/Dakka_Modeling_FAQ:_Weathering' },
      { title: 'Spikey Bits: Rusted and weathered armour', url: 'https://spikeybits.com/rusted-and-weathered-armor-jack-of-clubs-hobby-tutorial/' },
    ],
    diagram: 'weathering',
  },
  basing: {
    how: [
      'Spread texture paint (or PVA and sand/grit) over the base with an old brush or spreader; add rocks or cork.',
      'Let it dry fully.',
      'Shade it, then drybrush one or two lighter colours.',
      'Paint the rim a neat solid colour (black or a dark earth tone).',
      'Glue tufts or static grass last, then a matt varnish over the base.',
    ],
    tips: [
      'Paint the rim before tufts: they often hang over it.',
      'Match the base to where the army fights, and keep it the same across the army.',
      'See the Bases tab for full recipes.',
    ],
    sources: [
      { title: 'The Army Painter: Finishing the miniature\'s base', url: 'https://thearmypainter.com/blogs/explore/finishing-the-miniature-s-base' },
      { title: 'Golden Goblin Games: Basing', url: 'https://www.goldengoblingames.com/painting-guide-basing' },
      { title: 'Fauxhammer: Static grass bases', url: 'https://www.fauxhammer.com/?p=5248' },
    ],
    diagram: 'order',
  },
  varnish: {
    how: [
      'Wait until the paint is fully cured (ideally a day).',
      'Shake the can well; test on a spare model.',
      'Spray from 25–30 cm in light passes, all around, like priming.',
      'For gaming models, some painters use gloss first (tougher) then matt (to remove the shine).',
      'Add gloss by brush on gems, lenses, eyes and wet effects at the end.',
    ],
    tips: [
      'Frosting (a white haze) comes from humidity or paint that has not cured. A coat of gloss can sometimes fix it.',
      'Many "matt" varnishes dry satin: test before the whole army.',
      'Matt varnish dulls metallics; you can re-shine them with a touch of gloss.',
    ],
    sources: [
      { title: 'The Army Painter: Varnishes 101', url: 'https://thearmypainter.com/blogs/explore/paint-like-a-pro-varnishes-101' },
      { title: 'Goonhammer: How to use varnish', url: 'https://goonhammer.com/hobby-101-how-to-use-varnish-with-miniatures' },
      { title: 'Age of Miniatures: Best varnish for miniatures', url: 'https://ageofminiatures.com/best-varnish-for-miniatures/' },
    ],
    diagram: 'varnish',
  },
}
