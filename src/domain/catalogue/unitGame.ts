import type { OwnedUnit } from '../collection/types'
import { EDITIONS, gameOfRepo, type GameId } from './editions'
import type { Catalogue } from './types'

/** "All games" or one game: what the game picker in the menu shows. */
export type GameFilter = GameId | 'all'

/** Faction and datasheet ids (and faction names, for older free-text units) → the game of the catalogue they come from. */
export function gameIndex(catalogues: Catalogue[]): Map<string, GameId> {
  const index = new Map<string, GameId>()
  for (const c of catalogues) {
    const g = gameOfRepo(c.source.repo)
    for (const f of c.factions) {
      index.set(f.id, g)
      index.set(`name:${f.name}`, g)
    }
    for (const d of c.datasheets) index.set(d.id, g)
  }
  return index
}

/** The game a unit belongs to, or undefined when no installed catalogue knows it. */
export function gameOfUnit(u: OwnedUnit, index: Map<string, GameId>): GameId | undefined {
  return (u.datasheetId && index.get(u.datasheetId)) || (u.factionId && index.get(u.factionId)) || (u.factionName ? index.get(`name:${u.factionName}`) : undefined) || undefined
}

/** Units of one game ("all" keeps every unit, also those no catalogue knows). */
export function unitsOfGame(units: OwnedUnit[], catalogues: Catalogue[], game: GameFilter): OwnedUnit[] {
  if (game === 'all') return units
  const index = gameIndex(catalogues)
  return units.filter((u) => gameOfUnit(u, index) === game)
}

/** The game of an army list, from its edition. */
export const gameOfEdition = (edition: string): GameId => EDITIONS.find((e) => e.key === edition)?.game ?? '40k'

/** Games with at least one installed catalogue, in menu order. */
export function installedGames(catalogues: Catalogue[]): GameId[] {
  const have = new Set(catalogues.map((c) => gameOfRepo(c.source.repo)))
  return [...new Set(EDITIONS.map((e) => e.game))].filter((g) => have.has(g))
}
