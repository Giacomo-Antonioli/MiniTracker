/**
 * Storage (#18): nested places (shelf › box › bag…) where units live.
 * Each unit has a home (place + optional slot) and may be checked out to another place
 * (a travel case, the painting desk) while keeping its home. Every change is logged.
 */
export type PlaceKind = 'shelf' | 'box' | 'bag' | 'case' | 'tray' | 'desk'

export const PLACE_KINDS: { id: PlaceKind; name: string; icon: string }[] = [
  { id: 'shelf', name: 'Shelf', icon: '🗄' },
  { id: 'box', name: 'Box', icon: '📦' },
  { id: 'bag', name: 'Bag', icon: '🛍' },
  { id: 'case', name: 'Case', icon: '🧳' },
  { id: 'tray', name: 'Tray', icon: '🧩' },
  { id: 'desk', name: 'Desk / table', icon: '🖌' },
]

export interface Place {
  id: string
  name: string
  kind: PlaceKind
  parentId?: string
  /** Room, shelf or anything that helps to find it. */
  location: string
  /** Number of slots; undefined = no fixed slots. */
  capacity?: number
  note: string
  createdAt: string
}

export interface Home {
  placeId: string
  slot?: number
}

export interface StorageMove {
  id: string
  unitId: string
  date: string
  kind: 'home' | 'out' | 'back'
  /** Place the unit went to (home or check-out target); empty when the home was removed. */
  placeId?: string
  slot?: number
}

export interface Storage {
  places: Place[]
  homes: Record<string, Home>
  /** Checked-out units: unit id → place it is in now. */
  out: Record<string, string>
  log: StorageMove[]
}

export const EMPTY_STORAGE: Storage = { places: [], homes: {}, out: {}, log: [] }

type Ctx = { now: string; newId: () => string }

export const placeById = (s: Storage, id: string | undefined) => s.places.find((p) => p.id === id)

/** Root first: [Shelf 2, Box Sprues, Bag 7]. */
export function placePath(s: Storage, id: string | undefined): Place[] {
  const out: Place[] = []
  const seen = new Set<string>()
  let p = placeById(s, id)
  while (p && !seen.has(p.id)) {
    seen.add(p.id)
    out.unshift(p)
    p = placeById(s, p.parentId)
  }
  return out
}

export const pathLabel = (s: Storage, id: string | undefined, slot?: number) =>
  placePath(s, id).map((p) => p.name).join(' › ') + (slot !== undefined ? ` · slot ${slot}` : '')

/** The place and everything inside it. */
export function descendants(s: Storage, id: string): Set<string> {
  const out = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const p of s.places) if (p.parentId && out.has(p.parentId) && !out.has(p.id)) (out.add(p.id), (grew = true))
  }
  return out
}

export function validatePlace(s: Storage, p: Place): void {
  if (!p.name.trim()) throw new Error('Give the place a name or number')
  if (p.capacity !== undefined && (!Number.isInteger(p.capacity) || p.capacity < 1)) throw new Error('Slots must be a whole number above 0')
  if (p.parentId && descendants(s, p.id).has(p.parentId)) throw new Error('A place cannot be inside itself')
  if (p.parentId && !placeById(s, p.parentId)) throw new Error('Unknown parent place')
}

export function savePlace(s: Storage, p: Place): Storage {
  validatePlace(s, p)
  const clean = { ...p, name: p.name.trim() }
  return { ...s, places: s.places.some((x) => x.id === p.id) ? s.places.map((x) => (x.id === p.id ? clean : x)) : [...s.places, clean] }
}

/** Removes a place: what was inside moves up to its parent; units lose that home; checked-out units there go back. */
export function removePlace(s: Storage, id: string, c: Ctx): Storage {
  const p = placeById(s, id)
  if (!p) return s
  let next: Storage = { ...s, places: s.places.filter((x) => x.id !== id).map((x) => (x.parentId === id ? { ...x, parentId: p.parentId } : x)) }
  const homed = Object.entries(s.homes).filter(([, h]) => h.placeId === id).map(([u]) => u)
  const homes = { ...next.homes }
  for (const u of homed) delete homes[u]
  next = { ...next, homes, log: [...next.log, ...homed.map((unitId) => ({ id: c.newId(), unitId, date: c.now, kind: 'home' as const }))] }
  return putBack(next, Object.entries(s.out).filter(([, at]) => at === id).map(([u]) => u), c)
}

/** Units whose home is here (directly). */
export const homedIn = (s: Storage, placeId: string) =>
  Object.entries(s.homes).filter(([, h]) => h.placeId === placeId).map(([unitId, h]) => ({ unitId, slot: h.slot })).sort((a, b) => (a.slot ?? 1e9) - (b.slot ?? 1e9))

/** Units checked out to here. */
export const checkedOutTo = (s: Storage, placeId: string) => Object.entries(s.out).filter(([, p]) => p === placeId).map(([u]) => u)

/** Slots used / capacity; a slot may hold several units (a sprue bag), so used counts distinct slots plus unslotted units. */
export function fill(s: Storage, placeId: string): { used: number; capacity?: number; free: number[] } {
  const p = placeById(s, placeId)
  const here = homedIn(s, placeId)
  const slots = new Set(here.filter((x) => x.slot !== undefined).map((x) => x.slot))
  const used = slots.size + here.filter((x) => x.slot === undefined).length
  const free = p?.capacity ? Array.from({ length: p.capacity }, (_, i) => i + 1).filter((n) => !slots.has(n)) : []
  return { used, capacity: p?.capacity, free }
}

export function setHome(s: Storage, unitId: string, home: Home | undefined, c: Ctx): Storage {
  const homes = { ...s.homes }
  if (home) {
    if (!placeById(s, home.placeId)) throw new Error('Unknown place')
    const cap = placeById(s, home.placeId)!.capacity
    if (home.slot !== undefined && (!Number.isInteger(home.slot) || home.slot < 1 || (cap && home.slot > cap))) throw new Error(`Slot must be between 1 and ${cap ?? '…'}`)
    homes[unitId] = home
  } else delete homes[unitId]
  return { ...s, homes, log: [...s.log, { id: c.newId(), unitId, date: c.now, kind: 'home', placeId: home?.placeId, slot: home?.slot }] }
}

export function checkOut(s: Storage, unitIds: string[], placeId: string, c: Ctx): Storage {
  if (!placeById(s, placeId)) throw new Error('Unknown place')
  const out = { ...s.out }
  const moved = unitIds.filter((u) => out[u] !== placeId)
  for (const u of moved) out[u] = placeId
  return { ...s, out, log: [...s.log, ...moved.map((unitId) => ({ id: c.newId(), unitId, date: c.now, kind: 'out' as const, placeId }))] }
}

export function putBack(s: Storage, unitIds: string[], c: Ctx): Storage {
  const out = { ...s.out }
  const moved = unitIds.filter((u) => out[u])
  for (const u of moved) delete out[u]
  return { ...s, out, log: [...s.log, ...moved.map((unitId) => ({ id: c.newId(), unitId, date: c.now, kind: 'back' as const, placeId: s.homes[unitId]?.placeId }))] }
}

/** Where the unit is now: checked-out place, else home. */
export function whereIs(s: Storage, unitId: string): { placeId?: string; slot?: number; out: boolean } {
  if (s.out[unitId]) return { placeId: s.out[unitId], out: true }
  const h = s.homes[unitId]
  return { placeId: h?.placeId, slot: h?.slot, out: false }
}

export interface PickStop {
  placeId: string
  path: string
  items: { unitId: string; slot?: number }[]
}

/**
 * Which places to open to collect these units, in shelf › box › slot order.
 * Units already in `target` are listed apart; units with no known place are "unstored".
 */
export function pickList(s: Storage, unitIds: string[], target?: string) {
  const stops = new Map<string, PickStop>()
  const ready: string[] = []
  const unstored: string[] = []
  for (const u of [...new Set(unitIds)]) {
    const w = whereIs(s, u)
    if (target && w.placeId === target) ready.push(u)
    else if (!w.placeId) unstored.push(u)
    else {
      const stop = stops.get(w.placeId) ?? { placeId: w.placeId, path: pathLabel(s, w.placeId), items: [] }
      stop.items.push({ unitId: u, slot: w.slot })
      stops.set(w.placeId, stop)
    }
  }
  const list = [...stops.values()].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
  for (const st of list) st.items.sort((a, b) => (a.slot ?? 1e9) - (b.slot ?? 1e9))
  return { stops: list, ready, unstored }
}

/** Where each unit checked out to `placeId` goes back. */
export function putBackList(s: Storage, placeId: string) {
  const units = checkedOutTo(s, placeId)
  const home: Storage = { ...s, out: {} }
  return pickList(home, units)
}

export const unitLog = (s: Storage, unitId: string) => s.log.filter((m) => m.unitId === unitId).sort((a, b) => b.date.localeCompare(a.date))

/** Drops homes, check-outs and log rows of units that no longer exist. */
export function pruneStorage(s: Storage, unitIds: Set<string>): Storage {
  const keep = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([u]) => unitIds.has(u)))
  return { ...s, homes: keep(s.homes), out: keep(s.out), log: s.log.filter((m) => unitIds.has(m.unitId)) }
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

export function parseStorage(x: unknown): Storage {
  if (!isObj(x)) return EMPTY_STORAGE
  const places = Array.isArray(x.places) ? x.places.filter((p): p is Place => isObj(p) && typeof p.id === 'string' && typeof p.name === 'string').map((p) => ({ ...p, kind: PLACE_KINDS.some((k) => k.id === p.kind) ? p.kind : 'box', location: p.location ?? '', note: p.note ?? '' })) : []
  return {
    places,
    homes: isObj(x.homes) ? (x.homes as Record<string, Home>) : {},
    out: isObj(x.out) ? (x.out as Record<string, string>) : {},
    log: Array.isArray(x.log) ? (x.log as StorageMove[]) : [],
  }
}
