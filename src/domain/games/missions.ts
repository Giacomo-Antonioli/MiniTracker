/**
 * Mission cards (#194): names from the Chapter Approved 2026-27 mission deck (11th edition), no rules text.
 * Each player picks a Force Disposition; the pair gives each player's Primary Mission.
 */
export const MISSION_PACK = 'Chapter Approved 2026-27'

export const DISPOSITIONS = ['Take and Hold', 'Purge the Foe', 'Disruption', 'Reconnaissance', 'Priority Assets'] as const
export type Disposition = (typeof DISPOSITIONS)[number]

/** PRIMARY[mine][theirs]: the Primary Mission I play. */
export const PRIMARY: Record<Disposition, Record<Disposition, string>> = {
  'Take and Hold': { 'Take and Hold': 'Battlefield Dominance', 'Purge the Foe': 'Immovable Object', Disruption: 'Determined Acquisition', Reconnaissance: 'Purge and Secure', 'Priority Assets': 'Inescapable Dominion' },
  'Purge the Foe': { 'Take and Hold': 'Unstoppable Force', 'Purge the Foe': 'Meatgrinder', Disruption: 'Punishment', Reconnaissance: 'Consecrate', 'Priority Assets': "Destroyer's Wrath" },
  Disruption: { 'Take and Hold': 'Death Trap', 'Purge the Foe': 'Delaying Action', Disruption: 'Outmanoeuvre', Reconnaissance: 'Smoke and Mirrors', 'Priority Assets': 'Locate and Deny' },
  Reconnaissance: { 'Take and Hold': 'Reconnaissance Sweep', 'Purge the Foe': 'Triangulation', Disruption: 'Surveil the Foe', Reconnaissance: 'Gather Intel', 'Priority Assets': 'Search and Scour' },
  'Priority Assets': { 'Take and Hold': 'Secure Asset', 'Purge the Foe': 'Vital Link', Disruption: 'Extract Relic', Reconnaissance: 'Vanguard Operation', 'Priority Assets': 'Sabotage' },
}

export const DEPLOYMENTS = ['Tipping Point', 'Sweeping Engagement', 'Search and Destroy', 'Hammer and Anvil', 'Dawn of War', 'Crucible of Battle'] as const
export const TWISTS = ['Nowhere to Hide', 'Mirrored World', 'Scrambled Communications', 'Martial Pride', 'Ruinscape', 'Night Fighting'] as const

/** Every Primary Mission name, for suggestions. */
export const PRIMARIES = DISPOSITIONS.flatMap((a) => DISPOSITIONS.map((b) => PRIMARY[a][b]))

export const isDisposition = (s?: string): s is Disposition => !!s && (DISPOSITIONS as readonly string[]).includes(s)

/** Both players' Primary Missions from their dispositions. */
export const primaries = (mine: Disposition, theirs: Disposition) => ({ me: PRIMARY[mine][theirs], them: PRIMARY[theirs][mine] })

/** Draw one card at random, like from the deck. */
export const draw = <T>(cards: readonly T[], random: () => number = Math.random): T => cards[Math.min(cards.length - 1, Math.floor(random() * cards.length))]
