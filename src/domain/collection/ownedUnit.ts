import type { Ctx, MagnetSlot, ModelGroup, OwnedUnit, StageId } from './types'

export interface NewGroup {
  count: number
  status: StageId
  loadout?: string[]
}

export type NewUnit = Partial<Omit<OwnedUnit, 'id' | 'groups' | 'createdAt' | 'updatedAt'>> & {
  customName: string
  groups: NewGroup[]
}

function assertCount(count: number, max = Infinity): void {
  if (!Number.isInteger(count) || count < 1 || count > max) {
    throw new RangeError(`Invalid model count: ${count}`)
  }
}

function findGroup(unit: OwnedUnit, groupId: string): ModelGroup {
  const g = unit.groups.find((x) => x.id === groupId)
  if (!g) throw new Error(`Unknown group: ${groupId}`)
  return g
}

/** Key that is equal for groups which can be merged. */
function groupKey(g: ModelGroup): string {
  const loadout = [...g.loadout].sort()
  const magnets = [...g.magnetised]
    .map((m) => ({ slot: m.slot, optionIds: [...m.optionIds].sort() }))
    .sort((a, b) => a.slot.localeCompare(b.slot))
  return JSON.stringify([g.status, loadout, magnets])
}

export function createUnit(input: NewUnit, ctx: Ctx): OwnedUnit {
  const customName = input.customName.trim()
  if (!customName) throw new Error('Unit name is required')
  const groups = input.groups.map((g): ModelGroup => {
    assertCount(g.count)
    return { id: ctx.newId(), count: g.count, status: g.status, loadout: g.loadout ?? [], magnetised: [] }
  })
  return {
    kitIds: [],
    tutorials: [],
    notes: '',
    photoIds: [],
    tags: [],
    lifecycle: 'active',
    favourite: false,
    nextUp: false,
    externalRefs: [],
    ...input,
    customName,
    groups,
    id: ctx.newId(),
    createdAt: ctx.now,
    updatedAt: ctx.now,
  }
}

export function totalModels(unit: OwnedUnit): number {
  return unit.groups.reduce((sum, g) => sum + g.count, 0)
}

export function modelsByStatus(unit: OwnedUnit): Record<StageId, number> {
  const out: Record<StageId, number> = {}
  for (const g of unit.groups) out[g.status] = (out[g.status] ?? 0) + g.count
  return out
}

/** Merge groups that share status, loadout and magnets. Keeps the first group's id and order. */
export function mergeGroups(unit: OwnedUnit, ctx: Pick<Ctx, 'now'>): OwnedUnit {
  const byKey = new Map<string, ModelGroup>()
  for (const g of unit.groups) {
    const k = groupKey(g)
    const existing = byKey.get(k)
    if (existing) existing.count += g.count
    else byKey.set(k, structuredClone(g))
  }
  return { ...unit, groups: [...byKey.values()], updatedAt: ctx.now }
}

/** Move `count` models of a group to `status`. The moved models keep loadout and magnets. */
export function splitGroup(unit: OwnedUnit, groupId: string, count: number, status: StageId, ctx: Ctx): OwnedUnit {
  const src = findGroup(unit, groupId)
  assertCount(count, src.count)
  const groups: ModelGroup[] = []
  for (const g of unit.groups) {
    if (g.id !== groupId) {
      groups.push(g)
    } else if (count === g.count) {
      groups.push({ ...g, status })
    } else {
      groups.push({ ...g, count: g.count - count })
      groups.push({ ...structuredClone(g), id: ctx.newId(), count, status })
    }
  }
  return mergeGroups({ ...unit, groups }, ctx)
}

export function setMagnetSlots(
  unit: OwnedUnit,
  groupId: string,
  slots: MagnetSlot[],
  ctx: Pick<Ctx, 'now'>,
): OwnedUnit {
  findGroup(unit, groupId)
  const names = new Set<string>()
  for (const s of slots) {
    if (new Set(s.optionIds).size < 2) throw new Error(`Magnet slot "${s.slot}" needs at least two options`)
    if (names.has(s.slot)) throw new Error(`Duplicate magnet slot: ${s.slot}`)
    names.add(s.slot)
  }
  return {
    ...unit,
    groups: unit.groups.map((g) => (g.id === groupId ? { ...g, magnetised: structuredClone(slots) } : g)),
    updatedAt: ctx.now,
  }
}
