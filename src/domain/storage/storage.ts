/**
 * Storage (#18): nested places (shelf › box › bag…) where units live.
 * Each unit has a home (place + optional slot) and may be checked out to another place
 * (a travel case, the painting desk) while keeping its home. Every change is logged.
 */
/** Place kind id; the list of kinds is user-editable (Settings). */
export type PlaceKind = string

export interface KindDef {
  id: PlaceKind
  name: string
  icon: string
}

export const PLACE_KINDS: KindDef[] = [
  { id: 'shelf', name: 'Shelf', icon: '🗄' },
  { id: 'box', name: 'Box', icon: '📦' },
  { id: 'bag', name: 'Bag', icon: '🛍' },
  { id: 'case', name: 'Case', icon: '🧳' },
  { id: 'tray', name: 'Tray', icon: '🧩' },
  { id: 'desk', name: 'Desk / table', icon: '🖌' },
  { id: 'drawer', name: 'Drawer', icon: '🗃' },
]

/** An independent storage: your home, a club locker, a friend's house. Top-level places belong to one. */
export interface Site {
  id: string
  name: string
  address: string
  note: string
}

/** Stages of the storage flow (Settings ▸ Pipelines ▸ Storage); check-out and put-back move units along it. */
export const FLOW_STORED = 'stored'
export const FLOW_DESK = 'desk'
export const FLOW_PACKED = 'packed'
export const DEFAULT_STORAGE_FLOW = {
  stages: [
    { id: FLOW_STORED, name: 'In storage' },
    { id: FLOW_DESK, name: 'On the desk' },
    { id: FLOW_PACKED, name: 'Packed' },
    { id: 'at-game', name: 'At a game' },
    { id: 'lent', name: 'Lent out' },
  ],
}

export interface Place {
  id: string
  name: string
  kind: PlaceKind
  parentId?: string
  /** Storage it belongs to; only set on top-level places (children follow their parent). */
  siteId?: string
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
  sites: Site[]
  kinds: KindDef[]
  places: Place[]
  /** Storage-flow stage per unit. */
  flow: Record<string, string>
  /** Short codes (U-007, B-03) of units and places, by id. */
  codes: Record<string, string>
  homes: Record<string, Home>
  /** Checked-out units: unit id → place it is in now. */
  out: Record<string, string>
  log: StorageMove[]
}

export const EMPTY_STORAGE: Storage = { sites: [], kinds: PLACE_KINDS, places: [], flow: {}, codes: {}, homes: {}, out: {}, log: [] }

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

/** The storage a place belongs to (its top-level place's site; else the first storage). */
export function siteOf(s: Storage, id: string | undefined): Site | undefined {
  const root = placePath(s, id)[0]
  return s.sites.find((x) => x.id === root?.siteId) ?? s.sites[0]
}

/** "Home › Shelf 2 › Box"; the storage name is shown only when there are several. */
export function pathLabel(s: Storage, id: string | undefined, slot?: number): string {
  const path = placePath(s, id).map((p) => p.name)
  if (path.length && s.sites.length > 1) path.unshift(siteOf(s, id)!.name)
  return path.join(' › ') + (slot !== undefined ? ` · slot ${slot}` : '')
}

export const kindOf = (s: Storage, id: PlaceKind) => s.kinds.find((k) => k.id === id) ?? { id, name: id, icon: '📦' }

export function saveSite(s: Storage, x: Site): Storage {
  if (!x.name.trim()) throw new Error('Give the storage a name')
  const clean = { ...x, name: x.name.trim() }
  return { ...s, sites: s.sites.some((y) => y.id === x.id) ? s.sites.map((y) => (y.id === x.id ? clean : y)) : [...s.sites, clean] }
}

/** Removes a storage; its top-level places move to the first remaining storage. */
export function removeSite(s: Storage, id: string): Storage {
  const sites = s.sites.filter((x) => x.id !== id)
  if (sites.length === s.sites.length) return s
  return { ...s, sites, places: s.places.map((p) => (p.siteId === id ? { ...p, siteId: sites[0]?.id } : p)) }
}

/** Top-level places of a storage (places with no site go to the first storage). */
export const sitePlaces = (s: Storage, siteId: string | undefined) =>
  s.places.filter((p) => !p.parentId && (p.siteId === siteId || (!s.sites.some((x) => x.id === p.siteId) && siteId === s.sites[0]?.id)))

export function saveKinds(s: Storage, kinds: KindDef[]): Storage {
  if (!kinds.length) throw new Error('Keep at least one kind')
  for (const k of kinds) if (!k.name.trim() || !k.id) throw new Error('Every kind needs a name')
  if (new Set(kinds.map((k) => k.id)).size !== kinds.length) throw new Error('Kinds must be different')
  const gone = s.kinds.filter((k) => !kinds.some((x) => x.id === k.id)).find((k) => s.places.some((p) => p.kind === k.id))
  if (gone) throw new Error(`"${gone.name}" is used by places`)
  return { ...s, kinds }
}

export function setFlow(s: Storage, unitIds: string[], stage: string | undefined): Storage {
  const flow = { ...s.flow }
  for (const u of unitIds) {
    if (stage) flow[u] = stage
    else delete flow[u]
  }
  return { ...s, flow }
}

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
  // Check-out moves units along the storage flow: to a desk = on the desk, anywhere else = packed.
  const stage = placeById(s, placeId)!.kind === 'desk' ? FLOW_DESK : FLOW_PACKED
  return setFlow({ ...s, out, log: [...s.log, ...moved.map((unitId) => ({ id: c.newId(), unitId, date: c.now, kind: 'out' as const, placeId }))] }, moved, stage)
}

export function putBack(s: Storage, unitIds: string[], c: Ctx): Storage {
  const out = { ...s.out }
  const moved = unitIds.filter((u) => out[u])
  for (const u of moved) delete out[u]
  return setFlow({ ...s, out, log: [...s.log, ...moved.map((unitId) => ({ id: c.newId(), unitId, date: c.now, kind: 'back' as const, placeId: s.homes[unitId]?.placeId }))] }, moved, FLOW_STORED)
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
  return { ...s, homes: keep(s.homes), out: keep(s.out), flow: keep(s.flow), log: s.log.filter((m) => unitIds.has(m.unitId)) }
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

export function parseStorage(x: unknown): Storage {
  if (!isObj(x)) return EMPTY_STORAGE
  const kinds = Array.isArray(x.kinds) && x.kinds.length ? (x.kinds as KindDef[]).filter((k) => isObj(k) && typeof k.id === 'string') : PLACE_KINDS
  const places = Array.isArray(x.places) ? x.places.filter((p): p is Place => isObj(p) && typeof p.id === 'string' && typeof p.name === 'string').map((p) => ({ ...p, kind: kinds.some((k) => k.id === p.kind) ? p.kind : 'box', location: p.location ?? '', note: p.note ?? '' })) : []
  return {
    sites: Array.isArray(x.sites) ? (x.sites as Site[]).filter((y) => isObj(y) && typeof y.id === 'string') : [],
    kinds,
    places,
    flow: isObj(x.flow) ? (x.flow as Record<string, string>) : {},
    codes: isObj(x.codes) ? (x.codes as Record<string, string>) : {},
    homes: isObj(x.homes) ? (x.homes as Record<string, Home>) : {},
    out: isObj(x.out) ? (x.out as Record<string, string>) : {},
    log: Array.isArray(x.log) ? (x.log as StorageMove[]) : [],
  }
}

/**
 * Slots for units moving into `placeId`: each keeps its slot if it is free there, else takes the next free one;
 * `noSlot` lists the units that do not fit (the place is full). Places without slots give no slots.
 */
export function planMove(s: Storage, unitIds: string[], placeId: string): { slots: Record<string, number | undefined>; noSlot: string[] } {
  const cap = placeById(s, placeId)?.capacity
  const moving = new Set(unitIds)
  const slots: Record<string, number | undefined> = {}
  const noSlot: string[] = []
  if (!cap) {
    for (const u of unitIds) slots[u] = undefined
    return { slots, noSlot }
  }
  const taken = new Set(homedIn(s, placeId).filter((x) => !moving.has(x.unitId) && x.slot !== undefined).map((x) => x.slot!))
  const order = [...unitIds].sort((a, b) => (s.homes[a]?.slot ?? 1e9) - (s.homes[b]?.slot ?? 1e9))
  // first pass keeps slots, second fills the gaps, so keepers are never pushed out
  for (const u of order) {
    const cur = s.homes[u]?.slot
    if (cur !== undefined && cur <= cap && !taken.has(cur)) (slots[u] = cur, taken.add(cur))
  }
  for (const u of order) {
    if (u in slots) continue
    const free = Array.from({ length: cap }, (_, i) => i + 1).find((n) => !taken.has(n))
    if (free === undefined) (slots[u] = undefined, noSlot.push(u))
    else (slots[u] = free, taken.add(free))
  }
  return { slots, noSlot }
}

/** Gives all these units a new home in `placeId`, slots from planMove; units already homed there stay as they are. */
export function moveHomes(s: Storage, unitIds: string[], placeId: string, c: Ctx): Storage {
  if (!placeById(s, placeId)) throw new Error('Unknown place')
  const todo = unitIds.filter((u) => s.homes[u]?.placeId !== placeId)
  const { slots } = planMove(s, todo, placeId)
  return todo.reduce((x, u) => setHome(x, u, { placeId, slot: slots[u] }, c), s)
}

/** Puts a place (and all inside it) into another place, or at the top level of a storage. */
export function movePlace(s: Storage, id: string, to: { parentId?: string; siteId?: string }): Storage {
  const p = placeById(s, id)
  if (!p) throw new Error('Unknown place')
  return savePlace(s, { ...p, parentId: to.parentId, siteId: to.parentId ? undefined : to.siteId ?? p.siteId })
}
