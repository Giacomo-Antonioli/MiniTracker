import type { ItemStatus, WorkshopItem } from '../workshop/item'
import { newItem } from '../workshop/item'
import { createUnit, mergeGroups } from './ownedUnit'
import { WISHLISTED } from './pipeline'
import type { Ctx, OwnedUnit, Pipeline } from './types'

export const COLLECTION_FORMAT = 'minitracker-collection'
export const COLLECTION_VERSION = 1

/** One unit in a collection file. `status` is a stage id or name of the painting pipeline ("On sprue", "built", "wishlist"). */
export interface FileUnit {
  name: string
  faction?: string
  count?: number
  status?: string
  tags?: string[]
  notes?: string
}

/** One tool or supply in a collection file. */
export interface FileItem {
  name: string
  category?: string
  status?: ItemStatus
  quantity?: number
  notes?: string
}

export interface CollectionFile {
  format: typeof COLLECTION_FORMAT
  version: number
  units: FileUnit[]
  tools: FileItem[]
  supplies: FileItem[]
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const list = (v: unknown) => (Array.isArray(v) ? v : [])

function parseUnit(x: unknown, i: number): FileUnit {
  const r = (x ?? {}) as Record<string, unknown>
  const name = str(r.name)
  if (!name) throw new Error(`Unit ${i + 1} has no name`)
  const count = r.count === undefined ? 1 : Number(r.count)
  if (!Number.isInteger(count) || count < 1) throw new Error(`"${name}" has an invalid model count`)
  return { name, faction: str(r.faction) || undefined, count, status: str(r.status) || undefined, tags: list(r.tags).map(str).filter(Boolean), notes: str(r.notes) || undefined }
}

function parseItem(x: unknown, i: number, what: string): FileItem {
  const r = (x ?? {}) as Record<string, unknown>
  const name = str(r.name)
  if (!name) throw new Error(`${what} ${i + 1} has no name`)
  const quantity = r.quantity === undefined ? 1 : Number(r.quantity)
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error(`"${name}" has an invalid quantity`)
  const status: ItemStatus = str(r.status).toLowerCase().startsWith('wish') ? 'wishlist' : 'owned'
  return { name, category: str(r.category) || undefined, status, quantity, notes: str(r.notes) || undefined }
}

/** Parse and check a collection file's text. Throws a user-readable message when it can't be used. */
export function parseCollectionFile(text: string): CollectionFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON')
  }
  const r = raw as Partial<Record<keyof CollectionFile, unknown>> | null
  if (r?.format !== COLLECTION_FORMAT) throw new Error('This file is not a MiniTracker collection file')
  if (typeof r.version !== 'number' || r.version > COLLECTION_VERSION) throw new Error('This file was made for a newer version of MiniTracker; update the app first')
  for (const k of ['units', 'tools', 'supplies'] as const) if (r[k] !== undefined && !Array.isArray(r[k])) throw new Error('This collection file is damaged or incomplete')
  return {
    format: COLLECTION_FORMAT,
    version: r.version,
    units: list(r.units).map(parseUnit),
    tools: list(r.tools).map((x, i) => parseItem(x, i, 'Tool')),
    supplies: list(r.supplies).map((x, i) => parseItem(x, i, 'Supply')),
  }
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** Stage id for a file's status: matches an id or a name of the pipeline; "wishlist" means Wishlisted; none means the first owned stage. */
export function resolveStage(status: string | undefined, pipeline: Pipeline): string {
  const s = norm(status ?? '')
  if (!s) return (pipeline.stages.find((x) => x.id !== WISHLISTED) ?? pipeline.stages[0]).id
  if (s === 'wishlist' || s === 'wishlisted') return WISHLISTED
  const hit = pipeline.stages.find((x) => norm(x.id) === s || norm(x.name) === s)
  if (!hit) throw new Error(`Unknown stage "${status}" (stages: ${pipeline.stages.map((x) => x.name).join(', ')})`)
  return hit.id
}

export type Duplicates = 'skip' | 'add'

export interface CollectionPlan {
  /** New units. */
  units: OwnedUnit[]
  /** Existing units that got the file's models added as a group (only with `add`). */
  updatedUnits: OwnedUnit[]
  tools: WorkshopItem[]
  supplies: WorkshopItem[]
  /** Existing tools and supplies whose quantity went up (only with `add`). */
  updatedTools: WorkshopItem[]
  updatedSupplies: WorkshopItem[]
  /** Entries already there: skipped with `skip`, merged into the existing record with `add`. */
  duplicates: number
}

type Existing = { units: OwnedUnit[]; tools: WorkshopItem[]; supplies: WorkshopItem[] }

const sameUnit = (u: OwnedUnit, f: FileUnit) => {
  const tags = f.tags ?? []
  return norm(u.customName) === norm(f.name) && (tags.length === 0 ? u.tags.length === 0 : tags.some((t) => u.tags.includes(t)))
}

/**
 * Turn a collection file into records to add. Nothing is ever removed or overwritten. An entry that is already there
 * (same name; for units also a shared tag, or both untagged) is a duplicate: with `skip` it is left out, with `add`
 * its models join the existing unit as one more group (a tool or supply gets its quantity raised), so a second
 * purchase of the same thing becomes one record, not two.
 */
export function planCollection(file: CollectionFile, existing: Existing, pipeline: Pipeline, ctx: Ctx, duplicates: Duplicates = 'skip'): CollectionPlan {
  let dupes = 0
  const units: OwnedUnit[] = []
  const updated = new Map<string, OwnedUnit>()
  const pool = () => [...existing.units.map((u) => updated.get(u.id) ?? u), ...units]
  for (const f of file.units) {
    const stage = resolveStage(f.status, pipeline)
    const hit = pool().find((u) => sameUnit(u, f))
    if (hit) {
      dupes++
      if (duplicates === 'add') {
        const joined = mergeGroups({ ...hit, groups: [...hit.groups, { id: ctx.newId(), count: f.count ?? 1, status: stage, loadout: [], magnetised: [] }] }, ctx)
        const k = units.indexOf(hit)
        if (k >= 0) units[k] = joined
        else updated.set(hit.id, joined)
      }
      continue
    }
    units.push(createUnit({ customName: f.name, factionName: f.faction, tags: f.tags ?? [], notes: f.notes ?? '', groups: [{ count: f.count ?? 1, status: stage }] }, ctx))
  }
  const items = (incoming: FileItem[], have: WorkshopItem[], what: string) => {
    const added: WorkshopItem[] = []
    const raised = new Map<string, WorkshopItem>()
    for (const f of incoming) {
      const hit = [...have.map((x) => raised.get(x.id) ?? x), ...added].find((x) => norm(x.name) === norm(f.name))
      if (hit) {
        dupes++
        if (duplicates === 'add') {
          const more = { ...hit, quantity: hit.quantity + (f.quantity ?? 1), updatedAt: ctx.now }
          const k = added.indexOf(hit)
          if (k >= 0) added[k] = more
          else raised.set(hit.id, more)
        }
        continue
      }
      added.push({ ...newItem({ name: f.name, category: f.category ?? 'Other', status: f.status, quantity: f.quantity }, ctx, what), notes: f.notes ?? '' })
    }
    return { added, raised: [...raised.values()] }
  }
  const tools = items(file.tools, existing.tools, 'A tool')
  const supplies = items(file.supplies, existing.supplies, 'A supply')
  return { units, updatedUnits: [...updated.values()], tools: tools.added, updatedTools: tools.raised, supplies: supplies.added, updatedSupplies: supplies.raised, duplicates: dupes }
}

export interface DuplicateFlags {
  units: boolean[]
  tools: boolean[]
  supplies: boolean[]
}

/** For each entry of the file: is it already in the tracker (same name; units also share a tag, or both are untagged)? */
export function findDuplicates(file: CollectionFile, existing: Existing): DuplicateFlags {
  const named = (have: WorkshopItem[]) => (f: FileItem) => have.some((x) => norm(x.name) === norm(f.name))
  return { units: file.units.map((f) => existing.units.some((u) => sameUnit(u, f))), tools: file.tools.map(named(existing.tools)), supplies: file.supplies.map(named(existing.supplies)) }
}

/** The file with only the entries whose `keep` flag is true (flags in the file's order). */
export function selectEntries(file: CollectionFile, keep: DuplicateFlags): CollectionFile {
  const pick = <T,>(xs: T[], flags: boolean[]) => xs.filter((_, i) => flags[i])
  return { ...file, units: pick(file.units, keep.units), tools: pick(file.tools, keep.tools), supplies: pick(file.supplies, keep.supplies) }
}
