import type { TourStep } from './tourTarget'

/**
 * Guided tours of the welcome guide (#168), over the demo collection. Steps with `before` act out a real flow
 * (open a dialog, type, press Save, start a game…); the database drops every write meanwhile, so nothing is kept.
 */
export type TourName = 'units' | 'paints' | 'workshop' | 'armies' | 'more'

const css = (s: string) => ({ css: s })
const text = (s: string) => ({ text: s })

export const TOURS: Record<TourName, { name: string; steps: TourStep[] }> = {
  units: {
    name: 'Your units',
    steps: [
      { page: 'backlog', target: text('Backlog'), title: 'The Backlog', text: 'Your whole collection: every unit you own or want. This is a demo collection; your own data is safe and comes back when the tour ends.' },
      { page: 'backlog', target: css('[aria-label="Summary"]'), title: 'Progress at a glance', text: 'How many models are at each painting stage, and how much of the pile is painted.' },
      { page: 'backlog', target: css('[aria-label="Units"], table'), title: 'One row per unit', text: 'Each unit shows its models by stage. A unit can have models at different stages: 5 painted, 5 still built.' },
      { page: 'backlog', target: css('[aria-label="Filters"]'), title: 'Filters', text: 'Narrow the list by faction, stage, tag or text. The game picker at the top of the menu narrows it to one game.' },
      { page: 'backlog', target: text('+ Add unit'), title: 'Let\'s add a unit', text: 'Watch: the tour adds a squad of Hellblasters, step by step.' },
      { page: 'backlog', before: [{ click: text('+ Add unit') }], target: text('Faction'), title: 'Pick the faction…', text: 'With a catalogue installed, the faction and unit come from it, with points, stats and wargear. Without one, just type.' },
      { page: 'backlog', before: [{ fill: text('Name'), value: 'Hellblaster Squad' }], target: text('Name'), title: '…and the unit', text: 'Start typing and pick the unit from the list; a name of your own works too.' },
      { page: 'backlog', before: [{ fill: css('dialog[open] input[aria-label="Models"]'), value: '5' }, { pick: css('dialog[open] select[aria-label="Stage"]'), value: 'built' }], target: css('dialog[open] select[aria-label="Stage"]'), title: 'How many, at which stage', text: '5 models, built. Use "+ Add group" when some are at another stage. Wishlisted is for units you still have to buy.' },
      { page: 'backlog', target: text('Save'), title: 'Save', text: 'Scheme, tags, links and notes are optional; you can add them later.' },
      { page: 'backlog', before: [{ click: css('dialog[open] form button.btn-primary, dialog[open] button.btn-primary') }, { wait: 300 }], target: text('Hellblaster Squad'), title: 'There it is', text: 'The new unit is on the Backlog. (In the demo nothing is saved.)' },
      { page: 'backlog', before: [{ click: text('Hellblaster Squad') }], target: css('[aria-label="Unit details"]'), title: 'Unit details', text: 'Click a unit to see it here: models by stage, scheme, cost, photos and history. Double-click opens its full page.' },
      { page: 'backlog', target: text('Move with date'), title: 'Paint progress', text: 'Moving models to the next stage records the date, with a note or a photo: that history feeds your Stats.' },
      { page: 'backlog', before: [{ click: text('▦ Board') }], target: css('main'), title: 'The board', text: 'One column per stage. Drag units along as you paint them.' },
      { page: 'backlog', before: [{ click: text('☰ Table') }], target: text('📷 Scan box'), title: 'Scan a box', text: 'Point the camera at a kit\'s barcode. Teach it once what is inside; next time it tells you what you already own.' },
    ],
  },
  paints: {
    name: 'Paints and schemes',
    steps: [
      { page: 'paints', target: text('Paints'), title: 'Your paints', text: 'Thousands of paints from the main brands. The demo owns a few and has one running low.' },
      { page: 'paints', target: css('[aria-label="Paint stats"]'), title: 'What you have', text: 'Owned, running low and on the wishlist, with what your paints are worth.' },
      { page: 'paints', target: css('[aria-label="Paint filters"]'), title: 'Find a paint', text: 'Filter by brand, type, colour or stage, or search by name.' },
      { page: 'paints', before: [{ fill: css('input[placeholder^="🔍"]'), value: 'Macragge' }], target: css('[aria-label^="Macragge Blue"]'), title: 'Search', text: 'Typing "Macragge" finds Macragge Blue.' },
      { page: 'paints', before: [{ click: css('[aria-label^="Macragge Blue"]') }], target: css('[aria-label="Paint details"]'), title: 'A paint', text: 'Mark it owned, running low or wanted, set how many pots, and see the closest paints in other brands: handy when a shop has no Citadel.' },
      { page: 'schemes', target: text('Schemes'), title: 'Schemes', text: 'Painting recipes step by step: area, technique and paint for each step.' },
      { page: 'schemes', target: css('[aria-label="Scheme filters"]'), title: 'The library', text: 'Hundreds of recipes collected from painting sites, by faction. Start from one and make it yours.' },
      { page: 'schemes', target: text('+ New scheme'), title: 'Your own scheme', text: 'Write your steps, link the scheme to your units, and share it with a link. It shows which of its paints you lack and puts them on the Shopping list.' },
    ],
  },
  workshop: {
    name: 'Workshop',
    steps: [
      { page: 'tools', target: text('Tools'), title: 'Tools', text: 'Brushes, clippers, airbrush… what you own and what you want.' },
      { page: 'tools', target: css('[role="tablist"][aria-label="List"]'), title: 'Owned and wishlist', text: 'Keep a wishlist of tools to buy; ticking one bought moves it to your tools.' },
      { page: 'tools', before: [{ fill: text('Name'), value: 'Hobby knife' }], target: text('Name'), title: 'Add a tool', text: 'Type its name and pick a category: the category suggests maintenance, like changing the blade every month.' },
      { page: 'tools', before: [{ click: text('+ Add') }, { wait: 300 }], target: text('Hobby knife'), title: 'Added', text: 'Each tool keeps its condition, notes and maintenance jobs; jobs that are due show up on top and in the menu.' },
      { page: 'supplies', target: text('Supplies'), title: 'Supplies', text: 'Glue, primer, varnish, basing: how much is left. Liquids track a level (full … empty).' },
      { page: 'supplies', target: text('Plastic glue'), title: 'Running low', text: 'Set an alert level: when a supply drops to it, it is flagged and goes on the Shopping list in one click.' },
      { page: 'storage', target: text('Storage'), title: 'Storage', text: 'Boxes, cases and shelves: where each model is.' },
      { page: 'storage', before: [{ click: text('+ Add place') }, { fill: text('Name'), value: 'Box 1' }, { fill: text('Location'), value: 'Study, shelf 2' }], target: css('input[aria-label="Name"]'), title: 'Add a place', text: 'A box, a bag, a shelf: name it and say where it is. Slots help with foam trays.' },
      { page: 'storage', before: [{ click: text('Save') }, { wait: 300 }], target: text('Box 1'), title: 'Put units in it', text: 'Store units in places from here or from the unit; print QR labels and scan a box to see what is inside.' },
    ],
  },
  armies: {
    name: 'Armies and games',
    steps: [
      { page: 'armies', target: text('Armies'), title: 'Army lists', text: 'Lists built from the catalogue, with points and rules checks. They show which units you own and make a buy list for the rest. (They need a catalogue: download one in Settings › Catalogue data.)' },
      { page: 'armies', needsCatalogue: true, before: [{ click: text('+ New list') }, { fill: css('input[placeholder^="e.g."]'), value: 'Strike force 2000' }], target: css('[aria-label="New list"]'), title: 'A new list', text: 'Name it, pick the game, faction and size. "Start with all the units I own" fills it from your collection.' },
      { page: 'games', target: text('Games'), title: 'Games', text: 'Play a game with your list. Let\'s run one.' },
      { page: 'games', before: [{ click: text('▶ New game') }, { fill: text('Opponent'), value: 'Alex' }], target: css('[aria-label="New game"]'), title: 'Set it up', text: 'Your list, your opponent and their faction (or read their list from a QR code), mission, deployment, and who goes first: draw them at random with 🎲.' },
      { page: 'games', before: [{ click: text('▶ Start game') }, { wait: 300 }], target: css('[aria-label="Live game"]'), title: 'Playing', text: 'Round and turn, both sides\' scores and command points.' },
      { page: 'games', before: [{ click: css('[aria-label="Me primary +5"]') }], target: css('[aria-label="Me total"]'), title: 'Score', text: 'Primary and secondary points per round: +1, +5, or type them. Units destroyed are counted too.' },
      { page: 'games', target: text('🎲 Dice'), title: 'Dice', text: '3D dice with hits, wounds and saves in one go, a roll-off, and a coin flip.' },
      { page: 'games', before: [{ click: text('Next turn ▶') }], target: css('[aria-label="Live game"] [role="status"]'), title: 'Next turn', text: 'Turns and rounds move on; command points are added for you.' },
      { page: 'games', target: css('[aria-label="Score by round"]'), title: 'Round by round', text: 'The score of every round, kept with the game.' },
      { page: 'games', before: [{ click: text('End game') }], target: css('[aria-label="End game"]'), title: 'End the game', text: 'Add notes and photos, then save: the game goes into your history and your units\' records.' },
      { page: 'stats', target: text('Stats'), title: 'Stats', text: 'Painting progress over time, the pile, hours painted, money spent, games won.' },
    ],
  },
  more: {
    name: 'Everything else',
    steps: [
      { page: 'home', target: text('Home'), title: 'Home', text: 'Your pile, recent progress, what to paint next, shopping and goals at a glance. Rearrange or hide its cards.' },
      { page: 'browse', target: text('Catalogue'), title: 'Catalogue', text: 'Every unit of your games with points, stats, weapons and abilities. Add a unit to the Backlog or the Shopping list from here.' },
      { page: 'rules', target: text('Rules'), title: 'Rules', text: 'Core and faction rules with their text, and which units have them.' },
      { page: 'shopping', target: text('Shopping'), title: 'Shopping', text: 'Kits, paints, tools and supplies to buy, from lists, schemes and running-low alerts. Tick them bought and they move into your collection.' },
      { page: 'goals', target: text('Goals'), title: 'Goals', text: 'Set targets like "paint 20 models this month" or "finish the Intercessors" and follow them.' },
      { page: 'companion', title: 'Companion', text: 'A painting timer for the desk: track hours per unit, with steps from the unit\'s scheme.' },
      { page: 'sync', target: text('Sync'), title: 'Sync', text: 'Keep your phone, browser and computer in step: by pairing code, QR codes or a sync file. No account, no cloud.' },
      { page: 'settings', title: 'Settings', text: 'Catalogues, appearance and text size, painting stages, backups. The welcome guide is in Settings › Appearance whenever you want it again.' },
    ],
  },
}
