import type { Datasheet, Gear, UpgradeSection, WeaponProfile } from '../catalogue/types'
import type { ListEntry } from './types'

/**
 * Unit-level upgrades (One Page Rules). A list entry records how many times it took each option; the points and the
 * unit's resulting gear follow from that. Problems are reported, never enforced, like every other list check.
 */

export type Picks = Record<string, number>

export const pickKey = (sectionId: string, optionId: string): string => `${sectionId}/${optionId}`

const countOf = (picks: Picks, s: UpgradeSection, optionId: string) => picks[pickKey(s.id, optionId)] ?? 0

/**
 * How often a unit of `size` models can use a section: `perOption` times the same option, `total` times altogether.
 * "any" is bounded by the models in the unit, or for replacements by the weapons there are to replace.
 */
export function sectionLimits(s: UpgradeSection, size: number): { perOption: number; total: number } {
  const replace = s.variant === 'replace'
  const perOption = s.affects?.type === 'any' ? (replace ? Infinity : size) : s.affects?.type === 'exactly' || s.affects?.type === 'upTo' ? (s.affects.value ?? 1) : 1
  if (s.select?.type === 'exactly' || s.select?.type === 'upTo') {
    const n = s.select.value ?? 1
    // "Up to three models with one each": the choice is per model.
    return { perOption, total: n * perOption }
  }
  // A replacement without a choice rule gives its models one pool to share between the options.
  return { perOption, total: replace && !s.select ? perOption : Infinity }
}

export function upgradePoints(d: Datasheet, e: Pick<ListEntry, 'upgrades'>): number {
  const picks = e.upgrades
  if (!picks) return 0
  return (d.upgrades ?? []).reduce((sum, s) => sum + s.options.reduce((n, o) => n + o.points * countOf(picks, s, o.id), 0), 0)
}

/** "4x Claws" → 4 of "Claws". */
function parseTarget(t: string): { need: number; name: string } {
  const m = t.match(/^(\d+)x\s+(.*)$/)
  return m ? { need: Number(m[1]), name: m[2] } : { need: 1, name: t }
}

/** The singular forms a name could have: targets are often plural ("Throwing Knife" / "Throwing Knives"). */
function forms(name: string): string[] {
  const n = name.toLowerCase().trim()
  return [n, n.replace(/s$/, ''), n.replace(/es$/, ''), n.replace(/ves$/, 'fe'), n.replace(/ves$/, 'f'), n.replace(/ies$/, 'y')]
}
const sameName = (a: string, b: string) => {
  const other = forms(b)
  return forms(a).some((x) => other.includes(x))
}

// A target can also be a weapon inside an item (the guns of a bike or mount).
const have = (gear: Gear[], name: string) =>
  gear.reduce((n, g) => n + (sameName(g.name, name) ? g.count : g.count * (g.contains ?? []).reduce((m, c) => m + (sameName(c.weapon.name, name) ? c.count : 0), 0)), 0)

function take(gear: Gear[], name: string, count: number) {
  let left = count
  for (const g of gear) {
    if (!left || !sameName(g.name, name)) continue
    const n = Math.min(left, g.count)
    g.count -= n
    left -= n
  }
  for (const g of gear) {
    if (!left || !g.contains || !g.count) continue
    g.contains = g.contains.flatMap((c) => {
      if (!sameName(c.weapon.name, name)) return [c]
      const n = Math.min(c.count, Math.ceil(left / g.count))
      left = Math.max(0, left - n * g.count)
      return c.count > n ? [{ ...c, count: c.count - n }] : []
    })
  }
}

function give(gear: Gear[], g: Gear, times: number) {
  const key = JSON.stringify({ ...g, count: 0 })
  const old = gear.find((x) => JSON.stringify({ ...x, count: 0 }) === key)
  if (old) old.count += g.count * times
  else gear.push({ ...g, count: g.count * times })
}

export interface UpgradedUnit {
  gear: Gear[]
  problems: string[]
}

/** The unit's gear after its picks, with what doesn't fit. */
export function applyUpgrades(d: Datasheet, picks: Picks = {}): UpgradedUnit {
  const gear: Gear[] = (d.gear ?? []).map((g) => ({ ...g }))
  const problems: string[] = []
  const size = d.minModels
  const known = new Set<string>()
  let pending: { s: UpgradeSection; o: UpgradeSection['options'][number]; times: number }[] = []

  for (const s of d.upgrades ?? []) {
    const { perOption, total } = sectionLimits(s, size)
    let used = 0
    for (const o of s.options) {
      known.add(pickKey(s.id, o.id))
      const times = countOf(picks, s, o.id)
      if (!times) continue
      used += times
      if (times > perOption) problems.push(`${d.name}: "${o.label}" can be taken at most ${perOption} times`)
      pending.push({ s, o, times })
    }
    if (used > total) problems.push(`${d.name}: "${s.label}" allows ${total}, ${used} taken`)
  }
  if (Object.entries(picks).some(([k, n]) => n > 0 && !known.has(k))) problems.push(`${d.name}: an upgrade is no longer in the catalogue`)

  // An upgrade can need gear that another one gives, so keep going while something applies.
  let progress = true
  while (progress && pending.length) {
    progress = false
    pending = pending.filter(({ s, o, times }) => {
      const targets = s.targets.map(parseTarget)
      // How many times the gear there allows it.
      const room = targets.length ? Math.min(...targets.map((t) => Math.floor(have(gear, t.name) / t.need))) : Infinity
      let applications = times
      if (s.variant === 'replace') {
        // "Replace all": one pick swaps every copy.
        if (s.affects?.type === 'all') applications = times * Math.max(1, room)
        if (room < applications) return true
        for (const t of targets) take(gear, t.name, t.need * applications)
      } else {
        if (room < 1) return true
        if (s.affects?.type === 'all') applications = times * size
      }
      for (const g of o.gains) give(gear, g, applications)
      progress = true
      return false
    })
  }
  for (const { s, o } of pending) problems.push(`${d.name}: "${o.label}" needs ${s.targets.join(' and ')}`)
  return { gear: gear.filter((g) => g.count > 0), problems }
}

/** Weapon profiles of a unit's gear, with how many of each it has. */
export function gearWeapons(gear: Gear[]): WeaponProfile[] {
  const out = new Map<string, { w: WeaponProfile; n: number }>()
  for (const g of gear) {
    for (const x of [...(g.weapon ? [{ weapon: g.weapon, count: 1 }] : []), ...(g.contains ?? [])]) {
      const key = JSON.stringify(x.weapon)
      const old = out.get(key) ?? { w: x.weapon, n: 0 }
      old.n += g.count * x.count
      out.set(key, old)
    }
  }
  return [...out.values()].map(({ w, n }) => ({ ...w, values: [['Count', String(n)], ...w.values] }))
}

/** Special rules that upgrades added: those on gained items and rules, minus the unit's own. */
export function gainedRules(d: Datasheet, gear: Gear[]): string[] {
  const own = new Set(d.abilities)
  return [...new Set(gear.flatMap((g) => g.rules ?? []))].filter((r) => !own.has(r))
}
