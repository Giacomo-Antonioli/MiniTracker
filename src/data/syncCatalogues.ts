/** Catalogues over a sync (the catalogue phase of syncSession): the sender lists them, the receiver asks for the missing or newer ones. */
import type { Catalogue } from '../domain/catalogue/types'
import { buildBundle, readBundle } from './catalogue/bundle'
import type { MiniTrackerDb } from './db'

export interface CatalogueInfo {
  gameId: string
  fetchedAt: string
}

export const catalogueInfos = (list: Catalogue[]): CatalogueInfo[] => list.map((c) => ({ gameId: c.gameId, fetchedAt: c.source.fetchedAt }))

/** Ids of the offered catalogues this device lacks or has an older download of. */
export function wantedCatalogues(offered: CatalogueInfo[], mine: CatalogueInfo[]): string[] {
  const have = new Map(mine.map((c) => [c.gameId, Date.parse(c.fetchedAt) || 0]))
  return offered.filter((o) => !have.has(o.gameId) || (Date.parse(o.fetchedAt) || 0) > have.get(o.gameId)!).map((o) => o.gameId)
}

async function toBase64(bytes: Uint8Array): Promise<string> {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** One catalogue as text for the channel (compressed). */
export async function catalogueToWire(db: MiniTrackerDb, gameId: string): Promise<string | undefined> {
  const c = await db.catalogues.get(gameId)
  return c ? toBase64(await buildBundle([c], new Date().toISOString())) : undefined
}

export async function catalogueFromWire(text: string): Promise<Catalogue[]> {
  const found = await readBundle(Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0)))
  if (!found) throw new Error('The other device sent a catalogue this version cannot read')
  return found
}
