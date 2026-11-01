import type { Datasheet } from '../catalogue/types'
import type { OwnedUnit } from '../collection/types'
import type { PaintStock } from '../paints/types'
import { schemeFits } from '../schemes/match'
import { paintIdsOf } from '../schemes/scheme'
import type { PaintScheme, SchemeOrigin } from '../schemes/types'
import type { ListOwnership } from './ownership'
import type { ArmyList, ListEntry } from './types'

/** Paint stages that mean "you have a usable pot". */
export const HAVE_PAINT = new Set(['sealed', 'in-use', 'low'])

export type SchemeSource = 'list' | 'model' | 'variant' | 'army' | 'default' | 'none'

export interface ResolvedScheme {
  scheme?: PaintScheme
  source: SchemeSource
}

export interface SchemeContext {
  schemes: PaintScheme[]
  sheets: Map<string, Datasheet>
  units: OwnedUnit[]
  own: ListOwnership
  /** Faction name of the list (for matching and defaults). */
  factionName?: string
  /** Settings → default scheme per faction name. */
  defaults: Record<string, string>
}

const ORDER: SchemeOrigin[] = ['official', 'community', 'personal']
const group = (list: PaintScheme[]) =>
  ORDER.map((origin) => ({ origin, schemes: list.filter((s) => s.origin === origin).sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.schemes.length)

const fitsEntry = (s: PaintScheme, d: Datasheet | undefined, factionName?: string) =>
  schemeFits(s, { factionNames: [factionName, ...(d?.factionKeywords ?? [])], names: [d?.name ?? '', ...(d?.keywords ?? [])] })

/** Army-wide schemes (not made for one unit type) that fit the faction, grouped by origin. */
export function armySchemeChoices(schemes: PaintScheme[], factionName: string | undefined, current?: string) {
  return group(schemes.filter((s) => s.id === current || (!s.appliesTo?.length && schemeFits(s, { factionNames: [factionName], names: [] }))))
}

/** Schemes that fit one unit of the list, grouped by origin. */
export function unitSchemeChoices(schemes: PaintScheme[], d: Datasheet | undefined, factionName: string | undefined, current?: string) {
  return group(schemes.filter((s) => s.id === current || fitsEntry(s, d, factionName)))
}

/** The collection unit a list entry uses first, if any. */
const firstUnit = (ctx: SchemeContext, e: ListEntry) => {
  const id = ctx.own.byEntry.get(e.id)?.from[0]?.unitId
  return id ? ctx.units.find((u) => u.id === id) : undefined
}

/**
 * Which scheme a list unit uses: its own choice in the list → the scheme on the model it is linked to → a variant of
 * the army scheme made for this unit type → the army scheme → the faction default → none.
 */
export function resolveScheme(l: ArmyList, e: ListEntry, ctx: SchemeContext): ResolvedScheme {
  const byId = new Map(ctx.schemes.map((s) => [s.id, s]))
  const d = ctx.sheets.get(e.datasheetId)
  if (e.schemeId && byId.has(e.schemeId)) return { scheme: byId.get(e.schemeId), source: 'list' }
  const u = firstUnit(ctx, e)
  if (u?.schemeId && byId.has(u.schemeId)) return { scheme: byId.get(u.schemeId), source: 'model' }
  const army = l.schemeId ? byId.get(l.schemeId) : undefined
  if (army) {
    const variant = ctx.schemes.find((s) => s.basedOn === army.id && s.appliesTo?.length && fitsEntry(s, d, ctx.factionName))
    if (variant) return { scheme: variant, source: 'variant' }
    return { scheme: army, source: 'army' }
  }
  const def = ctx.factionName ? byId.get(ctx.defaults[ctx.factionName] ?? '') : undefined
  if (def) return { scheme: def, source: 'default' }
  return { source: 'none' }
}

export type PaintStatus = 'buy' | 'unpainted' | 'painted'

export interface SchemeGroup {
  scheme: PaintScheme
  units: { entryId: string; name: string; status: PaintStatus }[]
  paints: { paintId: string; have: boolean }[]
}

export interface PaintPlan {
  groups: SchemeGroup[]
  /** List units without a scheme. */
  withoutScheme: { entryId: string; name: string }[]
  /** Paints of all the list's schemes that you don't have, with the schemes needing them. */
  missing: { paintId: string; schemes: string[] }[]
}

/**
 * Paints for the whole list, by scheme. Every list unit counts, owned or not; painted units are reported too.
 * Status: 'buy' when models are missing, 'unpainted' when owned but not all painted, 'painted' otherwise.
 */
export function paintPlan(l: ArmyList, ctx: SchemeContext, stock: Map<string, PaintStock>): PaintPlan {
  const groups = new Map<string, SchemeGroup>()
  const withoutScheme: PaintPlan['withoutScheme'] = []
  for (const e of l.entries) {
    const name = ctx.sheets.get(e.datasheetId)?.name ?? 'Unknown unit'
    const o = ctx.own.byEntry.get(e.id)
    const status: PaintStatus = !o || o.have < o.need ? 'buy' : o.painted < o.have ? 'unpainted' : 'painted'
    const { scheme } = resolveScheme(l, e, ctx)
    if (!scheme) {
      withoutScheme.push({ entryId: e.id, name })
      continue
    }
    const g = groups.get(scheme.id) ?? { scheme, units: [], paints: paintIdsOf(scheme).map((paintId) => ({ paintId, have: HAVE_PAINT.has(stock.get(paintId)?.stage ?? '') })) }
    g.units.push({ entryId: e.id, name, status })
    groups.set(scheme.id, g)
  }
  const list = [...groups.values()].sort((a, b) => b.units.length - a.units.length || a.scheme.name.localeCompare(b.scheme.name))
  const missing = new Map<string, string[]>()
  for (const g of list) for (const p of g.paints) if (!p.have) missing.set(p.paintId, [...(missing.get(p.paintId) ?? []), g.scheme.name])
  return {
    groups: list,
    withoutScheme,
    missing: [...missing].map(([paintId, schemes]) => ({ paintId, schemes })).sort((a, b) => a.paintId.localeCompare(b.paintId)),
  }
}

/**
 * Collection units linked to the list whose scheme would change if the list's schemes were applied to them.
 * `set` have no scheme yet; `change` have a different one (ask first).
 */
export function schemesToApply(l: ArmyList, ctx: SchemeContext): { set: { unit: OwnedUnit; schemeId: string }[]; change: { unit: OwnedUnit; schemeId: string }[] } {
  const set: { unit: OwnedUnit; schemeId: string }[] = []
  const change: { unit: OwnedUnit; schemeId: string }[] = []
  const seen = new Set<string>()
  for (const e of l.entries) {
    // What the list wants, ignoring the model's own scheme.
    const wanted = resolveScheme(l, e, { ...ctx, units: [] }).scheme
    if (!wanted) continue
    for (const f of ctx.own.byEntry.get(e.id)?.from ?? []) {
      const u = ctx.units.find((x) => x.id === f.unitId)
      if (!u || seen.has(u.id) || u.schemeId === wanted.id) continue
      seen.add(u.id)
      ;(u.schemeId ? change : set).push({ unit: u, schemeId: wanted.id })
    }
  }
  return { set, change }
}
