import { pointsFor } from '../catalogue/points'
import type { Catalogue, Datasheet, WeaponProfile } from '../catalogue/types'
import type { OwnedUnit } from '../collection/types'
import { effectiveLoadout } from './loadout'
import type { ArmyList, ListEntry, LoadoutRow } from './types'

/** One printable datasheet card: a unit type with every list entry of it (#98). */
export interface UnitCard {
  datasheet: Datasheet
  entries: { models: number; points?: number; warlord?: boolean; enhancement?: { name: string; points: number } }[]
  weapons: WeaponProfile[]
  abilities: { name: string; text?: string }[]
  /** Core and faction rules the unit has (names only). */
  rules: string[]
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Weapon profiles a loadout carries: the model types' fixed wargear plus picked options, matched by name
 * ("Plasma gun" matches "Plasma gun - standard"). Every profile when nothing can be matched.
 */
export function carriedWeapons(d: Datasheet, rows: LoadoutRow[]): WeaponProfile[] {
  const all = d.weapons ?? []
  const types = new Map((d.models ?? []).map((m) => [m.id, m]))
  const names = new Set<string>()
  for (const r of rows) {
    const m = types.get(r.modelId)
    if (!m || r.count <= 0) continue
    m.fixed.forEach((x) => names.add(norm(x)))
    const opts = new Map(m.choices.flatMap((c) => c.options).map((o) => [o.id, o.name]))
    r.picks.forEach((id) => opts.has(id) && names.add(norm(opts.get(id)!)))
  }
  const kept = all.filter((w) => {
    const n = norm(w.name)
    return [...names].some((x) => n === x || n.startsWith(`${x} `))
  })
  return kept.length ? kept : all
}

/** Cards for a list, one per unit type in list order; unknown units are skipped. */
export function unitCards(list: ArmyList, cat: Catalogue, linkedTo: (e: ListEntry) => OwnedUnit[]): UnitCard[] {
  const sheets = new Map(cat.datasheets.map((d) => [d.id, d]))
  const rules = new Map((cat.rules ?? []).map((r) => [r.id, r.name]))
  const enh = new Map((cat.enhancements ?? []).map((x) => [x.id, x]))
  const cards = new Map<string, UnitCard & { carried: Set<WeaponProfile> }>()
  for (const e of list.entries) {
    const d = sheets.get(e.datasheetId)
    if (!d) continue
    const card = cards.get(d.id) ?? {
      datasheet: d,
      entries: [],
      weapons: [],
      carried: new Set<WeaponProfile>(),
      abilities: d.abilities.map((name) => ({ name, text: d.abilityTexts?.[name] })),
      rules: (d.ruleIds ?? []).map((id) => rules.get(id)).filter((x): x is string => !!x),
    }
    let points: number | undefined
    try {
      points = pointsFor(d, e.models)
    } catch {
      points = undefined
    }
    const x = enh.get(e.enhancementId ?? '')
    card.entries.push({ models: e.models, points, ...(e.warlord ? { warlord: true } : {}), ...(x ? { enhancement: { name: x.name, points: x.points } } : {}) })
    carriedWeapons(d, effectiveLoadout(e, d, linkedTo(e)).rows).forEach((w) => card.carried.add(w))
    cards.set(d.id, card)
  }
  return [...cards.values()].map(({ carried, ...c }) => ({ ...c, weapons: (c.datasheet.weapons ?? []).filter((w) => carried.has(w)) }))
}
