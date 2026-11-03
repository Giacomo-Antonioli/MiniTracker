import type { SchemeStep } from '../schemes/types'

/** A basing recipe for the Bases guide. */
export interface BaseRecipe {
  id: string
  name: string
  /** Terrain types, e.g. sand, rocks, snow. */
  kinds: string[]
  factionName?: string
  /** 'minitracker' = written for MiniTracker; 'community' = from a credited source. */
  origin: 'minitracker' | 'community'
  source?: { title: string; url: string; author?: string }
  /** The scheme this base comes from, when it is the base area of a library scheme. */
  schemeId?: string
  steps: SchemeStep[]
}

/** Terrain types and the words that point to them. */
export const BASE_KINDS: [string, RegExp][] = [
  ['sand', /\b(sand|desert|dunes?|armageddon dust|zandri)\b/i],
  ['soil', /\b(soil|earth|dirt|ground|stirland|plains?)\b/i],
  ['mud', /\b(mud|swamp|bog|puddles?)\b/i],
  ['rocks', /\b(rocks?|stones?|slate|cork|astrogranite)\b/i],
  ['grass', /\b(grass|tufts?|static|moss|undergrowth)\b/i],
  ['snow', /\b(snowy?|icy|ice|frozen|frost|blizzard|winter|tundra)\b/i],
  ['lava', /\b(lava|magma|fire|molten)\b/i],
  ['urban', /\b(urban|rubble|ruins?|bricks?|city|debris|tiles?|grates?)\b/i],
  ['mars', /\b(mars|martian|red earth|cracked|ironearth)\b/i],
  ['ash', /\b(ash|ashen|wastes?)\b/i],
]

/** Terrain types found in a base's name and step text. */
export function baseKinds(text: string): string[] {
  return BASE_KINDS.filter(([, re]) => re.test(text)).map(([k]) => k)
}

/** Bases matching a kind and a search text (name or faction). */
export function filterBases(bases: BaseRecipe[], kind: string, text: string): BaseRecipe[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  return bases.filter((b) => (!kind || b.kinds.includes(kind)) && words.every((w) => `${b.name} ${b.factionName ?? ''} ${b.kinds.join(' ')}`.toLowerCase().includes(w)))
}
