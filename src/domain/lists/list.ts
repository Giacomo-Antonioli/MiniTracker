import type { Ctx } from '../collection/types'
import type { ArmyList, ListEntry } from './types'

export type NewList = Pick<ArmyList, 'name' | 'edition' | 'battleSize' | 'pointsLimit'> & Partial<Pick<ArmyList, 'factionId' | 'status' | 'notes' | 'detachmentIds'>>

/** Throws a user-readable error if the list can't be stored. Rule problems are NOT errors (see #56). */
export function validateList(l: ArmyList): void {
  if (!l.name.trim()) throw new Error('A list needs a name')
  if (!Number.isInteger(l.pointsLimit) || l.pointsLimit < 0) throw new Error('Points limit must be a whole number, 0 or more')
  const ids = new Set<string>()
  for (const e of l.entries) {
    if (ids.has(e.id)) throw new Error(`Duplicate entry id: ${e.id}`)
    ids.add(e.id)
    if (!Number.isInteger(e.models) || e.models < 1) throw new Error('A unit needs at least 1 model')
  }
  for (const e of l.entries) {
    if (e.attachedTo && (e.attachedTo === e.id || !ids.has(e.attachedTo))) throw new Error('A leader is attached to a unit that is not in the list')
  }
}

export function createList(input: NewList, ctx: Ctx): ArmyList {
  const l: ArmyList = { status: 'planned', notes: '', ...input, id: ctx.newId(), entries: [], createdAt: ctx.now, updatedAt: ctx.now }
  validateList(l)
  return l
}

export function addEntry(l: ArmyList, e: Omit<ListEntry, 'id' | 'wargear'> & { wargear?: string[] }, ctx: Ctx): ArmyList {
  const out = { ...l, entries: [...l.entries, { wargear: [], ...e, id: ctx.newId() }], updatedAt: ctx.now }
  validateList(out)
  return out
}

export function updateEntry(l: ArmyList, id: string, patch: Partial<Omit<ListEntry, 'id'>>, ctx: Ctx): ArmyList {
  if (!l.entries.some((e) => e.id === id)) throw new Error(`Unknown entry: ${id}`)
  const out = { ...l, entries: l.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)), updatedAt: ctx.now }
  validateList(out)
  return out
}

/** Removes an entry; leaders attached to it become unattached. */
export function removeEntry(l: ArmyList, id: string, ctx: Ctx): ArmyList {
  const entries = l.entries
    .filter((e) => e.id !== id)
    .map((e) => {
      if (e.attachedTo !== id) return e
      const { attachedTo: _, ...rest } = e
      return rest
    })
  return { ...l, entries, updatedAt: ctx.now }
}
