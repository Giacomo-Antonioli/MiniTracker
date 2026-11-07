import type { TourStep } from './tourTarget'

/** Guided tours of the welcome guide's steps 5–8 (#168), shown over the demo collection. */
export const TOURS: Record<'units' | 'paints' | 'workshop' | 'armies', { name: string; steps: TourStep[] }> = {
  units: {
    name: 'Your units',
    steps: [
      { page: 'backlog', target: { text: 'Backlog' }, title: 'The Backlog', text: 'Your whole collection: every unit you own or want. This is a demo collection; your own data is safe and comes back when the tour ends.' },
      { page: 'backlog', target: { css: '[aria-label="Summary"]' }, title: 'Progress at a glance', text: 'How many models are at each painting stage, and how much of the pile is painted.' },
      { page: 'backlog', target: { css: '[aria-label="Units"], table' }, title: 'One row per unit', text: 'Each unit shows its models by stage. Click a unit to see it on the right; double-click to open its page with photos, history and scheme.' },
      { page: 'backlog', target: { text: '+ Add unit' }, title: 'Add a unit', text: 'Pick it from the catalogue (or type a name) and say how many models are on sprue, built, painted… Start at Wishlisted for units you still have to buy.' },
      { page: 'backlog', target: { text: '📷 Scan box' }, title: 'Scan a box', text: 'Point the camera at a kit\'s barcode. Teach it once what is inside; next time it tells you what you already own.' },
      { page: 'backlog', target: { css: '[aria-label="Filters"]' }, title: 'Filters', text: 'Narrow the list by faction, stage, tag or text. The game picker at the top of the menu narrows it to one game.' },
      { page: 'backlog', target: { css: '[aria-label="Backlog view"]' }, title: 'Table or board', text: 'The board shows one column per stage: drag units along as you paint them.' },
    ],
  },
  paints: {
    name: 'Paints and schemes',
    steps: [
      { page: 'paints', target: { text: 'Paints' }, title: 'Your paints', text: 'Thousands of paints from the main brands. The demo has a few marked as owned and one running low.' },
      { page: 'paints', target: { css: '[aria-label="Paint stats"]' }, title: 'What you have', text: 'Owned, running low and on the wishlist, with what your paints are worth.' },
      { page: 'paints', target: { css: '[aria-label="Paint filters"]' }, title: 'Find a paint', text: 'Filter by brand, type, colour or stage. Click a paint to mark it owned, low or wanted, and to find the closest match in other brands.' },
      { page: 'schemes', target: { text: 'Schemes' }, title: 'Schemes', text: 'Painting recipes step by step. Start from the library or write your own; a scheme shows which of its paints you lack and puts them on the Shopping list.' },
      { page: 'schemes', target: { text: '+ New scheme' }, title: 'Your own scheme', text: 'Add steps (area, technique, paint), link it to your units, and share it with a link.' },
    ],
  },
  workshop: {
    name: 'Workshop',
    steps: [
      { page: 'tools', target: { text: 'Tools' }, title: 'Tools', text: 'Brushes, clippers, airbrush… what you own and what you want, with condition and maintenance jobs.' },
      { page: 'tools', target: { text: '+ Add' }, title: 'Add a tool', text: 'Give it a category to get maintenance suggestions, like cleaning the airbrush every two weeks.' },
      { page: 'supplies', target: { text: 'Supplies' }, title: 'Supplies', text: 'Glue, primer, varnish, basing: how much is left. When one runs low it is flagged and can go on the Shopping list.' },
      { page: 'storage', target: { text: 'Storage' }, title: 'Storage', text: 'Boxes, cases and shelves. Put units in places to know where every model is, and print QR labels to scan later.' },
      { page: 'storage', target: { text: '+ Add place' }, title: 'Add a place', text: 'A box, a bag, a shelf: give it a name and where it is.' },
    ],
  },
  armies: {
    name: 'Armies and games',
    steps: [
      { page: 'armies', target: { text: 'Armies' }, title: 'Army lists', text: 'Build lists from the catalogue with points and rules checks. It shows which units you own and makes a buy list for the rest.' },
      { page: 'armies', target: { text: '+ New list' }, title: 'New list', text: 'Pick the game, faction and size; "Start with all the units I own" fills it from your collection.' },
      { page: 'games', target: { text: 'Games' }, title: 'Games', text: 'Play a game: missions, roll-off, 3D dice, scores and photos. Read your opponent\'s list from their QR code.' },
      { page: 'stats', title: 'Stats and Goals', text: 'Your painting progress over time, and goals like "paint 20 models this month" to keep going.' },
    ],
  },
}
